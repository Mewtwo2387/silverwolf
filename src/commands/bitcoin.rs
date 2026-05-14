use crate::{Context, Error};
use poise::serenity_prelude as serenity;
use serde::Deserialize;

#[derive(Deserialize)]
struct BitcoinPriceData {
    bpi: std::collections::HashMap<String, CurrencyData>,
    time: TimeData,
    disclaimer: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CurrencyData {
    code: String,
    symbol: String,
    rate: String,
    description: String,
    rate_float: f64,
}

#[derive(Deserialize)]
#[allow(dead_code, non_snake_case)]
struct TimeData {
    updated: String,
    updatedISO: String,
    updateduk: String,
}

/// Fetches the current Bitcoin price
#[poise::command(slash_command)]
pub async fn bitcoin_price(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;

    let url = "https://api.coindesk.com/v1/bpi/currentprice.json";
    let response = ctx.data().http_client.get(url).send().await?;
    let data: BitcoinPriceData = response.json().await?;

    let mut embed = serenity::CreateEmbed::new()
        .title("Current Bitcoin Price")
        .description(format!("As of {}", data.time.updated))
        .footer(serenity::CreateEmbedFooter::new(data.disclaimer));

    for (code, currency) in data.bpi {
        embed = embed.field(
            format!("{} ({})", code, currency.symbol),
            format!("**Rate:** {} {}", currency.rate, currency.code),
            true
        );
    }

    ctx.send(poise::CreateReply::default().embed(embed)).await?;

    Ok(())
}
