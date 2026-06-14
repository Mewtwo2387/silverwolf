import { getNextAscensionUpgradeCost } from './ascensionupgrades';
import { withUserLock } from './userLock';

export const ASCENSION_UPGRADES = [
  'nuggieFlatMultiplier',
  'nuggieStreakMultiplier',
  'nuggieCreditsMultiplier',
  'nuggiePokeMultiplier',
  'nuggieNuggieMultiplier',
] as const;

export type AscensionUpgradeKey = typeof ASCENSION_UPGRADES[number];

/** User column keys for ascension upgrade levels (camelCase, as returned by getUser). */
export const ASCENSION_LEVEL_ATTR: Record<AscensionUpgradeKey, string> = {
  nuggieFlatMultiplier: 'nuggieFlatMultiplierLevel',
  nuggieStreakMultiplier: 'nuggieStreakMultiplierLevel',
  nuggieCreditsMultiplier: 'nuggieCreditsMultiplierLevel',
  nuggiePokeMultiplier: 'nuggiePokemonMultiplierLevel',
  nuggieNuggieMultiplier: 'nuggieNuggieMultiplierLevel',
};

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

export const MAX_ASCENSION_PURCHASE = 10_000;

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
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ASCENSION_PURCHASE) {
    return { status: 'invalid_amount' };
  }

  const upgrade = ASCENSION_UPGRADES[upgradeId - 1];
  const levelAttr = ASCENSION_LEVEL_ATTR[upgrade];
  const level = await client.db.user.getUserAttr(userId, levelAttr);
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
    [levelAttr]: amount,
  });
  return {
    status: 'success', upgrade, upgradeId, level, amount, cost, heavenlyNuggies,
  };
}

export function processBuyAscensionUpgrade(
  client: any,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<BuyAscensionResult> {
  return withUserLock(buyAscLocks, userId, () => processBuyAscensionUpgradeInner(client, userId, upgradeId, amount));
}
