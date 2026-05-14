use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use serde_json::Value;

/// Commands for managing AI chat sessions
#[poise::command(slash_command, subcommands("view", "new", "switch", "delete"))]
pub async fn ai(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// View all your AI chat sessions
#[poise::command(slash_command)]
async fn view(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    let sessions = ctx.data().db.get_all_user_ai_chat_sessions(&user_id).await?;

    if sessions.is_empty() {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x5865F2)
                .title("🤖 Your AI Chat Sessions")
                .description("You don't have any sessions yet. Mention an AI (e.g. `@grok`) to start one!"))
        ).await?;
        return Ok(());
    }

    let display_sessions = &sessions[..sessions.len().min(25)];
    let overflow = sessions.len() as i64 - display_sessions.len() as i64;

    let mut rows = Vec::new();
    for s in display_sessions {
        let session_id = s["sessionId"].as_i64().unwrap_or(0);
        let persona_name = s["personaName"].as_str().unwrap_or("Unknown");
        let title = s["title"].as_str().unwrap_or(persona_name);
        let active = if s["active"].as_i64() == Some(1) { "🟢 Active" } else { "⚫ Inactive" };
        let message_count = s["messageCount"].as_i64().unwrap_or(0);
        let message_label = if message_count == 1 { "message" } else { "messages" };
        
        // Simple date formatting (chrono)
        let created_at_str = s["createdAt"].as_str().unwrap_or("");
        let row = format!("**[{}]** {} · {} · {} {} · Created {}", 
            session_id, title, active, message_count, message_label, &created_at_str[..10]);
        rows.push(row);
    }

    let mut description = rows.join("\n");
    if overflow > 0 {
        description.push_str(&format!("\n\n*…and {} more session(s) not shown.*", overflow));
    }

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x5865F2)
            .title("🤖 Your AI Chat Sessions")
            .description(description)
            .footer(serenity::CreateEmbedFooter::new("Use /ai new, /ai switch, or /ai delete.")))
    ).await?;

    Ok(())
}

/// Start a new chat session for a specific AI
#[poise::command(slash_command)]
async fn new(
    ctx: Context<'_>,
    #[description = "The AI persona to start a new chat with"] 
    #[autocomplete = "autocomplete_persona"]
    ai: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    let session = ctx.data().db.start_new_ai_chat_session(&user_id, &ai).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x57F287)
            .title("New Session Started")
            .description(format!(
                "Started a new **{}** chat session: **#{}**.\n\
                 Mentioning `@` followed by the persona name will now continue this new conversation.",
                ai, session.session_id
            )))
    ).await?;

    Ok(())
}

/// Switch to a previous AI chat session by its ID
#[poise::command(slash_command)]
async fn switch(
    ctx: Context<'_>,
    #[description = "The session ID to switch to (visible in /ai view)"]
    session_id: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    let session = ctx.data().db.switch_ai_chat_session(&user_id, session_id).await?;

    match session {
        Some(s) => {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0x57F287)
                    .title("✅ Session Switched")
                    .description(format!(
                        "Switched to session **#{}** ({}).\n\
                         Mentioning `@` followed by the persona name will now continue from this conversation.",
                        session_id, s.persona_name
                    )))
            ).await?;
        }
        None => {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xED4245)
                    .title("❌ Session Not Found")
                    .description(format!("No session with ID **{}** exists or you don't own it.", session_id)))
            ).await?;
        }
    }

    Ok(())
}

/// Permanently delete one of your AI chat sessions
#[poise::command(slash_command)]
async fn delete(
    ctx: Context<'_>,
    #[description = "The session ID to delete (visible in /ai view)"]
    session_id: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    let deleted = ctx.data().db.delete_ai_chat_session(&user_id, session_id).await?;

    if deleted {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x57F287)
                .title("🗑️ Session Deleted")
                .description(format!("Session **#{}** and all its history have been permanently deleted.", session_id)))
        ).await?;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xED4245)
                .title("❌ Delete Failed")
                .description(format!("No session with ID **{}** exists or you don't own it.", session_id)))
        ).await?;
    }

    Ok(())
}

async fn autocomplete_persona(_ctx: Context<'_>, partial: &str) -> Vec<String> {
    let personas_json = std::fs::read_to_string("data/aiPersonas.json").unwrap_or_default();
    let data: Value = serde_json::from_str(&personas_json).unwrap_or_default();
    let personas = data["personas"].as_array().cloned().unwrap_or_default();
    
    personas.into_iter()
        .filter_map(|p| p["name"].as_str().map(|s| s.to_string()))
        .filter(|name| name.to_lowercase().contains(&partial.to_lowercase()))
        .take(25)
        .collect()
}
