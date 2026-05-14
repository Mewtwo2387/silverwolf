use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use chrono::{Datelike, NaiveDate, Utc};

/// Birthday related commands
#[poise::command(slash_command, subcommands("set", "get", "notify", "unnotify", "channel"))]
pub async fn birthday(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

fn days_in_month(month: u32, year: i32) -> u32 {
    if month == 2 {
        if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
            29
        } else {
            28
        }
    } else if [4, 6, 9, 11].contains(&month) {
        30
    } else {
        31
    }
}

/// Sets your birthday
#[poise::command(slash_command)]
async fn set(
    ctx: Context<'_>,
    #[description = "Day of the month (1-31), or 0 to delete"] day: i64,
    #[description = "Month (1-12), or 0 to delete"] month: i64,
    #[description = "Year (e.g. 1990), or 0 to delete"] year: i64,
    #[description = "Timezone offset (e.g. +8, -5, +5.30). Defaults to UTC."] timezone: Option<String>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    if day == 0 && month == 0 && year == 0 {
        ctx.data().db.set_user_attr_birthday(&user_id, None).await?;
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .title("Birthday Deleted")
                .description("Your birthday entry has been removed.")
                .color(0xFF4444))
        ).await?;
        return Ok(());
    }

    let current_year = Utc::now().year();
    if year < 1900 || year > current_year as i64 {
        ctx.say(format!("Year must be between 1900 and {}.", current_year)).await?;
        return Ok(());
    }
    if month < 1 || month > 12 {
        ctx.say("Month must be between 1 and 12.").await?;
        return Ok(());
    }
    let max_day = days_in_month(month as u32, year as i32);
    if day < 1 || day > max_day as i64 {
        ctx.say(format!("Invalid day for the selected month/year.")).await?;
        return Ok(());
    }

    // Simple timezone parsing logic (manual for now to avoid complex crates)
    let _tz_str = timezone.unwrap_or_else(|| "+00:00".to_string());
    // For simplicity, we just store it as a NaiveDateTime in UTC if we can't parse perfectly,
    // but the TS code did: new Date(`${year}-${month}-${day}T00:00:00${timezone}`)
    // We'll just use 00:00:00 for now.
    
    let birthday = NaiveDate::from_ymd_opt(year as i32, month as u32, day as u32)
        .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
        .ok_or("Invalid date")?;

    ctx.data().db.set_user_attr_birthday(&user_id, Some(birthday)).await?;

    let month_names = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    let formatted_date = format!("{:02} {} {}", day, month_names[(month - 1) as usize], year);

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .title("Birthday Set!")
            .description(format!("Your birthday has been set to {}.", formatted_date))
            .color(0x00FF00))
    ).await?;

    Ok(())
}

/// Retrieve a user's birthday
#[poise::command(slash_command)]
async fn get(
    ctx: Context<'_>,
    #[description = "The user whose birthday you want to retrieve"] user: serenity::User,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = user.id.to_string();

    let birthday_data = ctx.data().db.get_user(&user_id).await?.birthdays;
    
    match birthday_data {
        Some(birthday) => {
            let now = Utc::now().naive_utc();
            
            let mut last_birthday = NaiveDate::from_ymd_opt(now.year(), birthday.month(), birthday.day())
                .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
                .unwrap_or(birthday);
            
            if last_birthday > now {
                last_birthday = NaiveDate::from_ymd_opt(now.year() - 1, birthday.month(), birthday.day())
                    .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
                    .unwrap_or(birthday);
            }
            
            let years_ago = now.year() - birthday.year() - if now < last_birthday { 1 } else { 0 };

            let mut next_birthday = NaiveDate::from_ymd_opt(now.year(), birthday.month(), birthday.day())
                .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
                .unwrap_or(birthday);
            
            if next_birthday < now {
                next_birthday = NaiveDate::from_ymd_opt(now.year() + 1, birthday.month(), birthday.day())
                    .and_then(|d: NaiveDate| d.and_hms_opt(0, 0, 0))
                    .unwrap_or(birthday);
            }
            
            let days_until_next = (next_birthday - now).num_days();

            let birthday_ts = birthday.and_utc().timestamp();
            let next_birthday_ts = next_birthday.and_utc().timestamp();

            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .title(format!("{}'s Birthday", user.name))
                    .color(0x00AAFF)
                    .field("Birthday", format!("<t:{}:D>", birthday_ts), true)
                    .field("Years Ago", format!("{} years ago", years_ago), true)
                    .field("Next Birthday", format!("In {} days (<t:{}:R>)", days_until_next, next_birthday_ts), true))
            ).await?;
        }
        None => {
            ctx.say(format!("{} has not set their birthday.", user.name)).await?;
        }
    }

    Ok(())
}

/// Get a DM reminder before someone's birthday
#[poise::command(slash_command)]
async fn notify(
    ctx: Context<'_>,
    #[description = "The user whose birthday you want to be reminded about"] user: serenity::User,
    #[description = "How many days in advance to remind you"] 
    #[choices(14, 7, 1)]
    days_before: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    let notifier_id = ctx.author().id.to_string();
    let tracked_user_id = user.id.to_string();

    let birthday_data = ctx.data().db.get_user(&tracked_user_id).await?.birthdays;
    if birthday_data.is_none() {
        ctx.say(format!("{} hasn't set their birthday yet.", user.name)).await?;
        return Ok(());
    }

    ctx.data().db.upsert_birthday_reminder(&notifier_id, &tracked_user_id, days_before).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .title("Reminder Set!")
            .description(format!("You will receive a DM **{} day(s)** before **{}**'s birthday.", days_before, user.name))
            .color(0x00AAFF))
    ).await?;

    Ok(())
}

/// Stop receiving DM reminders for someone's birthday
#[poise::command(slash_command)]
async fn unnotify(
    ctx: Context<'_>,
    #[description = "The user to stop receiving reminders for"] user: serenity::User,
) -> Result<(), Error> {
    ctx.defer().await?;
    let notifier_id = ctx.author().id.to_string();
    let tracked_user_id = user.id.to_string();

    let deleted = ctx.data().db.delete_birthday_reminder(&notifier_id, &tracked_user_id).await?;

    if deleted {
        ctx.say(format!("Stopped reminders for **{}**'s birthday.", user.name)).await?;
    } else {
        ctx.say(format!("You don't have a reminder set for **{}**.", user.name)).await?;
    }

    Ok(())
}

/// Set a channel for birthday announcements (Dev only)
#[poise::command(slash_command, owners_only)]
async fn channel(
    ctx: Context<'_>,
    #[description = "The channel to send birthday messages to"] channel: serenity::GuildChannel,
) -> Result<(), Error> {
    ctx.defer().await?;
    
    let existing = ctx.data().db.get_global_config("birthday_channels").await?.unwrap_or_default();
    let mut channels: Vec<&str> = existing.split(',').filter(|s| !s.is_empty()).collect();

    let channel_id_str = channel.id.to_string();
    if channels.contains(&channel_id_str.as_str()) {
        channels.retain(|&id| id != channel_id_str);
        ctx.data().db.set_global_config("birthday_channels", &channels.join(",")).await?;
        ctx.say(format!("Removed <#{}> from birthday channels.", channel.id)).await?;
    } else {
        let mut new_channels = channels.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        new_channels.push(channel_id_str);
        ctx.data().db.set_global_config("birthday_channels", &new_channels.join(",")).await?;
        ctx.say(format!("Added <#{}> as a birthday announcement channel.", channel.id)).await?;
    }

    Ok(())
}
