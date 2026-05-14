use crate::{Context, Error};
use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize)]
struct FortuneData {
    fortunes: Vec<String>,
}

/// munch virtual fortune cookies
#[poise::command(slash_command)]
pub async fn fortune(ctx: Context<'_>) -> Result<(), Error> {
    let data_str = std::fs::read_to_string("data/fortune.json")?;
    let data: FortuneData = serde_json::from_str(&data_str)?;
    
    let index = {
        let mut rng = rand::thread_rng();
        rng.gen_range(0..data.fortunes.len())
    };
    let fortune = &data.fortunes[index];

    ctx.say(format!("🥠 Your fortune: \"{}\"", fortune)).await?;

    Ok(())
}
