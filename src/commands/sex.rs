use crate::{Context, Error, SexSession};
use poise::serenity_prelude as serenity;
use rand::Rng;

/// Sex system commands
#[poise::command(slash_command, subcommands("start", "status", "thrust"))]
pub async fn sex_group(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Start a sex session with someone
#[poise::command(slash_command)]
pub async fn start(
    ctx: Context<'_>,
    #[description = "The user to fuck"] user: serenity::User,
) -> Result<(), Error> {
    if user.id == ctx.author().id {
        ctx.say("You can't fuck yourself! (well, you can, but not here)").await?;
        return Ok(());
    }

    if user.bot {
        ctx.say("Bots don't have genitals!").await?;
        return Ok(());
    }

    let mut sessions = ctx.data().sex_sessions.lock().await;
    
    if sessions.iter().any(|s| s.has_user(&ctx.author().id.to_string())) {
        ctx.say("You're already in a sex session!").await?;
        return Ok(());
    }
    
    if sessions.iter().any(|s| s.has_user(&user.id.to_string())) {
        ctx.say(format!("{} is already being fucked!", user.name)).await?;
        return Ok(());
    }

    sessions.push(SexSession {
        top: ctx.author().id.to_string(),
        bottom: user.id.to_string(),
        thrusts: 0,
    });

    ctx.send(poise::CreateReply::default().embed(
        serenity::CreateEmbed::new()
            .title("Sex session started!")
            .description(format!("<@{}> is now fucking <@{}>!", ctx.author().id, user.id))
            .color(0xFF69B4)
            .footer(serenity::CreateEmbedFooter::new("Use /sex thrust to... thrust"))
    )).await?;

    Ok(())
}

/// Check the status of your current sex session
#[poise::command(slash_command)]
pub async fn status(ctx: Context<'_>) -> Result<(), Error> {
    let sessions = ctx.data().sex_sessions.lock().await;
    let session = sessions.iter().find(|s| s.has_user(&ctx.author().id.to_string()));

    if let Some(s) = session {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .title("Sex Session Status")
                .description(format!("<@{}> is fucking <@{}>", s.top, s.bottom))
                .field("Thrusts", s.thrusts.to_string(), true)
                .color(0xFF69B4)
        )).await?;
    } else {
        ctx.say("You're not fucking anyone!").await?;
    }

    Ok(())
}

/// In... and out
#[poise::command(slash_command)]
pub async fn thrust(ctx: Context<'_>) -> Result<(), Error> {
    let mut sessions = ctx.data().sex_sessions.lock().await;
    let user_id = ctx.author().id.to_string();
    
    let index = sessions.iter().position(|s| s.has_user(&user_id));

    if let Some(idx) = index {
        let (thrusts, other_user, ejaculated, response) = {
            let session = &mut sessions[idx];
            session.thrusts += 1;
            
            let mut rng = rand::thread_rng();
            if rng.gen_bool(0.03) {
                (session.thrusts, session.other_user(&user_id), true, None)
            } else {
                let responses = [
                    "Mwwaahhhh!", "More...", "Please don't stop...", "Deeper...", "Faster...", "Harder...", "Please~ More~",
                ];
                (session.thrusts, session.other_user(&user_id), false, Some(responses[rng.gen_range(0..responses.len())]))
            }
        };

        if ejaculated {
            let footer = {
                let mut rng = rand::thread_rng();
                if thrusts < 30 {
                    if rng.gen_bool(0.5) { "so quick smh" } else { "that was fast" }
                } else if thrusts < 60 {
                    "mmmwwahhh"
                } else if thrusts < 100 {
                    "woah, you lasted quite a while"
                } else {
                    "holy shit, you lasted forever"
                }
            };

            let embed = serenity::CreateEmbed::new()
                .color(0x00FF00)
                .title("You ejaculated!")
                .description(format!("Total thrusts: {}", thrusts))
                .footer(serenity::CreateEmbedFooter::new(footer));

            ctx.send(poise::CreateReply::default().embed(embed)).await?;

            // Pregnancy chance
            let got_pregnant = {
                let mut rng = rand::thread_rng();
                rng.gen_bool(0.5)
            };

            if got_pregnant {
                let father_id = user_id.clone();
                let mother_id = other_user;

                ctx.data().db.create_baby(&mother_id, &father_id).await?;

                ctx.send(poise::CreateReply::default().embed(
                    serenity::CreateEmbed::new()
                        .color(0x00FF00)
                        .title("Oh...")
                        .description(format!("<@{}> is pregnant! Check /baby get to see your babies!", mother_id))
                )).await?;
            }

            sessions.remove(idx);
        } else if let Some(text) = response {
            ctx.send(poise::CreateReply::default().embed(
                serenity::CreateEmbed::new()
                    .color(0x00FF00)
                    .title(text)
            )).await?;
        }
    } else {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You're not fucking anyone!")
                .footer(serenity::CreateEmbedFooter::new("start a sex session with /sex start"))
        )).await?;
    }

    Ok(())
}
