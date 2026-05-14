use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use futures::StreamExt;

/// Sends a guide on how to play Dinonuggies
#[poise::command(slash_command)]
pub async fn guide(ctx: Context<'_>) -> Result<(), Error> {
    let guide_text = "
## since you are stupid and you need to learn common sense, let's teach you how to play silverwolf bot!

1. `/claim` - this is how you earn dinonuggies. There is a low chance that it will have a bonus attached to it. If you hit the bonus, you'll earn more.
2. `/eat` and `/eatmultiple` - Eating is the easiest early game tactic to gain mystic credits.
3. `/upgrades` - Upgrades are the best way to increase your dinonuggie earnings.
4. `/slots` - The meta way to earn dinonuggies. Make a bet and spin away! The natural statistical earnings from this are 70%, just gamble and you'll increase.
5. `/blackjack` and `/roulette` are other great alternatives.
6. `/upgradedata` to see how much mystic credits are needed for each upgrade.
7. Once you're maxed out to level 30, you can increase your cap via `/ascend`.

The grind doesn't stop! Rahhh!
";

    let embed = serenity::CreateEmbed::new()
        .title("Dinonuggies Guide")
        .color(0xFFD700)
        .description(guide_text)
        .timestamp(chrono::Utc::now());

    ctx.send(poise::CreateReply::default().embed(embed)).await?;
    Ok(())
}

/// hello
#[poise::command(slash_command)]
pub async fn hello(ctx: Context<'_>) -> Result<(), Error> {
    ctx.say(format!("Hello {}!", ctx.author().name)).await?;
    Ok(())
}

/// send member lore
#[poise::command(slash_command)]
pub async fn lore(
    ctx: Context<'_>,
    #[description = "lore of the member"] member: String,
) -> Result<(), Error> {
    match member.to_lowercase().as_str() {
        "doge" | "kaitlin" => {
            let embed = serenity::CreateEmbed::new()
                .color(0x00AAAA)
                .title("«« ━━ ✦・Doge Lore・✦ ━━ »»")
                .description("### Lover of the TGP Queen\nDoge is doge.")
                .field("Timezone", "Vietnam (GMT+7)", true)
                .field("Staff", "None", true)
                .field("Join Date", "April '22", true)
                .field("Pronouns", "She/Her", true)
                .field("Veteran", "Yes", true)
                .field("Basement Member", "Yes", true)
                .field("Aliases", "Doge\nDoge Man\nUnlimited Doge Works\nSosuke Aizen\nKarl\nKita\nKaitlin\nOkita\nFischl Simp\nVenfei's boyfriend\nLover of the TGP Queen\nHerrscher of Egg", true)
                .field("Matrix Relationships", "**Shipped with: ** Venfei\n**Married on: ** The Akagi\n**Simps for: ** Fischl (Not anymore)\n**Alt: ** Kira\n**Therapist: ** Jez\n**New Wife: ** Make it a Quote Bot", true)
                .field("Quotes", "*\"I love Venfei\"*\n*\"Venfei is a nice roommate sexually\"*\n*\"I want to peg Venfei\"*\n*\"I pissed in your cereal\"*\n*\"I swear if Japan wins against Germany I am going to post myself wearing a maid dress\"*", true);
            ctx.send(poise::CreateReply::default().embed(embed)).await?;
        },
        "implicit" => {
            let embed = serenity::CreateEmbed::new()
                .color(0x00AAAA)
                .title("«« (;  · \\_ ·) Implicit lore (;  · \\_ ·) »»")
                .description("### (;  · \\_ ·)\n(;  · \\_ ·)(;  · \\_ ·)(;  · \\_ ·) (;  · \\_ ·)(;  · \\_ ·)(;  · \\_ ·)(;  · \\_ ·) (;  · \\_ ·)(;  · \\_ ·) (;  · \\_ ·)(;  · \\_ ·)(;  · \\_ ·)(;  · \\_ ·)")
                .field("Timezone", "GMT+8 (Philippines)", true)
                .field("Staff", "Lore Team\nr/place staff", true)
                .field("Join Date", "April '22", true)
                .field("Pronouns", "He/Him", true)
                .field("Veteran", "Yes", true)
                .field("Basement Member", "Yes", true)
                .field("Aliases", "Implicit [insert anything]\n(;  · \\_ ·)\nExplicit All", true)
                .field("Matrix Relationships", "(;  · \\_ ·)", true);
            ctx.send(poise::CreateReply::default().embed(embed)).await?;
        },
        "akagi" | "akagers" => {
            let embed = serenity::CreateEmbed::new()
                .color(0x00AAAA)
                .title("«« ━━ ✦・Akagi Lore・✦ ━━ »»")
                .description("### Sentient Aircraft Carrier\nAkagi is an IJN aircraft carrier disguised as a genderbent human being. Despite being an aircraft carrier, his iconic quote is \"I am not an aircraft carrier\".")
                .field("Timezone", "Phillipines (GMT+8)", true)
                .field("Staff", "Event Team (Resigned)\nDesign Team\nr/place staff", true)
                .field("Join Date", "April '22", true)
                .field("Pronouns", "He/Him", true)
                .field("Veteran", "Yes", true)
                .field("Basement Member", "Yes", true)
                .field("Aliases", "Akagi\nAkagers\nAircraft Carrier\nHerrscher of Carriers\nAce person in horni server", true)
                .field("Matrix Relationships", "**Shipped with: ** Fit (Not anymore)\n**Mutualistic Grasseating: **Ei\n**Sisters: **Keq, Astro, Kaslanass, Lav\n**Alt: **Kaga", true);
            ctx.send(poise::CreateReply::default().embed(embed)).await?;
        },
        "jez" | "xei" | "xeiris" => {
            ctx.say("# XEIPIZZA").await?;
            ctx.channel_id().say(ctx, "<:yanfeismug:1136925353651228775>").await?;
            let embed = serenity::CreateEmbed::new()
                .color(0x00AAAA)
                .title("«« ━━ ✦・Jez Lore・✦ ━━ »»")
                .description("### Sentient GPU\nIris XE supremacy")
                .field("Timezone", "Singapore (GMT+8)", true)
                .field("Staff", "Basement Admin", true)
                .field("Join Date", "November '22", true)
                .field("Pronouns", "He/Him", true)
                .field("Veteran", "No (but entered vet chat via levels)", true)
                .field("Basement Member", "Yes", true)
                .field("Aliases", "Jez\nXei\nXel\nXeiris\nXelris\nArcXe\nIris Xe\nHerrscher of Lofi\nLofi's Husband\nMeltryllis Simp", true)
                .field("Matrix Relationships", "**Wife: ** Lofi Bot\n**Classmate: ** Mystic\n**Therapy on: ** Doge\n**Simps for: ** Meltryllis\n**Shipped with: ** Leon (I swear this was real)", true);
            ctx.channel_id().send_message(ctx, serenity::CreateMessage::new().embed(embed)).await?;
        },
        _ => {
            ctx.say("send me the lore").await?;
        }
    }
    Ok(())
}

/// send an embed of peak
#[poise::command(slash_command)]
pub async fn gamebang(ctx: Context<'_>) -> Result<(), Error> {
    let embed = serenity::CreateEmbed::new()
        .color(0x00AA00)
        .title("«« ━━ ✦・Gamebang Fanfics・✦ ━━ »»")
        .field("Gamebang's 2nd roleplay (Archived)", "https://docs.google.com/document/d/11crS4bxfcR2Vs-1ybmRWum4B5YZeXq6y0zEva0IdBRw/edit?usp=sharing", false)
        .field("1. Gamebang and the Shameful Voices", "https://drive.google.com/file/d/1J1OcQbLrHiriEcjXpCnAz-Fx1pMD7Y0y/view?usp=sharing", false)
        .field("2. Gamebang and the End of Femboys", "https://drive.google.com/file/d/1Itpof3KKwiTFTdUWFTmvrxLfI-foqV_v/view?usp=sharing", false)
        .field("3. Gamebang and the Last Salvation", "https://drive.google.com/file/d/1J-EyRPiWMreLKfdlKJXmqVBZbuMsiRq0/view?usp=sharing", false)
        .field("4. Gamebang and the Divorce", "https://drive.google.com/file/d/1IrztknsmfVjHioFcQEHHK5iXr9HLmjm7/view?usp=sharing", false)
        .field("5. Gamebang and the Kingdom of Atlantis", "https://drive.google.com/file/d/1jtjdLCudVhr4bgmVrEVDDVEvA-SIzmOp/view?usp=sharing", false)
        .field("6. Gamebang and the Collapse of Time", "https://drive.google.com/file/d/1AnFo0qxfTDXHtt3bv5mt-MhrkBdG3D3R/view?usp=sharing", false)
        .field("7. Gamebang and the Quiet Fallout", "https://drive.google.com/file/d/11wOJRYpdvy3GJdMU-I4hmMBew-ZIp5yL/view?usp=sharing", false)
        .field("8. Gamebang and the Divine Comedy", "https://drive.google.com/file/d/1l9RhvGjPrJk9taOFJZ2DNCpvwFrazJ8Z/view?usp=sharing", false)
        .field("9. Gamebang and the Purge", "https://drive.google.com/file/d/1cMCH9ac4MhHU-LlkXirb2kOEqXTscptI/view?usp=sharing", false)
        .field("10. Gamebang and the Revolution", "https://drive.google.com/file/d/1f_rOcsTMusAzcDDKB2RpfmoAvUkqEGh0/view?usp=sharing", false)
        .field("11. Gamebang and the Edge of Space", "https://drive.google.com/file/d/1099FJ0jWI3QICLL1DJddcWGQX8hdwd_x/view?usp=sharing", false)
        .field("12. Gamebang and the World's Silence", "https://drive.google.com/file/d/16cflz99qGGRTfpZWiP6ujNg_OJ2dXLRa/view?usp=sharing", false)
        .field("13. Gamebang and the Archon War", "https://drive.google.com/file/d/1lqXnxMjvAHjiFyFyFnGbHFA0ghaFmjdr/view?usp=sharing", false)
        .field("14. Gamebang and the Apocalypse", "https://drive.google.com/file/d/1hY3j3tfDkZWFhddWby5nRf6ICT9h7OFk/view?usp=sharing", false)
        .field("15. Gamebang and the Final Voices", "https://drive.google.com/file/d/1ufzi0x2UU0vCCFLakoftusuBod1djmtl/view?usp=sharing", false)
        .footer(serenity::CreateEmbedFooter::new("holy fuck"));

    ctx.send(poise::CreateReply::default().embed(embed)).await?;
    Ok(())
}

/// sing a song
#[poise::command(slash_command)]
pub async fn sing(
    ctx: Context<'_>,
    #[description = "song to sing"] song: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let songs_str = std::fs::read_to_string("data/songs.json")?;
    let songs: serde_json::Value = serde_json::from_str(&songs_str)?;
    
    if let Some(lyrics) = songs.get(&song).and_then(|v| v.as_array()) {
        if lyrics.is_empty() {
            return Ok(());
        }

        ctx.say(lyrics[0].as_str().unwrap_or("")).await?;

        for lyric in lyrics.iter().skip(1) {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            ctx.channel_id().say(ctx, lyric.as_str().unwrap_or("")).await?;
        }
    } else {
        ctx.say("Song not found.").await?;
    }

    Ok(())
}

/// Risk & Reward: how much are you willing to?
#[poise::command(slash_command, rename = "risk-n-reward")]
pub async fn risk_n_reward(
    ctx: Context<'_>,
    #[description = "The amount of credits to bet."] amount_str: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    let bet = crate::utils::check_valid_bet_raw(ctx.data().db.as_ref(), &user_id, &amount_str).await?;
    
    let amount = match bet {
        crate::utils::BetResult::Valid(a) => a,
        crate::utils::BetResult::Invalid => { ctx.say("Invalid bet amount.").await?; return Ok(()); },
        crate::utils::BetResult::Negative => { ctx.say("You can't bet negative amounts.").await?; return Ok(()); },
        crate::utils::BetResult::InsufficientFunds => { ctx.say("You don't have enough credits.").await?; return Ok(()); },
        crate::utils::BetResult::Infinity => { ctx.say("You can't bet infinity.").await?; return Ok(()); },
    };

    let mut rng = rand::thread_rng();
    let win_percentage: f64 = rng.gen_range(0.0..100.0);
    let failure_chance = 100.0 - win_percentage;

    let embed = serenity::CreateEmbed::new()
        .title("RnR Minigame")
        .description(format!("You can win {:.2}% of your initial bet. Success is at {:.2}%.\n\nWould you like to continue?", win_percentage, failure_chance))
        .footer(serenity::CreateEmbedFooter::new(format!("Current Bet: {}", amount)))
        .color(0xFFD700);

    let row = serenity::CreateActionRow::Buttons(vec![
        serenity::CreateButton::new("continue")
            .label("Continue")
            .style(serenity::ButtonStyle::Success),
        serenity::CreateButton::new("stepOut")
            .label("No balls")
            .style(serenity::ButtonStyle::Danger),
    ]);

    let reply = poise::CreateReply::default()
        .embed(embed.clone())
        .components(vec![row]);

    ctx.send(reply).await?;

    let collector = ctx.serenity_context().shard.clone(); // Wait, this is not how collectors work in poise/serenity 0.12
    // In serenity 0.12, we use ComponentInteractionCollector
    
    let m = ctx.interaction().as_command().unwrap();
    let mut interaction_stream = m.get_response(ctx.serenity_context()).await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(interaction) = interaction_stream.next().await {
        if interaction.user.id != ctx.author().id {
            interaction.create_response(ctx, serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("This is not your game!").ephemeral(true)
            )).await?;
            continue;
        }

        if interaction.data.custom_id == "continue" {
            let mut rng = rand::thread_rng();
            let roll: f64 = rng.gen_range(0.0..100.0);
            
            if roll < failure_chance {
                let lost_amount = amount * (1.0 + (win_percentage / 100.0));
                ctx.data().db.add_credits(&user_id, -lost_amount).await?;
                
                interaction.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
                    serenity::CreateInteractionResponseMessage::new()
                        .embed(embed.clone()
                            .description(format!("Aw, you lost! You lost {:.2} credits.", lost_amount))
                            .color(0xFF0000))
                        .components(vec![])
                )).await?;
            } else {
                let winnings = amount * (win_percentage / 100.0);
                ctx.data().db.add_credits(&user_id, winnings).await?;
                
                interaction.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
                    serenity::CreateInteractionResponseMessage::new()
                        .embed(embed.clone()
                            .description(format!("Congratulations! You won {:.2} credits with a {:.2}% chance!", winnings, win_percentage))
                            .color(0x00FF00))
                        .components(vec![])
                )).await?;
            }
        } else if interaction.data.custom_id == "stepOut" {
            let entrance_fee = amount * 0.05;
            ctx.data().db.add_credits(&user_id, -entrance_fee).await?;
            
            interaction.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .embed(embed.clone()
                        .description(format!("You chose to step out. You lost {:.2} credits as an entrance fee.", entrance_fee))
                        .color(0x0000FF))
                    .components(vec![])
            )).await?;
        }
        return Ok(());
    }

    // Timeout
    ctx.data().db.add_credits(&user_id, -amount).await?;
    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0xAA0000)
            .title(format!("You took too long and lost {} credits!", amount)))
        .components(vec![])
    ).await?;

    Ok(())
}

/// Eat one or more dinonuggies
#[poise::command(slash_command)]
pub async fn eat(
    ctx: Context<'_>,
    #[description = "The amount of dinonuggies to eat"] amount: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let amount = amount.unwrap_or(1);
    let user_id = ctx.author().id.to_string();

    let result = crate::eat::process_eat(&ctx, &user_id, amount).await?;

    match result {
        crate::eat::EatResult::NotEnough { .. } => {
            ctx.say("smh you don't have enough dinonuggies to eat.").await?;
        },
        crate::eat::EatResult::Cheat { dinonuggies, .. } => {
            ctx.say(format!("You ate {} dinonuggies! You now have {} dinonuggies.", amount, dinonuggies - amount as f64)).await?;
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            ctx.say("You're spotted cheating. Your dinonuggies have been reset to 0.").await?;
            // Reset logic here
            ctx.data().db.set_user_attr(&user_id, "dinonuggies", 0.0).await?;
        },
        crate::eat::EatResult::Single { item, .. } => {
            ctx.say(crate::eat::format_eat_item_line(&item)).await?;
        },
        crate::eat::EatResult::Batch { items, remaining_lost, total_earned, total_nuggies_earned, .. } => {
            let mut message = String::new();
            for item in items {
                message.push_str(&format!("- {}\n", crate::eat::format_eat_item_line(&item)));
            }
            message.push('\n');
            if remaining_lost > 0 {
                message.push_str(&format!("You lost the remaining {} dinonuggies.\n", remaining_lost));
            }
            if total_earned > 0.0 {
                message.push_str(&format!("You earned a total of {} mystic credits.\n", crate::utils::format(total_earned)));
            }
            if total_nuggies_earned > 0 {
                message.push_str(&format!("You earned a total of {} dinonuggies.\n", total_nuggies_earned));
            }

            let embed = serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("You tried eating {} dinonuggies", amount))
                .description(message);

            ctx.send(poise::CreateReply::default().embed(embed)).await?;
        }
    }

    Ok(())
}

/// Converts an emoji to a selected file format
#[poise::command(slash_command, rename = "grab-emoji")]
pub async fn grab_emoji(
    ctx: Context<'_>,
    #[description = "The emoji to be converted"] emoji_input: String,
    #[description = "The file format to download"] format: Option<String>,
) -> Result<(), Error> {
    ctx.defer().await?;
    
    let emoji_regex = regex::Regex::new(r"<a?:\w+:(\d+)>").unwrap();
    let caps = emoji_regex.captures(&emoji_input);
    
    if let Some(c) = caps {
        let emoji_id = &c[1];
        let is_animated = emoji_input.starts_with("<a:");
        let format = format.unwrap_or_else(|| "png".to_string());
        
        if is_animated && format != "gif" && format != "png" {
            ctx.say("Animated emojis can only be downloaded as GIF or PNG format.").await?;
            return Ok(());
        }

        let emoji_url = format!("https://cdn.discordapp.com/emojis/{}.{}", emoji_id, if is_animated { "gif" } else { "png" });
        
        let embed = serenity::CreateEmbed::new()
            .title("Emoji Conversion")
            .description(format!("Here is your emoji in the requested format: **{}**", format.to_uppercase()))
            .color(0x00FF00)
            .image(&emoji_url);

        ctx.send(poise::CreateReply::default().embed(embed)).await?;
    } else {
        ctx.say("Please provide a valid **custom** emoji.").await?;
    }

    Ok(())
}

/// Snipe a message (edited or deleted)
#[poise::command(slash_command)]
pub async fn snipe(
    ctx: Context<'_>,
    #[description = "The type of snipe: edited or deleted"] snipe_type: String,
    #[description = "The nth message to snipe"] id: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let count = id.unwrap_or(1);
    
    if snipe_type == "deleted" {
        let deleted = ctx.data().deleted_messages.lock().await;
        let filtered: Vec<_> = deleted.iter()
            .filter(|m| m.message.channel_id == ctx.channel_id() && !m.message.author.bot)
            .collect();
            
        if filtered.len() < count as usize {
            ctx.say(format!("There are only {} deleted messages to snipe in this channel.", filtered.len())).await?;
            return Ok(());
        }
        
        let msg = filtered[filtered.len() - count as usize];
        let embed = serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Deleted Message #{}", count))
            .description(format!("**{}**: {}", msg.message.author.name, msg.message.content))
            .timestamp(msg.message.timestamp);
            
        ctx.send(poise::CreateReply::default().embed(embed)).await?;
    } else if snipe_type == "edited" {
        let edited = ctx.data().edited_messages.lock().await;
        let filtered: Vec<_> = edited.iter()
            .filter(|m| m.old.channel_id == ctx.channel_id() && !m.old.author.bot)
            .collect();
            
        if filtered.len() < count as usize {
            ctx.say(format!("There are only {} edited messages to snipe in this channel.", filtered.len())).await?;
            return Ok(());
        }
        
        let msg = filtered[filtered.len() - count as usize];
        let embed = serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Edited Message #{}", count))
            .description(format!("Author: {}\nOld: {}\nNew: {}", msg.old.author.name, msg.old.content, msg.r#new.content))
            .timestamp(msg.r#new.timestamp);
            
        ctx.send(poise::CreateReply::default().embed(embed)).await?;
    } else {
        ctx.say("Invalid snipe type. Choose 'edited' or 'deleted'.").await?;
    }

    Ok(())
}

/// 99% chance to earn $1M, 1% chance to become a girl
#[poise::command(slash_command)]
pub async fn awdangit(ctx: Context<'_>) -> Result<(), Error> {
    let mut rng = rand::thread_rng();
    use rand::Rng;
    if rng.gen::<f64>() < 0.01 {
        let guild_id = ctx.guild_id().ok_or("Must be used in a server.")?.to_string();
        let role_id_str = ctx.data().db.get_server_role(&guild_id, "girl").await?;
        
        if let Some(role_id) = role_id_str {
            let role_id_u64 = role_id.parse::<u64>()?;
            let mut member = ctx.author_member().await.ok_or("Could not fetch member.")?.into_owned();
            member.add_role(ctx, serenity::RoleId::new(role_id_u64)).await?;
            
            ctx.send(poise::CreateReply::default().embed(
                serenity::CreateEmbed::new()
                    .title("Congrats!")
                    .description("You became a girl!")
                    .color(0x00FF00)
            )).await?;
        } else {
            ctx.say("Girl role is not set up for this server!").await?;
        }
    } else {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .title("Aw, dang it!")
                .description("You earned $1M!")
                .color(0xFF0000)
        )).await?;
    }
    Ok(())
}

/// spam ping the author of a command
#[poise::command(slash_command)]
pub async fn blame(
    ctx: Context<'_>,
    #[description = "the name of the command to blame"] command: String,
) -> Result<(), Error> {
    let cmd_name = command.to_lowercase().replace(' ', ".");
    
    // In poise, we can check if command exists
    let found = ctx.framework().options().commands.iter().find(|c| c.name == cmd_name || c.qualified_name == cmd_name);
    
    if let Some(c) = found {
        // Since we don't have 'blame' metadata in Rust commands yet, 
        // we'll just use a simple mapping or just blame 'ei' by default.
        let name = "ei"; 
        let uid = "595491647132008469";
        
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("blame {} for {}", name, cmd_name))
        )).await?;
        
        for _ in 0..5 {
            ctx.channel_id().say(ctx, format!("<@{}>", uid)).await?;
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    } else {
        ctx.say("command not found").await?;
    }
    Ok(())
}

/// send the link to the daily click thing
#[poise::command(slash_command)]
pub async fn click(ctx: Context<'_>) -> Result<(), Error> {
    ctx.say("https://arab.org/click-to-help/palestine/").await?;
    Ok(())
}

/// is this a squid game reference?
#[poise::command(slash_command, rename = "recruiter-game-오징어게임")]
pub async fn gongyoo(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    
    let now = chrono::Utc::now().timestamp_millis();
    let cooldown_ms = 24 * 60 * 60 * 1000;
    
    let last_gambled = ctx.data().db.get_user_attr(&user_id, "dinonuggieLastGambled").await?;
    if last_gambled > 0.0 && (now as f64) < last_gambled + cooldown_ms as f64 {
        let rem_hours = (last_gambled + cooldown_ms as f64 - now as f64) / (60.0 * 60.0 * 1000.0);
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0xFF0000)
                .title("Cooldown Active")
                .description(format!("You can use this command again in {:.1} hours.", rem_hours))
                .image("https://media1.tenor.com/m/MUGXIqovlEoAAAAd/salesman-gong-yoo.gif")
        )).await?;
        return Ok(());
    }

    ctx.data().db.set_user_attr(&user_id, "dinonuggieLastGambled", now as f64).await?;

    let user = ctx.data().db.get_user(&user_id).await?;
    let credits = user.credits;
    let dinonuggies = user.dinonuggies;

    let win_credits = (credits * 0.20).floor();
    let lose_credits = (credits * 0.20).floor();
    let multiplier = (dinonuggies.log2()).max(1.0).min(100.0);

    let embed = serenity::CreateEmbed::new()
        .color(0x00AAFF)
        .title("Win or Bust!")
        .description(format!("Test your luck! You have 60 seconds to decide:\n\n**Left Button**: Gain **20%** of your current credits (**+{} credits**).\n**Right Button**: Risk **20%** of your credits (**-{} credits**) for:\n- A chance to win {}x your current dinonuggie count!", 
            crate::utils::format(win_credits), 
            crate::utils::format(lose_credits),
            crate::utils::format(multiplier)))
        .footer(serenity::CreateEmbedFooter::new("Make your choice wisely!"))
        .image("https://media1.tenor.com/m/jYKFyMNCsPgAAAAC/choose-one-squid-game-season-2.gif");

    let row = serenity::CreateActionRow::Buttons(vec![
        serenity::CreateButton::new("winOrBustLeft").label("Take +20% Credits").style(serenity::ButtonStyle::Success),
        serenity::CreateButton::new("winOrBustRight").label("Nah I'd Gamble").style(serenity::ButtonStyle::Danger),
    ]);

    let reply = ctx.send(poise::CreateReply::default().embed(embed).components(vec![row])).await?;

    let mut interaction_stream = reply.message().await?.await_component_interactions(ctx.serenity_context()).timeout(std::time::Duration::from_secs(60)).stream();

    if let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx, serenity::CreateInteractionResponse::Message(serenity::CreateInteractionResponseMessage::new().content("This is not your game!").ephemeral(true))).await?;
        } else {
            if mci.data.custom_id == "winOrBustLeft" {
                ctx.data().db.add_credits(&user_id, win_credits).await?;
                mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(serenity::CreateEmbed::new().color(0x00FF00).title("You chose wisely!").description(format!("You gained **+{} credits**!", crate::utils::format(win_credits))).image("https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif")).components(vec![]))).await?;
            } else {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let r: f64 = rng.gen();
                if r <= 0.003 {
                    let winnings = dinonuggies * multiplier;
                    ctx.data().db.add_user_attr(&user_id, "dinonuggies", winnings).await?;
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(serenity::CreateEmbed::new().color(0xFFD700).title("Jackpot!").description(format!("🎉 YOU WON **{}x YOUR DINONUGGIE COUNT**! 🎉\nYou gained **+{} dinonuggies**!", crate::utils::format(multiplier), crate::utils::format(winnings))).image("https://media1.tenor.com/m/dGx7QjIRZ7wAAAAd/celebrating-seong-gi-hun.gif")).components(vec![]))).await?;
                } else if r <= 0.503 {
                    ctx.data().db.add_credits(&user_id, -lose_credits).await?;
                    ctx.data().db.set_user_attr(&user_id, "dinonuggiesClaimStreak", 0.0).await?;
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(serenity::CreateEmbed::new().color(0xFF0000).title("Bust!").description(format!("You lost **-{} credits** and your **dinonuggie claim streak**.", crate::utils::format(lose_credits))).image("https://media1.tenor.com/m/3Xvc3_wnE_oAAAAd/squid-game-screwed.gif")).components(vec![]))).await?;
                } else {
                    ctx.data().db.add_credits(&user_id, -lose_credits).await?;
                    mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(serenity::CreateInteractionResponseMessage::new().embed(serenity::CreateEmbed::new().color(0xFF4500).title("You lost!").description(format!("You lost **-{} credits**! Better luck next time.", crate::utils::format(lose_credits))).image("https://media1.tenor.com/m/xXLgviXVqI8AAAAd/squid-game-salesman.gif")).components(vec![]))).await?;
                }
            }
            return Ok(());
        }
    }
    
    // Timeout
    let fee = (credits * 0.05).floor();
    ctx.data().db.add_credits(&user_id, -fee).await?;
    ctx.send(poise::CreateReply::default().embed(serenity::CreateEmbed::new().color(0xAA0000).title("Timeout!").description(format!("You took too long to decide and lost **-{} credits** as an entrance fee.", crate::utils::format(fee))).image("https://media1.tenor.com/m/kvJMZJAiYrMAAAAd/squid-game-slap.gif")).components(vec![])).await?;

    Ok(())
}

/// our 69th command
#[poise::command(slash_command)]
pub async fn hilichurl(ctx: Context<'_>) -> Result<(), Error> {
    let gifs_str = std::fs::read_to_string("data/hilichurl.json")?;
    let gifs: Vec<String> = serde_json::from_str(&gifs_str)?;
    if !gifs.is_empty() {
        use rand::seq::SliceRandom;
        let gif = { let mut rng = rand::thread_rng(); gifs.choose(&mut rng).cloned() };
        if let Some(g) = gif { ctx.say(g).await?; }
    }
    Ok(())
}

/// roll a dice
#[poise::command(slash_command)]
pub async fn roll(
    ctx: Context<'_>,
    #[description = "number of sides"] sides: Option<String>,
) -> Result<(), Error> {
    let input = sides.unwrap_or_else(|| "6".to_string());
    let mut embed = serenity::CreateEmbed::new();
    
    match input.as_str() {
        "0" => { embed = embed.color(0xAA0000).description("### You tried rolling a 0-sided die.\nWait, where did it go?"); },
        "1" => { embed = embed.color(0x00AA00).description("### You tried rolling a 1-sided die.\nOr, a sphere. It landed on a 1. Like, what did you expect?"); },
        "pi" => { embed = embed.color(0xAA0000).description("### You tried rolling a 3.14159..."); },
        _ => {
            if let Ok(faces) = input.parse::<i64>() {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let res = rng.gen_range(1..=faces.abs());
                embed = embed.color(0x00AA00).description(format!("### You rolled a {}-sided die. It landed on {}.", faces, if faces < 0 { -res } else { res }));
            } else {
                embed = embed.color(0xAA0000).description(format!("### You tried rolling a {}-sided die.\nIt landed on {}. Pretty cool, huh?", input, input));
            }
        }
    }
    
    ctx.send(poise::CreateReply::default().embed(embed)).await?;
    Ok(())
}

/// 2022 flashbacks
#[poise::command(slash_command, rename = "2022")]
pub async fn twenty_twenty_two(ctx: Context<'_>) -> Result<(), Error> {
    let quotes_str = std::fs::read_to_string("data/2022.json")?;
    let quotes: Vec<serde_json::Value> = serde_json::from_str(&quotes_str)?;
    
    if !quotes.is_empty() {
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        if let Some(quote) = quotes.choose(&mut rng) {
            let mut embed = serenity::CreateEmbed::new()
                .color(0x00AA00)
                .description(format!("*\"{}\"* - {}", quote["quote"].as_str().unwrap_or(""), quote["author"].as_str().unwrap_or("")));
            
            if let Some(reply) = quote["reply"].as_str() {
                embed = embed.description(format!("*\"{}\"* - {}\n*\"{}\"* - {}", 
                    quote["quote"].as_str().unwrap_or(""), 
                    quote["author"].as_str().unwrap_or(""),
                    reply,
                    quote["replyauthor"].as_str().unwrap_or("")
                ));
            }
            ctx.send(poise::CreateReply::default().embed(embed)).await?;
        }
    }
    Ok(())
}

/// Calculate love compatibility between two members
#[poise::command(slash_command, rename = "love-calculator")]
pub async fn love_calculator(
    ctx: Context<'_>,
    #[description = "The first input (user mention or string)"] input1: String,
    #[description = "The second input (user mention or string)"] input2: String,
) -> Result<(), Error> {
    ctx.defer().await?;

    let name1 = resolve_mention(&ctx, &input1).await;
    let name2 = resolve_mention(&ctx, &input2).await;

    let mut inputs = [name1.to_lowercase(), name2.to_lowercase()];
    inputs.sort();
    let sorted_inputs = inputs.join("");

    let hash = md5::compute(sorted_inputs);
    
    // Get first 2 bytes for the percentage
    let hex = format!("{:x}", hash);
    let slice = &hex[0..4];
    let percentage = u32::from_str_radix(slice, 16).unwrap_or(0) % 101;

    let phrase = if percentage <= 20 {
        "Chances are low, but never zero!"
    } else if percentage <= 40 {
        "You might be better off as friends."
    } else if percentage <= 60 {
        "There's something there... maybe!"
    } else if percentage <= 80 {
        "Looks like there's some potential!"
    } else {
        "True love! Get ready for the wedding bells!"
    };

    ctx.say(format!("{} ❤️ {}: {}% compatibility\n{}", name1, name2, percentage, phrase)).await?;

    Ok(())
}

#[derive(serde::Deserialize)]
struct JokeData {
    setup: String,
    punchline: String,
}

/// A random joke just like your existence that nobody asked for
#[poise::command(slash_command, rename = "random-joke")]
pub async fn random_joke(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let joke_url = "https://official-joke-api.appspot.com/random_joke";
    let response = ctx.data().http_client.get(joke_url).send().await?;
    let data: JokeData = response.json().await?;

    ctx.say(&data.setup).await?;

    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    ctx.channel_id().say(ctx, &data.punchline).await?;

    Ok(())
}

#[derive(serde::Deserialize)]
struct CatFact {
    fact: String,
}

#[derive(serde::Deserialize, Clone)]
struct CatPic {
    url: String,
    id: String,
}

#[derive(poise::ChoiceParameter, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CatOption {
    #[name = "fact"]
    Fact,
    #[name = "img"]
    Img,
    #[name = "both"]
    Both,
}

/// Fetch a random cat fact, picture, or both
#[poise::command(slash_command)]
pub async fn cat(
    ctx: Context<'_>,
    #[description = "Choose what you want"]
    option: CatOption,
) -> Result<(), Error> {
    ctx.defer().await?;

    let mut fact = None;
    let mut pic = None;

    if option == CatOption::Fact || option == CatOption::Both {
        let res = ctx.data().http_client.get("https://catfact.ninja/fact").send().await?;
        let data: CatFact = res.json().await?;
        fact = Some(data.fact);
    }

    if option == CatOption::Img || option == CatOption::Both {
        let res = ctx.data().http_client.get("https://api.thecatapi.com/v1/images/search").send().await?;
        let data: Vec<CatPic> = res.json().await?;
        if !data.is_empty() {
            pic = Some(data[0].clone());
        }
    }

    let mut embed = serenity::builder::CreateEmbed::new().color(0x3498db);

    match option {
        CatOption::Fact => {
            embed = embed.title("Cat Fact").description(fact.unwrap_or_default());
        }
        CatOption::Img => {
            if let Some(p) = pic {
                embed = embed.title("Found a cat! 🐈").image(p.url).footer(serenity::builder::CreateEmbedFooter::new(format!("Cat ID: {}", p.id)));
            }
        }
        CatOption::Both => {
            embed = embed.title("Cat fact and unrelated pic").description(fact.unwrap_or_default());
            if let Some(p) = pic {
                embed = embed.image(p.url).footer(serenity::builder::CreateEmbedFooter::new(format!("Cat ID: {}", p.id)));
            }
        }
    }

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}

/// gotta catcg em all
#[poise::command(slash_command)]
pub async fn catcg(
    ctx: Context<'_>,
    #[description = "the pokenom to catcg"] _pokenom: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    
    let pokemons = ctx.data().db.get_pokemons(&user_id).await?;
    
    if !pokemons.is_empty() {
        use rand::seq::SliceRandom;
        let pokemon = {
            let mut rng = rand::thread_rng();
            pokemons.choose(&mut rng).cloned()
        };
        
        if let Some(p) = pokemon {
            ctx.data().db.sacrifice_pokemon(&user_id, &p.pokemon_name).await?;
            
            ctx.send(poise::CreateReply::default().embed(
                serenity::builder::CreateEmbed::new()
                    .title("You used the wrong catch command!")
                    .description(format!("A random pokemon you own, {}, was released.", p.pokemon_name))
                    .color(0xFF0000)
            )).await?;
        }
    } else {
        ctx.send(poise::CreateReply::default().embed(
            serenity::builder::CreateEmbed::new()
                .title("You used the wrong catch command!")
                .color(0xFF0000)
        )).await?;
    }

    Ok(())
}

/// Get a random song from the playlist
#[poise::command(slash_command, rename = "spotify-playlist")]
pub async fn spotify_playlist(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let links: Vec<String> = serde_json::from_str(&std::fs::read_to_string("data/spotifyPlaylist.json").unwrap_or_else(|_| "[]".to_string()))?;
    
    if links.is_empty() {
        ctx.say("The playlist is empty!").await?;
        return Ok(());
    }

    use rand::seq::SliceRandom;
    let link = {
        let mut rng = rand::thread_rng();
        links.choose(&mut rng).cloned()
    };
    
    if let Some(l) = link {
        ctx.say(l).await?;
    }

    Ok(())
}

/// scare leon away
#[poise::command(slash_command)]
pub async fn arlecchino(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let gifs: Vec<String> = serde_json::from_str(&std::fs::read_to_string("data/arlecchino.json").unwrap_or_else(|_| "[]".to_string()))?;
    
    if !gifs.is_empty() {
        use rand::seq::SliceRandom;
        let gif = {
            let mut rng = rand::thread_rng();
            gifs.choose(&mut rng).cloned()
        };
        
        if let Some(g) = gif {
            ctx.say(g).await?;
            ctx.channel_id().say(ctx, "<@993614772354416673>").await?;
        }
    }

    Ok(())
}

/// Let out a big... one?
#[poise::command(slash_command)]
pub async fn fart(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let day_length = 24 * 60 * 60 * 1000;

    {
        let mut cooldowns = ctx.data().fart_cooldowns.lock().await;
        if let Some(last_fart) = cooldowns.get(&user_id) {
            if now < last_fart + day_length {
                ctx.say("you shat yourself.").await?;
                ctx.channel_id().say(ctx, "https://tenor.com/view/laughing-cat-catlaughing-laughingcat-point-gif-7577620470218150413").await?;
                return Ok(());
            }
        }
        cooldowns.insert(user_id, now);
    }

    // In TS, it checks if it's an allowed server for everyone mention.
    // For now, I'll just check if it's a guild.
    if ctx.guild_id().is_some() {
        ctx.send(poise::CreateReply::default()
            .content(format!("# @everyone {} has farted! 💨", ctx.author().name))
            .allowed_mentions(serenity::CreateAllowedMentions::new().everyone(true))
        ).await?;
    } else {
        ctx.say(format!("{} has farted! 💨", ctx.author().name)).await?;
    }

    Ok(())
}

/// say an n-word
#[poise::command(slash_command)]
pub async fn nword(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let nwords: Vec<String> = serde_json::from_str(&std::fs::read_to_string("data/nwords.json").unwrap_or_else(|_| "[]".to_string()))?;
    
    if !nwords.is_empty() {
        use rand::seq::SliceRandom;
        let word = {
            let mut rng = rand::thread_rng();
            nwords.choose(&mut rng).cloned()
        };
        
        if let Some(w) = word {
            ctx.say(w).await?;
        }
    }

    Ok(())
}

/// Does absolutely nothing
#[poise::command(slash_command)]
pub async fn nothing(_ctx: Context<'_>) -> Result<(), Error> {
    Ok(())
}

async fn resolve_mention(ctx: &Context<'_>, input: &str) -> String {
    let mention_regex = regex::Regex::new(r"<@!?(\d+)>").unwrap();
    if let Some(caps) = mention_regex.captures(input) {
        if let Ok(user_id) = caps[1].parse::<u64>() {
            if let Ok(user) = serenity::model::id::UserId::new(user_id).to_user(ctx).await {
                return user.name;
            }
        }
    }
    input.to_string()
}
