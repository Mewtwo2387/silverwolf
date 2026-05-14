use crate::{Context, Error};
use poise::serenity_prelude as serenity;

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoopColour {
    #[name = "brown"] Brown,
    #[name = "dark-brown"] DarkBrown,
    #[name = "yellow"] Yellow,
    #[name = "green"] Green,
    #[name = "black"] Black,
    #[name = "red"] Red,
    #[name = "holy"] Holy,
}

impl PoopColour {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Brown => "brown",
            Self::DarkBrown => "dark-brown",
            Self::Yellow => "yellow",
            Self::Green => "green",
            Self::Black => "black",
            Self::Red => "red",
            Self::Holy => "holy",
        }
    }
}

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoopSize {
    #[name = "small"] Small,
    #[name = "medium"] Medium,
    #[name = "large"] Large,
    #[name = "omnipresent"] Omnipresent,
}

impl PoopSize {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Small => "small",
            Self::Medium => "medium",
            Self::Large => "large",
            Self::Omnipresent => "omnipresent",
        }
    }
}

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoopType {
    #[name = "liquid"] Liquid,
    #[name = "soft"] Soft,
    #[name = "normal"] Normal,
    #[name = "hard"] Hard,
    #[name = "pellet"] Pellet,
    #[name = "divine"] Divine,
}

impl PoopType {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Liquid => "liquid",
            Self::Soft => "soft",
            Self::Normal => "normal",
            Self::Hard => "hard",
            Self::Pellet => "pellet",
            Self::Divine => "divine",
        }
    }
}

/// Poop tracking system
#[poise::command(slash_command, subcommands("log", "stats", "gacha"))]
pub async fn poop_group(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Record a bathroom visit 💩
#[poise::command(slash_command)]
pub async fn log(
    ctx: Context<'_>,
    #[description = "The colour of your poop"] colour: Option<PoopColour>,
    #[description = "The size of your poop"] size: Option<PoopSize>,
    #[description = "The consistency of your poop"] r#type: Option<PoopType>,
    #[description = "How long you were on the throne (minutes)"]
    #[min = 1] #[max = 120]
    duration: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    ctx.data().db.log_poop(
        &user_id, 
        colour.map(|c| c.as_str()), 
        size.map(|s| s.as_str()), 
        r#type.map(|t| t.as_str()), 
        duration
    ).await?;
    
    let (count, _) = ctx.data().db.get_poop_stats(&user_id).await?;

    ctx.say(format!("flushed🚽! This is poop number **{}**, keep poopin'! 💩", count)).await?;

    Ok(())
}

/// See your poop stats
#[poise::command(slash_command)]
pub async fn stats(ctx: Context<'_>, #[description = "The user to check"] user: Option<serenity::User>) -> Result<(), Error> {
    ctx.defer().await?;
    let target = user.as_ref().unwrap_or(ctx.author());
    let user_id = target.id.to_string();

    let (count, last_logged) = ctx.data().db.get_poop_stats(&user_id).await?;

    let last_time = last_logged.map(|ts| format!("<t:{}:R>", ts)).unwrap_or_else(|| "Never".to_string());

    let embed = serenity::CreateEmbed::new()
        .title(format!("Poop Stats for {}", target.name))
        .field("Total Poops", count.to_string(), true)
        .field("Last Pooped", last_time, true)
        .color(0x8B4513);

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}

/// Pull a random poop... from the members...
#[poise::command(slash_command)]
pub async fn gacha(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let random_poop = ctx.data().db.get_random_poop().await?;

    if let Some(p) = random_poop {
        let embed = serenity::CreateEmbed::new()
            .title("💩 Poop Gacha Pull")
            .description(format!("Congratulations! You pulled <@{}>'s poop!", p.user_id))
            .color(0x8B4513)
            .field("👤 User", format!("<@{}>", p.user_id), true)
            .field("🎨 Colour", p.colour.unwrap_or_else(|| "Unknown".to_string()), true)
            .field("📏 Size", p.size.unwrap_or_else(|| "Unknown".to_string()), true)
            .field("🧪 Type", p.r#type.unwrap_or_else(|| "Unknown".to_string()), true)
            .field("⏱️ Duration", p.duration.map(|d| format!("{} min", d)).unwrap_or_else(|| "Unknown".to_string()), true)
            .field("🕒 Logged", format!("<t:{}:F>", p.logged_at), false);

        ctx.send(poise::CreateReply::default().embed(embed)).await?;
    } else {
        ctx.say("No poop entries found yet. Please use `/poop log` first.").await?;
    }

    Ok(())
}
