import { getNextUpgradeCost, getMaxLevel } from './upgrades';
import { withUserLock, userLocks } from './userLock';

export const UPGRADES = ['multiplierAmount', 'multiplierRarity', 'beki'] as const;
export type UpgradeKey = typeof UPGRADES[number];

export type BuyUpgradeResult =
  | { status: 'invalid_upgrade' }
  | { status: 'invalid_amount' }
  | { status: 'maxed'; maxLevel: number; level: number; upgrade: UpgradeKey }
  | { status: 'too_many'; maxLevel: number; level: number; upgrade: UpgradeKey }
  | { status: 'poor'; cost: number; credits: number; upgrade: UpgradeKey }
  | {
    status: 'success';
    upgrade: UpgradeKey;
    upgradeId: number;
    level: number;
    amount: number;
    cost: number;
    credits: number;
  };

async function processBuyUpgradeInner(
  client: any,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<BuyUpgradeResult> {
  if (!Number.isInteger(upgradeId) || upgradeId < 1 || upgradeId > UPGRADES.length) {
    return { status: 'invalid_upgrade' };
  }
  if (!Number.isInteger(amount) || amount < 1) {
    return { status: 'invalid_amount' };
  }

  const upgrade = UPGRADES[upgradeId - 1];
  const ascensionLevel = await client.db.user.getUserAttr(userId, 'ascensionLevel');
  const maxLevel = getMaxLevel(ascensionLevel);
  const level = await client.db.user.getUserAttr(userId, `${upgrade}Level`);

  if (level >= maxLevel) {
    return {
      status: 'maxed', maxLevel, level, upgrade,
    };
  }
  if (level + amount > maxLevel) {
    return {
      status: 'too_many', maxLevel, level, upgrade,
    };
  }

  let cost = 0;
  for (let i = 0; i < amount; i += 1) cost += getNextUpgradeCost(level + i);
  const credits = await client.db.user.getUserAttr(userId, 'credits');
  if (credits < cost) {
    return {
      status: 'poor', cost, credits, upgrade,
    };
  }

  await client.db.user.addUserAttrs(userId, {
    credits: -cost,
    [`${upgrade}Level`]: amount,
  });
  return {
    status: 'success', upgrade, upgradeId, level, amount, cost, credits,
  };
}

export function processBuyUpgrade(
  client: any,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<BuyUpgradeResult> {
  return withUserLock(userLocks, userId, () => processBuyUpgradeInner(client, userId, upgradeId, amount));
}
