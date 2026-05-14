use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;


const PREGNANCY_DURATION: i64 = 7 * 24 * 60 * 60; // 1 week in seconds
const MURDER_COOLDOWN: i64 = 24 * 60 * 60; // 1 day in seconds

/// Baby commands
#[poise::command(slash_command, subcommands("get", "birth", "name", "murder"))]
pub async fn baby(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Get a list of babies from parents
#[poise::command(slash_command)]
pub async fn get(
    ctx: Context<'_>,
    #[description = "The parent of the baby (default: you)"] parent: Option<serenity::User>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let target_parent = parent.as_ref().unwrap_or(ctx.author());
    let babies = ctx.data().db.get_babies_by_parent(&target_parent.id.to_string()).await?;

    if babies.is_empty() {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("404 Baby Not Found"))
        ).await?;
        return Ok(());
    }

    let mut result = String::new();
    for baby in babies {
        result.push_str(&format!("**{}**\n", baby.name));
        result.push_str(&format!("ID: {}\n", baby.id));
        result.push_str(&format!("Status: {}\n", baby.status));
        
        if let Some(job) = &baby.job {
            match job.as_str() {
                "nuggieClaimer" => {
                    result.push_str(&format!("Nuggie Claimer - {} claims, {} nuggies claimed\n", baby.nuggie_claimer_claims, utils::format(baby.nuggie_claimer_claimed as f64)));
                }
                "gambler" => {
                    result.push_str(&format!("Gambler - {} games ({} wins, {} losses), {} net winnings ({} won, {} gambled)\n", 
                        baby.gambler_games, baby.gambler_wins, baby.gambler_losses,
                        utils::format((baby.gambler_credits_won - baby.gambler_credits_gambled) as f64),
                        utils::format(baby.gambler_credits_won as f64),
                        utils::format(baby.gambler_credits_gambled as f64)
                    ));
                }
                "pinger" => {
                    result.push_str(&format!("Pinger - {} pings\n", baby.pinger_pings));
                }
                _ => { result.push_str("No job\n"); }
            }
        } else {
            result.push_str("No job\n");
        }

        result.push_str(&format!("Level: Lv {}\n", baby.level));
        result.push_str(&format!("Mother: <@{}>\n", baby.mother_id));
        result.push_str(&format!("Father: <@{}>\n", baby.father_id));

        if baby.status == "unborn" {
            let now = chrono::Utc::now().naive_utc();
            let diff = now.signed_duration_since(baby.created).num_seconds();
            if diff > PREGNANCY_DURATION {
                result.push_str("Can give birth now! Use /baby birth!\n");
            } else {
                let rem_days = (PREGNANCY_DURATION - diff) as f64 / (24.0 * 3600.0);
                result.push_str(&format!("Can give birth in {} days!\n", utils::format_advanced(rem_days, true, 9.0)));
            }
        } else if let Some(born) = baby.born {
            result.push_str(&format!("Born: {}\n", born));
        }
        result.push_str("\n");
    }

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Babies of {}", target_parent.name))
            .description(result))
    ).await?;

    Ok(())
}

/// Give birth to your baby
#[poise::command(slash_command)]
pub async fn birth(
    ctx: Context<'_>,
    #[description = "The id of the baby"] id: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let baby = ctx.data().db.get_baby_by_id(id).await?;

    if let Some(baby) = baby {
        if baby.mother_id != user_id {
            if baby.father_id == user_id {
                ctx.send(poise::CreateReply::default()
                    .embed(serenity::CreateEmbed::new()
                        .color(0xFF0000)
                        .title("You are not the mother of this baby!")
                        .description("Fun fact: Only mothers can give birth."))
                ).await?;
            } else {
                ctx.send(poise::CreateReply::default()
                    .embed(serenity::CreateEmbed::new()
                        .color(0xFF0000)
                        .title("This is not your baby smh smh")
                        .footer(serenity::CreateEmbedFooter::new("Check your baby id with /baby get")))
                ).await?;
            }
            return Ok(());
        }

        if baby.status != "unborn" {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFF0000)
                    .title("Your baby is already born!"))
            ).await?;
            return Ok(());
        }

        let now = chrono::Utc::now().naive_utc();
        let diff = now.signed_duration_since(baby.created).num_seconds();

        if diff < PREGNANCY_DURATION {
            let rem_days = (PREGNANCY_DURATION - diff) as f64 / (24.0 * 3600.0);
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFF0000)
                    .title("Your baby is not ready to be born yet!")
                    .description(format!("Can give birth in {} days!", utils::format_advanced(rem_days, true, 9.0))))
            ).await?;
            return Ok(());
        }

        ctx.data().db.born_baby(id).await?;
        ctx.data().db.add_baby_attr(id, "level", 1).await?;

        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00FF00)
                .title("Congratulations!")
                .description(format!("**{}** has been born!", baby.name)))
        ).await?;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("Invalid baby id!")
                .footer(serenity::CreateEmbedFooter::new("Check your baby id with /baby get")))
        ).await?;
    }

    Ok(())
}

/// Name your baby
#[poise::command(slash_command)]
pub async fn name(
    ctx: Context<'_>,
    #[description = "The id of the baby"] id: i64,
    #[description = "The name of the baby"] name: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let baby = ctx.data().db.get_baby_by_id(id).await?;

    if let Some(baby) = baby {
        if baby.mother_id != user_id && baby.father_id != user_id {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFF0000)
                    .title("This is not your baby smh smh")
                    .footer(serenity::CreateEmbedFooter::new("Check your baby id with /baby get")))
            ).await?;
            return Ok(());
        }

        ctx.data().db.update_baby_attr(id, "name", &name).await?;

        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("Baby {} is now named {}!", id, name))
                .description(format!("Mother: <@{}>\nFather: <@{}>\nStatus: {}", baby.mother_id, baby.father_id, baby.status)))
        ).await?;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("Invalid baby id!")
                .footer(serenity::CreateEmbedFooter::new("Check your baby id with /baby get")))
        ).await?;
    }

    Ok(())
}

/// Kill a baby
#[poise::command(slash_command)]
pub async fn murder(
    ctx: Context<'_>,
    #[description = "The id of the baby"] id: i64,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let baby = ctx.data().db.get_baby_by_id(id).await?;
    let user = ctx.data().db.get_user(&user_id).await?;

    if let Some(baby) = baby {
        if baby.status == "unborn" {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFF0000)
                    .title("You can't murder an unborn baby!"))
            ).await?;
            return Ok(());
        }

        if baby.status == "dead" {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFF0000)
                    .title("You can't murder a dead baby!"))
            ).await?;
            return Ok(());
        }

        if let Some(last_murder) = user.last_murder {
            let now = chrono::Utc::now().naive_utc();
            let diff = now.signed_duration_since(last_murder).num_seconds();
            if diff < MURDER_COOLDOWN {
                let rem_hours = (MURDER_COOLDOWN - diff) as f64 / 3600.0;
                ctx.send(poise::CreateReply::default()
                    .embed(serenity::CreateEmbed::new()
                        .color(0xFF0000)
                        .title(format!("You can murder again in {} hours.", utils::format_advanced(rem_hours, true, 9.0))))
                ).await?;
                return Ok(());
            }
        }

        let success = {
            let mut rng = rand::thread_rng();
            rand::Rng::gen_bool(&mut rng, 0.5)
        };
        let now = chrono::Utc::now().naive_utc();

        if success {
            ctx.data().db.update_baby_attr(id, "status", "dead").await?;
            sqlx::query("UPDATE User SET last_murder = ?, murder_success = murder_success + 1 WHERE id = ?")
                .bind(now)
                .bind(&user_id)
                .execute(&ctx.data().db.pool)
                .await?;
            
            ctx.send(poise::CreateReply::default()
                .content(format!("You killed {}!\n<@{}> <@{}> look at this murderer", baby.name, baby.mother_id, baby.father_id))
            ).await?;
        } else {
            sqlx::query("UPDATE User SET last_murder = ?, murder_fail = murder_fail + 1, dinonuggies = 0, credits = 0 WHERE id = ?")
                .bind(now)
                .bind(&user_id)
                .execute(&ctx.data().db.pool)
                .await?;
            
            ctx.send(poise::CreateReply::default()
                .content(format!("You tried killing {}, but {} killed you instead! You lost {} dinonuggies and {} credits!\n<@{}> <@{}> look at this guy trying to murder your baby", 
                    baby.name, baby.name, utils::format(user.dinonuggies), utils::format(user.credits), baby.mother_id, baby.father_id))
            ).await?;
        }

    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("Invalid baby id!")
                .footer(serenity::CreateEmbedFooter::new("Check baby id with /baby get")))
        ).await?;
    }

    Ok(())
}
