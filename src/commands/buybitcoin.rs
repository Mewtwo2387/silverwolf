use crate::{Context, Error, utils, bitcoin};
use poise::serenity_prelude as serenity;

/// buy bitcoin with mystic credits
#[poise::command(slash_command)]
pub async fn buybitcoin(
    ctx: Context<'_>,
    #[description = "the amount of bitcoin to buy (negative to sell)"] amount: f64,
) -> Result<(), Error> {
    ctx.defer().await?;

    let price = match bitcoin::get_bitcoin_price().await {
        Ok(p) => p,
        Err(_) => {
            ctx.say("Failed to get bitcoin price").await?;
            return Ok(());
        }
    };

    let user_id = ctx.author().id.to_string();
    let mut db_user = ctx.data().db.get_user(&user_id).await?;

    if amount == 0.0 {
        ctx.say("You bought gamebang's pp!").await?;
    } else if amount < 0.0 {
        if db_user.bitcoin < -amount {
            ctx.say("You don't have that much bitcoin to sell smh").await?;
        } else {
            ctx.data().db.update_user_attr(&user_id, "bitcoin", amount, true).await?;
            ctx.data().db.update_user_attr(&user_id, "credits", -amount * price, true).await?;
            ctx.data().db.update_user_attr(&user_id, "total_sold_amount", -amount, true).await?;
            ctx.data().db.update_user_attr(&user_id, "total_sold_price", -amount * price, true).await?;
            
            db_user = ctx.data().db.get_user(&user_id).await?;
            
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0x00AA00)
                    .title(format!("Sold {} bitcoin for {} mystic credits!", -amount, utils::format(-amount * price)))
                    .description(format!("Current bitcoin price: {}\nLast bought price: {} ({} bitcoin)\nCurrent bitcoin amount: {}\nCurrent mystic credits: {}", 
                        utils::format(price),
                        utils::format(db_user.last_bought_price),
                        db_user.last_bought_amount,
                        db_user.bitcoin,
                        utils::format(db_user.credits as f64)
                    )))
            ).await?;
        }
    } else if (db_user.credits as f64) < amount * price {
        ctx.say("You're too poor to buy that much bitcoin smh").await?;
    } else {
        ctx.data().db.update_user_attr(&user_id, "bitcoin", amount, true).await?;
        ctx.data().db.update_user_attr(&user_id, "credits", -amount * price, true).await?;
        ctx.data().db.update_user_attr(&user_id, "total_bought_amount", amount, true).await?;
        ctx.data().db.update_user_attr(&user_id, "total_bought_price", amount * price, true).await?;
        ctx.data().db.update_user_attr(&user_id, "last_bought_amount", amount, false).await?;
        ctx.data().db.update_user_attr(&user_id, "last_bought_price", price, false).await?;
        
        db_user = ctx.data().db.get_user(&user_id).await?;
        
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title(format!("Bought {} bitcoin for {} mystic credits!", amount, utils::format(amount * price)))
                .description(format!("Current bitcoin price: {}\nCurrent bitcoin amount: {}\nCurrent mystic credits: {}", 
                    utils::format(price),
                    db_user.bitcoin,
                    utils::format(db_user.credits as f64)
                )))
        ).await?;
    }

    Ok(())
}
