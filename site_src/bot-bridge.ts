import type { Silverwolf } from '../classes/silverwolf';

export type LeaderboardKind = 'gambler' | 'murder' | 'nuggie' | 'poop';

export interface LeaderboardRow {
  rank: number;
  id: string;
  username: string;
  avatarURL: string | null;
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

async function resolveUser(silverwolf: Silverwolf, id: string) {
  try {
    const user = await silverwolf.users.fetch(id);
    return {
      username: user.username,
      avatarURL: user.displayAvatarURL({ extension: 'png', size: 64 }),
    };
  } catch {
    return {
      username: id,
      avatarURL: null,
    };
  }
}

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
      rows: await Promise.all(attrs.map(async (row: any, i: number) => {
        const u = await resolveUser(silverwolf, row.id);
        return {
          rank: i + 1,
          id: row.id,
          username: u.username,
          avatarURL: u.avatarURL,
          value: row[attribute],
          valueLabel: `${row[attribute]} ${counter}`,
        };
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
      rows: await Promise.all(winnings.map(async (row: any, i: number) => {
        const u = await resolveUser(silverwolf, row.id);
        return {
          rank: i + 1,
          id: row.id,
          username: u.username,
          avatarURL: u.avatarURL,
          value: row.relativeWon,
          valueLabel: `${row.relativeWon > 0 ? '+' : ''}${row.relativeWon} bets`,
        };
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
      rows: await Promise.all(attrs.map(async (row: any, i: number) => {
        const u = await resolveUser(silverwolf, row.id);
        return {
          rank: i + 1,
          id: row.id,
          username: u.username,
          avatarURL: u.avatarURL,
          value: row.poopCount,
          valueLabel: `${row.poopCount} Poops`,
        };
      })),
    };
  }

  throw new Error(`Unknown leaderboard kind: ${kind}`);
}

export interface BirthdayUser {
  id: string;
  username: string;
  avatarURL: string | null;
  nextBirthday: string;
  day: number;
}

function formatNextBirthday(birthdayISO: string): string {
  const d = new Date(birthdayISO);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let candidate = new Date(Date.UTC(now.getUTCFullYear(), month, day, hour, minute));
  const candidateDay = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate()));
  if (candidateDay.getTime() < today.getTime()) {
    candidate = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day, hour, minute));
  }

  const dateStr = candidate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  const diffDays = Math.round(
    (new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate())).getTime()
      - today.getTime()) / 86400000,
  );
  if (diffDays === 0) return `Today — ${dateStr}`;
  if (diffDays === 1) return `Tomorrow — ${dateStr}`;
  return `${dateStr} (in ${diffDays} days)`;
}

export async function getAllBirthdaysByMonth(
  silverwolf: Silverwolf,
): Promise<Record<string, BirthdayUser[]>> {
  const rows = await (silverwolf as any).db.user.getAllBirthdays();
  const grouped: Record<string, BirthdayUser[]> = {};
  for (const name of MONTHS) grouped[name] = [];

  const validRows = rows.filter((row: any) => {
    if (!row.birthdays) return false;
    const date = new Date(row.birthdays);
    return !Number.isNaN(date.getTime());
  });

  await Promise.all(validRows.map(async (row: any) => {
    const date = new Date(row.birthdays);
    const monthName = MONTHS[date.getUTCMonth()];
    const u = await resolveUser(silverwolf, row.id);
    grouped[monthName].push({
      id: row.id,
      username: u.username,
      avatarURL: u.avatarURL,
      nextBirthday: formatNextBirthday(row.birthdays),
      day: date.getUTCDate(),
    });
  }));

  for (const name of MONTHS) grouped[name].sort((a, b) => a.day - b.day);

  return grouped;
}

export { MONTHS };
