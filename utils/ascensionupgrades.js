function getNextAscensionUpgradeCost(level, amplifier) {
  return amplifier * 500 * level * level;
}

function getTotalAscensionUpgradeCost(level, amplifier) {
  let totalCost = 0;
  for (let i = 1; i < level; i += 1) {
    totalCost += getNextAscensionUpgradeCost(i, amplifier);
  }
  return totalCost;
}

function getNuggieFlatMultiplier(level) {
  return level;
}

function getNuggieStreakMultiplier(level) {
  return 0.01 * (level - 1);
}

function getNuggieCreditsMultiplier(level) {
  return 0.01 * (level - 1);
}

function getNuggiePokeMultiplier(level) {
  return 0.01 * (level - 1);
}

function getNuggieNuggieMultiplier(level) {
  return 0.01 * (level - 1);
}

module.exports = {
  getNextAscensionUpgradeCost,
  getTotalAscensionUpgradeCost,
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
};
