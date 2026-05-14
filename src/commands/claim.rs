use crate::{Context, Error, utils, upgrades};
use poise::serenity_prelude as serenity;
use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Skin {
    pub title: String,
    pub image_url: String,
    pub colour: String,
    pub footer: String,
    pub thumbnail: String,
}

pub struct RewardResult {
    pub amount: i64,
    pub title: String,
    pub image_url: String,
    pub colour: String,
    pub footer: String,
    pub thumbnail: String,
}

pub enum ClaimStatus {
    Cooldown { title: String, gif_url: String, hours_remaining: f64 },
    BrokenStreak { amount: i64, previous_dinonuggies: i64, previous_streak: i64 },
    Success { amount: i64, title: String, image_url: String, colour: String, footer: String, thumbnail: String, previous_dinonuggies: i64, previous_streak: i64 },
}

const BEKI_COOLDOWN_RESPONSES: [(&str, &str); 7] = [
    ("Beki is currently cooking the next batch of dinonuggies please wait", "https://c.tenor.com/i6sOwD66MAEAAAAC/tenor.gif"),
    ("Beki is having a little bit of an issue. Please hold", "https://c.tenor.com/h6XlgMwYBnkAAAAd/tenor.gif"),
    ("Ah shit i forgottt, hang on a momentt-", "https://c.tenor.com/TYW-RNzp6hEAAAAC/tenor.gif"),
    ("uhhh what is beki doing ?", "https://media.tenor.com/RYGLfSXNIRIAAAAi/frieren.gif"),
    ("Beki fucking dies of exhaustion", "https://c.tenor.com/kU_EwdsrkLkAAAAC/tenor.gif"),
    ("Beki Spins", "https://media.tenor.com/WKPXrrxUvEgAAAAi/frieren-kuru-kuru.gif"),
    ("Beki is trying out new hobbies", "https://c.tenor.com/_33fqJ2mxQUAAAAd/tenor.gif"),
];

pub async fn get_base_amount(ctx: &Context<'_>, user_id: &str, streak: i64) -> anyhow::Result<f64> {
    let user = ctx.data().db.get_user(user_id).await?;
    
    let marriage_benefits = ctx.data().db.get_marriage_benefits(user_id).await?;
    let pokemon_count = ctx.data().db.get_unique_pokemon_count(user_id).await?;

    let log2_credits = if user.credits > 1.0 { user.credits.log2() } else { 0.0 };
    let log2_nuggies = if user.dinonuggies > 1.0 { user.dinonuggies.log2() } else { 0.0 };

    let mut base = (5 + streak) as f64;
    base *= upgrades::get_nuggie_flat_multiplier(user.nuggie_flat_multiplier_level);
    base *= 1.0 + (streak as f64 * upgrades::get_nuggie_streak_multiplier(user.nuggie_streak_multiplier_level));
    base *= 1.0 + (log2_credits * upgrades::get_nuggie_credits_multiplier(user.nuggie_credits_multiplier_level));
    base *= 1.0 + (pokemon_count as f64 * upgrades::get_nuggie_poke_multiplier(user.nuggie_pokemon_multiplier_level));
    base *= 1.0 + (log2_nuggies * upgrades::get_nuggie_nuggie_multiplier(user.nuggie_nuggie_multiplier_level));
    base *= marriage_benefits;

    Ok(base)
}

pub async fn get_reward(ctx: &Context<'_>, user_id: &str, streak: i64) -> anyhow::Result<RewardResult> {
    let user = ctx.data().db.get_user(user_id).await?;
    let multiplier = upgrades::get_multiplier_amount(user.multiplier_amount_level);
    let chance = upgrades::get_multiplier_chance(user.multiplier_rarity_level);
    
    let (_rand_val, skin_key) = {
        let mut rng = rand::thread_rng();
        let val: f64 = rng.gen();
        let key = if val < chance.gold {
            "gold"
        } else if val < chance.gold + chance.silver {
            "silver"
        } else if val < chance.gold + chance.silver + chance.bronze {
            "bronze"
        } else {
            "regular"
        };
        (val, key)
    };

    let base_amount = get_base_amount(ctx, user_id, streak).await?;
    let mult_val = match skin_key {
        "gold" => multiplier.gold,
        "silver" => multiplier.silver,
        "bronze" => multiplier.bronze,
        _ => 1.0,
    };
    let amount = (base_amount * mult_val).ceil() as i64;

    let skin_data_str = std::fs::read_to_string("data/config/skin/claim.json")?;
    let skin_data: serde_json::Value = serde_json::from_str(&skin_data_str)?;
    
    let season = ctx.data().db.get_global_config("season").await?.unwrap_or_else(|| "normal".to_string());
    let resolved_season = if skin_data.get(&season).is_some() { &season } else { "normal" };
    
    let skin_obj = &skin_data[resolved_season][skin_key];
    
    let title = skin_obj["title"].as_str().unwrap_or("")
        .replace("{amount}", &utils::format(amount as f64))
        .replace("{multiplier}", &utils::format(mult_val));
    
    let footer = skin_obj["footer"].as_str().unwrap_or("")
        .replace("{gold}", &utils::format(chance.gold * 100.0))
        .replace("{silver}", &utils::format(chance.silver * 100.0))
        .replace("{bronze}", &utils::format(chance.bronze * 100.0))
        .replace("{goldMultiplier}", &utils::format(multiplier.gold))
        .replace("{silverMultiplier}", &utils::format(multiplier.silver))
        .replace("{bronzeMultiplier}", &utils::format(multiplier.bronze));

    Ok(RewardResult {
        amount,
        title,
        image_url: skin_obj["imageUrl"].as_str().unwrap_or("").to_string(),
        colour: skin_obj["colour"].as_str().unwrap_or("#FFFFFF").to_string(),
        footer,
        thumbnail: skin_obj["thumbnail"].as_str().unwrap_or("").to_string(),
    })
}

/// Claim your daily dinonuggies
#[poise::command(slash_command)]
pub async fn claim(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    let now = chrono::Utc::now().naive_utc();
    
    let cooldown_hours = upgrades::get_beki_cooldown(user.beki_level);
    
    if let Some(last_claimed) = user.dinonuggies_last_claimed {
        let diff = now.signed_duration_since(last_claimed);
        if diff.num_seconds() < (cooldown_hours * 3600.0) as i64 {
            let (t, g) = {
                let mut rng = rand::thread_rng();
                BEKI_COOLDOWN_RESPONSES[rng.gen_range(0..BEKI_COOLDOWN_RESPONSES.len())]
            };
            let hours_rem = cooldown_hours - (diff.num_seconds() as f64 / 3600.0);
            
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .title(t)
                    .thumbnail("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")
                    .description(format!("You can claim your next nuggie in {:.1} hours.", hours_rem))
                    .color(0xFF0000)
                    .image(g)
                    .author(serenity::CreateEmbedAuthor::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa"))
                    .footer(serenity::CreateEmbedFooter::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")))
            ).await?;
            return Ok(());
        }
        
        if diff.num_seconds() > (2 * 24 * 3600) {
            let base = get_base_amount(&ctx, &user_id, 0).await?;
            let amount = base.ceil() as i64;
            
            ctx.data().db.claim_nuggies(&user_id, amount as f64, true).await?;
            
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .thumbnail("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")
                    .title(format!("{} dinonuggies claimed!", utils::format(amount as f64)))
                    .description(format!("You now have {} dinonuggies. You broke your streak of {} days.", 
                        utils::format(user.dinonuggies + amount as f64),
                        user.dinonuggies_claim_streak
                    ))
                    .color(0x83F28F)
                    .image("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")
                    .author(serenity::CreateEmbedAuthor::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa"))
                    .footer(serenity::CreateEmbedFooter::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")))
            ).await?;
            return Ok(());
        }
    }

    let reward = get_reward(&ctx, &user_id, user.dinonuggies_claim_streak).await?;
    ctx.data().db.claim_nuggies(&user_id, reward.amount as f64, false).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .thumbnail(&reward.thumbnail)
            .color(utils::parse_hex(&reward.colour))
            .author(serenity::CreateEmbedAuthor::new("dinonuggie").icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa"))
            .title(&reward.title)
            .description(format!("You now have {} dinonuggies. You are on a streak of {} days.", 
                utils::format(user.dinonuggies + reward.amount as f64),
                user.dinonuggies_claim_streak + 1
            ))
            .image(&reward.image_url)
            .footer(serenity::CreateEmbedFooter::new(format!("dinonuggie | {}", reward.footer)).icon_url("https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa")))
    ).await?;

    Ok(())
}
