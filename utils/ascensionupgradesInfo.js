const { INFO_LEVEL } = require('./upgradesInfo');
const {
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
  getNextAscensionUpgradeCost,
  getTotalAscensionUpgradeCost,
} = require('./ascensionupgrades');
const { format } = require('./math');

function getAscensionUpgradeInfo(
  level,
  infoLevel,
  title,
  description,
  thisInfo,
  nextInfo,
  index,
  amplifier,
) {
  const cost = getNextAscensionUpgradeCost(level, amplifier);
  const costTotal = getTotalAscensionUpgradeCost(level, amplifier);

  let info = `### ${title} Upgrade\n`;

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    info += description;
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    info += thisInfo;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    info += nextInfo;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    info += `**Cost:** ${format(cost)} heavenly nuggies\n`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    info += `Buy with \`/buy ascension ${index}\`\n`;
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    info += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies\n`;
    info += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies\n`;
  }

  return info;
}

function getNuggieFlatMultiplierInfo(level, infoLevel, amount = 1) {
  const nuggieFlatMultiplier = getNuggieFlatMultiplier(level);
  const nuggieFlatMultiplierNext = getNuggieFlatMultiplier(level + amount);

  return getAscensionUpgradeInfo(
    level,
    infoLevel,
    'Nuggie Flat Multiplier Upgrade',
    'Applies a flat multiplier to all claims.\n',
    `**Level:** ${level}
    **Multiplier:** ${format(nuggieFlatMultiplier, true)}x
    `,
    `**Level:** ${level} -> ${(level + amount)}
    **Multiplier:** ${format(nuggieFlatMultiplier, true)}x -> ${format(nuggieFlatMultiplierNext, true)}x
    `,
    1,
    1,
  );
}

function getNuggieStreakMultiplierInfo(level, infoLevel, amount = 1) {
  const nuggieStreakMultiplier = getNuggieStreakMultiplier(level);
  const nuggieStreakMultiplierNext = getNuggieStreakMultiplier(level + 1);

  return getAscensionUpgradeInfo(
    level,
    infoLevel,
    'Nuggie Streak Multiplier Upgrade',
    'Applies a multiplier to all claims based on your current streak.\n',
    `**Level:** ${level}
    **Multiplier:** ${format(nuggieStreakMultiplier * 100, true)}%/day
    `,
    `**Level:** ${level} -> ${(level + amount)}
    **Multiplier:** ${format(nuggieStreakMultiplier * 100, true)}%/day -> ${format(nuggieStreakMultiplierNext * 100, true)}%/day
    `,
    2,
    1,
  );
}

function getNuggieCreditsMultiplierInfo(level, infoLevel, amount = 1) {
  const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(level);
  const nuggieCreditsMultiplierNext = getNuggieCreditsMultiplier(level + 1);

  return getAscensionUpgradeInfo(
    level,
    infoLevel,
    'Nuggie Credits Multiplier Upgrade',
    'Applies a multiplier to all claims based on your current credits.\n',
    `**Level:** ${level}
    **Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits)
    `,
    `**Level:** ${level} -> ${(level + amount)}
    **Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits) -> +${format(nuggieCreditsMultiplierNext * 100)}% * log2(credits)
    `,
    3,
    3,
  );
}

function getNuggiePokeMultiplierInfo(level, infoLevel, amount = 1) {
  const nuggiePokeMultiplier = getNuggiePokeMultiplier(level);
  const nuggiePokeMultiplierNext = getNuggiePokeMultiplier(level + 1);

  return getAscensionUpgradeInfo(
    level,
    infoLevel,
    'Nuggie PokeMultiplier Upgrade',
    'Applies a multiplier to all claims based on the number of unique pokemons you have.\n',
    `**Level:** ${level}
    **Multiplier:** +${format(nuggiePokeMultiplier * 100)}%/pokemon
    `,
    `**Level:** ${level} -> ${(level + amount)}
    **Multiplier:** +${format(nuggiePokeMultiplier * 100)}%/pokemon -> +${format(nuggiePokeMultiplierNext * 100)}%/pokemon
    `,
    4,
    9,
  );
}

function getNuggieNuggieMultiplierInfo(level, infoLevel, amount = 1) {
  const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(level);
  const nuggieNuggieMultiplierNext = getNuggieNuggieMultiplier(level + amount);

  return getAscensionUpgradeInfo(
    level,
    infoLevel,
    'Nuggie Nuggie Multiplier Upgrade',
    'Applies a multiplier to all claims based on the number of nuggies you have.\n',
    `**Level:** ${level}
    **Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies)
    `,
    `**Level:** ${level} -> ${(level + amount)}
    **Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies) -> +${format(nuggieNuggieMultiplierNext * 100)}% * log2(nuggies)
    `,
    5,
    27,
  );
}

module.exports = {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
};
