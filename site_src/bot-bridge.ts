import type { Silverwolf } from '../classes/silverwolf';

export type LeaderboardKind = 'gambler' | 'murder' | 'nuggie' | 'poop';

export interface LeaderboardRow {
  rank: number;
  id: string;
  value: number;
  valueLabel: string;
}

export interface LeaderboardResult {
  title: string;
  rows: LeaderboardRow[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function getLeaderboard(
  silverwolf: Silverwolf,
  kind: LeaderboardKind,
  opts?: { gamblerType?: string; poopPeriod?: string },
): Promise<LeaderboardResult> {
  if (kind === 'murder' || kind === 'nuggie') {
    const commandName = kind === 'murder' ? 'murderboard' : 'nuggieboard';
    const command = silverwolf.commands.get(commandName) as any;
    if (!command?.fetchData) throw new Error(`${commandName} command not available`);
    const { attrs } = await command.fetchData(0);
    const attribute = command.attribute as string;
    const counter = command.counter as string;
    return {
      title: command.title as string,
      rows: attrs.map((row: any, i: number) => ({
        rank: i + 1,
        id: row.id,
        value: row[attribute],
        valueLabel: `${row[attribute]} ${counter}`,
      })),
    };
  }

  if (kind === 'gambler') {
    const command = silverwolf.commands.get('gamblerboard') as any;
    if (!command?.fetchData) throw new Error('gamblerboard command not available');
    const type = opts?.gamblerType ?? 'all';
    const { winnings } = await command.fetchData(type, 0);
    const title = type === 'all' ? 'The Ultimate Gambler Leaderboard' : `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`;
    return {
      title,
      rows: winnings.map((row: any, i: number) => ({
        rank: i + 1,
        id: row.id,
        value: row.relativeWon,
        valueLabel: `${row.relativeWon > 0 ? '+' : ''}${row.relativeWon} bets`,
      })),
    };
  }

  if (kind === 'poop') {
    const command = silverwolf.commands.get('poopboard') as any;
    if (!command?.fetchData) throw new Error('poopboard command not available');
    const period = opts?.poopPeriod ?? 'all-time';
    const { attrs, periodLabel } = await command.fetchData(period, 0);
    return {
      title: `Poop Leaderboard — ${periodLabel}`,
      rows: attrs.map((row: any, i: number) => ({
        rank: i + 1,
        id: row.id,
        value: row.poopCount,
        valueLabel: `${row.poopCount} Poops`,
      })),
    };
  }

  throw new Error(`Unknown leaderboard kind: ${kind}`);
}

export async function getAllBirthdaysByMonth(
  silverwolf: Silverwolf,
): Promise<Record<string, string[]>> {
  const rows = await (silverwolf as any).db.user.getAllBirthdays();
  const grouped: Record<string, string[]> = {};
  for (const name of MONTHS) grouped[name] = [];

  for (const row of rows) {
    if (!row.birthdays) continue;
    const date = new Date(row.birthdays);
    if (Number.isNaN(date.getTime())) continue;
    const monthName = MONTHS[date.getUTCMonth()];
    grouped[monthName].push(row.id);
  }

  return grouped;
}

export { MONTHS };
