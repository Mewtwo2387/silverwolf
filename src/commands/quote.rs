use crate::{Context, Error};
use serde::Serialize;
use poise::serenity_prelude as serenity;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QuoteRequest {
    username: String,
    nickname: String,
    message: String,
    avatar_url: String,
    background_color: Option<String>,
    text_color: Option<String>,
    profile_color: Option<String>,
    font_style: Option<String>,
}

/// Create a beautiful quote image from a message
#[poise::command(slash_command)]
pub async fn quote(
    ctx: Context<'_>,
    #[description = "The user to quote"] user: serenity::User,
    #[description = "The message to quote"] message: String,
    #[description = "Background color (black/white)"] background_color: Option<String>,
    #[description = "Text hex color (e.g. #FF0000)"] text_color: Option<String>,
    #[description = "Profile color effect"] profile_color: Option<String>,
    #[description = "Font style"] font_style: Option<String>,
) -> Result<(), Error> {
    ctx.defer().await?;

    let nickname = user.name.clone(); // In a real scenario, we'd fetch the member nickname
    let avatar_url = user.face();

    let payload = QuoteRequest {
        username: user.name,
        nickname,
        message,
        avatar_url,
        background_color,
        text_color,
        profile_color,
        font_style,
    };

    let url = format!("{}/quote", ctx.data().canvas_worker_url);
    
    let response = ctx.data().http_client
        .post(&url)
        .json(&payload)
        .send()
        .await?;

    if !response.status().is_success() {
        let err_text = response.text().await?;
        ctx.say(format!("Canvas worker error: {}", err_text)).await?;
        return Ok(());
    }

    let bytes = response.bytes().await?;
    
    let attachment = serenity::CreateAttachment::bytes(bytes.to_vec(), "quote.png");
    
    ctx.send(poise::CreateReply::default()
        .attachment(attachment)
    ).await?;

    Ok(())
}
