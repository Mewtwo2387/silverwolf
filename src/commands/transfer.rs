use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;

struct TransferDetails {
    give: i64,
    receive: i64,
    description: String,
}

fn calculate_transfer_details(amount: f64, target_name: &str) -> TransferDetails {
    let tiers = [
        (10_000_000.0, 2.75, 0.001, 3, 0.0),
        (1_000_000.0, 2.15, 0.01, 2, 0.0),
        (100_000.0, 1.75, 0.05, 1, 0.0),
        (-1.0, 1.5, 0.25, 0, 10000.0),
    ];

    let (_threshold, give_factor, receive_factor, tax_level, small_fee) = tiers.iter().find(|(t, ..)| amount > *t).unwrap();

    let give = (amount * give_factor + small_fee) as i64;
    let receive = (amount * receive_factor) as i64;

    let mut description = format!("**You pay:**\nAmount: {}\nVAT: {}\nElectricity fee: {}\nTransaction fee: {}", 
        utils::format(amount),
        utils::format(amount * 0.25),
        utils::format(amount * 0.1),
        utils::format(amount * 0.15)
    );

    if *small_fee > 0.0 { description.push_str(&format!("\nSmall transfer fee: {}", utils::format(*small_fee))); }
    if *tax_level > 0 { description.push_str(&format!("\nBig transfer fee (>100k): {}", utils::format(amount * 0.2))); }
    if *tax_level > 1 { description.push_str(&format!("\nHuge transfer fee (>1m): {}", utils::format(amount * 0.4))); }
    if *tax_level > 2 { description.push_str(&format!("\nYourmom transfer fee (>10m): {}", utils::format(amount * 0.6))); }

    description.push_str(&format!("\n**Total: {}**\n\n**{} receives:**\nAmount: {}\nVAT: {}\nTransfer tax: {}", 
        utils::format(give as f64),
        target_name,
        utils::format(amount),
        utils::format(amount * -0.25),
        utils::format(amount * -0.2)
    ));

    if *tax_level > 0 { description.push_str(&format!("\nBig transfer tax (>100k): {}", utils::format(amount * -0.2))); }
    if *tax_level > 1 { description.push_str(&format!("\nHuge transfer tax (>1m): {}", utils::format(amount * -0.04))); }
    if *tax_level > 2 { description.push_str(&format!("\nYourmom transfer tax (>10m): {}", utils::format(amount * -0.009))); }

    description.push_str(&format!("\n**Total: {}**", utils::format(receive as f64)));

    TransferDetails { give, receive, description }
}

/// Transfer mystic credits to another user (taxed)
#[poise::command(slash_command)]
pub async fn transfer(
    ctx: Context<'_>,
    #[description = "the user to transfer to"] target: serenity::User,
    #[description = "the amount of credits to transfer"] amount_str: String,
) -> Result<(), Error> {
    let amount = utils::anti_format(&amount_str);
    
    if amount <= 0.0 {
        ctx.say("You can't transfer debt or zero!").await?;
        return Ok(());
    }

    let user_id = ctx.author().id.to_string();
    let db_user = ctx.data().db.get_user(&user_id).await?;

    let details = calculate_transfer_details(amount, &target.name);

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0xAA0000)
            .title(format!("Transferring {} credits to {}...", utils::format(amount), target.name))
            .description(&details.description))
    ).await?;

    if details.give as f64 > db_user.credits {
        ctx.say("You don't have enough credits!").await?;
    } else {
        ctx.data().db.add_credits(&user_id, -(details.give as f64)).await?;
        ctx.data().db.add_credits(&target.id.to_string(), details.receive as f64).await?;
        
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("Successfully transferred {} credits to {}!", utils::format(amount), target.name))
                .description(format!("You paid {} credits and {} received {} credits.", 
                    utils::format(details.give as f64), 
                    target.name, 
                    utils::format(details.receive as f64)
                ))
                .footer(serenity::CreateEmbedFooter::new("No you don't have a choice to cancel. We took your money already.")))
        ).await?;
    }

    Ok(())
}
