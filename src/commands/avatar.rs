use crate::{Context, Error};
use poise::serenity_prelude as serenity;

#[derive(poise::ChoiceParameter)]
pub enum AvatarType {
    #[name = "Global Avatar"]
    Global,
    #[name = "Server Avatar"]
    Server,
}

/// Displays the avatar of a user
#[poise::command(slash_command)]
pub async fn avatar(
    ctx: Context<'_>,
    #[description = "The user whose avatar you want to see"] user: Option<serenity::User>,
    #[description = "global or server avatar"] avatar_type: Option<AvatarType>,
) -> Result<(), Error> {
    let user = user.as_ref().unwrap_or(ctx.author());
    let avatar_type = avatar_type.unwrap_or(AvatarType::Global);

    let mut avatar_url = user.face();
    let mut title = format!("Global avatar of {}", user.name);

    if let AvatarType::Server = avatar_type {
        if let Some(guild_id) = ctx.guild_id() {
            if let Ok(member) = guild_id.member(ctx, user.id).await {
                if let Some(avatar) = member.avatar {
                    avatar_url = format!("https://cdn.discordapp.com/guilds/{}/users/{}/avatars/{}.png?size=4096", guild_id, user.id, avatar);
                    title = format!("Server Avatar of {}", user.name);
                } else {
                    title = format!("Global avatar of {} (no server avatar found)", user.name);
                }
            }
        }
    }

    let png_url = avatar_url.replace(".webp", ".png");
    let jpg_url = avatar_url.replace(".webp", ".jpg");

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x0099ff)
            .title(title)
            .image(&png_url))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new_link(&png_url).label("Download as PNG"),
            serenity::CreateButton::new_link(&jpg_url).label("Download as JPG"),
            serenity::CreateButton::new_link(&avatar_url).label("Download as WEBP"),
        ])])
    ).await?;

    Ok(())
}
