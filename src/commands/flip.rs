use crate::{Context, Error};
use rand::Rng;
use poise::serenity_prelude as serenity;

/// 50/50 for silverwolf to give you head
#[poise::command(slash_command)]
pub async fn flip(ctx: Context<'_>) -> Result<(), Error> {
    let description = {
        let mut rng = rand::thread_rng();
        let val = rng.gen::<f64>();
        if val < 0.49 {
            "Silverwolf gave you head."
        } else if val < 0.98 {
            "Silverwolf gave you tail."
        } else {
            "Silverwolf gave you side."
        }
    };

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title("You flipped a coin.")
            .description(description))
    ).await?;

    Ok(())
}
