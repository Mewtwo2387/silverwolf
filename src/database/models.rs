use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::NaiveDateTime;

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub credits: f64,
    pub bitcoin: f64,
    pub last_bought_price: f64,
    pub last_bought_amount: f64,
    pub total_bought_price: f64,
    pub total_bought_amount: f64,
    pub total_sold_price: f64,
    pub total_sold_amount: f64,
    pub dinonuggies: f64,
    pub dinonuggies_last_claimed: Option<NaiveDateTime>,
    pub dinonuggies_claim_streak: i64,
    pub multiplier_amount_level: i64,
    pub multiplier_rarity_level: i64,
    pub beki_level: i64,
    pub birthdays: Option<NaiveDateTime>,
    pub ascension_level: i64,
    pub heavenly_nuggies: f64,
    pub nuggie_flat_multiplier_level: i64,
    pub nuggie_streak_multiplier_level: i64,
    pub nuggie_credits_multiplier_level: i64,
    pub pity: i64,
    pub slots_times_played: i64,
    pub slots_amount_gambled: f64,
    pub slots_times_won: i64,
    pub slots_amount_won: f64,
    pub slots_relative_won: f64,
    pub blackjack_times_played: i64,
    pub blackjack_amount_gambled: f64,
    pub blackjack_times_won: i64,
    pub blackjack_times_drawn: i64,
    pub blackjack_times_lost: i64,
    pub blackjack_amount_won: f64,
    pub blackjack_relative_won: f64,
    pub roulette_times_played: i64,
    pub roulette_amount_gambled: f64,
    pub roulette_times_won: i64,
    pub roulette_amount_won: f64,
    pub roulette_relative_won: f64,
    pub roulette_streak: i64,
    pub roulette_max_streak: i64,
    pub blackjack_streak: i64,
    pub blackjack_max_streak: i64,
    pub dinonuggie_last_gambled: Option<NaiveDateTime>,
    pub nuggie_pokemon_multiplier_level: i64,
    pub nuggie_nuggie_multiplier_level: i64,
    pub stellar_nuggies: f64,
    pub last_murder: Option<NaiveDateTime>,
    pub murder_success: i64,
    pub murder_fail: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pokemon {
    pub user_id: String,
    pub pokemon_name: String,
    pub pokemon_count: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Marriage {
    pub user1_id: String,
    pub user2_id: String,
    pub married_on: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Baby {
    pub id: i64,
    pub mother_id: String,
    pub father_id: String,
    pub status: String,
    pub name: String,
    pub created: NaiveDateTime,
    pub born: Option<NaiveDateTime>,
    pub level: i64,
    pub job: Option<String>,
    pub pinger_target: Option<String>,
    pub pinger_channel: Option<String>,
    pub nuggie_claimer_claims: i64,
    pub nuggie_claimer_claimed: i64,
    pub gambler_games: i64,
    pub gambler_wins: i64,
    pub gambler_losses: i64,
    pub gambler_credits_gambled: f64,
    pub gambler_credits_won: f64,
    pub pinger_pings: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PoopEntry {
    pub id: i64,
    pub user_id: String,
    pub logged_at: i64,
    pub colour: Option<String>,
    pub size: Option<String>,
    pub r#type: Option<String>,
    pub duration: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiChatSession {
    pub session_id: i64,
    pub user_id: String,
    pub persona_name: String,
    pub active: i64,
    pub created_at: NaiveDateTime,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiChatHistory {
    pub id: i64,
    pub session_id: i64,
    pub role: String,
    pub message: String,
    pub timestamp: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub session_id: i64,
    pub started_by: String,
    pub server_id: String,
    pub active: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistory {
    pub id: i64,
    pub session_id: i64,
    pub role: String,
    pub message: String,
    pub timestamp: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BirthdayReminder {
    pub id: i64,
    pub notifier_id: String,
    pub tracked_user_id: String,
    pub days_before: i64,
    pub last_reminded_year: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GameUid {
    pub user_id: String,
    pub game: String,
    pub game_uid: String,
    pub region: Option<String>,
}
