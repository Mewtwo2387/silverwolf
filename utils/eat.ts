import { format } from './math';
import { withUserLock } from './userLock';

export type EatItem =
  | { type: 'mystic_small'; earned: number }
  | { type: 'mystic_huge'; earned: number }
  | { type: 'choke' }
  | { type: 'extra2' }
  | { type: 'extra5' }
  | { type: 'nom' };

export type EatResult =
  | { status: 'invalid_amount'; amount: number }
  | { status: 'not_enough'; dinonuggies: number; amount: number }
  | { status: 'cheat'; amount: number; dinonuggies: number }
  | {
    status: 'single';
    amount: 1;
    item: EatItem;
    previousDinonuggies: number;
    earned: number;
    bonusNuggies: number;
  }
  | {
    status: 'batch';
    amount: number;
    items: EatItem[];
    totalEarned: number;
    totalNuggiesEarned: number;
    remainingLost: number;
    previousDinonuggies: number;
  };

export const MAX_EAT = 10_000;

const eatLocks = new Map<string, Promise<EatResult>>();

function rollOne(): EatItem {
  const rand = Math.random();
  if (rand < 0.2) return { type: 'mystic_small', earned: 2000 + Math.floor(Math.random() * 1000) };
  if (rand < 0.25) return { type: 'mystic_huge', earned: 5000 + Math.floor(Math.random() * 2000) };
  if (rand < 0.35) return { type: 'choke' };
  if (rand < 0.45) return { type: 'extra2' };
  if (rand < 0.48) return { type: 'extra5' };
  return { type: 'nom' };
}

export function formatEatItemLine(item: EatItem): string {
  switch (item.type) {
    case 'mystic_small':
      return `You found a hidden mystichunterzium nugget in the dinonuggie! You earned ${format(item.earned)} mystic credits.`;
    case 'mystic_huge':
      return `You found a huge mystichunterzium nugget in the dinonuggie! You earned ${format(item.earned)} mystic credits.`;
    case 'choke':
      return 'You choked on the dinonuggie and died.';
    case 'extra2':
      return "You found 2 dinonuggies in the dinonuggie! I don't know how that works, it just does.";
    case 'extra5':
      return 'You found 5 dinonuggies in the dinonuggie! Uhmmm what?';
    case 'nom':
    default:
      return 'nom nom nom';
  }
}

async function processEatInner(client: any, userId: string, amount: number): Promise<EatResult> {
  if (!Number.isInteger(amount) || amount === 0 || amount > MAX_EAT) {
    return { status: 'invalid_amount', amount };
  }

  const dinonuggies = await client.db.user.getUserAttr(userId, 'dinonuggies');

  if (amount < 0) {
    return { status: 'cheat', amount, dinonuggies };
  }

  if (dinonuggies < amount) {
    return { status: 'not_enough', dinonuggies, amount };
  }

  await client.db.user.addUserAttr(userId, 'dinonuggies', -amount);

  if (amount === 1) {
    const item = rollOne();
    let earned = 0;
    let bonusNuggies = 0;
    if (item.type === 'mystic_small' || item.type === 'mystic_huge') {
      earned = item.earned;
      await client.db.user.addUserAttr(userId, 'credits', earned);
    } else if (item.type === 'extra2') {
      bonusNuggies = 2;
      await client.db.user.addUserAttr(userId, 'dinonuggies', 2);
    } else if (item.type === 'extra5') {
      bonusNuggies = 5;
      await client.db.user.addUserAttr(userId, 'dinonuggies', 5);
    }
    return {
      status: 'single', amount: 1, item, previousDinonuggies: dinonuggies, earned, bonusNuggies,
    };
  }

  const items: EatItem[] = [];
  let totalEarned = 0;
  let totalNuggiesEarned = 0;
  let remaining = amount;

  while (remaining > 0) {
    remaining -= 1;
    const item = rollOne();
    items.push(item);
    if (item.type === 'mystic_small' || item.type === 'mystic_huge') {
      totalEarned += item.earned;
    } else if (item.type === 'extra2') {
      totalNuggiesEarned += 2;
    } else if (item.type === 'extra5') {
      totalNuggiesEarned += 5;
    } else if (item.type === 'choke') {
      break;
    }
  }

  if (totalEarned > 0) await client.db.user.addUserAttr(userId, 'credits', totalEarned);
  if (totalNuggiesEarned > 0) await client.db.user.addUserAttr(userId, 'dinonuggies', totalNuggiesEarned);

  return {
    status: 'batch',
    amount,
    items,
    totalEarned,
    totalNuggiesEarned,
    remainingLost: remaining,
    previousDinonuggies: dinonuggies,
  };
}

export function processEat(client: any, userId: string, amount: number): Promise<EatResult> {
  return withUserLock(eatLocks, userId, () => processEatInner(client, userId, amount));
}
