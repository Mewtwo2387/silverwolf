use crate::{Context, Error, utils, upgrades};
use poise::serenity_prelude as serenity;

pub enum InfoLevel {
    ThisLevel,
    NextLevel,
    ShopInfo,
    CostTotal,
}

fn get_multiplier_amount_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    let mult = upgrades::get_multiplier_amount(level);
    let mult_next = upgrades::get_multiplier_amount(level + amount);
    let cost = upgrades::get_next_upgrade_cost(level);
    let cost_total = upgrades::get_total_upgrade_cost(level);

    let mut info = "### Multiplier Amount Upgrade".to_string();

    match info_level {
        InfoLevel::ThisLevel => {
            info.push_str(&format!(
                "\n**Level:** {}\n**Gold Multiplier:** {}x\n**Silver Multiplier:** {}x\n**Bronze Multiplier:** {}x\n",
                level,
                utils::format_advanced(mult.gold, true, 9.0),
                utils::format_advanced(mult.silver, true, 9.0),
                utils::format_advanced(mult.bronze, true, 9.0)
            ));
        }
        InfoLevel::NextLevel | InfoLevel::ShopInfo | InfoLevel::CostTotal => {
            info.push_str(&format!(
                "\n**Level:** {} -> {}\n**Gold Multiplier:** {}x -> {}x\n**Silver Multiplier:** {}x -> {}x\n**Bronze Multiplier:** {}x -> {}x\n",
                level, level + amount,
                utils::format_advanced(mult.gold, true, 9.0), utils::format_advanced(mult_next.gold, true, 9.0),
                utils::format_advanced(mult.silver, true, 9.0), utils::format_advanced(mult_next.silver, true, 9.0),
                utils::format_advanced(mult.bronze, true, 9.0), utils::format_advanced(mult_next.bronze, true, 9.0)
            ));
        }
    }

    match info_level {
        InfoLevel::NextLevel | InfoLevel::ShopInfo => {
            info.push_str(&format!("**Cost:** {} mystic credits\n", utils::format(cost)));
        }
        _ => {}
    }

    if let InfoLevel::ShopInfo = info_level {
        info.push_str("Buy with `/buy upgrades 1`\n");
    }

    if let InfoLevel::CostTotal = info_level {
        info.push_str(&format!("**Cost for {} to {}:** {} mystic credits\n", level, level + 1, utils::format(cost)));
        info.push_str(&format!("**Cost for 1 to {}:** {} mystic credits\n", level, utils::format(cost_total)));
    }

    info
}

fn get_multiplier_chance_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    let chance = upgrades::get_multiplier_chance(level);
    let chance_next = upgrades::get_multiplier_chance(level + amount);
    let cost = upgrades::get_next_upgrade_cost(level);
    let cost_total = upgrades::get_total_upgrade_cost(level);

    let mut info = "### Multiplier Rarity Upgrade".to_string();

    match info_level {
        InfoLevel::ThisLevel => {
            info.push_str(&format!(
                "\n**Level:** {}\n**Gold Chance:** {}%\n**Silver Chance:** {}%\n**Bronze Chance:** {}%\n",
                level,
                utils::format_advanced(chance.gold * 100.0, true, 9.0),
                utils::format_advanced(chance.silver * 100.0, true, 9.0),
                utils::format_advanced(chance.bronze * 100.0, true, 9.0)
            ));
        }
        InfoLevel::NextLevel | InfoLevel::ShopInfo | InfoLevel::CostTotal => {
            info.push_str(&format!(
                "\n**Level:** {} -> {}\n**Gold Chance:** {}% -> {}%\n**Silver Chance:** {}% -> {}%\n**Bronze Chance:** {}% -> {}%\n",
                level, level + amount,
                utils::format_advanced(chance.gold * 100.0, true, 9.0), utils::format_advanced(chance_next.gold * 100.0, true, 9.0),
                utils::format_advanced(chance.silver * 100.0, true, 9.0), utils::format_advanced(chance_next.silver * 100.0, true, 9.0),
                utils::format_advanced(chance.bronze * 100.0, true, 9.0), utils::format_advanced(chance_next.bronze * 100.0, true, 9.0)
            ));
        }
    }

    match info_level {
        InfoLevel::NextLevel | InfoLevel::ShopInfo => {
            info.push_str(&format!("**Cost:** {} mystic credits\n", utils::format(cost)));
        }
        _ => {}
    }

    if let InfoLevel::ShopInfo = info_level {
        info.push_str("Buy with `/buy upgrades 2`\n");
    }

    if let InfoLevel::CostTotal = info_level {
        info.push_str(&format!("**Cost for {} to {}:** {} mystic credits\n", level, level + 1, utils::format(cost)));
        info.push_str(&format!("**Cost for 1 to {}:** {} mystic credits\n", level, utils::format(cost_total)));
    }

    info
}

fn get_beki_cooldown_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    let cooldown = upgrades::get_beki_cooldown(level);
    let cooldown_next = upgrades::get_beki_cooldown(level + amount);
    let cost = upgrades::get_next_upgrade_cost(level);
    let cost_total = upgrades::get_total_upgrade_cost(level);

    let mut info = "### Beki Upgrade".to_string();

    match info_level {
        InfoLevel::ThisLevel => {
            info.push_str(&format!(
                "\n**Level:** {}\n**Cooldown:** {} hours\n",
                level,
                utils::format_advanced(cooldown, true, 9.0)
            ));
        }
        InfoLevel::NextLevel | InfoLevel::ShopInfo | InfoLevel::CostTotal => {
            info.push_str(&format!(
                "\n**Level:** {} -> {}\n**Cooldown:** {} hours -> {} hours\n",
                level, level + amount,
                utils::format_advanced(cooldown, true, 9.0),
                utils::format_advanced(cooldown_next, true, 9.0)
            ));
        }
    }

    match info_level {
        InfoLevel::NextLevel | InfoLevel::ShopInfo => {
            info.push_str(&format!("**Cost:** {} mystic credits\n", utils::format(cost)));
        }
        _ => {}
    }

    if let InfoLevel::ShopInfo = info_level {
        info.push_str("Buy with `/buy upgrades 3`\n");
    }

    if let InfoLevel::CostTotal = info_level {
        info.push_str(&format!("**Cost for {} to {}:** {} mystic credits\n", level, level + 1, utils::format(cost)));
        info.push_str(&format!("**Cost for 1 to {}:** {} mystic credits\n", level, utils::format(cost_total)));
    }

    info
}

/// View and buy upgrades
#[poise::command(slash_command, subcommands("shop_upgrades", "shop_ascension"))]
pub async fn shop(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// Upgrade your dinonuggie multipliers
#[poise::command(slash_command, rename = "upgrades")]
pub async fn shop_upgrades(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    let max_level = upgrades::get_max_level(user.ascension_level);

    let mut desc = format!("**Your Dinonuggies: {}**\n", utils::format(user.dinonuggies));
    
    if user.multiplier_amount_level < max_level {
        desc.push_str(&get_multiplier_amount_info(user.multiplier_amount_level, InfoLevel::ShopInfo, 1));
    } else {
        desc.push_str(&get_multiplier_amount_info(user.multiplier_amount_level, InfoLevel::ThisLevel, 1));
    }

    if user.multiplier_rarity_level < max_level {
        desc.push_str(&get_multiplier_chance_info(user.multiplier_rarity_level, InfoLevel::ShopInfo, 1));
    } else {
        desc.push_str(&get_multiplier_chance_info(user.multiplier_rarity_level, InfoLevel::ThisLevel, 1));
    }

    if user.beki_level < max_level {
        desc.push_str(&get_beki_cooldown_info(user.beki_level, InfoLevel::ShopInfo, 1));
    } else {
        desc.push_str(&get_beki_cooldown_info(user.beki_level, InfoLevel::ThisLevel, 1));
    }

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title("Upgrades")
            .description(desc))
    ).await?;

    Ok(())
}

/// Buy upgrades and items
#[poise::command(slash_command, subcommands("buy_upgrades", "buy_ascension"))]
pub async fn buy(_: Context<'_>) -> Result<(), Error> {
    Ok(())
}

/// The upgrade to buy
#[derive(poise::ChoiceParameter)]
pub enum UpgradeType {
    #[name = "Multiplier Amount"]
    MultiplierAmount = 1,
    #[name = "Multiplier Rarity"]
    MultiplierRarity = 2,
    #[name = "Beki"]
    Beki = 3,
}

/// Buy multipliers and upgrades
#[poise::command(slash_command, rename = "upgrades")]
pub async fn buy_upgrades(
    ctx: Context<'_>,
    #[description = "The upgrade to buy"] upgrade: UpgradeType,
    #[description = "The amount to buy"] amount: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let amount = amount.unwrap_or(1);
    if amount <= 0 {
        ctx.say("Invalid amount!").await?;
        return Ok(());
    }

    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;
    let max_level = upgrades::get_max_level(user.ascension_level);

    let (current_level, attr_name, upgrade_name) = match upgrade {
        UpgradeType::MultiplierAmount => (user.multiplier_amount_level, "multiplier_amount_level", "Multiplier Amount"),
        UpgradeType::MultiplierRarity => (user.multiplier_rarity_level, "multiplier_rarity_level", "Multiplier Rarity"),
        UpgradeType::Beki => (user.beki_level, "beki_level", "Beki"),
    };

    if current_level >= max_level {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("Upgrade maxed")
                .description("how far do you even want to go")
                .footer(serenity::CreateEmbedFooter::new("increase the cap by ascending")))
        ).await?;
        return Ok(());
    }

    if current_level + amount > max_level {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You cannot buy this much")
                .description(format!("The cap is {}, and you are at {}. You cannot buy more than {} upgrades.", max_level, current_level, max_level - current_level))
                .footer(serenity::CreateEmbedFooter::new("increase the cap by ascending")))
        ).await?;
        return Ok(());
    }

    let mut total_cost = 0.0;
    for i in 0..amount {
        total_cost += upgrades::get_next_upgrade_cost(current_level + i);
    }

    if user.credits < total_cost {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You dont have enough mystic credits")
                .description(format!("You have {} mystic credits, but you need {} to buy the upgrade", utils::format(user.credits), utils::format(total_cost)))
                .footer(serenity::CreateEmbedFooter::new("Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin")))
        ).await?;
        return Ok(());
    }

    ctx.data().db.add_credits(&user_id, -total_cost).await?;
    ctx.data().db.update_user_attr(&user_id, attr_name, amount as f64, true).await?;

    let info_str = match upgrade {
        UpgradeType::MultiplierAmount => get_multiplier_amount_info(current_level, InfoLevel::NextLevel, amount),
        UpgradeType::MultiplierRarity => get_multiplier_chance_info(current_level, InfoLevel::NextLevel, amount),
        UpgradeType::Beki => get_beki_cooldown_info(current_level, InfoLevel::NextLevel, amount),
    };

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("{} Upgrade Bought", upgrade_name))
            .description(format!("{}\nMystic Credits: {} -> {}", info_str, utils::format(user.credits), utils::format(user.credits - total_cost))))
    ).await?;

    Ok(())
}

fn get_ascension_upgrade_info(
    level: i64,
    info_level: InfoLevel,
    title: &str,
    description: &str,
    this_info: &str,
    next_info: &str,
    index: i64,
    amplifier: f64,
) -> String {
    let cost = upgrades::get_next_ascension_upgrade_cost(level, amplifier);
    let cost_total = upgrades::get_total_ascension_upgrade_cost(level, amplifier);

    let mut info = format!("### {} Upgrade\n", title);

    if let InfoLevel::ShopInfo = info_level {
        info.push_str(description);
    }

    if let InfoLevel::ThisLevel = info_level {
        info.push_str(this_info);
    }

    match info_level {
        InfoLevel::NextLevel | InfoLevel::ShopInfo | InfoLevel::CostTotal => {
            info.push_str(next_info);
        }
        _ => {}
    }

    match info_level {
        InfoLevel::NextLevel | InfoLevel::ShopInfo => {
            info.push_str(&format!("**Cost:** {} heavenly nuggies\n", utils::format(cost)));
        }
        _ => {}
    }

    if let InfoLevel::ShopInfo = info_level {
        info.push_str(&format!("Buy with `/buy ascension {}`\n", index));
    }

    if let InfoLevel::CostTotal = info_level {
        info.push_str(&format!("**Cost for {} to {}:** {} heavenly nuggies\n", level, level + 1, utils::format(cost)));
        info.push_str(&format!("**Cost for 1 to {}:** {} heavenly nuggies\n", level, utils::format(cost_total)));
    }

    info
}

fn get_n_flat_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    get_ascension_upgrade_info(
        level, info_level, "Nuggie Flat Multiplier", 
        "Applies a flat multiplier to all claims.\n",
        &format!("**Level:** {}\n**Multiplier:** {}x\n", level, utils::format_advanced(upgrades::get_nuggie_flat_multiplier(level), true, 9.0)),
        &format!("**Level:** {} -> {}\n**Multiplier:** {}x -> {}x\n", level, level + amount, 
            utils::format_advanced(upgrades::get_nuggie_flat_multiplier(level), true, 9.0),
            utils::format_advanced(upgrades::get_nuggie_flat_multiplier(level + amount), true, 9.0)),
        1, 1.0
    )
}

fn get_n_streak_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    get_ascension_upgrade_info(
        level, info_level, "Nuggie Streak Multiplier",
        "Applies a multiplier to all claims based on your current streak.\n",
        &format!("**Level:** {}\n**Multiplier:** {}%/day\n", level, utils::format_advanced(upgrades::get_nuggie_streak_multiplier(level) * 100.0, true, 9.0)),
        &format!("**Level:** {} -> {}\n**Multiplier:** {}%/day -> {}%/day\n", level, level + amount,
            utils::format_advanced(upgrades::get_nuggie_streak_multiplier(level) * 100.0, true, 9.0),
            utils::format_advanced(upgrades::get_nuggie_streak_multiplier(level + amount) * 100.0, true, 9.0)),
        2, 1.0
    )
}

fn get_n_credits_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    get_ascension_upgrade_info(
        level, info_level, "Nuggie Credits Multiplier",
        "Applies a multiplier to all claims based on your current credits.\n",
        &format!("**Level:** {}\n**Multiplier:** +{}% * log2(credits)\n", level, utils::format(upgrades::get_nuggie_credits_multiplier(level) * 100.0)),
        &format!("**Level:** {} -> {}\n**Multiplier:** +{}% * log2(credits) -> +{}% * log2(credits)\n", level, level + amount,
            utils::format(upgrades::get_nuggie_credits_multiplier(level) * 100.0),
            utils::format(upgrades::get_nuggie_credits_multiplier(level + amount) * 100.0)),
        3, 3.0
    )
}

fn get_n_poke_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    get_ascension_upgrade_info(
        level, info_level, "Nuggie PokeMultiplier",
        "Applies a multiplier to all claims based on the number of unique pokemons you have.\n",
        &format!("**Level:** {}\n**Multiplier:** +{}%/pokemon\n", level, utils::format(upgrades::get_nuggie_poke_multiplier(level) * 100.0)),
        &format!("**Level:** {} -> {}\n**Multiplier:** +{}%/pokemon -> +{}%/pokemon\n", level, level + amount,
            utils::format(upgrades::get_nuggie_poke_multiplier(level) * 100.0),
            utils::format(upgrades::get_nuggie_poke_multiplier(level + amount) * 100.0)),
        4, 9.0
    )
}

fn get_n_nuggie_info(level: i64, info_level: InfoLevel, amount: i64) -> String {
    get_ascension_upgrade_info(
        level, info_level, "Nuggie Nuggie Multiplier",
        "Applies a multiplier to all claims based on the number of nuggies you have.\n",
        &format!("**Level:** {}\n**Multiplier:** +{}% * log2(nuggies)\n", level, utils::format(upgrades::get_nuggie_nuggie_multiplier(level) * 100.0)),
        &format!("**Level:** {} -> {}\n**Multiplier:** +{}% * log2(nuggies) -> +{}% * log2(nuggies)\n", level, level + amount,
            utils::format(upgrades::get_nuggie_nuggie_multiplier(level) * 100.0),
            utils::format(upgrades::get_nuggie_nuggie_multiplier(level + amount) * 100.0)),
        5, 27.0
    )
}

/// View ascension upgrades
#[poise::command(slash_command, rename = "ascension")]
pub async fn shop_ascension(ctx: Context<'_>) -> Result<(), Error> {
    ctx.defer().await?;
    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;

    let desc = format!(
        "**Your Ascension level: {}**\n**Your Heavenly Nuggies: {}**\n\n\
        {}\n\
        {}\n\n\
        ### Unlocks at Ascension 2 {}\n{}\n\n\
        ### Unlocks at Ascension 4 {}\n{}\n\n\
        ### Unlocks at Ascension 6 {}\n{}\n\n\
        ### Unlocks at Ascension 10 {}\n### Aeons\nTBA",
        user.ascension_level, utils::format(user.heavenly_nuggies),
        get_n_flat_info(user.nuggie_flat_multiplier_level, InfoLevel::ShopInfo, 1),
        get_n_streak_info(user.nuggie_streak_multiplier_level, InfoLevel::ShopInfo, 1),
        if user.ascension_level >= 2 { "✅" } else { "❌" },
        get_n_credits_info(user.nuggie_credits_multiplier_level, InfoLevel::ShopInfo, 1),
        if user.ascension_level >= 4 { "✅" } else { "❌" },
        get_n_poke_info(user.nuggie_pokemon_multiplier_level, InfoLevel::ShopInfo, 1),
        if user.ascension_level >= 6 { "✅" } else { "❌" },
        get_n_nuggie_info(user.nuggie_nuggie_multiplier_level, InfoLevel::ShopInfo, 1),
        if user.ascension_level >= 10 { "✅" } else { "❌" }
    );

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x0099FF)
            .title("Ascension Upgrades")
            .description(desc))
    ).await?;

    Ok(())
}

/// The ascension upgrade to buy
#[derive(poise::ChoiceParameter)]
pub enum AscensionUpgradeType {
    #[name = "Nuggie Flat Multiplier"]
    Flat = 1,
    #[name = "Nuggie Streak Multiplier"]
    Streak = 2,
    #[name = "Nuggie Credits Multiplier"]
    Credits = 3,
    #[name = "Nuggie PokeMultiplier"]
    Pokemon = 4,
    #[name = "Nuggie Nuggie Multiplier"]
    Nuggie = 5,
}

/// Buy ascension upgrades
#[poise::command(slash_command, rename = "ascension")]
pub async fn buy_ascension(
    ctx: Context<'_>,
    #[description = "The upgrade to buy"] upgrade: AscensionUpgradeType,
    #[description = "The number of levels to buy"] amount: Option<i64>,
) -> Result<(), Error> {
    ctx.defer().await?;
    let amount = amount.unwrap_or(1);
    if amount <= 0 {
        ctx.say("Invalid amount!").await?;
        return Ok(());
    }

    let user_id = ctx.author().id.to_string();
    let user = ctx.data().db.get_user(&user_id).await?;

    let (current_level, attr_name, upgrade_name, amplifier, required_ascension) = match upgrade {
        AscensionUpgradeType::Flat => (user.nuggie_flat_multiplier_level, "nuggie_flat_multiplier_level", "Nuggie Flat Multiplier", 1.0, 1),
        AscensionUpgradeType::Streak => (user.nuggie_streak_multiplier_level, "nuggie_streak_multiplier_level", "Nuggie Streak Multiplier", 1.0, 1),
        AscensionUpgradeType::Credits => (user.nuggie_credits_multiplier_level, "nuggie_credits_multiplier_level", "Nuggie Credits Multiplier", 3.0, 2),
        AscensionUpgradeType::Pokemon => (user.nuggie_pokemon_multiplier_level, "nuggie_pokemon_multiplier_level", "Nuggie PokeMultiplier", 9.0, 4),
        AscensionUpgradeType::Nuggie => (user.nuggie_nuggie_multiplier_level, "nuggie_nuggie_multiplier_level", "Nuggie Nuggie Multiplier", 27.0, 6),
    };

    if user.ascension_level < required_ascension {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You cannot buy this upgrade!")
                .description(format!("You need to be at least ascension {} to buy this upgrade. You are currently at ascension {}", required_ascension, user.ascension_level)))
        ).await?;
        return Ok(());
    }

    let mut total_cost = 0.0;
    for i in 0..amount {
        total_cost += upgrades::get_next_ascension_upgrade_cost(current_level + i, amplifier);
    }

    if user.heavenly_nuggies < total_cost {
        ctx.send(poise::CreateReply::default()
            .embed(serenity::CreateEmbed::new()
                .color(0xAA0000)
                .title("You dont have enough heavenly nuggies")
                .description(format!("You have {} heavenly nuggies, but you need {} to buy the upgrade", utils::format(user.heavenly_nuggies), utils::format(total_cost)))
                .footer(serenity::CreateEmbedFooter::new("heavenly nuggies can be obtained by /ascend")))
        ).await?;
        return Ok(());
    }

    ctx.data().db.update_user_attr(&user_id, "heavenly_nuggies", -total_cost, true).await?;
    ctx.data().db.update_user_attr(&user_id, attr_name, amount as f64, true).await?;

    let info_str = match upgrade {
        AscensionUpgradeType::Flat => get_n_flat_info(current_level, InfoLevel::NextLevel, amount),
        AscensionUpgradeType::Streak => get_n_streak_info(current_level, InfoLevel::NextLevel, amount),
        AscensionUpgradeType::Credits => get_n_credits_info(current_level, InfoLevel::NextLevel, amount),
        AscensionUpgradeType::Pokemon => get_n_poke_info(current_level, InfoLevel::NextLevel, amount),
        AscensionUpgradeType::Nuggie => get_n_nuggie_info(current_level, InfoLevel::NextLevel, amount),
    };

    ctx.send(poise::CreateReply::default()
        .embed(serenity::CreateEmbed::new()
            .color(0x00AA00)
            .title(format!("{} Upgrade Bought", upgrade_name))
            .description(format!("{}\nHeavenly Nuggies: {} -> {}", info_str, utils::format(user.heavenly_nuggies), utils::format(user.heavenly_nuggies - total_cost))))
    ).await?;

    Ok(())
}
