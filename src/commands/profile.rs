use crate::{Context, Error};
use poise::serenity_prelude as serenity;

/// Get Genshin Impact player data
#[poise::command(slash_command)]
pub async fn genshin_profile(
    ctx: Context<'_>,
    #[description = "The UID of the player"] uid: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let url = format!("https://enka.network/api/uid/{}/", uid);
    let response = ctx.data().http_client.get(&url)
        .header("User-Agent", "Silverwolf-bot/1.0")
        .send().await?;

    if !response.status().is_success() {
        ctx.say(format!("Failed to fetch data: HTTP status {}.", response.status())).await?;
        return Ok(());
    }

    let data: serde_json::Value = response.json().await?;
    let player_info = match data.get("playerInfo") {
        Some(info) => info,
        None => {
            ctx.say("No data found for the given UID.").await?;
            return Ok(());
        }
    };

    let nickname = player_info["nickname"].as_str().unwrap_or("Unknown");
    let level = player_info["level"].as_i64().unwrap_or(0);
    let world_level = player_info["worldLevel"].as_i64().unwrap_or(0);
    let signature = player_info["signature"].as_str().unwrap_or("No signature provided");
    let achievements = player_info["finishAchievementNum"].as_i64().unwrap_or(0);
    let abyss_floor = player_info["towerFloorIndex"].as_i64().unwrap_or(0);
    let abyss_level = player_info["towerLevelIndex"].as_i64().unwrap_or(0);

    let profile_picture_id = player_info["profilePicture"]["id"].as_i64().map(|id| id.to_string());
    let mut profile_picture_url = None;
    if let Some(id) = profile_picture_id {
        if let Some(icon_path) = ctx.data().genshin_pfps.get(&id).and_then(|v| v["IconPath"].as_str()) {
            profile_picture_url = Some(format!("https://enka.network{}", icon_path));
        }
    }

    let name_card_id = player_info["nameCardId"].as_i64().map(|id| id.to_string());
    let mut namecard_url = None;
    if let Some(id) = name_card_id {
        if let Some(icon_path) = ctx.data().genshin_namecards.get(&id).and_then(|v| v["Icon"].as_str()) {
            namecard_url = Some(format!("https://enka.network{}", icon_path));
        }
    }

    let mut embed = serenity::CreateEmbed::new()
        .color(0x00AA00)
        .title(format!("{}'s Genshin Profile", nickname))
        .description(format!(
            "**Level:** {}\n**World Level:** {}\n**Signature:** {}\n**Achievements:** {}\n**Spiral Abyss:** Floor {}, Level {}\n**Namecard ID:** {}",
            level, world_level, signature, achievements, abyss_floor, abyss_level, player_info["nameCardId"]
        ))
        .footer(serenity::CreateEmbedFooter::new(format!("UID: {} • Powered by enka.network", uid)))
        .timestamp(serenity::Timestamp::now());

    if let Some(url) = profile_picture_url {
        embed = embed.thumbnail(url);
    }
    if let Some(url) = namecard_url {
        embed = embed.image(url);
    }

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}

/// Get Honkai Star Rail player data
#[poise::command(slash_command)]
pub async fn hsr_profile(
    ctx: Context<'_>,
    #[description = "The UID of the player"] uid: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let url = format!("https://enka.network/api/hsr/uid/{}", uid);
    let response = ctx.data().http_client.get(&url)
        .header("User-Agent", "Silverwolf-bot/1.0")
        .send().await?;

    if !response.status().is_success() {
        ctx.say(format!("Failed to fetch data: HTTP status {}.", response.status())).await?;
        return Ok(());
    }

    let data: serde_json::Value = response.json().await?;
    let detail_info = match data.get("detailInfo") {
        Some(info) => info,
        None => {
            ctx.say("No data found for the given UID.").await?;
            return Ok(());
        }
    };

    let nickname = detail_info["nickname"].as_str().unwrap_or("Unknown");
    let level = detail_info["level"].as_i64().unwrap_or(0);
    let world_level = detail_info["worldLevel"].as_i64().unwrap_or(0);
    let signature = detail_info["signature"].as_str().unwrap_or("No signature provided");
    
    let record_info = &detail_info["recordInfo"];
    let achievement_count = record_info["achievementCount"].as_i64().unwrap_or(0);
    let avatar_count = record_info["avatarCount"].as_i64().unwrap_or(0);
    let equipment_count = record_info["equipmentCount"].as_i64().unwrap_or(0);
    let friend_count = detail_info["friendCount"].as_i64().unwrap_or(0);

    let head_icon_id = detail_info["headIcon"].as_i64().map(|id| id.to_string());
    let mut avatar_url = None;
    if let Some(id) = head_icon_id {
        if let Some(icon_path) = ctx.data().hsr_avatars.get(&id).and_then(|v| v["Icon"].as_str()) {
            avatar_url = Some(format!("https://enka.network/ui/hsr/{}", icon_path));
        }
    }

    let mut characters_on_display = Vec::new();
    if let Some(avatar_list) = detail_info["avatarDetailList"].as_array() {
        for character in avatar_list {
            let avatar_id = character["avatarId"].as_i64().map(|id| id.to_string()).unwrap_or_default();
            if let Some(char_info) = ctx.data().hsr_characters.get(&avatar_id) {
                let name_hash = char_info["AvatarName"]["Hash"].as_str().unwrap_or_default();
                let char_name = ctx.data().hsr_names["en"][name_hash].as_str().unwrap_or("Unknown Character");
                let rarity = char_info["Rarity"].as_i64().unwrap_or(0);
                
                let mut lightcone_name = "N/A".to_string();
                let mut equipment_level = "N/A".to_string();
                
                if let Some(equipment) = character.get("equipment") {
                    let equipment_tid = equipment["tid"].as_i64().map(|id| id.to_string()).unwrap_or_default();
                    if let Some(lc_info) = ctx.data().hsr_lc.get(&equipment_tid) {
                        let lc_name_hash = lc_info["EquipmentName"]["Hash"].as_str().unwrap_or_default();
                        lightcone_name = ctx.data().hsr_names["en"][lc_name_hash].as_str().unwrap_or("Unknown Lightcone").to_string();
                        equipment_level = equipment["level"].as_i64().map(|l| l.to_string()).unwrap_or_else(|| "N/A".to_string());
                    }
                }

                characters_on_display.push(format!(
                    "**{}**\nLvl: {} | {}⭐\nLightcone: {} | Lvl: {}\n",
                    char_name, character["level"], rarity, lightcone_name, equipment_level
                ));
            }
        }
    }

    let characters_display_string = characters_on_display.join("\n");

    let mut embed = serenity::CreateEmbed::new()
        .color(0x00AA00)
        .title(format!("{}'s Honkai Star Rail Profile", nickname))
        .description(format!(
            "**Level:** {}\n**World Level:** {}\n**Signature:** {}\n**Achievements:** {}\n**Avatar Count:** {}\n**Equipment Count:** {}\n**Friend Count:** {}",
            level, world_level, signature, achievement_count, avatar_count, equipment_count, friend_count
        ))
        .field("Characters on Display", if characters_display_string.is_empty() { "No characters found.".to_string() } else { characters_display_string }, false)
        .footer(serenity::CreateEmbedFooter::new(format!("UID: {} • Powered by enka.network", uid)))
        .timestamp(serenity::Timestamp::now());

    if let Some(url) = avatar_url {
        embed = embed.thumbnail(url);
    }

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}
