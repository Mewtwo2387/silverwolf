mod database;
mod commands;
mod utils;
mod web;
mod mcp;
mod bitcoin;
mod upgrades;
mod scheduler;
mod eat;
mod ai;

use database::Database;
use poise::serenity_prelude as serenity;
use std::env;
use std::sync::Arc;
use tracing::{info, error};

use tokio::sync::Mutex;

// Shared state for the bot
#[derive(Clone)]
pub struct Data {
    pub db: Arc<Database>,
    pub canvas_worker_url: String,
    pub http_client: reqwest::Client,
    pub current_pokemon: Arc<Mutex<Option<String>>>,
    pub genshin_pfps: Arc<serde_json::Value>,
    pub genshin_namecards: Arc<serde_json::Value>,
    pub hsr_avatars: Arc<serde_json::Value>,
    pub hsr_characters: Arc<serde_json::Value>,
    pub hsr_names: Arc<serde_json::Value>,
    pub hsr_lc: Arc<serde_json::Value>,
    pub sex_sessions: Arc<Mutex<Vec<SexSession>>>,
    pub fart_cooldowns: Arc<Mutex<std::collections::HashMap<String, i64>>>,
    pub deleted_messages: Arc<Mutex<std::collections::VecDeque<DeletedMessage>>>,
    pub edited_messages: Arc<Mutex<std::collections::VecDeque<EditedMessage>>>,
}

#[derive(Clone)]
pub struct DeletedMessage {
    pub message: serenity::Message,
    pub replied_message_content: Option<String>,
    pub replied_message_author: Option<String>,
}

#[derive(Clone)]
pub struct EditedMessage {
    pub old: serenity::Message,
    pub r#new: serenity::Message,
}

#[derive(Clone)]
pub struct SexSession {
    pub top: String,
    pub bottom: String,
    pub thrusts: i32,
}

impl SexSession {
    pub fn has_user(&self, user_id: &str) -> bool {
        self.top == user_id || self.bottom == user_id
    }

    pub fn other_user(&self, user_id: &str) -> String {
        if self.top == user_id {
            self.bottom.clone()
        } else {
            self.top.clone()
        }
    }
}

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Context<'a> = poise::Context<'a, Data, Error>;

async fn on_error(error: poise::FrameworkError<'_, Data, Error>) {
    match error {
        poise::FrameworkError::Setup { error, .. } => panic!("Failed to start bot: {:?}", error),
        poise::FrameworkError::Command { error, ctx, .. } => {
            error!("Error in command `{}`: {:?}", ctx.command().name, error);
        }
        error => {
            if let Err(e) = poise::builtins::on_error(error).await {
                error!("Error while handling error: {:?}", e);
            }
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::fmt::init();

    info!("Starting Silverwolf Rust Core...");

    let token = env::var("TOKEN").expect("Missing TOKEN");
    let canvas_worker_url = env::var("CANVAS_WORKER_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    // Initialize Database
    let db = Arc::new(Database::new().await?);

    // Initialize HTTP Client
    let http_client = reqwest::Client::new();

    // Poise framework options
    let options = poise::FrameworkOptions {
        commands: vec![
            // Add commands here as they are ported
            commands::dev::dev(),
            commands::server::server(),
            commands::server::set_server_role(),
            commands::summary::summary(),
            commands::russian_roulette::russian_roulette(),
            commands::utility::convert(),
            commands::utility::discord_timestamp(),
            commands::utility::say(),
            commands::utility::say_dm(),
            commands::ping::ping(),
            commands::quote::quote(),
            commands::eightball::eightball(),
            commands::flip::flip(),
            commands::avatar::avatar(),
            commands::balance::balance(),
            commands::transfer::transfer(),
            commands::ask_silverwolf_ai::ask_silverwolf_ai(),
            commands::fun::love_calculator(),
            commands::fun::risk_n_reward(),
            commands::fun::twenty_twenty_two(),
            commands::fun::awdangit(),
            commands::fun::blame(),
            commands::fun::click(),
            commands::fun::gongyoo(),
            commands::fun::hilichurl(),
            commands::fun::roll(),
            commands::fun::guide(),

            commands::fun::hello(),
            commands::fun::lore(),
            commands::fun::gamebang(),
            commands::fun::sing(),
            commands::fun::grab_emoji(),
            commands::fun::snipe(),
            commands::fortune::fortune(),
            commands::misfortune::misfortune(),
            commands::buybitcoin::buybitcoin(),
            commands::leaderboard::nuggieboard(),
            commands::leaderboard::gamblerboard(),
            commands::leaderboard::murderboard(),
            commands::pokemon::pokemon(),
            commands::pokemon::trade(),
            commands::pokemon::sacrifice(),
            commands::pokemon::pokemon_find(),
            commands::catch::catch(),
            commands::claim::claim(),

            commands::ascend::ascend(),
            commands::blackjack::blackjack(),
            commands::slots::slots(),
            commands::roulette::roulette(),
            commands::shop::shop(),
            commands::shop::buy(),
            commands::marriage::marriage(),
            commands::baby::baby(),
            commands::ai::ai(),
            commands::birthday::birthday(),
            commands::gameuid::gameuid(),
            commands::bitcoin::bitcoin_price(),
            commands::profile::genshin_profile(),
            commands::profile::hsr_profile(),
            commands::fun::love_calculator(),
            commands::fun::random_joke(),
            commands::fun::cat(),
            commands::fun::catcg(),
            commands::fun::spotify_playlist(),
            commands::fun::arlecchino(),
            commands::fun::fart(),
            commands::fun::nword(),
            commands::fun::nothing(),
            commands::f1::f1_standings(),
            commands::gacha::gacha(),
            commands::poop::poop_group(),
            commands::leaderboard::poopboard(),
            commands::sex::sex_group(),
            ],

        on_error: |error| Box::pin(on_error(error)),
        pre_command: |ctx| {
            Box::pin(async move {
                info!("Executing command {}...", ctx.command().qualified_name);
            })
        },
        post_command: |ctx| {
            Box::pin(async move {
                info!("Executed command {}!", ctx.command().qualified_name);
            })
        },
        event_handler: |_ctx, event, _framework, data| {
            Box::pin(async move {
                match event {
                    serenity::FullEvent::MessageDelete { channel_id: _, guild_id: _, message_id: _ } => {
                        // Unfortunately messageDelete event doesn't provide the message content if not cached.
                        // We might need to cache messages ourselves or rely on serenity's cache.
                    },
                    serenity::FullEvent::MessageDeleteBulk { channel_id: _, guild_id: _, message_ids: _ } => {},
                    serenity::FullEvent::MessageUpdate { old_if_available, new: _, event } => {
                         if let Some(old) = old_if_available {
                             let mut edited = data.edited_messages.lock().await;
                             if edited.len() >= 100 { edited.pop_back(); }
                             // We don't have the "new" message easily here as a full message object 
                             // without fetching it. But we can store what we have.
                             // Actually event is MessageUpdateEvent
                         }
                    },
                    _ => {}
                }
                Ok(())
            })
        },
        ..Default::default()
    };

    let framework = poise::Framework::builder()
        .options(options)
        .setup(|ctx, _ready, _framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &_framework.options().commands).await?;
                
                info!("Loading RPG data files...");
                let genshin_pfps = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/genshinPfps.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());
                let genshin_namecards = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/genshinNamecards.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());
                let hsr_avatars = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/hsrAvartars.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());
                let hsr_characters = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/hsrCharacters.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());
                let hsr_names = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/hsr.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());
                let hsr_lc = Arc::new(serde_json::from_str(&std::fs::read_to_string("data/hsrLC.json").unwrap_or_else(|_| "{}".to_string())).unwrap_or_default());

                let data = Data {
                    db,
                    canvas_worker_url,
                    http_client,
                    current_pokemon: Arc::new(Mutex::new(None)),
                    genshin_pfps,
                    genshin_namecards,
                    hsr_avatars,
                    hsr_characters,
                    hsr_names,
                    hsr_lc,
                    sex_sessions: Arc::new(Mutex::new(Vec::new())),
                    fart_cooldowns: Arc::new(Mutex::new(std::collections::HashMap::new())),
                    deleted_messages: Arc::new(Mutex::new(std::collections::VecDeque::with_capacity(100))),
                    edited_messages: Arc::new(Mutex::new(std::collections::VecDeque::with_capacity(100))),
                };
                
                // Start web server in background
                let web_data = data.clone();
                tokio::spawn(async move {
                    if let Err(e) = web::start_website(web_data).await {
                        error!("Web server crashed: {:?}", e);
                    }
                });

                // Start birthday scheduler
                let scheduler_data = data.clone();
                let http = ctx.http.clone();
                tokio::spawn(async move {
                    scheduler::start_birthday_scheduler(scheduler_data, http).await;
                });

                Ok(data)
            })
        })
        .build();

    let mut client = serenity::ClientBuilder::new(token, serenity::GatewayIntents::all())
        .framework(framework)
        .await?;

    info!("Logging in to Discord...");
    client.start().await?;

    Ok(())
}
