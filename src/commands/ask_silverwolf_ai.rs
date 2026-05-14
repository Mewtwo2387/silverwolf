use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use async_openai::{
    types::{ChatCompletionRequestSystemMessageArgs, ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs},
    Client,
};
use std::env;

/// Ask Silverwolf AI a question (powered by Gemini/OpenAI)
#[poise::command(slash_command)]
pub async fn ask_silverwolf_ai(
    ctx: Context<'_>,
    #[description = "The prompt"] prompt: String,
    #[description = "Reset the chat session"] reset: Option<bool>,
) -> Result<(), Error> {
    ctx.defer().await?;

    let user_id = ctx.author().id.to_string();
    let server_id = ctx.guild_id().map(|id| id.to_string()).unwrap_or_else(|| "dm".to_string());
    let username = &ctx.author().name;

    let session = if reset.unwrap_or(false) {
        ctx.data().db.start_chat_session(&user_id, &server_id).await?
    } else {
        match ctx.data().db.get_active_chat_session(&user_id, &server_id).await? {
            Some(s) => s,
            None => ctx.data().db.start_chat_session(&user_id, &server_id).await?,
        }
    };

    let history_rows = ctx.data().db.get_chat_history(session.session_id).await?;
    
    // Convert to OpenAI format (Gemini can be called via OpenAI-compatible endpoint or dedicated crate)
    // For now, using async-openai as it's standard.
    let api_key = env::var("GEMINI_API_KEY").expect("Missing GEMINI_API_KEY");
    let config = async_openai::config::OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base("https://generativelanguage.googleapis.com/v1beta/openai/");
    
    let client = Client::with_config(config);

    let system_instruction = std::fs::read_to_string("data/SilverwolfSystemPrompt.txt").unwrap_or_default();
    
    let mut messages = vec![
        ChatCompletionRequestSystemMessageArgs::default()
            .content(system_instruction)
            .build()?
            .into(),
    ];

    for entry in history_rows.into_iter().rev() {
        if entry.role == "user" {
            messages.push(ChatCompletionRequestUserMessageArgs::default().content(entry.message).build()?.into());
        } else {
            messages.push(ChatCompletionRequestUserMessageArgs::default().content(entry.message).build()?.into()); // Simplified
        }
    }

    messages.push(ChatCompletionRequestUserMessageArgs::default()
        .content(format!("{}: {}", username, prompt))
        .build()?
        .into());

    let request = CreateChatCompletionRequestArgs::default()
        .max_tokens(8192u16)
        .model("gemini-1.5-flash")
        .messages(messages)
        .build()?;

    let response = client.chat().create(request).await?;
    let response_text = response.choices[0].message.content.clone().unwrap_or_default();
    let processed_text = response_text.replace("(Trailblazer)", username);

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .title("Silverwolf Ai says:")
            .description(&processed_text)
            .color(0x0099ff)
            .footer(serenity::CreateEmbedFooter::new("Powered by ChatTGP")))
    ).await?;

    ctx.data().db.add_chat_history(session.session_id, "user", &format!("{}: {}", username, prompt)).await?;
    ctx.data().db.add_chat_history(session.session_id, "model", &processed_text).await?;

    Ok(())
}
