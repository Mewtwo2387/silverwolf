use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;
use rand::Rng;

#[derive(poise::ChoiceParameter)]
pub enum RouletteBetType {
    Number,
    Red,
    Black,
    Green,
    Even,
    Odd,
}

fn get_color(num: i32) -> &'static str {
    if num == 0 { return "green"; }
    let red_numbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    if red_numbers.contains(&num) { "red" } else { "black" }
}

/// guess what? more betting. bet your credits on roulette.
#[poise::command(slash_command)]
pub async fn roulette(
    ctx: Context<'_>,
    #[description = "the amount of mystic credits to bet"] amount_str: String,
    #[description = "the type of bet"] bet_type: RouletteBetType,
    #[description = "the value if it is a number bet"] bet_value: Option<i32>,
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

    if let RouletteBetType::Number = bet_type {
        if let Some(val) = bet_value {
            if val < 0 || val > 36 {
                ctx.say("Invalid number. Must be between 0 and 36").await?;
                return Ok(());
            }
        } else {
            ctx.say("You must provide a number for a Number bet!").await?;
            return Ok(());
        }
    }

    let wheel_result = {
        let mut rng = rand::thread_rng();
        rng.gen_range(0..37)
    };
    let color_result = get_color(wheel_result);

    let user = ctx.data().db.get_user(&user_id).await?;
    let mut streak = user.roulette_streak;
    let mut multi = 0.0;
    let mut result_msg = format!("The wheel landed on **{} {}**.\n", wheel_result, color_result);

    let mut win = false;
    match bet_type {
        RouletteBetType::Number => {
            if let Some(val) = bet_value {
                if val == wheel_result {
                    multi = 38.0 * 1.06f64.powi(streak as i32);
                    streak += 1;
                    result_msg += &format!("You correctly guessed the number! You are now on a streak of {}", streak);
                    win = true;
                }
            }
        }
        RouletteBetType::Red => {
            if color_result == "red" {
                multi = 2.0 * 1.06f64.powi(streak as i32);
                streak += 1;
                result_msg += &format!("You correctly guessed red! You are now on a streak of {}", streak);
                win = true;
            }
        }
        RouletteBetType::Black => {
            if color_result == "black" {
                multi = 2.0 * 1.06f64.powi(streak as i32);
                streak += 1;
                result_msg += &format!("You correctly guessed black! You are now on a streak of {}", streak);
                win = true;
            }
        }
        RouletteBetType::Green => {
            if color_result == "green" {
                multi = 38.0 * 1.06f64.powi(streak as i32);
                streak += 1;
                result_msg += &format!("You correctly guessed green! You are now on a streak of {}", streak);
                win = true;
            }
        }
        RouletteBetType::Even => {
            if wheel_result != 0 && wheel_result % 2 == 0 {
                multi = 2.0 * 1.06f64.powi(streak as i32);
                streak += 1;
                result_msg += &format!("You correctly guessed even! You are now on a streak of {}", streak);
                win = true;
            }
        }
        RouletteBetType::Odd => {
            if wheel_result != 0 && wheel_result % 2 != 0 {
                multi = 2.0 * 1.06f64.powi(streak as i32);
                streak += 1;
                result_msg += &format!("You correctly guessed odd! You are now on a streak of {}", streak);
                win = true;
            }
        }
    }

    if !win {
        streak = 0;
        result_msg += "You guessed wrongly. Skill issue.";
    }

    let benefits = ctx.data().db.get_marriage_benefits(&user_id).await?;
    multi *= benefits;

    let winnings = ctx.data().db.record_roulette_result(&user_id, amount, multi, streak).await?;

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(if win { 0x00AA00 } else { 0xAA0000 })
            .title(format!("You bet {} mystic credits and {}!", 
                utils::format(amount),
                if win { format!("won {} mystic credits", utils::format(winnings)) } else { "lost".to_string() }
            ))
            .description(result_msg))
    ).await?;

    Ok(())
}
