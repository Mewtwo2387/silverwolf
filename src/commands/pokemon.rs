use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use futures::StreamExt;

/// list your pokemons?
#[poise::command(slash_command)]
pub async fn pokemon(ctx: Context<'_>) -> Result<(), Error> {
    let user_id = ctx.author().id.to_string();
    let all_pokemons = ctx.data().db.get_pokemons(&user_id).await?;
    
    if all_pokemons.is_empty() {
        ctx.say("You have no pokemons! Go catch some.").await?;
        return Ok(());
    }

    let items_per_page = 20;
    let mut current_page = 0;
    let max_page = (all_pokemons.len() as f64 / items_per_page as f64).ceil() as usize - 1;

    let ctx_id = ctx.id();
    let prev_button_id = format!("{}prev", ctx_id);
    let next_button_id = format!("{}next", ctx_id);

    // Initial embed
    let generate_embed = |page: usize, pokemons: &[crate::database::models::Pokemon]| {
        let start = page * items_per_page;
        let end = std::cmp::min(start + items_per_page, pokemons.len());
        let page_items = &pokemons[start..end];
        
        let max_name_len = page_items.iter().map(|p| p.pokemon_name.len()).max().unwrap_or(0);
        let mut description = String::from("```");
        for p in page_items {
            description.push_str(&format!("{:<width$} {}\n", p.pokemon_name, p.pokemon_count, width = max_name_len + 2));
        }
        description.push_str("```");

        serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title("Your Pokémons")
            .description(description)
            .footer(serenity::CreateEmbedFooter::new(format!("Page {} of {}", page + 1, max_page + 1)))
    };

    let reply = ctx.send(poise::CreateReply::default()
        .embed(generate_embed(current_page, &all_pokemons))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&prev_button_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(true),
            serenity::CreateButton::new(&next_button_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(current_page == max_page),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.data.custom_id == prev_button_id && current_page > 0 {
            current_page -= 1;
        } else if mci.data.custom_id == next_button_id && current_page < max_page {
            current_page += 1;
        } else {
            continue;
        }

        mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
            serenity::CreateInteractionResponseMessage::new()
                .embed(generate_embed(current_page, &all_pokemons))
                .components(vec![serenity::CreateActionRow::Buttons(vec![
                    serenity::CreateButton::new(&prev_button_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(current_page == 0),
                    serenity::CreateButton::new(&next_button_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(current_page == max_page),
                ])])
        )).await?;
    }

    // Disable buttons after timeout
    reply.edit(ctx, poise::CreateReply::default()
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&prev_button_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(true),
            serenity::CreateButton::new(&next_button_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(true),
        ])])
    ).await?;

    Ok(())
}

/// trade pokemon
#[poise::command(slash_command)]
pub async fn trade(
    ctx: Context<'_>,
    #[description = "the user to trade with"] target_user: serenity::User,
    #[description = "the pokemon you are sending"] sending: String,
    #[description = "the pokemon you are requesting"] requesting: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let self_id = ctx.author().id.to_string();
    let target_id = target_user.id.to_string();

    if self_id == target_id {
        ctx.say("You can't trade with yourself smh").await?;
        return Ok(());
    }

    let self_count = ctx.data().db.get_pokemon_count(&self_id, &sending).await?;
    let target_count = ctx.data().db.get_pokemon_count(&target_id, &requesting).await?;

    if self_count < 1 {
        ctx.say(format!("You don't have any {}s to trade!", sending)).await?;
        return Ok(());
    }
    if target_count < 1 {
        ctx.say(format!("<@{}> doesn't have any {}s to trade!", target_id, requesting)).await?;
        return Ok(());
    }

    let ctx_id = ctx.id();
    let accept_id = format!("{}accept", ctx_id);
    let reject_id = format!("{}reject", ctx_id);

    let embed = serenity::CreateEmbed::new()
        .color(0x00AA00)
        .title("Trade Request")
        .description(format!("{} wants to trade their {} for your {}!", ctx.author().name, sending, requesting));

    let row = serenity::CreateActionRow::Buttons(vec![
        serenity::CreateButton::new(&accept_id).label("Accept").style(serenity::ButtonStyle::Success),
        serenity::CreateButton::new(&reject_id).label("Reject").style(serenity::ButtonStyle::Danger),
    ]);

    let reply = ctx.send(poise::CreateReply::default()
        .content(format!("<@{}>, {} has sent you a trade request!", target_id, ctx.author().name))
        .embed(embed)
        .components(vec![row])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != target_user.id {
            mci.create_response(ctx, serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("don't steal pokemon smh").ephemeral(true)
            )).await?;
            continue;
        }

        if mci.data.custom_id == accept_id {
            // Re-check counts
            let self_count = ctx.data().db.get_pokemon_count(&self_id, &sending).await?;
            let target_count = ctx.data().db.get_pokemon_count(&target_id, &requesting).await?;

            if self_count < 1 || target_count < 1 {
                mci.create_response(ctx, serenity::CreateInteractionResponse::Message(
                    serenity::CreateInteractionResponseMessage::new().content("This pokemon no longer exist").ephemeral(true)
                )).await?;
                return Ok(());
            }

            use rand::Rng;
            let mut rng = rand::thread_rng();
            let sending_died = rng.gen::<f64>() < 0.05;
            let requesting_died = rng.gen::<f64>() < 0.05;

            ctx.data().db.sacrifice_pokemon(&self_id, &sending).await?;
            ctx.data().db.sacrifice_pokemon(&target_id, &requesting).await?;

            if !sending_died {
                ctx.data().db.catch_pokemon(&target_id, &sending).await?;
            }
            if !requesting_died {
                ctx.data().db.catch_pokemon(&self_id, &requesting).await?;
            }

            let mut message = format!("<@{}> traded their {} for <@{}>'s {}!", self_id, sending, target_id, requesting);
            let mut footer = "crytek-chan my bot is better uwu~";

            if sending_died && requesting_died {
                message.push_str("\nHowever, both pokemon died in the trade.");
                footer = "how did you even manage that it's 5% each side";
            } else if sending_died {
                message.push_str(&format!("\nHowever, <@{}>'s {} died in the trade.", self_id, sending));
                footer = "rip";
            } else if requesting_died {
                message.push_str(&format!("\nHowever, <@{}>'s {} died in the trade.", target_id, requesting));
                footer = "rip";
            }

            mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .content("")
                    .embed(serenity::CreateEmbed::new()
                        .color(0x00FF00)
                        .description(message)
                        .footer(serenity::CreateEmbedFooter::new(footer)))
                    .components(vec![])
            )).await?;
            return Ok(());
        } else if mci.data.custom_id == reject_id {
            mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .content("")
                    .embed(serenity::CreateEmbed::new()
                        .color(0xFF0000)
                        .description(format!("<@{}> rejected the trade request!", target_id)))
                    .components(vec![])
            )).await?;
            return Ok(());
        }
    }

    Ok(())
}

/// sacrifice 3 pokemons to summon a random pokemon
#[poise::command(slash_command)]
pub async fn sacrifice(
    ctx: Context<'_>,
    #[description = "the first pokemon to sacrifice"] p1: String,
    #[description = "the second pokemon to sacrifice"] p2: String,
    #[description = "the third pokemon to sacrifice"] p3: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();

    // Check if enough (handling duplicates)
    let mut needed = std::collections::HashMap::new();
    *needed.entry(p1.clone()).or_insert(0) += 1;
    *needed.entry(p2.clone()).or_insert(0) += 1;
    *needed.entry(p3.clone()).or_insert(0) += 1;

    for (name, count) in needed {
        let current = ctx.data().db.get_pokemon_count(&user_id, &name).await?;
        if current < count {
            ctx.say(format!("You don't have enough {}s.", name)).await?;
            return Ok(());
        }
    }

    ctx.data().db.sacrifice_pokemon(&user_id, &p1).await?;
    ctx.data().db.sacrifice_pokemon(&user_id, &p2).await?;
    ctx.data().db.sacrifice_pokemon(&user_id, &p3).await?;

    ctx.send(poise::CreateReply::default().embed(
        serenity::CreateEmbed::new()
            .description(format!("Sacrificing {}, {}, and {}...", p1, p2, p3))
            .color(0x00FF00)
    )).await?;

    // Placeholder for summon
    ctx.say("A new Pokémon has been summoned! (placeholder)").await?;

    Ok(())
}

/// Find users with Pokemon of a specific name
#[poise::command(slash_command, rename = "pokemon-find")]
pub async fn pokemon_find(
    ctx: Context<'_>,
    #[description = "The name of Pokemon to search for"] name: String,
) -> Result<(), Error> {
    ctx.defer().await?;
    let name = name.to_lowercase().trim();
    let rows = ctx.data().db.get_users_with_pokemon(name).await?;

    if rows.is_empty() {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("No users found with {}", name))
        )).await?;
        return Ok(());
    }

    let mut user_list = Vec::new();
    for (uid, count) in rows {
        let username = match uid.parse::<u64>() {
            Ok(id) => match serenity::UserId::new(id).to_user(ctx).await {
                Ok(u) => u.name,
                Err(_) => format!("<@{}>", uid),
            },
            Err(_) => format!("<@{}>", uid),
        };
        user_list.push(format!("{}: {}", username, count));
    }

    let items_per_page = 10;
    let mut current_page = 0;
    let total_pages = (user_list.len() as f64 / items_per_page as f64).ceil() as usize;

    let ctx_id = ctx.id();
    let prev_id = format!("{}findprev", ctx_id);
    let next_id = format!("{}findnext", ctx_id);

    let generate_embed = |page: usize, list: &[String]| {
        let start = page * items_per_page;
        let end = std::cmp::min(start + items_per_page, list.len());
        let page_items = &list[start..end];
        
        serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("Users with {}", name))
            .description(format!("```\n{}\n```", page_items.join("\n")))
            .footer(serenity::CreateEmbedFooter::new(format!("Page {} of {}", page + 1, total_pages)))
    };

    let reply = ctx.send(poise::CreateReply::default()
        .embed(generate_embed(current_page, &user_list))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&prev_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(true),
            serenity::CreateButton::new(&next_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(total_pages <= 1),
        ])])
    ).await?;

    let mut interaction_stream = reply.message().await?.await_component_interactions(ctx.serenity_context()).timeout(std::time::Duration::from_secs(60)).stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.data.custom_id == prev_id && current_page > 0 {
            current_page -= 1;
        } else if mci.data.custom_id == next_id && current_page < total_pages.saturating_sub(1) {
            current_page += 1;
        } else {
            continue;
        }

        mci.create_response(ctx, serenity::CreateInteractionResponse::UpdateMessage(
            serenity::CreateInteractionResponseMessage::new()
                .embed(generate_embed(current_page, &user_list))
                .components(vec![serenity::CreateActionRow::Buttons(vec![
                    serenity::CreateButton::new(&prev_id).label("⬅️ Back").style(serenity::ButtonStyle::Primary).disabled(current_page == 0),
                    serenity::CreateButton::new(&next_id).label("Next ➡️").style(serenity::ButtonStyle::Primary).disabled(current_page >= total_pages.saturating_sub(1)),
                ])])
        )).await?;
    }

    Ok(())
}
