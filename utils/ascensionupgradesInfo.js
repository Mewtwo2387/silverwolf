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

function getNuggieFlatMultiplierInfo(level, infoLevel) {
  const nuggieFlatMultiplier = getNuggieFlatMultiplier(level);
  const nuggieFlatMultiplierNext = getNuggieFlatMultiplier(level + 1);
  const cost = getNextAscensionUpgradeCost(level, 1);
  const costTotal = getTotalAscensionUpgradeCost(level, 1);

  let nuggieFlatMultiplierInfo = '### Nuggie Flat Multiplier Upgrade';

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieFlatMultiplierInfo += 'Applies a flat multiplier to all claims.\n';
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    nuggieFlatMultiplierInfo += `
    **Level:** ${level}
    **Multiplier:** ${format(nuggieFlatMultiplier, true)}x
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieFlatMultiplierInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Multiplier:** ${format(nuggieFlatMultiplier, true)}x -> ${format(nuggieFlatMultiplierNext, true)}x
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieFlatMultiplierInfo += `**Cost:** ${format(cost)} heavenly nuggies`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieFlatMultiplierInfo += 'Buy with `/buy ascension 1`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieFlatMultiplierInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies`;
    nuggieFlatMultiplierInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies`;
  }

  return nuggieFlatMultiplierInfo;
}

function getNuggieStreakMultiplierInfo(level, infoLevel) {
  const nuggieStreakMultiplier = getNuggieStreakMultiplier(level);
  const nuggieStreakMultiplierNext = getNuggieStreakMultiplier(level + 1);
  const cost = getNextAscensionUpgradeCost(level, 1);
  const costTotal = getTotalAscensionUpgradeCost(level, 1);

  let nuggieStreakMultiplierInfo = '### Nuggie Streak Multiplier Upgrade';

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieStreakMultiplierInfo += 'Applies a multiplier to all claims based on your current streak.\n';
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    nuggieStreakMultiplierInfo += `
    **Level:** ${level}
    **Multiplier:** ${format(nuggieStreakMultiplier * 100, true)}%/day
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieStreakMultiplierInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Multiplier:** ${format(nuggieStreakMultiplier * 100, true)}%/day -> ${format(nuggieStreakMultiplierNext * 100, true)}%/day
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieStreakMultiplierInfo += `**Cost:** ${format(cost)} heavenly nuggies`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieStreakMultiplierInfo += 'Buy with `/buy ascension 2`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieStreakMultiplierInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies`;
    nuggieStreakMultiplierInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies`;
  }

  return nuggieStreakMultiplierInfo;
}

function getNuggieCreditsMultiplierInfo(level, infoLevel) {
  const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(level);
  const nuggieCreditsMultiplierNext = getNuggieCreditsMultiplier(level + 1);
  const cost = getNextAscensionUpgradeCost(level, 3);
  const costTotal = getTotalAscensionUpgradeCost(level, 3);

  let nuggieCreditsMultiplierInfo = '### Nuggie Credits Multiplier Upgrade';

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieCreditsMultiplierInfo += 'Applies a multiplier to all claims based on your current credits.\n';
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    nuggieCreditsMultiplierInfo += `
    **Level:** ${level}
    **Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits)
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieCreditsMultiplierInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits) -> +${format(nuggieCreditsMultiplierNext * 100)}% * log2(credits)
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieCreditsMultiplierInfo += `**Cost:** ${format(cost)} heavenly nuggies`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieCreditsMultiplierInfo += 'Buy with `/buy ascension 3`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieCreditsMultiplierInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies`;
    nuggieCreditsMultiplierInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies`;
  }

  return nuggieCreditsMultiplierInfo;
}

function getNuggiePokeMultiplierInfo(level, infoLevel) {
  const nuggiePokeMultiplier = getNuggiePokeMultiplier(level);
  const nuggiePokeMultiplierNext = getNuggiePokeMultiplier(level + 1);
  const cost = getNextAscensionUpgradeCost(level, 9);
  const costTotal = getTotalAscensionUpgradeCost(level, 9);

  let nuggiePokeMultiplierInfo = '### Nuggie PokeMultiplier Upgrade';

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggiePokeMultiplierInfo += 'Applies a multiplier to all claims based on the number of unique pokemons you have.\n';
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    nuggiePokeMultiplierInfo += `
    **Level:** ${level}
    **Multiplier:** +${format(nuggiePokeMultiplier * 100)}%/pokemon
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggiePokeMultiplierInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Multiplier:** +${format(nuggiePokeMultiplier * 100)}%/pokemon -> +${format(nuggiePokeMultiplierNext * 100)}%/pokemon
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggiePokeMultiplierInfo += `**Cost:** ${format(cost)} heavenly nuggies`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggiePokeMultiplierInfo += 'Buy with `/buy ascension 4`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggiePokeMultiplierInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies`;
    nuggiePokeMultiplierInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies`;
  }

  return nuggiePokeMultiplierInfo;
}

function getNuggieNuggieMultiplierInfo(level, infoLevel) {
  const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(level);
  const nuggieNuggieMultiplierNext = getNuggieNuggieMultiplier(level + 1);
  const cost = getNextAscensionUpgradeCost(level, 27);
  const costTotal = getTotalAscensionUpgradeCost(level, 27);

  let nuggieNuggieMultiplierInfo = '### Nuggie Nuggie Multiplier Upgrade';

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieNuggieMultiplierInfo += 'Applies a multiplier to all claims based on the number of nuggies you have.\n';
  }

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    nuggieNuggieMultiplierInfo += `
    **Level:** ${level}
    **Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies)
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieNuggieMultiplierInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies) -> +${format(nuggieNuggieMultiplierNext * 100)}% * log2(nuggies)
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieNuggieMultiplierInfo += `**Cost:** ${format(cost)} heavenly nuggies`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    nuggieNuggieMultiplierInfo += 'Buy with `/buy ascension 5`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    nuggieNuggieMultiplierInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} heavenly nuggies`;
    nuggieNuggieMultiplierInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} heavenly nuggies`;
  }

  return nuggieNuggieMultiplierInfo;
}

module.exports = {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
};
