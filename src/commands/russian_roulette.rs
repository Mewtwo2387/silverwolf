use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use futures::StreamExt;
use rand::seq::SliceRandom;
use rand::Rng;

#[poise::command(slash_command, subcommands("regular", "singleplayer"))]
pub async fn russian_roulette(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Play a game of Russian Roulette
#[poise::command(slash_command)]
pub async fn regular(
    ctx: Context<'_>,
    #[description = "The first participant"] user1: serenity::User,
    #[description = "The second participant"] user2: serenity::User,
    #[description = "The third participant"] user3: Option<serenity::User>,
    #[description = "The fourth participant"] user4: Option<serenity::User>,
    #[description = "The fifth participant"] user5: Option<serenity::User>,
    #[description = "The sixth participant"] user6: Option<serenity::User>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let mut participants = vec![user1, user2];
    if let Some(u) = user3 { participants.push(u); }
    if let Some(u) = user4 { participants.push(u); }
    if let Some(u) = user5 { participants.push(u); }
    if let Some(u) = user6 { participants.push(u); }

    let mut rng = rand::thread_rng();
    participants.shuffle(&mut rng);

    let unlucky_person = rng.gen_range(0..participants.len());
    let mut turn = 0;

    let mut embed = serenity::CreateEmbed::new()
        .title("Russian Roulette")
        .color(0xFF0000)
        .description(format!("{}'s turn!", participants[turn].name))
        .footer(serenity::CreateEmbedFooter::new("Click the button below to pull the trigger."));

    let row = serenity::CreateActionRow::Buttons(vec![
        serenity::CreateButton::new("trigger").label("Pull the Trigger").style(serenity::ButtonStyle::Danger),
    ]);

    let reply = ctx.send(poise::CreateReply::default().embed(embed.clone()).components(vec![row])).await?;

    let mut interaction_stream = reply.message().await?.await_component_interactions(ctx.serenity_context()).timeout(std::time::Duration::from_secs(60)).stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != participants[turn].id {
            mci.create_response(ctx, serenity::CreateInteractionResponse::Message(serenity::CreateInteractionResponseMessage::new().content("It's not your turn!").ephemeral(true))).await?;
            continue;
        }

        if turn == unlucky_person {
            embed = embed.description(format!("{} was shot! 💥\n\nGame Over!", participants[turn].name));
            mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
            return Ok(());
        } else if turn == participants.len() - 1 {
            embed = embed.description(format!("Everyone survived! 🎉\n\nNo one was shot, but {} was the unlucky one.", participants[unlucky_person].name));
            mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
            return Ok(());
        } else {
            turn += 1;
            embed = embed.description(format!("{}'s turn!", participants[turn].name));
            mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed))).await?;
        }
    }

    Ok(())
}

/// Play a single-player game of Russian Roulette
#[poise::command(slash_command)]
pub async fn singleplayer(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let total_chambers = 6;
    let mut rng = rand::thread_rng();
    let loaded_chamber = rng.gen_range(0..total_chambers);
    let mut current_chamber = 0;
    let mut shots_fired = 0;
    let mut this_chamber_cooldown = false;

    let mut embed = serenity::CreateEmbed::new()
        .title("Single-Player Russian Roulette")
        .color(0xFF0000)
        .description(format!("Round {}: What will you do?", shots_fired + 1))
        .footer(serenity::CreateEmbedFooter::new(format!("Chambers checked: {}/{}", shots_fired, total_chambers)))
        .image("https://media1.tenor.com/m/NT9p3cPLcvIAAAAC/pull-the-trigger-squid-game-season-2.gif");

    let generate_row = |cooldown: bool| {
        serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new("shootSelf").label("Shoot Self").style(serenity::ButtonStyle::Danger),
            serenity::CreateButton::new("thisChamber").label("This Chamber").style(serenity::ButtonStyle::Primary).disabled(cooldown),
        ])
    };

    let reply = ctx.send(poise::CreateReply::default().embed(embed.clone()).components(vec![generate_row(this_chamber_cooldown)])).await?;

    let mut interaction_stream = reply.message().await?.await_component_interactions(ctx.serenity_context()).timeout(std::time::Duration::from_secs(120)).stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx, serenity::CreateInteractionResponse::Message(serenity::CreateInteractionResponseMessage::new().content("This is not your game!").ephemeral(true))).await?;
            continue;
        }

        if mci.data.custom_id == "shootSelf" {
            if current_chamber == loaded_chamber {
                embed = embed.description("💥 You pulled the trigger and the chamber was loaded! You lose.")
                    .color(0xAA0000)
                    .image("https://media1.tenor.com/m/xJUgKa1lPZ4AAAAd/squidgames-dead.gif");
                mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
                return Ok(());
            } else {
                shots_fired += 1;
                current_chamber += 1;
                this_chamber_cooldown = false;

                embed = embed.description(format!("Click! You survived round {}. What will you do next?", shots_fired))
                    .footer(serenity::CreateEmbedFooter::new(format!("Chambers checked: {}/{}", shots_fired, total_chambers)));

                if shots_fired == total_chambers {
                    embed = embed.description("💥 You survived until the last round but failed to discharge the loaded chamber. You lose.")
                        .color(0xAA0000)
                        .image("https://media1.tenor.com/m/xJUgKa1lPZ4AAAAd/squidgames-dead.gif");
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
                    return Ok(());
                } else {
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed.clone()).components(vec![generate_row(this_chamber_cooldown)]))).await?;
                }
            }
        } else if mci.data.custom_id == "thisChamber" {
            if current_chamber == loaded_chamber {
                embed = embed.description("🎉 You discharged the loaded chamber without harming yourself. You win!")
                    .color(0x00FF00)
                    .image("https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif");
                mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
                return Ok(());
            } else {
                this_chamber_cooldown = true;
                shots_fired += 1;
                current_chamber += 1;

                embed = embed.description(format!("The chamber was empty. You have survived round {}. What will you do next?", shots_fired))
                    .footer(serenity::CreateEmbedFooter::new(format!("Chambers checked: {}/{}", shots_fired, total_chambers)));

                if shots_fired == total_chambers {
                    embed = embed.description("🎉 You survived all 5 rounds and successfully discharged the loaded chamber. You win!")
                        .color(0x00FF00)
                        .image("https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif");
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed).components(vec![]))).await?;
                    return Ok(());
                } else {
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(embed.clone()).components(vec![generate_row(this_chamber_cooldown)]))).await?;
                }
            }
        }
    }

    Ok(())
}
