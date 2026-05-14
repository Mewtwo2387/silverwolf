use crate::{Context, Error};
use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize)]
struct MisfortuneData {
    misfortunes: Vec<String>,
}

/// munch virtual misfortune cookies
#[poise::command(slash_command)]
pub async fn misfortune(ctx: Context<'_>) -> Result<(), Error> {
    let data_str = std::fs::read_to_string("data/misfortune.json")?;
    let data: MisfortuneData = serde_json::from_str(&data_str)?;
    
    let index = {
        let mut rng = rand::thread_rng();
        rng.gen_range(0..data.misfortunes.len())
    };
    let misfortune = &data.misfortunes[index];

    ctx.say(format!("🥠☠Your misfortune : \"{}\"", misfortune)).await?;

    Ok(())
}
