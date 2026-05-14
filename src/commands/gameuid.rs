use crate::{Context, Error};
use poise::serenity_prelude as serenity;

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Game {
    #[name = "Minecraft"]
    Minecraft,
    #[name = "Genshin Impact"]
    GenshinImpact,
    #[name = "Honkai: Star Rail"]
    HonkaiStarRail,
    #[name = "Honkai Impact 3rd"]
    HonkaiImpact3rd,
    #[name = "Zenless Zone Zero"]
    ZenlessZoneZero,
    #[name = "Wuthering Waves"]
    WutheringWaves,
    #[name = "Valorant"]
    Valorant,
    #[name = "Fate/Grand Order"]
    FateGrandOrder,
    #[name = "Reverse: 1999"]
    Reverse1999,
    #[name = "Arknights"]
    Arknights,
    #[name = "Azur Lane"]
    AzurLane,
    #[name = "Punishing: Gray Raven"]
    PunishingGrayRaven,
    #[name = "Blue Archive"]
    BlueArchive,
}

impl Game {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Minecraft => "Minecraft",
            Self::GenshinImpact => "Genshin Impact",
            Self::HonkaiStarRail => "Honkai: Star Rail",
            Self::HonkaiImpact3rd => "Honkai Impact 3rd",
            Self::ZenlessZoneZero => "Zenless Zone Zero",
            Self::WutheringWaves => "Wuthering Waves",
            Self::Valorant => "Valorant",
            Self::FateGrandOrder => "Fate/Grand Order",
            Self::Reverse1999 => "Reverse: 1999",
            Self::Arknights => "Arknights",
            Self::AzurLane => "Azur Lane",
            Self::PunishingGrayRaven => "Punishing: Gray Raven",
            Self::BlueArchive => "Blue Archive",
        }
    }
}

/// Game UID management
#[poise::command(slash_command, subcommands("get", "set", "delete"))]
pub async fn gameuid(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Get all game UIDs for a user
#[poise::command(slash_command)]
async fn get(
    ctx: Context<'_>,
    #[description = "The user to get the game UIDs for"] user: serenity::User,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = user.id.to_string();

    let uids = ctx.data().db.get_all_game_uids(&user_id).await?;

    if uids.is_empty() {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title(format!("No game UIDs found for {}", user.name))
                .description("The specified user has not set any game UIDs."))
        ).await?;
        return Ok(());
    }

    let description = uids.iter().map(|g| {
        format!("**Game:** {}\n**UID:** {}\n**Region:** {}\n", g.game, g.game_uid, g.region.as_deref().unwrap_or("N/A"))
    }).collect::<Vec<_>>().join("\n");

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Game UIDs under {}:", user.name))
            .description(description))
    ).await?;

    Ok(())
}

/// Set a game UID for yourself
#[poise::command(slash_command)]
async fn set(
    ctx: Context<'_>,
    #[description = "The name of the game"]
    game: Game,
    #[description = "The game UID to set"] uid: String,
    #[description = "The region for the game UID"] region: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let game_str = game.as_str();

    ctx.data().db.set_game_uid(&user_id, game_str, &uid, Some(&region)).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Successfully set game UID for {}", ctx.author().name))
            .description(format!("Game: **{}**\nUID: **{}**\nRegion: **{}**", game_str, uid, region)))
    ).await?;

    Ok(())
}

/// Delete a game UID for yourself
#[poise::command(slash_command)]
async fn delete(
    ctx: Context<'_>,
    #[description = "The name of the game"]
    game: Game,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let game_str = game.as_str();

    let deleted = ctx.data().db.delete_game_uid(&user_id, game_str).await?;

    if deleted {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("Successfully deleted {} UID", game_str)))
        ).await?;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title(format!("Failed to delete {} UID", game_str))
                .description("You don't have a UID set for this game."))
        ).await?;
    }

    Ok(())
}
