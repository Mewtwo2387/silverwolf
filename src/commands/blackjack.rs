use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;
use rand::seq::SliceRandom;
use futures::StreamExt;

#[derive(Clone, Copy)]
pub struct Card {
    pub suit: &'static str,
    pub value: &'static str,
}

impl Card {
    fn score(&self) -> i64 {
        match self.value {
            "A" => 11,
            "K" | "Q" | "J" | "10" => 10,
            _ => self.value.parse().unwrap_or(0),
        }
    }
}

fn create_deck() -> Vec<Card> {
    let suits = ["♠", "♣", "♥", "♦"];
    let values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    let mut deck = Vec::new();
    for suit in suits {
        for value in values {
            deck.push(Card { suit, value });
        }
    }
    let mut rng = rand::thread_rng();
    deck.shuffle(&mut rng);
    deck
}

fn calculate_hand(hand: &[Card]) -> i64 {
    let mut total = hand.iter().map(|c| c.score()).sum::<i64>();
    let mut aces = hand.iter().filter(|c| c.value == "A").count();
    while total > 21 && aces > 0 {
        total -= 10;
        aces -= 1;
    }
    total
}

fn format_hand(hand: &[Card]) -> String {
    hand.iter().map(|c| format!("{}{}", c.suit, c.value)).collect::<Vec<_>>().join(", ")
}

/// bj with silverwolf
#[poise::command(slash_command)]
pub async fn blackjack(
    ctx: Context<'_>,
    #[description = "the amount of mystic credits to bet"] amount_str: String,
) -> Result<(), Error> {
    let bet_res = utils::check_valid_bet_raw(ctx.data().db.as_ref(), &ctx.author().id.to_string(), &amount_str).await?;
    let amount = match bet_res {
        utils::BetResult::Valid(a) => a,
        utils::BetResult::Infinity => {
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xAA0000)
                    .title("You have been spotted cheating! Mystic credits set to 0."))
            ).await?;
            return Ok(());
        }
        _ => {
            ctx.say("Invalid bet amount!").await?;
            return Ok(());
        }
    };

    let mut deck = create_deck();
    let mut player_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];
    let mut dealer_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];

    let ctx_id = ctx.id();
    let hit_id = format!("{}hit", ctx_id);
    let stand_id = format!("{}stand", ctx_id);

    let build_embed = |p_hand: &[Card], d_hand: &[Card], title: &str, finished: bool| {
        let d_str = if finished { format_hand(d_hand) } else { format_hand(&d_hand[0..1]) };
        let d_score = if finished { calculate_hand(d_hand).to_string() } else { "??".to_string() };

        serenity::CreateEmbed::new()
            .color(0x0099ff)
            .title(format!("Blackjack - {}", title))
            .description(format!("Your hand: {} ({})\nSilverwolf's hand: {} ({})\n\n{}", 
                format_hand(p_hand), 
                calculate_hand(p_hand),
                d_str,
                d_score,
                if finished { "" } else { "Hit or Stand?" }
            ))
    };

    let reply = ctx.send(poise::CreateReply::default()
        .embed(build_embed(&player_hand, &dealer_hand, "Game Start", false))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&hit_id).label("Hit").style(serenity::ButtonStyle::Primary),
            serenity::CreateButton::new(&stand_id).label("Stand").style(serenity::ButtonStyle::Secondary),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    let mut finished = false;
    let mut reason = "time";

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("These buttons aren't for you smh").ephemeral(true)
            )).await?;
            continue;
        }

        if mci.data.custom_id == hit_id {
            player_hand.push(deck.pop().unwrap());
            if calculate_hand(&player_hand) > 21 {
                reason = "busted";
                finished = true;
                break;
            } else {
                mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                    serenity::CreateInteractionResponseMessage::new()
                        .embed(build_embed(&player_hand, &dealer_hand, "Hit", false))
                )).await?;
            }
        } else if mci.data.custom_id == stand_id {
            reason = "stand";
            finished = true;
            break;
        }
    }

    if !finished {
        ctx.say("Time ran out!").await?;
        // Handle loss...
        return Ok(());
    }

    if reason == "busted" {
        ctx.data().db.record_blackjack_loss(&ctx.author().id.to_string(), amount).await?;
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title(format!("You busted! You lost {} mystic credits!", utils::format(amount)))
                .description(format!("Your hand: {} ({})\nSilverwolf's hand: {} ({})", 
                    format_hand(&player_hand), calculate_hand(&player_hand),
                    format_hand(&dealer_hand), calculate_hand(&dealer_hand)
                )))
            .components(vec![])
        ).await?;
    } else {
        while calculate_hand(&dealer_hand) < 17 {
            dealer_hand.push(deck.pop().unwrap());
        }

        let p_score = calculate_hand(&player_hand);
        let d_score = calculate_hand(&dealer_hand);

        let user_id = ctx.author().id.to_string();

        if d_score > 21 || p_score > d_score {
            let (_multi, streak, winnings) = ctx.data().db.record_blackjack_win(&user_id, amount).await?;
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0x00AA00)
                    .title(format!("You win! You won {} mystic credits!", utils::format(winnings)))
                    .description(format!("Your hand: {} ({})\nSilverwolf's hand: {} ({})\nYou are now on a streak of {}", 
                        format_hand(&player_hand), p_score,
                        format_hand(&dealer_hand), d_score,
                        streak
                    )))
                .components(vec![])
            ).await?;
        } else if p_score < d_score {
            ctx.data().db.record_blackjack_loss(&user_id, amount).await?;
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xAA0000)
                    .title(format!("Silverwolf wins! You lost {} mystic credits!", utils::format(amount)))
                    .description(format!("Your hand: {} ({})\nSilverwolf's hand: {} ({})", 
                        format_hand(&player_hand), p_score,
                        format_hand(&dealer_hand), d_score
                    )))
                .components(vec![])
            ).await?;
        } else {
            ctx.data().db.record_blackjack_tie(&user_id, amount).await?;
            ctx.send(poise::CreateReply::default()
                .embed(serenity::CreateEmbed::new()
                    .color(0xFFFF00)
                    .title(format!("No one wins! Nothing happened to your {} mystic credits, boring.", utils::format(amount)))
                    .description(format!("Your hand: {} ({})\nSilverwolf's hand: {} ({})", 
                        format_hand(&player_hand), p_score,
                        format_hand(&dealer_hand), d_score
                    )))
                .components(vec![])
            ).await?;
        }
    }

    Ok(())
}
