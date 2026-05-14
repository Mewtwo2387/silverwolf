use crate::{Context, Error};
use poise::serenity_prelude as serenity;

/// Gotta catch 'em all
#[poise::command(slash_command)]
pub async fn catch(
    ctx: Context<'_>,
    #[description = "the name of the uhh.. pokemon?"] pokemon_name: String,
) -> Result<(), Error> {
    let mut current_pokemon_lock = ctx.data().current_pokemon.lock().await;
    
    let caught_name = match &*current_pokemon_lock {
        Some(name) => name.clone(),
        None => {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .title("There's no pokemon to catch")
                    .color(0xFF0000))
            ).await?;
            return Ok(());
        }
    };

    if caught_name.to_lowercase() == pokemon_name.to_lowercase() {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .title(format!("You caught a wild {}!", caught_name))
                .description("Ummm congrats I guess?")
                .color(0x00FF00))
        ).await?;

        ctx.data().db.catch_pokemon(&ctx.author().id.to_string(), &caught_name).await?;
        *current_pokemon_lock = None;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .title("There's no pokemon with that name to catch")
                .color(0xFF0000))
        ).await?;
    }

    Ok(())
}
