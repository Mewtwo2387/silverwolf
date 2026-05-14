use crate::{Context, Error};
use poise::serenity_prelude as serenity;

/// Ask the magic 8-ball a question
#[poise::command(slash_command)]
pub async fn eightball(
    ctx: Context<'_>,
    #[description = "The question you want to ask"] question: String,
) -> Result<(), Error> {
    let user_id = ctx.author().id.to_string();
    let combined = format!("{}{}", question, user_id);
    
    // Using MD5 for "savage" check
    let hash1 = md5::compute(&combined);
    let is_savage = hash1[0] % 2 == 0;
    
    // Load 8ball data (in a real app we'd load this once at startup)
    let data_str = std::fs::read_to_string("data/8ball.json")?;
    let data: serde_json::Value = serde_json::from_str(&data_str)?;
    
    let responses = if is_savage {
        data["savage"].as_array().unwrap()
    } else {
        data["normal"].as_array().unwrap()
    };
    
    // Use a hash for selection consistency
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    use std::hash::{Hash, Hasher};
    combined.hash(&mut hasher);
    let index = (hasher.finish() as usize) % responses.len();
    let answer = responses[index].as_str().unwrap();

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .title("Magic 8 Ball")
            .color(if is_savage { 0xff0000 } else { 0x00ffff })
            .description(format!("**{}**", question))
            .field("The magic 8 ball answers:", answer, true))
    ).await?;

    Ok(())
}
