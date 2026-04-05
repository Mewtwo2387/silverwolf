import { format } from './math';
import {
  getMultiplierAmount,
  getNextUpgradeCost,
  getTotalUpgradeCost,
  getMultiplierChance,
  getBekiCooldown,
} from './upgrades';

export const INFO_LEVEL = {
  THIS_LEVEL: 0,
  NEXT_LEVEL: 1,
  SHOP_INFO: 2,
  COST_TOTAL: 3,
} as const;

export type InfoLevel = typeof INFO_LEVEL[keyof typeof INFO_LEVEL];

function getMultiplierAmountInfo(level: number, infoLevel: InfoLevel, amount = 1): string {
  const multiplierAmount = getMultiplierAmount(level);
  const multiplierAmountNext = getMultiplierAmount(level + amount);
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
    **Level:** ${level} -> ${(level + amount)}
    **Gold Multiplier:** ${format(multiplierAmount.gold, true)}x -> ${format(multiplierAmountNext.gold, true)}x
    **Silver Multiplier:** ${format(multiplierAmount.silver, true)}x -> ${format(multiplierAmountNext.silver, true)}x
    **Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x -> ${format(multiplierAmountNext.bronze, true)}x
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierAmountInfo += `**Cost:** ${format(cost)} mystic credits\n`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierAmountInfo += 'Buy with `/buy upgrades 1`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierAmountInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits\n`;
    multiplierAmountInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits\n`;
  }

  return multiplierAmountInfo;
}

function getMultiplierChanceInfo(level: number, infoLevel: InfoLevel, amount = 1): string {
  const multiplierChance = getMultiplierChance(level);
  const multiplierChanceNext = getMultiplierChance(level + amount);
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
    **Level:** ${level} -> ${(level + amount)}
    **Gold Chance:** ${format(multiplierChance.gold * 100, true)}% -> ${format(multiplierChanceNext.gold * 100, true)}%
    **Silver Chance:** ${format(multiplierChance.silver * 100, true)}% -> ${format(multiplierChanceNext.silver * 100, true)}%
    **Bronze Chance:** ${format(multiplierChance.bronze * 100, true)}% -> ${format(multiplierChanceNext.bronze * 100, true)}%
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierChanceInfo += `**Cost:** ${format(cost)} mystic credits\n`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    multiplierChanceInfo += 'Buy with `/buy upgrades 2`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    multiplierChanceInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits\n`;
    multiplierChanceInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits\n`;
  }

  return multiplierChanceInfo;
}

function getBekiCooldownInfo(level: number, infoLevel: InfoLevel, amount = 1): string {
  const bekiCooldown = getBekiCooldown(level);
  const bekiCooldownNext = getBekiCooldown(level + amount);
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
    **Level:** ${level} -> ${(level + amount)}
    **Cooldown:** ${format(bekiCooldown, true)} hours -> ${format(bekiCooldownNext, true)} hours
    `;
  }

  if (infoLevel === INFO_LEVEL.NEXT_LEVEL
    || infoLevel === INFO_LEVEL.SHOP_INFO) {
    bekiCooldownInfo += `**Cost:** ${format(cost)} mystic credits\n`;
  }

  if (infoLevel === INFO_LEVEL.SHOP_INFO) {
    bekiCooldownInfo += 'Buy with `/buy upgrades 3`\n';
  }

  if (infoLevel === INFO_LEVEL.COST_TOTAL) {
    bekiCooldownInfo += `**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits\n`;
    bekiCooldownInfo += `**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits\n`;
  }

  return bekiCooldownInfo;
}

export {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
};
