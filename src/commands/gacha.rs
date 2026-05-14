use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use futures::StreamExt;
use rand::Rng;

/// TECHNICAL TEST, WORK IN PROGRESS
#[poise::command(slash_command)]
pub async fn gacha(
    ctx: Context<'_>,
    #[description = "Number of rolls (1 or 10)"]
    #[choices(1, 10)]
    amount: i32,
) -> Result<(), Error> {
    ctx.defer().await?;

    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    let mut pity_count = user.pity;
    let dinonuggies = user.dinonuggies;

    let cost_per_roll = 160.0;
    let total_cost = cost_per_roll * amount as f64;

    if dinonuggies < total_cost {
        ctx.send(poise::CreateReply::default().embed(
            serenity::CreateEmbed::new()
                .title("Not enough dinonuggies!")
                .description(format!("You need {}, but you only have {}.", total_cost, dinonuggies))
                .color(0xFF0000)
        )).await?;
        return Ok(());
    }

    // Deduct cost
    ctx.data().db.add_user_attr(&user_id, "dinonuggies", -total_cost).await?;

    let mut results = Vec::new();
    let mut got_five_star = false;

    {
        let mut rng = rand::thread_rng();

        for _ in 0..amount {
            let pity_rate = if pity_count >= 74 {
                ((pity_count - 73) as f64 * 0.1).min(1.0)
            } else {
                0.006
            };

            let roll: f64 = rng.gen();
            let roll_result;

            if roll < pity_rate {
                // 5 star
                let pool = if rng.gen_bool(0.5) {
                    ctx.data().hsr_characters.as_object().unwrap().values()
                        .filter(|v| v["Rarity"].as_i64() == Some(5))
                        .collect::<Vec<_>>()
                } else {
                    ctx.data().hsr_lc.as_object().unwrap().values()
                        .filter(|v| v["Rarity"].as_i64() == Some(5))
                        .collect::<Vec<_>>()
                };
                roll_result = pool[rng.gen_range(0..pool.len())].clone();
                got_five_star = true;
                pity_count = 0;
            } else if roll < 0.056 {
                // 4 star
                let pool = if rng.gen_bool(0.5) {
                    ctx.data().hsr_characters.as_object().unwrap().values()
                        .filter(|v| v["Rarity"].as_i64() == Some(4))
                        .collect::<Vec<_>>()
                } else {
                    ctx.data().hsr_lc.as_object().unwrap().values()
                        .filter(|v| v["Rarity"].as_i64() == Some(4))
                        .collect::<Vec<_>>()
                };
                roll_result = pool[rng.gen_range(0..pool.len())].clone();
                pity_count += 1;
            } else {
                // 3 star
                let pool: Vec<_> = ctx.data().hsr_lc.as_object().unwrap().values()
                    .filter(|v| v["Rarity"].as_i64() == Some(3))
                    .collect();
                roll_result = pool[rng.gen_range(0..pool.len())].clone();
                pity_count += 1;
            }

            let name_hash = roll_result["AvatarName"]["Hash"].as_str()
                .or_else(|| roll_result["EquipmentName"]["Hash"].as_str())
                .unwrap_or_default();
            let name = ctx.data().hsr_names["en"][name_hash].as_str().unwrap_or("Unknown").to_string();
            let image_path = roll_result["AvatarCutinFrontImgPath"].as_str()
                .or_else(|| roll_result["ImagePath"].as_str());
            let rarity = roll_result["Rarity"].as_i64().unwrap_or(0);

            results.push(GachaResult {
                name,
                image_url: image_path.map(|p| format!("https://enka.network{}", p)),
                rarity,
            });
        }
    }

    // Update pity
    ctx.data().db.set_user_attr(&user_id, "pity", pity_count as f64).await?;

    let mut current_index = 0;

    let generate_embed = |index: usize, results: &[GachaResult], pity: i64, got_5: bool| {
        let item = &results[index];
        let mut embed = serenity::CreateEmbed::new()
            .title(format!("Gacha Roll #{}", index + 1))
            .description(format!("**{}**", item.name))
            .color(if got_5 { 0xFFD700 } else { 0x00FF00 })
            .footer(serenity::CreateEmbedFooter::new(format!("Pity: {}", pity)));
        
        if let Some(url) = &item.image_url {
            embed = embed.image(url);
        }
        embed
    };

    let ctx_id = ctx.id();
    let next_id = format!("{}next", ctx_id);
    let skip_id = format!("{}skip", ctx_id);

    let reply = ctx.send(poise::CreateReply::default()
        .embed(generate_embed(current_index, &results, pity_count, got_five_star))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&next_id).label("➡️ Next").style(serenity::ButtonStyle::Primary).disabled(results.len() == 1),
            serenity::CreateButton::new(&skip_id).label("Skip to Results").style(serenity::ButtonStyle::Danger),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.data.custom_id == next_id {
            current_index += 1;
            if current_index < results.len() {
                mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                    serenity::CreateInteractionResponseMessage::new()
                        .embed(generate_embed(current_index, &results, pity_count, got_five_star))
                        .components(vec![serenity::CreateActionRow::Buttons(vec![
                            serenity::CreateButton::new(&next_id).label("➡️ Next").style(serenity::ButtonStyle::Primary).disabled(current_index == results.len() - 1),
                            serenity::CreateButton::new(&skip_id).label("Skip to Results").style(serenity::ButtonStyle::Danger),
                        ])])
                )).await?;
            }
        } else if mci.data.custom_id == skip_id {
            break;
        }
    }

    // Final results
    let final_embed = serenity::CreateEmbed::new()
        .title(format!("Gacha Roll Results for {} ({})", ctx.author().name, amount))
        .description(results.iter().map(|item| format!("**{}** - {}★", item.name, item.rarity)).collect::<Vec<_>>().join("\n"))
        .color(if got_five_star { 0xFFD700 } else { 0x00FF00 });

    ctx.send(poise::CreateReply::default()
        .embed(final_embed)
        .components(vec![])
    ).await?;

    Ok(())
}

struct GachaResult {
    name: String,
    image_url: Option<String>,
    rarity: i64,
}
