import { getNextAscensionUpgradeCost } from './ascensionupgrades';

export const ASCENSION_UPGRADES = [
  'nuggieFlatMultiplier',
  'nuggieStreakMultiplier',
  'nuggieCreditsMultiplier',
  'nuggiePokeMultiplier',
  'nuggieNuggieMultiplier',
] as const;

export type AscensionUpgradeKey = typeof ASCENSION_UPGRADES[number];

export const ASCENSION_AMPLIFIERS: Record<AscensionUpgradeKey, number> = {
  nuggieFlatMultiplier: 1,
  nuggieStreakMultiplier: 1,
  nuggieCreditsMultiplier: 3,
  nuggiePokeMultiplier: 9,
  nuggieNuggieMultiplier: 27,
};

export const ASCENSION_LEVEL_REQ: Record<AscensionUpgradeKey, number> = {
  nuggieFlatMultiplier: 1,
  nuggieStreakMultiplier: 1,
  nuggieCreditsMultiplier: 2,
  nuggiePokeMultiplier: 4,
  nuggieNuggieMultiplier: 6,
};

export type BuyAscensionResult =
  | { status: 'invalid_upgrade' }
  | { status: 'invalid_amount' }
  | {
    status: 'locked';
    required: number;
    ascensionLevel: number;
    upgrade: AscensionUpgradeKey;
  }
  | {
    status: 'poor';
    cost: number;
    heavenlyNuggies: number;
    upgrade: AscensionUpgradeKey;
  }
  | {
    status: 'success';
    upgrade: AscensionUpgradeKey;
    upgradeId: number;
    level: number;
    amount: number;
    cost: number;
    heavenlyNuggies: number;
  };

const buyAscLocks = new Map<string, Promise<BuyAscensionResult>>();

async function processBuyAscensionUpgradeInner(
  client: any,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<BuyAscensionResult> {
  if (!Number.isInteger(upgradeId) || upgradeId < 1 || upgradeId > ASCENSION_UPGRADES.length) {
    return { status: 'invalid_upgrade' };
  }
  if (!Number.isInteger(amount) || amount < 1) {
    return { status: 'invalid_amount' };
  }

  const upgrade = ASCENSION_UPGRADES[upgradeId - 1];
  const level = await client.db.user.getUserAttr(userId, `${upgrade}Level`);
  const ascensionLevel = await client.db.user.getUserAttr(userId, 'ascensionLevel');

  if (ascensionLevel < ASCENSION_LEVEL_REQ[upgrade]) {
    return {
      status: 'locked', required: ASCENSION_LEVEL_REQ[upgrade], ascensionLevel, upgrade,
    };
  }

  let cost = 0;
  for (let i = 0; i < amount; i += 1) {
    cost += getNextAscensionUpgradeCost(level + i, ASCENSION_AMPLIFIERS[upgrade]);
  }

  const heavenlyNuggies = await client.db.user.getUserAttr(userId, 'heavenlyNuggies');
  if (heavenlyNuggies < cost) {
    return {
      status: 'poor', cost, heavenlyNuggies, upgrade,
    };
  }

  await client.db.user.addUserAttrs(userId, {
    heavenlyNuggies: -cost,
    [`${upgrade}Level`]: amount,
  });
  return {
    status: 'success', upgrade, upgradeId, level, amount, cost, heavenlyNuggies,
  };
}

export async function processBuyAscensionUpgrade(
  client: any,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<BuyAscensionResult> {
  let existing = buyAscLocks.get(userId);
  while (existing) {
    await existing.catch(() => {});
    existing = buyAscLocks.get(userId);
  }
  const run = processBuyAscensionUpgradeInner(client, userId, upgradeId, amount);
  buyAscLocks.set(userId, run);
  try {
    return await run;
  } finally {
    if (buyAscLocks.get(userId) === run) buyAscLocks.delete(userId);
  }
}
