const { format } = require('./math');
const {
  getMultiplierAmount,
  getNextUpgradeCost,
  getTotalUpgradeCost,
  getMultiplierChance,
  getBekiCooldown,
} = require('./upgrades');

const INFO_LEVEL = {
  THIS_LEVEL: 0,
  NEXT_LEVEL: 1,
  SHOP_INFO: 2,
  COST_TOTAL: 3,
};

function getMultiplierAmountInfo(level, infoLevel) {
  const multiplierAmount = getMultiplierAmount(level);
  const multiplierAmountNext = getMultiplierAmount(level + 1);
  const cost = getNextUpgradeCost(level);
  const costTotal = getTotalUpgradeCost(level);

  let multiplierAmountInfo = '### Multiplier Amount Upgrade';

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    multiplierAmountInfo += `
    **Level:** ${level}
    **Gold Multiplier:** ${format(multiplierAmount.gold, true)}x
    **Silver Multiplier:** ${format(multiplierAmount.silver, true)}x
    **Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierAmountInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Gold Multiplier:** ${format(multiplierAmount.gold, true)}x -> ${format(multiplierAmountNext.gold, true)}x
    **Silver Multiplier:** ${format(multiplierAmount.silver, true)}x -> ${format(multiplierAmountNext.silver, true)}x
    **Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x -> ${format(multiplierAmountNext.bronze, true)}x
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierAmountInfo += `**Cost:** ${format(cost)} mystic credits`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierAmountInfo += 'Buy with `/buy upgrades 1`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierAmountInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits`;
    multiplierAmountInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits`;
  }

  return multiplierAmountInfo;
}

function getMultiplierChanceInfo(level, infoLevel) {
  const multiplierChance = getMultiplierChance(level);
  const multiplierChanceNext = getMultiplierChance(level + 1);
  const cost = getNextUpgradeCost(level);
  const costTotal = getTotalUpgradeCost(level);

  let multiplierChanceInfo = '### Multiplier Rarity Upgrade';

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    multiplierChanceInfo += `
    **Level:** ${level}
    **Gold Chance:** ${format(multiplierChance.gold * 100, true)}%
    **Silver Chance:** ${format(multiplierChance.silver * 100, true)}%
    **Bronze Chance:** ${format(multiplierChance.bronze * 100, true)}%
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierChanceInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Gold Chance:** ${format(multiplierChance.gold * 100, true)}% -> ${format(multiplierChanceNext.gold * 100, true)}%
    **Silver Chance:** ${format(multiplierChance.silver * 100, true)}% -> ${format(multiplierChanceNext.silver * 100, true)}%
    **Bronze Chance:** ${format(multiplierChance.bronze * 100, true)}% -> ${format(multiplierChanceNext.bronze * 100, true)}%
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierChanceInfo += `**Cost:** ${format(cost)} mystic credits`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierChanceInfo += 'Buy with `/buy upgrades 2`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierChanceInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits`;
    multiplierChanceInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits`;
  }

  return multiplierChanceInfo;
}

function getBekiCooldownInfo(level, infoLevel) {
  const bekiCooldown = getBekiCooldown(level);
  const bekiCooldownNext = getBekiCooldown(level + 1);
  const cost = getNextUpgradeCost(level);
  const costTotal = getTotalUpgradeCost(level);

  let bekiCooldownInfo = '### Beki Upgrade';

  if (infoLevel === INFO_LEVEL.THIS_LEVEL) {
    bekiCooldownInfo += `
    **Level:** ${level}
    **Cooldown:** ${format(bekiCooldown, true)} hours
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO
    || infoLevel === INFO_LEVEL.COST_TOTAL) {
    bekiCooldownInfo += `
    **Level:** ${level} -> ${(level + 1)}
    **Cooldown:** ${format(bekiCooldown, true)} hours -> ${format(bekiCooldownNext, true)} hours
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    bekiCooldownInfo += `**Cost:** ${format(cost)} mystic credits`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    bekiCooldownInfo += 'Buy with `/buy upgrades 3`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    bekiCooldownInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits`;
    bekiCooldownInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits`;
  }

  return bekiCooldownInfo;
}

module.exports = {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
};
