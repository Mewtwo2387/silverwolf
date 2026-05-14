use crate::Data;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use chrono::{Utc, Datelike, Timelike};
use poise::serenity_prelude as serenity;
use tracing::{info, error};

pub async fn start_birthday_scheduler(data: Data, http: Arc<serenity::Http>) {
    let mut hourly = interval(Duration::from_secs(3600));
    let mut daily = interval(Duration::from_secs(86400));

    // Initial delay to align with the hour? 
    // For simplicity, we just run them periodically.

    tokio::spawn({
        let data = data.clone();
        let http = http.clone();
        async move {
            loop {
                hourly.tick().await;
                if let Err(e) = check_birthdays(&data, &http).await {
                    error!("Error in hourly birthday check: {:?}", e);
                }
            }
        }
    });

    tokio::spawn({
        let data = data.clone();
        let http = http.clone();
        async move {
            loop {
                daily.tick().await;
                if let Err(e) = check_birthday_reminders(&data, &http).await {
                    error!("Error in daily birthday reminder check: {:?}", e);
                }
            }
        }
    });
}

async fn check_birthdays(data: &Data, http: &serenity::Http) -> anyhow::Result<()> {
    let now = Utc::now();
    let today_hour = format!("{:02}-{:02}T{:02}", now.month(), now.day(), now.hour());
    info!("Checking for birthdays on {} (UTC)", today_hour);

    let birthdays = data.db.get_users_with_birthday(&today_hour).await?;
    if birthdays.is_empty() {
        info!("No birthdays this hour.");
        return Ok(());
    }

    info!("Users with birthdays this hour: {:?}", birthdays);

    let db_channels = data.db.get_global_config("birthday_channels").await?.unwrap_or_default();
    let channel_ids: Vec<&str> = db_channels.split(',').filter(|s| !s.is_empty()).collect();

    for channel_id_str in channel_ids {
        let channel_id = match channel_id_str.parse::<u64>() {
            Ok(id) => serenity::ChannelId::new(id),
            Err(_) => continue,
        };

        for user_id_str in &birthdays {
            let user_id = match user_id_str.parse::<u64>() {
                Ok(id) => serenity::UserId::new(id),
                Err(_) => continue,
            };

            let discord_user = http.get_user(user_id).await.ok();
            let username = discord_user.as_ref().map(|u| u.name.clone()).unwrap_or_else(|| format!("Unknown User ({})", user_id));
            let avatar_url = discord_user.as_ref().and_then(|u| u.avatar_url());

            let mut embed = serenity::CreateEmbed::new()
                .title("🎉 Birthday Alert! 🎉")
                .description(format!("Today is {}'s birthday! Let's all wish them a great day! 🥳", username))
                .color(0x00FF00);
            
            if let Some(url) = avatar_url {
                embed = embed.image(url);
            }

            let message = serenity::CreateMessage::new()
                .content(format!("<@{}>", user_id))
                .embed(embed);

            if let Err(e) = channel_id.send_message(http, message).await {
                error!("Failed to send birthday message to {}: {:?}", channel_id, e);
            }
        }
    }

    Ok(())
}

async fn check_birthday_reminders(data: &Data, http: &serenity::Http) -> anyhow::Result<()> {
    let now = Utc::now();
    let current_year = now.year() as i64;
    info!("Running daily birthday reminder check for year {}", current_year);

    let pending = data.db.get_pending_birthday_reminders(current_year).await?;
    info!("Found {} pending reminder(s) to evaluate", pending.len());

    for entry in pending {
        let notifier_id_str = entry["notifierId"].as_str().unwrap();
        let tracked_user_id_str = entry["trackedUserId"].as_str().unwrap();
        let days_before = entry["daysBefore"].as_i64().unwrap();
        
        use chrono::{NaiveDateTime, NaiveDate};
        let birthday_raw = entry["birthdays"].as_str().unwrap();
        // NaiveDateTime's default serialization to JSON is ISO 8601
        let birthday = NaiveDateTime::parse_from_str(birthday_raw, "%Y-%m-%dT%H:%M:%S").or_else(|_| {
            // Handle if there are milliseconds or other formats
            birthday_raw.parse::<NaiveDateTime>()
        }).unwrap();

        // Calculate next occurrence
        let mut next_birthday = NaiveDate::from_ymd_opt(now.year(), birthday.month(), birthday.day())
            .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
            .unwrap();
        
        if next_birthday < now.naive_utc() {
            next_birthday = NaiveDate::from_ymd_opt(now.year() + 1, birthday.month(), birthday.day())
                .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
                .unwrap();
        }

        let days_until = (next_birthday - now.naive_utc()).num_days();

        if days_until != days_before {
            continue;
        }

        let tracked_user = http.get_user(serenity::UserId::new(tracked_user_id_str.parse().unwrap())).await.ok();
        let tracked_name = tracked_user.as_ref().map(|u| u.name.clone()).unwrap_or_else(|| format!("Unknown User ({})", tracked_user_id_str));

        let notifier_id = serenity::UserId::new(notifier_id_str.parse().unwrap());
        let notifier = http.get_user(notifier_id).await.ok();

        if let Some(n) = notifier {
            let embed = serenity::CreateEmbed::new()
                .title("🎂 Birthday Reminder!")
                .description(format!(
                    "**{}**'s birthday is in **{} day(s)**!\nBe sure to ready a gift or a wish! 🎁",
                    tracked_name, days_before
                ))
                .color(0xFFAA00);

            if let Err(e) = n.direct_message(http, serenity::CreateMessage::new().embed(embed)).await {
                error!("Failed to DM birthday reminder to {}: {:?}", notifier_id, e);
            } else {
                data.db.mark_birthday_reminder_sent(notifier_id_str, tracked_user_id_str, current_year).await?;
            }
        }
    }

    Ok(())
}
