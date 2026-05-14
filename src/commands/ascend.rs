use crate::{Context, Error, utils, upgrades};
use poise::serenity_prelude as serenity;
use futures::StreamExt;

/// Ascend to reset stuff but get more stuff
#[poise::command(slash_command)]
pub async fn ascend(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    
    let current_max = upgrades::get_max_level(user.ascension_level);
    let all_maxed = user.multiplier_amount_level >= current_max && 
                    user.multiplier_rarity_level >= current_max && 
                    user.beki_level >= current_max;

    if user.dinonuggies < 500.0 {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xFFA500)
                .title("Cannot ascend")
                .description(format!("You need at least 500 dinonuggies to ascend. You have {} dinonuggies.", utils::format(user.dinonuggies)))
                .footer(serenity::CreateEmbedFooter::new("so no one ascends and complains they cant buy anything from it")))
        ).await?;
        return Ok(());
    }

    let next_max = upgrades::get_max_level(if all_maxed { user.ascension_level + 1 } else { user.ascension_level });

    let desc = format!(
        "Are you sure you want to ascend?\n\
        - Your dinonuggies ({}) will be converted to {} heavenly nuggies which can be used to buy better upgrades\n\
        - All your upgrades, credits, bitcoins, dinonuggies, and streak will reset\n\
        - If you ascend with all upgrades maxed, you will gain an ascension level, which increases the level cap by 10\n\n\
        Your current upgrades:\n\
        • Multiplier amount: {}/{}\n\
        • Multiplier rarity: {}/{}\n\
        • Beki cooldown: {}/{}\n\n\
        {}",
        utils::format(user.dinonuggies),
        utils::format(user.dinonuggies),
        user.multiplier_amount_level, current_max,
        user.multiplier_rarity_level, current_max,
        user.beki_level, current_max,
        if all_maxed {
            format!("Your ascension level will increase from {} to {} if you ascend now, allowing you to buy upgrades up to level {}", user.ascension_level, user.ascension_level + 1, next_max)
        } else {
            format!("Your ascension level will remain at {} as not all upgrades are maxed.", user.ascension_level)
        }
    );

    let ctx_id = ctx.id();
    let confirm_id = format!("{}confirm", ctx_id);
    let cancel_id = format!("{}cancel", ctx_id);

    let reply = ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0xFFA500)
            .title("Ascension Confirmation")
            .description(desc)
            .footer(serenity::CreateEmbedFooter::new("what even is this game now")))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&confirm_id).label("Confirm").style(serenity::ButtonStyle::Success),
            serenity::CreateButton::new(&cancel_id).label("Cancel").style(serenity::ButtonStyle::Danger),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(30))
        .stream();

    if let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("Not for you!").ephemeral(true)
            )).await?;
            return Ok(());
        }

        if mci.data.custom_id == confirm_id {
            let gained = user.dinonuggies;
            ctx.data().db.ascend_user(&user_id, all_maxed).await?;

            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .embed(serenity::CreateEmbed::new()
                        .color(0x00AA00)
                        .title("Ascension Successful!")
                        .description(format!(
                            "You have ascended!\n- Gained {} heavenly nuggies\n- All other stuff reset\n{}\n- New max level: {}",
                            utils::format(gained),
                            if all_maxed { format!("- Ascension level increased to {}", user.ascension_level + 1) } else { "- Ascension level remained the same".to_string() },
                            next_max
                        ))
                        .footer(serenity::CreateEmbedFooter::new("what even is this game now")))
                    .components(vec![])
            )).await?;
        } else {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .content("Ascension cancelled.")
                    .embeds(vec![])
                    .components(vec![])
            )).await?;
        }
    } else {
        ctx.send(poise::CreateReply::default()
            .content("Ascension timed out.")
            .components(vec![])
        ).await?;
    }

    Ok(())
}
