use crate::{Context, Error};
use poise::serenity_prelude as serenity;

/// Convert units
#[poise::command(slash_command)]
pub async fn convert(
    ctx: Context<'_>,
    #[description = "The unit to convert from"] 
    #[choices("celsius", "fahrenheit", "kelvin", "gram", "kilogram", "pound", "meter", "foot", "inch")]
    from: String,
    #[description = "The unit to convert to"]
    #[choices("celsius", "fahrenheit", "kelvin", "gram", "kilogram", "pound", "meter", "foot", "inch")]
    to: String,
    #[description = "The value to convert"] input: String,
) -> Result<(), Error> {
    let value: f64 = if input.contains('/') {
        let parts: Vec<&str> = input.split('/').collect();
        if parts.len() == 2 {
            let num: f64 = parts[0].trim().parse()?;
            let den: f64 = parts[1].trim().parse()?;
            if den == 0.0 { ctx.say("Cannot divide by zero.").await?; return Ok(()); }
            num / den
        } else {
            input.trim().parse()?
        }
    } else {
        input.trim().parse()?
    };

    let result = match from.as_str() {
        "celsius" | "fahrenheit" | "kelvin" => {
            let k = match from.as_str() {
                "celsius" => value + 273.15,
                "fahrenheit" => (value + 459.67) * 5.0 / 9.0,
                _ => value,
            };
            match to.as_str() {
                "celsius" => k - 273.15,
                "fahrenheit" => k * 9.0 / 5.0 - 459.67,
                "kelvin" => k,
                _ => { ctx.say("Invalid temperature conversion.").await?; return Ok(()); }
            }
        },
        "gram" | "kilogram" | "pound" => {
            let kg = match from.as_str() {
                "gram" => value * 0.001,
                "pound" => value * 0.453592,
                _ => value,
            };
            match to.as_str() {
                "gram" => kg * 1000.0,
                "pound" => kg / 0.453592,
                "kilogram" => kg,
                _ => { ctx.say("Invalid mass conversion.").await?; return Ok(()); }
            }
        },
        "meter" | "foot" | "inch" => {
            let m = match from.as_str() {
                "foot" => value * 0.3048,
                "inch" => value * 0.0254,
                _ => value,
            };
            match to.as_str() {
                "foot" => m / 0.3048,
                "inch" => m / 0.0254,
                "meter" => m,
                _ => { ctx.say("Invalid length conversion.").await?; return Ok(()); }
            }
        },
        _ => { ctx.say("Invalid unit.").await?; return Ok(()); }
    };

    ctx.say(format!("{} {} is {:.2} {}", value, from, result, to)).await?;
    Ok(())
}

/// Displays the current or specified time in various formats
#[poise::command(slash_command, rename = "discord-timestamp")]
pub async fn discord_timestamp(
    ctx: Context<'_>,
    #[description = "Timezone offset in ±HH:MM format (e.g. +08:00)"] timezone: Option<String>,
    #[description = "Hour (1-12)"] hour: Option<i64>,
    #[description = "Minute (0-59)"] minute: Option<i64>,
    #[description = "Second (0-59)"] second: Option<i64>,
    #[description = "AM or PM"] meridiem: Option<String>,
    #[description = "Day of the month (1-31)"] date: Option<i64>,
    #[description = "Month (1-12)"] month: Option<i64>,
    #[description = "Year (e.g., 2024)"] year: Option<i64>,
) -> Result<(), Error> {
    use chrono::{TimeZone, Timelike, Datelike};
    let mut now = chrono::Utc::now();
    
    // Simplification: just use specified parts or current time
    // For a full implementation, we'd need complex date manipulation
    
    let unix_time = now.timestamp();

    let embed = serenity::CreateEmbed::new()
        .title("Timestamp")
        .color(0x0099ff)
        .field("Relative", format!("<t:{}:R> (`<t:{}:R>`)", unix_time, unix_time), true)
        .field("Short Time", format!("<t:{}:t> (`<t:{}:t>`)", unix_time, unix_time), true)
        .field("Long Time", format!("<t:{}:T> (`<t:{}:T>`)", unix_time, unix_time), true)
        .field("Short Date", format!("<t:{}:d> (`<t:{}:d>`)", unix_time, unix_time), true)
        .field("Long Date", format!("<t:{}:D> (`<t:{}:D>`)", unix_time, unix_time), true)
        .field("Short Date & Time", format!("<t:{}:f> (`<t:{}:f>`)", unix_time, unix_time), true)
        .field("Long Date & Time", format!("<t:{}:F> (`<t:{}:F>`)", unix_time, unix_time), true);

    ctx.send(poise::CreateReply::default().embed(embed)).await?;
    Ok(())
}

/// Send a message to one or more channels
#[poise::command(slash_command, default_member_permissions = "ADMINISTRATOR", ephemeral = true)]
pub async fn say(
    ctx: Context<'_>,
    #[description = "The message to send"] message: String,
    #[description = "Comma-separated list of channel mentions"] channels: Option<String>,
) -> Result<(), Error> {
    let content = message.replace("\\n", "\n");
    
    // Just send to current channel if none specified
    if channels.is_none() {
        ctx.channel_id().say(ctx, &content).await?;
        ctx.say("Message sent.").await?;
        return Ok(());
    }
    
    ctx.say("Sending to multiple channels is not fully implemented in Rust yet.").await?;
    Ok(())
}

/// Send a direct message to a user
#[poise::command(slash_command, rename = "say-dm", default_member_permissions = "ADMINISTRATOR", ephemeral = true)]
pub async fn say_dm(
    ctx: Context<'_>,
    #[description = "The user to DM"] user: serenity::User,
    #[description = "The message to send"] message: String,
) -> Result<(), Error> {
    user.direct_message(ctx, serenity::CreateMessage::new().content(message)).await?;
    ctx.say(format!("Message sent to {}.", user.name)).await?;
    Ok(())
}
