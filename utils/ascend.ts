import { getMaxLevel } from './upgrades';
import { withUserLock, userLocks } from './userLock';

export interface AscensionState {
  dinonuggies: number;
  ascensionLevel: number;
  multiplierAmountLevel: number;
  multiplierRarityLevel: number;
  bekiLevel: number;
  currentMaxLevel: number;
  nextMaxLevel: number;
  allMaxed: boolean;
  canAscend: boolean;
}

export type AscendResult =
  | { status: 'too_few'; dinonuggies: number }
  | {
    status: 'success';
    gained: number;
    previousAscensionLevel: number;
    ascensionLevel: number;
    allMaxed: boolean;
    newMaxLevel: number;
  };

export async function getAscensionState(client: any, userId: string): Promise<AscensionState> {
  const user = await client.db.user.getUser(userId);
  const currentMaxLevel = getMaxLevel(user.ascensionLevel);
  const allMaxed = user.multiplierAmountLevel >= currentMaxLevel
    && user.multiplierRarityLevel >= currentMaxLevel
    && user.bekiLevel >= currentMaxLevel;
  return {
    dinonuggies: user.dinonuggies,
    ascensionLevel: user.ascensionLevel,
    multiplierAmountLevel: user.multiplierAmountLevel,
    multiplierRarityLevel: user.multiplierRarityLevel,
    bekiLevel: user.bekiLevel,
    currentMaxLevel,
    nextMaxLevel: getMaxLevel(allMaxed ? user.ascensionLevel + 1 : user.ascensionLevel),
    allMaxed,
    canAscend: user.dinonuggies >= 500,
  };
}

async function processAscendInner(client: any, userId: string): Promise<AscendResult> {
  const state = await getAscensionState(client, userId);
  if (!state.canAscend) return { status: 'too_few', dinonuggies: state.dinonuggies };

  await client.db.user.ascendUser(userId, state.allMaxed);
  return {
    status: 'success',
    gained: state.dinonuggies,
    previousAscensionLevel: state.ascensionLevel,
    ascensionLevel: state.allMaxed ? state.ascensionLevel + 1 : state.ascensionLevel,
    allMaxed: state.allMaxed,
    newMaxLevel: state.nextMaxLevel,
  };
}

export function processAscend(client: any, userId: string): Promise<AscendResult> {
  return withUserLock(userLocks, userId, () => processAscendInner(client, userId));
}
