use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use futures::StreamExt;

#[poise::command(slash_command, subcommands("time", "count"))]
pub async fn summary(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Summarize messages from the last n hours/minutes
#[poise::command(slash_command)]
pub async fn time(
    ctx: Context<'_>,
    #[description = "The number of hours"] hours: i64,
    #[description = "The number of minutes"] minutes: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let total_minutes = hours * 60 + minutes.unwrap_or(0);
    
    if total_minutes <= 0 {
        ctx.say("Invalid time range.").await?;
        return Ok(());
    }
    if total_minutes > 72 * 60 {
        ctx.say("Invalid time range. Maximum is 72 hours.").await?;
        return Ok(());
    }

    let time_limit = chrono::Utc::now() - chrono::Duration::minutes(total_minutes);
    let mut messages = Vec::new();
    let mut last_id = None;

    while messages.len() < 3000 {
        let mut builder = serenity::GetMessages::new().limit(100);
        if let Some(id) = last_id {
            builder = builder.before(id);
        }
        
        let fetched = ctx.channel_id().messages(ctx, builder).await?;
        if fetched.is_empty() { break; }
        
        last_id = Some(fetched.last().unwrap().id);
        
        let mut reached_limit = false;
        for msg in fetched {
            if msg.timestamp.unix_timestamp() >= time_limit.timestamp() {
                messages.push(msg);
            } else {
                reached_limit = true;
                break;
            }
        }
        if reached_limit { break; }
    }

    if messages.is_empty() {
        ctx.say("No messages found in the last specified time.").await?;
        return Ok(());
    }

    summarize_and_send(ctx, messages).await
}

/// Summarize the last n messages
#[poise::command(slash_command)]
pub async fn count(
    ctx: Context<'_>,
    #[description = "The number of past messages to summarize"] n: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    if n < 1 || n > 3000 {
        ctx.say("Invalid count. Please enter a number between 1 and 3000.").await?;
        return Ok(());
    }

    let messages = ctx.channel_id().messages(ctx, serenity::GetMessages::new().limit(n as u8)).await?;
    
    summarize_and_send(ctx, messages).await
}

async fn summarize_and_send(ctx: Context<'_>, messages: Vec<serenity::Message>) -> Result<(), Error> {
    let content = format!("Summarizing {} messages.\n\n{}", 
        messages.len(),
        messages.iter().rev().map(|m| format!("Message by {}: {}", m.author.name, m.content)).collect::<Vec<_>>().join("\n")
    );

    let persona = crate::ai::get_persona_by_name("Summarizer").await?
        .ok_or("Summarizer persona not configured.")?;

    let summary = crate::ai::generate_content(
        &ctx.data().http_client,
        &persona.provider,
        &persona.model,
        persona.system_prompt.as_deref().unwrap_or(""),
        &content
    ).await?;

    let chunks = split_for_embed(&summary, 4096);
    
    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .title(format!("Summary of {} messages", messages.len()))
            .description(&chunks[0]))
    ).await?;

    for chunk in chunks.iter().skip(1) {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new().description(chunk))
        ).await?;
    }

    Ok(())
}

fn split_for_embed(text: &str, max: usize) -> Vec<String> {
    if text.len() <= max { return vec![text.to_string()]; }
    let mut chunks = Vec::new();
    let mut remaining = text;
    while remaining.len() > max {
        let mut end = remaining[..max].rfind('\n').unwrap_or(0);
        if end == 0 { end = remaining[..max].rfind(' ').unwrap_or(max); }
        chunks.push(remaining[..end].to_string());
        remaining = &remaining[end..].trim_start();
    }
    if !remaining.is_empty() { chunks.push(remaining.to_string()); }
    chunks
}
