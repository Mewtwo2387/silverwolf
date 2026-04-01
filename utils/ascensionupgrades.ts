function getNextAscensionUpgradeCost(level: number, amplifier: number): number {
  return amplifier * 500 * level * level;
}

function getTotalAscensionUpgradeCost(level: number, amplifier: number): number {
  let totalCost = 0;
  for (let i = 1; i < level; i += 1) {
    totalCost += getNextAscensionUpgradeCost(i, amplifier);
  }
  return totalCost;
}

function getNuggieFlatMultiplier(level: number): number {
  return level;
}

function getNuggieStreakMultiplier(level: number): number {
  return 0.01 * (level - 1);
}

function getNuggieCreditsMultiplier(level: number): number {
  return 0.01 * (level - 1);
}

function getNuggiePokeMultiplier(level: number): number {
  return 0.01 * (level - 1);
}

function getNuggieNuggieMultiplier(level: number): number {
  return 0.01 * (level - 1);
}

export {
  getNextAscensionUpgradeCost,
  getTotalAscensionUpgradeCost,
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
};
