use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;
use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize, Clone)]
pub struct SlotsEmote {
    pub emote: String,
    pub value: f64,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SlotsSkin {
    pub name: String,
    pub emotes: Vec<SlotsEmote>,
    pub color: String,
    pub win_message: String,
    pub lose_message: String,
}

const LINES: [[usize; 5]; 9] = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 1, 2, 2, 2],
    [2, 1, 0, 0, 0],
    [0, 0, 0, 1, 2],
    [2, 2, 2, 1, 0],
];

/// lose all your mystic credits
#[poise::command(slash_command)]
pub async fn slots(
    ctx: Context<'_>,
    #[description = "the amount of mystic credits to bet"] amount_str: String,
) -> Result<(), Error> {
    let user_id = ctx.author().id.to_string();
    let bet_res = utils::check_valid_bet_raw(ctx.data().db.as_ref(), &user_id, &amount_str).await?;
    let amount = match bet_res {
        utils::BetResult::Valid(a) => a,
        _ => {
            ctx.say("Invalid bet amount!").await?;
            return Ok(());
        }
    };

    let season = ctx.data().db.get_global_config("season").await?.unwrap_or_else(|| "normal".to_string());
    let skins_str = std::fs::read_to_string("data/config/skin/slots.json")?;
    let skins: serde_json::Value = serde_json::from_str(&skins_str)?;
    
    let resolved_season = if skins.get(&season).is_some() { &season } else { "normal" };
    let skin_val = &skins[resolved_season];
    let skin: SlotsSkin = serde_json::from_value(skin_val.clone())?;

    let results: Vec<Vec<SlotsEmote>> = {
        let mut rng = rand::thread_rng();
        let mut res = vec![vec![], vec![], vec![]];
        for i in 0..3 {
            for _ in 0..5 {
                let emote = skin.emotes[rng.gen_range(0..skin.emotes.len())].clone();
                res[i].push(emote);
            }
        }
        res
    };

    let mut multi = calculate_multi(&results);

    if resolved_season == "aprilFools" {
        multi = 0.9;
    }

    let benefits = ctx.data().db.get_marriage_benefits(&user_id).await?;
    multi *= benefits;

    let winnings = ctx.data().db.record_slots_result(&user_id, amount, multi).await?;
    let is_win = (winnings - amount) > 0.0;

    let description = format!(
        "{} {} {} {} {}\n{} {} {} {} {}\n{} {} {} {} {}",
        results[0][0].emote, results[0][1].emote, results[0][2].emote, results[0][3].emote, results[0][4].emote,
        results[1][0].emote, results[1][1].emote, results[1][2].emote, results[1][3].emote, results[1][4].emote,
        results[2][0].emote, results[2][1].emote, results[2][2].emote, results[2][3].emote, results[2][4].emote,
    );

    let title = if is_win {
        skin.win_message.replace("{amount}", &utils::format(amount)).replace("{winnings}", &utils::format(winnings))
    } else {
        skin.lose_message.replace("{amount}", &utils::format(amount))
    };

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(utils::parse_hex(&skin.color))
            .title(title)
            .description(description))
    ).await?;

    Ok(())
}

pub fn calculate_multi(results: &Vec<Vec<SlotsEmote>>) -> f64 {
    let mut multi = 0.0;
    for line in LINES {
        if results[line[0]][0].emote == results[line[1]][1].emote
            && results[line[1]][1].emote == results[line[2]][2].emote
            && results[line[2]][2].emote == results[line[3]][3].emote
            && results[line[3]][3].emote == results[line[4]][4].emote {
            multi += results[line[0]][0].value * 20.0;
        } else if results[line[0]][0].emote == results[line[1]][1].emote
            && results[line[1]][1].emote == results[line[2]][2].emote
            && results[line[2]][2].emote == results[line[3]][3].emote {
            multi += results[line[0]][0].value * 4.0;
        } else if results[line[0]][0].emote == results[line[1]][1].emote
            && results[line[1]][1].emote == results[line[2]][2].emote {
            multi += results[line[1]][1].value;
        }
    }
    multi
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_multi() {
        let grid = vec![
            vec![SlotsEmote { emote: "A".into(), value: 1.0 }, SlotsEmote { emote: "A".into(), value: 1.0 }, SlotsEmote { emote: "A".into(), value: 1.0 }, SlotsEmote { emote: "B".into(), value: 2.0 }, SlotsEmote { emote: "B".into(), value: 2.0 }],
            vec![SlotsEmote { emote: "B".into(), value: 2.0 }, SlotsEmote { emote: "B".into(), value: 2.0 }, SlotsEmote { emote: "B".into(), value: 2.0 }, SlotsEmote { emote: "A".into(), value: 1.0 }, SlotsEmote { emote: "A".into(), value: 1.0 }],
            vec![SlotsEmote { emote: "C".into(), value: 3.0 }, SlotsEmote { emote: "C".into(), value: 3.0 }, SlotsEmote { emote: "C".into(), value: 3.0 }, SlotsEmote { emote: "C".into(), value: 3.0 }, SlotsEmote { emote: "C".into(), value: 3.0 }],
        ];
        
        // Line 0 (top): A-A-A-B-B -> 3 A's = 1.0
        // Line 1 (mid): B-B-B-A-A -> 3 B's = 2.0
        // Line 2 (bot): C-C-C-C-C -> 5 C's = 3.0 * 20 = 60.0
        // Line 3 (0,1,2,1,0): A-B-C-B-A -> None
        // Line 4 (2,1,0,1,2): C-B-A-B-C -> None
        // ...
        
        let multi = calculate_multi(&grid);
        assert!(multi >= 63.0); 
    }
}
