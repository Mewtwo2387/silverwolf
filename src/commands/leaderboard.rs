use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;
use futures::StreamExt;

pub enum BoardType {
    Attribute(&'static str),
    AllGambler,
    Poop(String),
}

pub struct BoardConfig {
    pub title: String,
    pub board_type: BoardType,
    pub counter: &'static str,
    pub none_message: &'static str,
}

async fn fetch_board_data(ctx: &Context<'_>, config: &BoardConfig, page: i64) -> anyhow::Result<(Vec<(String, f64)>, i64)> {
    let limit = 10;
    let offset = page * limit;
    
    match &config.board_type {
        BoardType::Attribute(attr) => {
            let data = ctx.data().db.get_everyone_attr(attr, limit, offset).await?;
            let count = ctx.data().db.get_everyone_attr_count(attr).await?;
            Ok((data, count))
        }
        BoardType::AllGambler => {
            let data = ctx.data().db.get_all_relative_net_winnings(limit, offset).await?;
            let count = ctx.data().db.get_all_relative_net_winnings_count().await?;
            Ok((data, count))
        }
        BoardType::Poop(period) => {
            let data = ctx.data().db.get_poop_leaderboard(period, limit, offset).await?;
            let count = ctx.data().db.get_poop_leaderboard_count(period).await?;
            Ok((data, count))
        }
    }
}

fn build_board_embed(config: &BoardConfig, data: &[(String, f64)], page: i64) -> serenity::CreateEmbed {
    let mut desc = String::new();
    for (i, (id, val)) in data.iter().enumerate() {
        desc.push_str(&format!("{}. <@{}>: {} {}\n", i as i64 + 1 + (page * 10), id, utils::format(*val), config.counter));
    }
    
    if desc.is_empty() {
        desc = config.none_message.to_string();
    }

    serenity::CreateEmbed::new()
        .title(&config.title)
        .description(desc)
        .footer(serenity::CreateEmbedFooter::new(format!("Page {}", page + 1)))
        .color(0x00AA00)
}

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Period {
    #[name = "all-time"] AllTime,
    #[name = "weekly"] Weekly,
    #[name = "monthly"] Monthly,
}

/// See who has pooped the most 💩
#[poise::command(slash_command)]
pub async fn poopboard(
    ctx: Context<'_>,
    #[description = "Time period for the leaderboard"]
    period: Option<Period>,
) -> Result<(), Error> {
    let period = period.unwrap_or(Period::AllTime);
    let (period_str, label) = match period {
        Period::Weekly => ("weekly", "This Week"),
        Period::Monthly => ("monthly", "This Month"),
        Period::AllTime => ("all-time", "All Time"),
    };

    run_leaderboard(ctx, BoardConfig {
        title: format!("Poop Leaderboard 💩 — {}", label),
        board_type: BoardType::Poop(period_str.to_string()),
        counter: "Poops",
        none_message: "No one has pooped yet... or have they? 🤔",
    }).await
}

async fn run_leaderboard(ctx: Context<'_>, config: BoardConfig) -> Result<(), Error> {
    ctx.defer().await?;
    let mut current_page = 0;
    
    let (data, total_count) = fetch_board_data(&ctx, &config, current_page).await?;
    let max_page = (total_count as f64 / 10.0).ceil() as i64 - 1;

    let ctx_id = ctx.id();
    let prev_id = format!("{}prev", ctx_id);
    let next_id = format!("{}next", ctx_id);

    let reply = ctx.send(poise::CreateReply::default()
        .embed(build_board_embed(&config, &data, current_page))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&prev_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(true),
            serenity::CreateButton::new(&next_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(current_page >= max_page),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("Not for you!").ephemeral(true)
            )).await?;
            continue;
        }

        if mci.data.custom_id == prev_id && current_page > 0 {
            current_page -= 1;
        } else if mci.data.custom_id == next_id && current_page < max_page {
            current_page += 1;
        }

        let (new_data, _) = fetch_board_data(&ctx, &config, current_page).await?;
        
        mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
            serenity::CreateInteractionResponseMessage::new()
                .embed(build_board_embed(&config, &new_data, current_page))
                .components(vec![serenity::CreateActionRow::Buttons(vec![
                    serenity::CreateButton::new(&prev_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(current_page == 0),
                    serenity::CreateButton::new(&next_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(current_page >= max_page),
                ])])
        )).await?;
    }

    Ok(())
}

/// dinonuggie leaderboard
#[poise::command(slash_command)]
pub async fn nuggieboard(ctx: Context<'_>) -> Result<(), Error> {
    run_leaderboard(ctx, BoardConfig {
        title: "Dinonuggie Leaderboard".to_string(),
        board_type: BoardType::Attribute("dinonuggies"),
        counter: "Nuggies",
        none_message: "No one has any nuggies yet!",
    }).await
}

/// gambler leaderboard
#[poise::command(slash_command)]
pub async fn gamblerboard(ctx: Context<'_>) -> Result<(), Error> {
    run_leaderboard(ctx, BoardConfig {
        title: "Gambler Leaderboard".to_string(),
        board_type: BoardType::AllGambler,
        counter: "Relative Winnings",
        none_message: "No one has gambled yet!",
    }).await
}

/// murder leaderboard
#[poise::command(slash_command)]
pub async fn murderboard(ctx: Context<'_>) -> Result<(), Error> {
    run_leaderboard(ctx, BoardConfig {
        title: "Murderer Leaderboard".to_string(),
        board_type: BoardType::Attribute("murder_success"),
        counter: "Kills",
        none_message: "No one has killed any babies yet! How wholesome.",
    }).await
}
