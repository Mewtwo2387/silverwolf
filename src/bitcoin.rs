use serde::Deserialize;

#[derive(Deserialize)]
struct CoindeskResponse {
    bpi: Bpi,
}

#[derive(Deserialize)]
struct Bpi {
    #[serde(rename = "USD")]
    usd: Usd,
}

#[derive(Deserialize)]
struct Usd {
    rate_float: f64,
}

pub async fn get_bitcoin_price() -> anyhow::Result<f64> {
    let url = "https://api.coindesk.com/v1/bpi/currentprice.json";
    let resp = reqwest::get(url).await?.json::<CoindeskResponse>().await?;
    Ok(resp.bpi.usd.rate_float)
}
