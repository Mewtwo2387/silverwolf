use crate::{Context, Error, utils};
use poise::serenity_prelude as serenity;
use futures::StreamExt;
use rand::seq::SliceRandom;

const PROPOSAL_GIFS: [&str; 9] = [
    "https://media1.tenor.com/m/vor_61NjS7oAAAAC/anime-couple.gif",
    "https://media1.tenor.com/m/an0diNvfSSwAAAAC/marriage-anime-sailor-moon.gif",
    "https://media1.tenor.com/m/WCeJaacSAecAAAAC/anime-wedding.gif",
    "https://media1.tenor.com/m/If1oqh_gE0kAAAAC/anime-wedding.gif",
    "https://media1.tenor.com/m/nyS7gg5Ii0oAAAAC/gurren-lagann-marriage.gif",
    "https://media1.tenor.com/m/fLCsfPKZrlkAAAAC/goku-chichi.gif",
    "https://media1.tenor.com/m/R4EeoV4R-kUAAAAd/spy-x-family-loid-forger.gif",
    "https://media1.tenor.com/m/3OYmSePDSVUAAAAC/black-clover-licht.gif",
    "https://media1.tenor.com/m/UcfxIbNWVyQAAAAC/sailor-moon.gif",
];

const INTERFERENCE_RESPONSES: [&str; 4] = [
    "Yo <@USER_ID>, this is not for you to decide!",
    "Hey <@USER_ID>! Are you trying to crash the party?",
    "Hello <@USER_ID>? What are you trying to do? This is between them, not you.",
    "Excuse me, <@USER_ID>? This is a private matter!",
];

const INTERFERENCE_GIFS: [&str; 5] = [
    "https://media1.tenor.com/m/5IBH0NSUPLQAAAAC/lynette-genshin-impact.gif",
    "https://media1.tenor.com/m/Db72dfVmRUoAAAAC/anime-game.gif",
    "https://media1.tenor.com/m/VFSdoooIp14AAAAC/genshin-impact.gif",
    "https://media1.tenor.com/m/N5jGrowCtRIAAAAC/venti-paimon-slap.gif",
    "https://media1.tenor.com/m/DXMFACgb6EsAAAAd/hotaru-firefly.gif",
];

/// Marriage commands
#[poise::command(slash_command, subcommands("propose", "status", "divorce"))]
pub async fn marriage(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Propose to another user
#[poise::command(slash_command)]
pub async fn propose(
    ctx: Context<'_>,
    #[description = "The user you want to propose to"] target_user: serenity::User,
) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let target_id = target_user.id.to_string();

    if user_id == target_id {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("And then... THEY PUT THEMSELF AS THE ONE TO MARRY... KEKW")
                .image("https://media1.tenor.com/m/tFvnLWU0zWMAAAAC/resitas-laugh.gif"))
        ).await?;
        return Ok(());
    }

    if target_user.bot {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("Seriously?")
                .description("How about you go outside instead of trying to marry a bot-")
                .image("https://media1.tenor.com/m/aefLV3eg758AAAAd/silver-wolf-honkai-star-rail.gif"))
        ).await?;
        return Ok(());
    }

    let (is_married, _) = ctx.data().db.get_marriage_status(&user_id).await?;
    if is_married {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You're already married!")
                .image("https://media1.tenor.com/m/VCBut_Csl-cAAAAC/yo-stop-trying-to-cheat-conceited.gif"))
        ).await?;
        return Ok(());
    }

    let (is_target_married, _) = ctx.data().db.get_marriage_status(&target_id).await?;
    if is_target_married {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title(format!("{} is already married!", target_user.name)))
        ).await?;
        return Ok(());
    }

    let ctx_id = ctx.id();
    let accept_id = format!("{}accept", ctx_id);
    let reject_id = format!("{}reject", ctx_id);

    let reply = ctx.send(poise::CreateReply::default()
        .content(format!("<@{}>, you have a marriage proposal from <@{}>!", target_id, user_id))
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title("Marriage Proposal")
            .description(format!("✨{} has proposed to you.✨", ctx.author().name)))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&accept_id).label("Accept💍").style(serenity::ButtonStyle::Success),
            serenity::CreateButton::new(&reject_id).label("Reject💔").style(serenity::ButtonStyle::Danger),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    while let Some(mci) = interaction_stream.next().await {
        if mci.user.id != target_user.id {
            let (response, gif) = {
                let mut rng = rand::thread_rng();
                let r = INTERFERENCE_RESPONSES.choose(&mut rng).unwrap().replace("USER_ID", &mci.user.id.to_string());
                let g = INTERFERENCE_GIFS.choose(&mut rng).unwrap();
                (r, *g)
            };

            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new()
                    .embed(serenity::CreateEmbed::new()
                        .color(0xFFAA00)
                        .title("Hold On!")
                        .description(response)
                        .image(gif))
                    .ephemeral(true)
            )).await?;
            continue;
        }

        if mci.data.custom_id == accept_id {
            ctx.data().db.add_marriage(&user_id, &target_id).await?;
            let gif = {
                let mut rng = rand::thread_rng();
                *PROPOSAL_GIFS.choose(&mut rng).unwrap()
            };

            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .content(format!("<@{}> has accepted the proposal! Congratulations!", target_id))
                    .embed(serenity::CreateEmbed::new()
                        .color(0x00AA00)
                        .title("Proposal Accepted")
                        .description(format!("{} and {} are now married! 🎉💍", target_user.name, ctx.author().name))
                        .image(gif))
                    .components(vec![])
            )).await?;
            return Ok(());
        } else if mci.data.custom_id == reject_id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .content(format!("<@{}> has rejected the proposal.", target_id))
                    .embed(serenity::CreateEmbed::new()
                        .color(0xAA0000)
                        .title("Proposal Rejected")
                        .description(format!("{} has rejected the proposal from {}.", target_user.name, ctx.author().name)))
                    .components(vec![])
            )).await?;
            return Ok(());
        }
    }

    ctx.send(poise::CreateReply::default()
        .content("The proposal has timed out.")
        .components(vec![])
    ).await?;

    Ok(())
}

/// Check your or another user's marriage status
#[poise::command(slash_command)]
pub async fn status(
    ctx: Context<'_>,
    #[description = "The user whose marriage status you want to check"] user: Option<serenity::User>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let target_user = user.as_ref().unwrap_or(ctx.author());
    let (is_married, partner_id) = ctx.data().db.get_marriage_status(&target_user.id.to_string()).await?;

    if is_married {
        let partner_id = partner_id.unwrap();
        let partner = serenity::UserId::new(partner_id.parse()?).to_user(ctx).await?;
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0x00AA00)
                .title("Marriage Status")
                .description(format!("{} is married to {}. 💍", target_user.name, partner.name)))
        ).await?;
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("Marriage Status")
                .description(format!("{} is currently single.", target_user.name)))
        ).await?;
    }

    Ok(())
}

struct FeeEntry {
    name: String,
    dinonuggies: f64,
    credits: f64,
}

/// Divorce your spouse
#[poise::command(slash_command)]
pub async fn divorce(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let (is_married, partner_id) = ctx.data().db.get_marriage_status(&user_id).await?;

    if !is_married {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("Divorce Status")
                .description("You are not married, so you cannot initiate a divorce.")
                .image("https://media1.tenor.com/m/8h3p86xYBSsAAAAC/how-to-lose-a-guy-in10days-andy.gif"))
        ).await?;
        return Ok(());
    }

    let partner_id = partner_id.unwrap();
    let ctx_id = ctx.id();
    let confirm_id = format!("{}confirm", ctx_id);
    let cancel_id = format!("{}cancel", ctx_id);

    let reply = ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0xFFAA00)
            .title("Divorce Confirmation")
            .description(format!("Are you sure you want to divorce <@{}>? You will receive 50% of the combined assets after heavy court fees.", partner_id)))
        .components(vec![serenity::CreateActionRow::Buttons(vec![
            serenity::CreateButton::new(&confirm_id).label("Confirm Divorce").style(serenity::ButtonStyle::Danger),
            serenity::CreateButton::new(&cancel_id).label("Cancel Divorce").style(serenity::ButtonStyle::Secondary),
        ])])
    ).await?;

    let mut interaction_stream = reply
        .message()
        .await?
        .await_component_interactions(ctx.serenity_context())
        .timeout(std::time::Duration::from_secs(60))
        .stream();

    if let Some(mci) = interaction_stream.next().await {
        if mci.user.id != ctx.author().id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::Message(
                serenity::CreateInteractionResponseMessage::new().content("This is not for you to decide!").ephemeral(true)
            )).await?;
            return Ok(());
        }

        if mci.data.custom_id == confirm_id {
            let user = ctx.data().db.get_user(&user_id).await?;
            let partner = ctx.data().db.get_user(&partner_id).await?;

            let total_nuggies = user.dinonuggies + partner.dinonuggies;
            let total_credits = user.credits + partner.credits;

            let fixed_fee_types = [
                ("Lawyer Fees", 0.30),
                ("Court Fees", 0.20),
            ];

            let dynamic_fee_options = [
                ("Electricity of Court", 0.12),
                ("Water of Court", 0.06),
                ("Rent for Court Space", 0.18),
                ("Air Tax", 0.06),
                ("Gavel Maintenance Fee", 0.03),
                ("Chair Usage Fee", 0.024),
                ("Courtroom Snacks Tax", 0.036),
                ("Clerk Smiling Fee", 0.012),
            ];

            let (selected_dynamic, fixed_fees, mut total_n_fees, mut total_c_fees) = {
                let mut rng = rand::thread_rng();
                let selected = dynamic_fee_options.choose_multiple(&mut rng, 4).cloned().collect::<Vec<_>>();
                
                let mut f_fees = Vec::new();
                let mut n_f = 0.0;
                let mut c_f = 0.0;
                for (name, pct) in fixed_fee_types {
                    let n_fee = (total_nuggies * pct).floor();
                    let c_fee = (total_credits * pct).floor();
                    f_fees.push(FeeEntry { name: name.to_string(), dinonuggies: n_fee, credits: c_fee });
                    n_f += n_fee;
                    c_f += c_fee;
                }
                (selected, f_fees, n_f, c_f)
            };

            let mut dynamic_fees = Vec::new();
            for (name, pct) in selected_dynamic {
                let n_fee = (total_nuggies * pct).floor();
                let c_fee = (total_credits * pct).floor();
                dynamic_fees.push(FeeEntry { name: name.to_string(), dinonuggies: n_fee, credits: c_fee });
                total_n_fees += n_fee;
                total_c_fees += c_fee;
            }

            let adjusted_n = total_nuggies - total_n_fees;
            let adjusted_c = total_credits - total_c_fees;

            let partner_n_share = (adjusted_n * 0.5).floor();
            let initiator_n_share = adjusted_n - partner_n_share;

            let partner_c_share = (adjusted_c * 0.5).floor();
            let initiator_c_share = adjusted_c - partner_c_share;

            ctx.data().db.update_user_attr(&user_id, "dinonuggies", initiator_n_share, false).await?;
            ctx.data().db.update_user_attr(&user_id, "credits", initiator_c_share, false).await?;
            ctx.data().db.update_user_attr(&partner_id, "dinonuggies", partner_n_share, false).await?;
            ctx.data().db.update_user_attr(&partner_id, "credits", partner_c_share, false).await?;
            
            ctx.data().db.remove_marriage(&user_id, &partner_id).await?;

            let fixed_breakdown = fixed_fees.iter()
                .map(|f| format!("- **{}:** {} dinonuggies, {} credits", f.name, utils::format(f.dinonuggies), utils::format(f.credits)))
                .collect::<Vec<_>>().join("\n");
            
            let dynamic_breakdown = dynamic_fees.iter()
                .map(|f| format!("- **{}:** {} dinonuggies, {} credits", f.name, utils::format(f.dinonuggies), utils::format(f.credits)))
                .collect::<Vec<_>>().join("\n");

            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .embed(serenity::CreateEmbed::new()
                        .color(0x00AA00)
                        .title("Divorce Successful")
                        .description(format!(
                            "You have successfully divorced <@{}>.\n\n**Fixed Fees:**\n{}\n\n**Dynamic Fees:**\n{}\n\n**Post-Settlement Distribution:**\n**You received:** {} dinonuggies and {} credits.\n**<@{}> received:** {} dinonuggies and {} credits.",
                            partner_id, fixed_breakdown, dynamic_breakdown,
                            utils::format(initiator_n_share), utils::format(initiator_c_share),
                            partner_id, utils::format(partner_n_share), utils::format(partner_c_share)
                        )))
                    .components(vec![])
            )).await?;

        } else if mci.data.custom_id == cancel_id {
            mci.create_response(ctx.serenity_context(), serenity::CreateInteractionResponse::UpdateMessage(
                serenity::CreateInteractionResponseMessage::new()
                    .embed(serenity::CreateEmbed::new()
                        .color(0x00AA00)
                        .title("Divorce Canceled")
                        .description("The divorce request has been canceled."))
                    .components(vec![])
            )).await?;
        }
    } else {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("Divorce Request Timed Out")
                .description("The divorce request has timed out."))
            .components(vec![])
        ).await?;
    }

    Ok(())
}
