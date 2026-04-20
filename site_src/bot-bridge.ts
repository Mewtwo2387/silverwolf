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

// Local shapes for the command objects on `silverwolf.commands` (typed as Map<string, any> upstream).
// Only the fields this bridge actually consumes are declared.
interface AttrRow {
  id: string;
  [k: string]: unknown;
}

interface AttrLeaderboardCommand {
  title: string;
  attribute: string;
  counter: string;
  fetchData(page: number): Promise<{ attrs: AttrRow[] }>;
}

interface GamblerBoardCommand {
  fetchData(
    leaderboardType: string,
    page: number,
  ): Promise<{ winnings: { id: string; relativeWon: number }[] }>;
}

interface PoopBoardCommand {
  fetchData(
    period: string,
    page: number,
  ): Promise<{ attrs: { id: string; poopCount: number }[]; periodLabel: string }>;
}

interface BirthdayRow {
  id: string;
  birthdays: string | null | undefined;
}

// The Silverwolf class types `db` and `commands` as `any` / `Map<string, any>`; this helper localises the cast.
function db(silverwolf: Silverwolf): { user: { getAllBirthdays(): Promise<BirthdayRow[]> } } {
  return (silverwolf as unknown as { db: { user: { getAllBirthdays(): Promise<BirthdayRow[]> } } }).db;
}

function getCommand<T>(silverwolf: Silverwolf, name: string): T {
  const cmd = silverwolf.commands.get(name) as T | undefined;
  if (!cmd || typeof (cmd as { fetchData?: unknown }).fetchData !== 'function') {
    throw new Error(`${name} command not available`);
  }
  return cmd;
}

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
    const command = getCommand<AttrLeaderboardCommand>(silverwolf, commandName);
    const { attrs } = await command.fetchData(0);
    const { attribute, counter, title } = command;
    return {
      title,
      rows: await Promise.all(attrs.map(async (row, i) => {
        const u = await resolveUser(silverwolf, row.id);
        const value = Number(row[attribute] ?? 0);
        return {
          rank: i + 1,
          id: row.id,
          username: u.username,
          avatarURL: u.avatarURL,
          value,
          valueLabel: `${value} ${counter}`,
        };
      })),
    };
  }

  if (kind === 'gambler') {
    const command = getCommand<GamblerBoardCommand>(silverwolf, 'gamblerboard');
    const type = opts?.gamblerType ?? 'all';
    const { winnings } = await command.fetchData(type, 0);
    const title = type === 'all'
      ? 'The Ultimate Gambler Leaderboard'
      : `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`;
    return {
      title,
      rows: await Promise.all(winnings.map(async (row, i) => {
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
    const command = getCommand<PoopBoardCommand>(silverwolf, 'poopboard');
    const period = opts?.poopPeriod ?? 'all-time';
    const { attrs, periodLabel } = await command.fetchData(period, 0);
    return {
      title: `Poop Leaderboard — ${periodLabel}`,
      rows: await Promise.all(attrs.map(async (row, i) => {
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

  throw new Error(`Unknown leaderboard kind: ${kind as string}`);
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
  const rows = await db(silverwolf).user.getAllBirthdays();
  const grouped: Record<string, BirthdayUser[]> = Object.fromEntries(
    MONTHS.map((m) => [m, [] as BirthdayUser[]]),
  );

  const parsed: { row: BirthdayRow; date: Date }[] = [];
  for (const row of rows) {
    if (!row.birthdays) continue;
    const date = new Date(row.birthdays);
    if (!Number.isNaN(date.getTime())) parsed.push({ row, date });
  }

  await Promise.all(parsed.map(async ({ row, date }) => {
    const u = await resolveUser(silverwolf, row.id);
    grouped[MONTHS[date.getUTCMonth()]].push({
      id: row.id,
      username: u.username,
      avatarURL: u.avatarURL,
      nextBirthday: formatNextBirthday(row.birthdays as string),
      day: date.getUTCDate(),
    });
  }));

  // Promise.all resolves in arbitrary order; sort each month to present a stable view.
  for (const name of MONTHS) grouped[name].sort((a, b) => a.day - b.day);

  return grouped;
}

export { MONTHS };
