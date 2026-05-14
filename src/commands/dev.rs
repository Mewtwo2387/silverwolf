use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use std::path::Path;
use tokio::fs;

#[poise::command(slash_command, subcommands("dbdump", "logdump", "add", "set", "force_automation", "force_claim", "force_summon", "test_summon", "ram_stats", "blacklist"), default_member_permissions = "ADMINISTRATOR")]
pub async fn dev(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

#[poise::command(slash_command, subcommands("configure", "view"))]
pub async fn blacklist(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Add or remove a command from the blacklist for a specific server
#[poise::command(slash_command)]
pub async fn configure(
    ctx: Context<'_>,
    #[description = "The name of the command"] command: String,
    #[description = "The ID of the server"] server: String,
    #[description = "The action to perform"] 
    #[choices("add", "remove")]
    action: String,
    #[description = "Reason for blacklisting"] reason: Option<String>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let cmd_name = command.to_lowercase().replace(' ', ".");
    
    if action == "add" {
        let reason_str = reason.unwrap_or_else(|| "No reason provided".to_string());
        ctx.data().db.add_or_update_command_blacklist(&cmd_name, &server, &reason_str).await?;
        
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("Command Blacklisted")
                .description(format!("Command: **{}** has been blacklisted in server: **{}**.", cmd_name, server))
                .field("Reason", reason_str, false)
        )).await?;
    } else {
        let res = ctx.data().db.delete_command_blacklist(&cmd_name, &server).await?;
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0x00FF00)
                .title("Command Blacklist Updated")
                .description(res)
        )).await?;
    }
    
    Ok(())
}

/// Retrieve blacklisted commands for a specific server
#[poise::command(slash_command)]
pub async fn view(
    ctx: Context<'_>,
    #[description = "The ID of the server"] server: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let blacklisted = ctx.data().db.get_blacklisted_commands(&server).await?;
    
    if blacklisted.is_empty() {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title("No Blacklisted Commands")
                .description(format!("There are no blacklisted commands for server: **{}**.", server))
        )).await?;
        return Ok(());
    }

    let mut description = String::new();
    for (i, cmd) in blacklisted.iter().enumerate() {
        description.push_str(&format!("**{}. Command**: {}\n**Reason**: {}\n**Date Disabled**: {}\n\n", 
            i + 1, 
            cmd["commandName"].as_str().unwrap_or(""), 
            cmd["reason"].as_str().unwrap_or("No reason provided"),
            cmd["disabled_date"].as_str().unwrap_or("")
        ));
    }

    ctx.send(poise::CreateReply::default().embed(
        serenity::CreateEmbed::new()
            .color(0xFF0000)
            .title(format!("Blacklisted Commands for Server: {}", server))
            .description(description)
    )).await?;

    Ok(())
}

...

/// claim dinonuggies ignoring cooldown
#[poise::command(slash_command)]
pub async fn force_claim(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    
    let reward = crate::commands::claim::get_reward(&ctx, &user_id, user.dinonuggies_claim_streak).await?;
    ctx.data().db.claim_nuggies(&user_id, reward.amount as f64, false).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .thumbnail(&reward.thumbnail)
            .color(crate::utils::parse_hex(&reward.colour))
            .author(serenity::CreateEmbedAuthor::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa"))
            .title(&reward.title)
            .description(format!("(FORCE CLAIM) You now have {} dinonuggies. You are on a streak of {} days.", 
                crate::utils::format(user.dinonuggies + reward.amount as f64),
                user.dinonuggies_claim_streak + 1
            ))
            .image(&reward.image_url)
            .footer(serenity::CreateEmbedFooter::new(format!("dinonuggie | {}", reward.footer)).icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")))
    ).await?;

    Ok(())
}

/// force summon a pokemon
#[poise::command(slash_command)]
pub async fn force_summon(
    ctx: Context<'_>,
    #[description = "mode"] mode: Option<String>,
) -> Result<(), Error> {
    ctx.defer().await?;
    // Placeholder for when pokemon handlers are ported
    ctx.say(format!("Force summoning pokemon in mode: {} (placeholder)", mode.unwrap_or_else(|| "normal".to_string()))).await?;
    Ok(())
}

/// summon a pokemon at random intervals
#[poise::command(slash_command)]
pub async fn test_summon(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    ctx.say("Test summoning started (placeholder)").await?;
    Ok(())
}

/// show RAM usage breakdown for the bot process
#[poise::command(slash_command)]
pub async fn ram_stats(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    
    // Simple version using standard library or just basic placeholders
    // For a more complete version, we could use `sysinfo` crate if it was in Cargo.toml
    
    let embed = serenity::CreateEmbed::new()
        .color(0x5865F2)
        .title("RAM Stats — Silverwolf Process (Rust)")
        .description("Detailed RAM stats require `sysinfo` crate. Placeholder for now.")
        .field("Uptime", "Check /ping for uptime", true);

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}

struct DumpDefinition {
    choice_name: &'static str,
    value: &'static str,
    table_name: &'static str,
    file_name: &'static str,
    format_user_ids: &'static [&'static str],
}

const DUMP_DEFINITIONS: [DumpDefinition; 15] = [
    DumpDefinition { choice_name: "User Data", value: "user", table_name: "User", file_name: "User_Data.csv", format_user_ids: &["id"] },
    DumpDefinition { choice_name: "Pokemon Data", value: "pokemon", table_name: "Pokemon", file_name: "Pokemon_Data.csv", format_user_ids: &["user_id"] },
    DumpDefinition { choice_name: "Marriage Data", value: "marriage", table_name: "Marriage", file_name: "Marriage_Data.csv", format_user_ids: &["user1_id", "user2_id"] },
    DumpDefinition { choice_name: "Baby Data", value: "baby", table_name: "Baby", file_name: "Baby_Data.csv", format_user_ids: &["mother_id", "father_id"] },
    DumpDefinition { choice_name: "Command Config Data", value: "commandConfig", table_name: "CommandConfig", file_name: "Command_Config_Data.csv", format_user_ids: &[] },
    DumpDefinition { choice_name: "Server Roles Data", value: "serverRoles", table_name: "ServerRoles", file_name: "Server_Roles_Data.csv", format_user_ids: &[] },
    DumpDefinition { choice_name: "Chat History Data", value: "chatHistory", table_name: "ChatHistory", file_name: "Chat_History_Data.csv", format_user_ids: &[] },
    DumpDefinition { choice_name: "Chat Session Data", value: "chatSession", table_name: "ChatSession", file_name: "Chat_Session_Data.csv", format_user_ids: &["started_by"] },
    DumpDefinition { choice_name: "Global Config Data", value: "globalConfig", table_name: "GlobalConfig", file_name: "Global_Config_Data.csv", format_user_ids: &[] },
    DumpDefinition { choice_name: "Game UID Data", value: "gameUID", table_name: "GameUID", file_name: "Game_UID_Data.csv", format_user_ids: &["user_id"] },
    DumpDefinition { choice_name: "AI Chat History Data", value: "aiChatHistory", table_name: "AiChatHistory", file_name: "AI_Chat_History_Data.csv", format_user_ids: &[] },
    DumpDefinition { choice_name: "AI Chat Session Data", value: "aiChatSession", table_name: "AiChatSession", file_name: "AI_Chat_Session_Data.csv", format_user_ids: &["user_id"] },
    DumpDefinition { choice_name: "Birthday Reminder Data", value: "birthdayReminder", table_name: "BirthdayReminder", file_name: "Birthday_Reminder_Data.csv", format_user_ids: &["notifier_id", "tracked_user_id"] },
    DumpDefinition { choice_name: "Poop Entry Data", value: "poopEntry", table_name: "PoopEntry", file_name: "Poop_Entry_Data.csv", format_user_ids: &["user_id"] },
    DumpDefinition { choice_name: "Poop Profile Data", value: "poopProfile", table_name: "PoopProfile", file_name: "Poop_Profile_Data.csv", format_user_ids: &["user_id"] },
];

/// Output a specific database table or all tables.
#[poise::command(slash_command)]
pub async fn dbdump(
    ctx: Context<'_>,
    #[description = "Select the table to dump"]
    #[autocomplete = "autocomplete_table"]
    table: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let mut files_to_dump = Vec::new();
    let temp_dir = "temp_dumps";
    fs::create_dir_all(temp_dir).await?;

    let selected_definitions: Vec<&DumpDefinition> = if table == "all" {
        DUMP_DEFINITIONS.iter().collect()
    } else {
        DUMP_DEFINITIONS.iter().filter(|d| d.value == table).collect()
    };

    for def in selected_definitions {
        let table_data = ctx.data().db.dump_table(def.table_name, def.format_user_ids).await?;
        let file_path = format!("{}/{}", temp_dir, def.file_name);
        fs::write(&file_path, table_data).await?;
        files_to_dump.push(file_path);
    }

    if files_to_dump.is_empty() {
        ctx.say("No database dump files were generated.").await?;
    } else {
        for chunk in files_to_dump.chunks(10) {
            let mut attachments = Vec::new();
            for path in chunk {
                attachments.push(serenity::CreateAttachment::path(path).await?);
            }
            ctx.send(poise::CreateReply::default()
                .content("Database dump files:")
                .attachments(attachments)
            ).await?;
        }
    }

    // Also send the raw database file
    let db_path = "persistence/database.db";
    if Path::new(db_path).exists() {
        ctx.send(poise::CreateReply::default()
            .content("database:")
            .attachment(serenity::CreateAttachment::path(db_path).await?)
        ).await?;
    }

    // Cleanup
    let _ = fs::remove_dir_all(temp_dir).await;

    Ok(())
}

async fn autocomplete_table(_ctx: Context<'_>, _partial: &str) -> impl Iterator<Item = String> {
    let mut options: Vec<String> = DUMP_DEFINITIONS.iter().map(|d| d.value.to_string()).collect();
    options.push("all".to_string());
    options.into_iter()
}

/// dump the log files
#[poise::command(slash_command)]
pub async fn logdump(
    ctx: Context<'_>,
    #[description = "last n lines of the logs"] lines: i64,
    #[description = "the type of log to dump"] log_type: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    if lines < 1 {
        ctx.say("Invalid number of lines").await?;
        return Ok(());
    }

    // The TS version had logFilePath and logErrorFilePath in persistence/
    let file_path = if log_type == "error" {
        "persistence/logs_error.txt"
    } else {
        "persistence/logs.txt"
    };

    if !Path::new(file_path).exists() {
        ctx.say(format!("Log file {} not found.", file_path)).await?;
        return Ok(());
    }

    let log_content = fs::read_to_string(file_path).await?;
    let log_lines: Vec<&str> = log_content.lines().collect();
    let start = log_lines.len().saturating_sub(lines as usize);
    let selected_lines = &log_lines[start..];
    let content = selected_lines.join("\n");

    if content.len() > 1990 {
        let attachment = serenity::CreateAttachment::bytes(content.as_bytes().to_vec(), format!("{}.txt", log_type));
        ctx.send(poise::CreateReply::default().attachment(attachment)).await?;
    } else {
        ctx.say(format!("```\n{}\n```", content)).await?;
    }

    Ok(())
}

/// add something to a user
#[poise::command(slash_command)]
pub async fn add(
    ctx: Context<'_>,
    #[description = "the user to add something to"] user: serenity::User,
    #[description = "the thing to add"] attr: String,
    #[description = "the amount of something to add"] amount_str: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    
    let user_id = user.id.to_string();

    if attr == "dinonuggiesLastClaimed" {
        let now = chrono::Utc::now().timestamp_millis();
        let val = if amount_str == "-1d" {
            -86400000.0
        } else if amount_str == "-2d" {
            -172800000.0
        } else {
            crate::utils::anti_format(&amount_str)
        };

        if !val.is_nan() {
             ctx.data().db.add_user_attr(&user_id, &attr, val).await?;
             ctx.say(format!("Added {} to {} for {}", val, attr, user.name)).await?;
             return Ok(());
        }
    }

    let amount = crate::utils::anti_format(&amount_str);
    if amount.is_nan() {
        ctx.say("Invalid amount").await?;
        return Ok(());
    }

    ctx.data().db.add_user_attr(&user_id, &attr, amount).await?;
    
    ctx.say(format!("Added {} {} to {}", crate::utils::format(amount), attr, user.name)).await?;

    Ok(())
}

/// set data of a user
#[poise::command(slash_command)]
pub async fn set(
    ctx: Context<'_>,
    #[description = "the user to set something of"] user: serenity::User,
    #[description = "the thing to set"] attr: String,
    #[description = "the value to set"] value_str: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let amount = crate::utils::anti_format(&value_str);
    if amount.is_nan() {
        ctx.say("Invalid amount").await?;
        return Ok(());
    }

    ctx.data().db.set_user_attr(&user.id.to_string(), &attr, amount).await?;
    
    ctx.say(format!("Set {} {} to {}", crate::utils::format(amount), attr, user.name)).await?;

    Ok(())
}

/// force a baby task
#[poise::command(slash_command)]
pub async fn force_automation(
    ctx: Context<'_>,
    #[description = "the frequency of the automation"] frequency: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    
    // This requires babyScheduler to be implemented in Rust.
    // Since it's not yet, we might want to skip or add a placeholder.
    // Phase 2 covers Schedulers.
    
    match frequency.as_str() {
        "daily" => {
            // crate::scheduler::daily_automations(ctx.data().clone(), ctx.http().clone()).await;
            ctx.say("Daily automations forced (placeholder)").await?;
        },
        "ten_minutes" => {
            // crate::scheduler::ten_minute_automations(ctx.data().clone(), ctx.http().clone()).await;
            ctx.say("Ten minute automations forced (placeholder)").await?;
        },
        _ => {
            ctx.say("Invalid frequency").await?;
        }
    }

    Ok(())
}
