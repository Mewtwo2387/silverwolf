use crate::{Context, Error};
use poise::serenity_prelude as serenity;

#[poise::command(slash_command, subcommands("register", "unregister"), default_member_permissions = "ADMINISTRATOR")]
pub async fn server(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Register this server for bot commands
#[poise::command(slash_command)]
pub async fn register(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let guild = ctx.guild().ok_or("This command must be used in a server.")?;
    let guild_id = guild.id.to_string();
    let guild_name = &guild.name;

    let added = ctx.data().db.append_unique_to_list("allowed_servers", &guild_id).await?;

    if !added {
        ctx.say(format!("Server **{}** (`{}`) is already registered.", guild_name, guild_id)).await?;
        return Ok(());
    }

    ctx.say(format!("Server **{}** (`{}`) registered. Re-registering commands...", guild_name, guild_id)).await?;

    // In poise, we can re-register commands globally or for this guild
    poise::builtins::register_in_guild(ctx.serenity_context(), &ctx.framework().options().commands, guild.id).await?;
    
    ctx.say(format!("Commands registered for **{}**.", guild_name)).await?;

    Ok(())
}

/// Unregister this server from bot commands
#[poise::command(slash_command)]
pub async fn unregister(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let guild = ctx.guild().ok_or("This command must be used in a server.")?;
    let guild_id = guild.id.to_string();
    let guild_name = &guild.name;

    let removed = ctx.data().db.remove_from_list("allowed_servers", &guild_id).await?;

    if !removed {
        ctx.say(format!("Server **{}** (`{}`) is not registered.", guild_name, guild_id)).await?;
        return Ok(());
    }

    // Clear guild-specific commands for this server
    guild.id.set_commands(ctx.serenity_context(), Vec::new()).await?;

    ctx.say(format!("Server **{}** (`{}`) unregistered and commands removed.", guild_name, guild_id)).await?;

    Ok(())
}

/// set server role
#[poise::command(slash_command, rename = "set-server-role", default_member_permissions = "ADMINISTRATOR")]
pub async fn set_server_role(
    ctx: Context<'_>,
    #[description = "the name of the role to set"] role_name: String,
    #[description = "the role to set"] role: serenity::Role,
) -> Result<(), Error> {
    ctx.defer().await?;
    let guild_id = ctx.guild_id().ok_or("This command must be used in a server.")?.to_string();

    ctx.data().db.set_server_role(&guild_id, &role_name, &role.id.to_string()).await?;

    let embed = serenity::CreateEmbed::new()
        .title("Server Role Set")
        .description(format!("The role {} has been set to {}.", role_name, role.name))
        .color(0x00FF00);

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}
