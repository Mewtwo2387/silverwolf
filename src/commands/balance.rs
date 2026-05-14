use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;

/// Check your mystic credits and bitcoin
#[poise::command(slash_command)]
pub async fn balance(
    ctx: Context<'_>,
    #[description = "member to check the balance of"] member: Option<serenity::User>,
) -> Result<(), Error> {
    let user = member.as_ref().unwrap_or(ctx.author());
    let is_self = user.id == ctx.author().id;

    let db_user = ctx.data().db.get_user(&user.id.to_string()).await?;

    let name = &user.name;
    
    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("{} have {} mystic credits, {} bitcoin, {} dinonuggies, and {} heavenly nuggies", 
                if is_self { "You" } else { name },
                utils::format(db_user.credits as f64),
                db_user.bitcoin,
                utils::format(db_user.dinonuggies as f64),
                utils::format(db_user.heavenly_nuggies as f64)
            ))
            .description(format!("Exact Credits: {}\nExact Nuggies: {}\nDinonuggies claim streak: {}", 
                utils::format(db_user.credits as f64),
                utils::format(db_user.dinonuggies as f64),
                db_user.dinonuggies_claim_streak
            ))
            .footer(serenity::CreateEmbedFooter::new("mommy mystic uwu")))
    ).await?;

    Ok(())
}
