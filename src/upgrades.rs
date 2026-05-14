pub struct MultiplierAmount {
    pub bronze: f64,
    pub silver: f64,
    pub gold: f64,
}

pub struct MultiplierChance {
    pub gold: f64,
    pub silver: f64,
    pub bronze: f64,
}

pub fn get_multiplier_amount(level: i64) -> MultiplierAmount {
    let level_f = level as f64;
    MultiplierAmount {
        bronze: 1.4 + 0.1 * level_f,
        silver: 1.8 + 0.2 * level_f,
        gold: 2.6 + 0.4 * level_f,
    }
}

pub fn get_multiplier_chance(level: i64) -> MultiplierChance {
    let level_f = level as f64;
    let mut gold = 0.025 + 0.005 * level_f;
    let mut silver = 0.05 + 0.01 * level_f;
    let mut bronze = 0.1 + 0.02 * level_f;
    
    if gold > 1.0 {
        gold = 1.0;
        silver = 0.0;
        bronze = 0.0;
    } else if gold + silver > 1.0 {
        silver = 1.0 - gold;
        bronze = 0.0;
    } else if gold + silver + bronze > 1.0 {
        bronze = 1.0 - gold - silver;
    }
    
    MultiplierChance { gold, silver, bronze }
}

pub fn get_beki_cooldown(level: i64) -> f64 {
    let level_f = level as f64;
    if level <= 30 {
        24.0 * 0.25f64.powf((level_f - 1.0) / 29.0)
    } else if level <= 40 {
        6.0 * (4.0 / 6.0f64).powf((level_f - 30.0) / 10.0)
    } else if level <= 50 {
        4.0 * (3.0 / 4.0f64).powf((level_f - 40.0) / 10.0)
    } else {
        3.0 * (2.0 / 3.0f64).powf((level_f - 50.0) / 50.0)
    }
}

pub fn get_nuggie_flat_multiplier(level: i64) -> f64 {
    level as f64
}

pub fn get_nuggie_streak_multiplier(level: i64) -> f64 {
    0.01 * (level - 1) as f64
}

pub fn get_nuggie_credits_multiplier(level: i64) -> f64 {
    0.01 * (level - 1) as f64
}

pub fn get_nuggie_poke_multiplier(level: i64) -> f64 {
    0.01 * (level - 1) as f64
}

pub fn get_nuggie_nuggie_multiplier(level: i64) -> f64 {
    0.01 * (level - 1) as f64
}

pub const MAX_LEVEL: i64 = 200;

pub fn get_next_upgrade_cost(level: i64) -> f64 {
    if level < 10 {
        5000.0 * level as f64
    } else if level < 20 {
        500.0 * (level * level) as f64
    } else if level < 30 {
        25.0 * (level * level * level) as f64
    } else {
        (1_000_000.0 * 10.0f64.powf((level - 30) as f64 / 10.0)).floor()
    }
}

pub fn get_total_upgrade_cost(level: i64) -> f64 {
    let mut total = 0.0;
    for i in 1..level {
        total += get_next_upgrade_cost(i);
    }
    total
}

pub fn get_max_level(ascension_level: i64) -> i64 {
    (20 + 10 * ascension_level).min(MAX_LEVEL)
}

pub fn get_next_ascension_upgrade_cost(level: i64, amplifier: f64) -> f64 {
    amplifier * 500.0 * (level * level) as f64
}

pub fn get_total_ascension_upgrade_cost(level: i64, amplifier: f64) -> f64 {
    let mut total = 0.0;
    for i in 1..level {
        total += get_next_ascension_upgrade_cost(i, amplifier);
    }
    total
}
