use crate::{Context, Error, utils};
use rand::Rng;

pub enum EatItem {
    MysticSmall { earned: f64 },
    MysticHuge { earned: f64 },
    Choke,
    Extra2,
    Extra5,
    Nom,
}

pub enum EatResult {
    NotEnough { dinonuggies: f64, amount: i64 },
    Cheat { amount: i64, dinonuggies: f64 },
    Single { item: EatItem, previous_dinonuggies: f64, earned: f64, bonus_nuggies: i64 },
    Batch {
        amount: i64,
        items: Vec<EatItem>,
        total_earned: f64,
        total_nuggies_earned: i64,
        remaining_lost: i64,
        previous_dinonuggies: f64,
    },
}

fn roll_one() -> EatItem {
    let mut rng = rand::thread_rng();
    let val: f64 = rng.gen();
    if val < 0.2 {
        EatItem::MysticSmall { earned: 2000.0 + rng.gen_range(0.0..1000.0).floor() }
    } else if val < 0.25 {
        EatItem::MysticHuge { earned: 5000.0 + rng.gen_range(0.0..2000.0).floor() }
    } else if val < 0.35 {
        EatItem::Choke
    } else if val < 0.45 {
        EatItem::Extra2
    } else if val < 0.48 {
        EatItem::Extra5
    } else {
        EatItem::Nom
    }
}

pub fn format_eat_item_line(item: &EatItem) -> String {
    match item {
        EatItem::MysticSmall { earned } => format!("You found a hidden mystichunterzium nugget in the dinonuggie! You earned {} mystic credits.", utils::format(*earned)),
        EatItem::MysticHuge { earned } => format!("You found a huge mystichunterzium nugget in the dinonuggie! You earned {} mystic credits.", utils::format(*earned)),
        EatItem::Choke => "You choked on the dinonuggie and died.".to_string(),
        EatItem::Extra2 => "You found 2 dinonuggies in the dinonuggie! I don't know how that works, it just does.".to_string(),
        EatItem::Extra5 => "You found 5 dinonuggies in the dinonuggie! Uhmmm what?".to_string(),
        EatItem::Nom => "nom nom nom".to_string(),
    }
}

pub async fn process_eat(ctx: &Context<'_>, user_id: &str, amount: i64) -> anyhow::Result<EatResult> {
    let user = ctx.data().db.get_user(user_id).await?;
    let dinonuggies = user.dinonuggies;

    if dinonuggies < amount as f64 {
        return Ok(EatResult::NotEnough { dinonuggies, amount });
    }

    if amount < 0 {
        return Ok(EatResult::Cheat { amount, dinonuggies });
    }

    ctx.data().db.add_user_attr(user_id, "dinonuggies", -(amount as f64)).await?;

    if amount == 1 {
        let item = roll_one();
        let mut earned = 0.0;
        let mut bonus_nuggies = 0;
        match item {
            EatItem::MysticSmall { earned: e } | EatItem::MysticHuge { earned: e } => {
                earned = e;
                ctx.data().db.add_user_attr(user_id, "credits", earned).await?;
            },
            EatItem::Extra2 => {
                bonus_nuggies = 2;
                ctx.data().db.add_user_attr(user_id, "dinonuggies", 2.0).await?;
            },
            EatItem::Extra5 => {
                bonus_nuggies = 5;
                ctx.data().db.add_user_attr(user_id, "dinonuggies", 5.0).await?;
            },
            _ => {}
        }
        return Ok(EatResult::Single { item, previous_dinonuggies: dinonuggies, earned, bonus_nuggies });
    }

    let mut items = Vec::new();
    let mut total_earned = 0.0;
    let mut total_nuggies_earned = 0;
    let mut remaining = amount;

    while remaining > 0 {
        remaining -= 1;
        let item = roll_one();
        match &item {
            EatItem::MysticSmall { earned: e } | EatItem::MysticHuge { earned: e } => {
                total_earned += *e;
            },
            EatItem::Extra2 => {
                total_nuggies_earned += 2;
            },
            EatItem::Extra5 => {
                total_nuggies_earned += 5;
            },
            EatItem::Choke => {
                items.push(item);
                break;
            },
            _ => {}
        }
        items.push(item);
    }

    if total_earned > 0.0 {
        ctx.data().db.add_user_attr(user_id, "credits", total_earned).await?;
    }
    if total_nuggies_earned > 0 {
        ctx.data().db.add_user_attr(user_id, "dinonuggies", total_nuggies_earned as f64).await?;
    }

    Ok(EatResult::Batch {
        amount,
        items,
        total_earned,
        total_nuggies_earned,
        remaining_lost: remaining,
        previous_dinonuggies: dinonuggies,
    })
}
