import type { Silverwolf } from '../classes/silverwolf';
import { logError } from '../utils/log';
import {
  checkValidBetRaw,
  INVALID_AMOUNT,
  NEGATIVE_AMOUNT,
  POOR_AMOUNT,
  INFINITY_AMOUNT,
} from '../utils/betting';
import {
  type Card,
  createDeck,
  drawCard,
  calculateHand,
  recordBlackjackWin,
  recordBlackjackLoss,
  recordBlackjackTie,
} from '../commands/blackjack';
import { playRoulette, type RouletteBetType, type RouletteResult } from '../commands/roulette';
import { spinSlots, type SlotsResult } from '../commands/slots';
import { processClaim, type ClaimResult } from '../utils/claim';

export type LeaderboardKind = 'gambler' | 'murder' | 'nuggie' | 'poop';

export type BetErrorCode = 'invalid' | 'negative' | 'poor' | 'infinity' | 'in_progress' | 'no_game' | 'expired' | 'invalid_bet_value';
export interface BetError { error: BetErrorCode; }
export interface BetSuccess<T> { ok: true; data: T; }
export type BetResult<T> = BetSuccess<T> | BetError;

function mapBetCode(code: number): BetError | null {
  switch (code) {
    case INVALID_AMOUNT: return { error: 'invalid' };
    case NEGATIVE_AMOUNT: return { error: 'negative' };
    case POOR_AMOUNT: return { error: 'poor' };
    case INFINITY_AMOUNT: return { error: 'infinity' };
    default: return null;
  }
}

export interface LeaderboardRow {
  rank: number;
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

export interface BirthdayUser {
  id: string;
  username: string;
  avatarURL: string | null;
  nextBirthday: string;
  day: number;
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

const userCache = new Map<string, { username: string; avatarURL: string | null; expiresAt: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const RESULT_TTL = 15 * 60 * 1000; // 15 minutes
const leaderboardResultCache = new Map<string, { value: LeaderboardResult; expiresAt: number }>();
let birthdayResultCache: { value: Record<string, BirthdayUser[]>; expiresAt: number } | null = null;

setInterval(() => {
  const now = Date.now();
  for (const [id, cached] of userCache.entries()) {
    if (cached.expiresAt < now) {
      userCache.delete(id);
    }
  }
  for (const [key, cached] of leaderboardResultCache.entries()) {
    if (cached.expiresAt < now) {
      leaderboardResultCache.delete(key);
    }
  }
  if (birthdayResultCache && birthdayResultCache.expiresAt < now) {
    birthdayResultCache = null;
  }
}, 30 * 60 * 1000).unref();

export async function resolveUser(silverwolf: Silverwolf, id: string) {
  const now = Date.now();
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > now) return cached;

  try {
    const user = await silverwolf.users.fetch(id);
    const res = {
      username: user.username,
      avatarURL: user.displayAvatarURL({ extension: 'png', size: 64 }),
      expiresAt: now + CACHE_TTL,
    };
    userCache.set(id, res);
    return res;
  } catch {
    const res = {
      username: id,
      avatarURL: null,
      expiresAt: now + CACHE_TTL,
    };
    userCache.set(id, res);
    return res;
  }
}

async function getLeaderboardUncached(
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

export async function getLeaderboard(
  silverwolf: Silverwolf,
  kind: LeaderboardKind,
  opts?: { gamblerType?: string; poopPeriod?: string },
): Promise<LeaderboardResult> {
  const key = `${kind}|${opts?.gamblerType ?? ''}|${opts?.poopPeriod ?? ''}`;
  const now = Date.now();
  const cached = leaderboardResultCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await getLeaderboardUncached(silverwolf, kind, opts);
  leaderboardResultCache.set(key, { value, expiresAt: now + RESULT_TTL });
  return value;
}

async function getAllBirthdaysByMonthUncached(
  silverwolf: Silverwolf,
): Promise<Record<string, BirthdayUser[]>> {
  const rows = await db(silverwolf).user.getAllBirthdays();
  const grouped: Record<string, BirthdayUser[]> = MONTHS.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {} as Record<string, BirthdayUser[]>);

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

export async function getAllBirthdaysByMonth(
  silverwolf: Silverwolf,
): Promise<Record<string, BirthdayUser[]>> {
  const now = Date.now();
  if (birthdayResultCache && birthdayResultCache.expiresAt > now) {
    return birthdayResultCache.value;
  }
  const value = await getAllBirthdaysByMonthUncached(silverwolf);
  birthdayResultCache = { value, expiresAt: now + RESULT_TTL };
  return value;
}

export function bustBirthdayCache() {
  birthdayResultCache = null;
}

// Fire-and-forget warming of the website's leaderboard + birthday caches.
// First cold load is slow because each row triggers a serialized Discord
// users.fetch — pre-warming on startup absorbs that cost in the background
// so user requests hit a populated cache. Refresh on an interval shorter
// than RESULT_TTL keeps the cache continuously warm.
const PREWARM_VARIANTS: { kind: LeaderboardKind; opts?: { gamblerType?: string; poopPeriod?: string } }[] = [
  { kind: 'gambler' },
  { kind: 'murder' },
  { kind: 'nuggie' },
  { kind: 'poop' },
];

async function prewarmOnce(silverwolf: Silverwolf): Promise<undefined> {
  // Each task swallows its own error so Promise.all never rejects;
  // we never want a single failed variant to abort the others.
  await Promise.all([
    ...PREWARM_VARIANTS.map(async (v) => {
      try {
        const value = await getLeaderboardUncached(silverwolf, v.kind, v.opts);
        const key = `${v.kind}|${v.opts?.gamblerType ?? ''}|${v.opts?.poopPeriod ?? ''}`;
        leaderboardResultCache.set(key, { value, expiresAt: Date.now() + RESULT_TTL });
      } catch (err) {
        logError(`prewarm leaderboard ${v.kind} failed:`, err);
      }
    }),
    (async () => {
      try {
        const value = await getAllBirthdaysByMonthUncached(silverwolf);
        birthdayResultCache = { value, expiresAt: Date.now() + RESULT_TTL };
      } catch (err) {
        logError('prewarm birthdays failed:', err);
      }
    })(),
  ]);
  return undefined;
}

let prewarmInterval: ReturnType<typeof setInterval> | null = null;

export function startWebsiteCachePrewarm(silverwolf: Silverwolf): undefined {
  if (prewarmInterval) return undefined;
  prewarmOnce(silverwolf).catch(() => {});
  // Refresh slightly under RESULT_TTL so a request never lands on an expired slot.
  prewarmInterval = setInterval(() => { prewarmOnce(silverwolf).catch(() => {}); }, 10 * 60 * 1000);
  prewarmInterval.unref?.();
  return undefined;
}

export function getEightBallResponses() {
  // eslint-disable-next-line global-require
  const data = require('../data/8ball.json');
  return { normal: data.normal as string[], savage: data.savage as string[] };
}

export function getFortunes() {
  // We can't easily import JSON in the bridge if it's used in both client/server contexts in some setups,
  // but here it's fine since it's Bun.
  // eslint-disable-next-line global-require
  const data = require('../data/fortune.json');
  return data.fortunes as string[];
}

export { MONTHS };

// ─── Blackjack: in-memory per-user game state ──────────────────────────────
// Mirrors the Discord bot's 60s collector. Keyed by Discord user ID. A user
// may only have one active game; starting a new one while a game is live
// returns 'in_progress'.

export interface SerializableCard { suit: string; value: string; }

interface BlackjackGameState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  amount: number;
  expiresAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
  finalized: boolean;
}

const BLACKJACK_TTL_MS = 60_000;
const blackjackGames = new Map<string, BlackjackGameState>();

function expireBlackjackGame(silverwolf: Silverwolf, userId: string): void {
  const game = blackjackGames.get(userId);
  if (!game || game.finalized) return;
  game.finalized = true;
  blackjackGames.delete(userId);
  recordBlackjackLoss(silverwolf, userId, game.amount).catch((err) => {
    logError('blackjack expiry record failed:', err);
  });
}

export interface BlackjackStartData {
  playerHand: SerializableCard[];
  dealerUpCard: SerializableCard;
  playerTotal: number;
  amount: number;
  expiresAt: number;
}

export interface BlackjackHitData {
  playerHand: SerializableCard[];
  dealerHand?: SerializableCard[];
  dealerTotal?: number;
  playerTotal: number;
  busted: boolean;
  expiresAt: number;
  result?: 'loss';
  message?: string;
  amount?: number;
}

export interface BlackjackStandData {
  playerHand: SerializableCard[];
  dealerHand: SerializableCard[];
  playerTotal: number;
  dealerTotal: number;
  result: 'win' | 'loss' | 'tie';
  message: string;
  multi?: number;
  winnings?: number;
  streak?: number;
  amount: number;
}

export async function startBlackjack(
  silverwolf: Silverwolf,
  userId: string,
  amountString: string,
): Promise<BetResult<BlackjackStartData>> {
  const existing = blackjackGames.get(userId);
  if (existing && !existing.finalized && Date.now() < existing.expiresAt) {
    return { error: 'in_progress' };
  }

  const code = await checkValidBetRaw(silverwolf as any, { id: userId }, amountString);
  const err = mapBetCode(code);
  if (err) return err;
  const amount = code;

  const deck = createDeck();
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];
  const expiresAt = Date.now() + BLACKJACK_TTL_MS;
  const timeoutHandle = setTimeout(() => expireBlackjackGame(silverwolf, userId), BLACKJACK_TTL_MS);
  // Don't keep the process alive purely for these timers.
  (timeoutHandle as unknown as { unref?: () => void }).unref?.();

  blackjackGames.set(userId, {
    deck, playerHand, dealerHand, amount, expiresAt, timeoutHandle, finalized: false,
  });

  return {
    ok: true,
    data: {
      playerHand,
      dealerUpCard: dealerHand[0],
      playerTotal: calculateHand(playerHand),
      amount,
      expiresAt,
    },
  };
}

export async function hitBlackjack(
  silverwolf: Silverwolf,
  userId: string,
): Promise<BetResult<BlackjackHitData>> {
  const game = blackjackGames.get(userId);
  if (!game || game.finalized) return { error: 'no_game' };
  if (Date.now() > game.expiresAt) {
    expireBlackjackGame(silverwolf, userId);
    return { error: 'expired' };
  }

  game.playerHand.push(drawCard(game.deck));
  const playerTotal = calculateHand(game.playerHand);

  if (playerTotal > 21) {
    clearTimeout(game.timeoutHandle);
    game.finalized = true;
    blackjackGames.delete(userId);
    await recordBlackjackLoss(silverwolf, userId, game.amount);
    return {
      ok: true,
      data: {
        playerHand: game.playerHand,
        dealerHand: game.dealerHand,
        dealerTotal: calculateHand(game.dealerHand),
        playerTotal,
        busted: true,
        expiresAt: game.expiresAt,
        result: 'loss',
        message: 'You busted!',
        amount: game.amount,
      },
    };
  }

  return {
    ok: true,
    data: {
      playerHand: game.playerHand,
      playerTotal,
      busted: false,
      expiresAt: game.expiresAt,
    },
  };
}

export async function standBlackjack(
  silverwolf: Silverwolf,
  userId: string,
): Promise<BetResult<BlackjackStandData>> {
  const game = blackjackGames.get(userId);
  if (!game || game.finalized) return { error: 'no_game' };
  if (Date.now() > game.expiresAt) {
    expireBlackjackGame(silverwolf, userId);
    return { error: 'expired' };
  }

  clearTimeout(game.timeoutHandle);
  game.finalized = true;
  blackjackGames.delete(userId);

  while (calculateHand(game.dealerHand) < 17) {
    game.dealerHand.push(drawCard(game.deck));
  }

  const playerTotal = calculateHand(game.playerHand);
  const dealerTotal = calculateHand(game.dealerHand);

  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    const win = await recordBlackjackWin(silverwolf, userId, game.amount);
    return {
      ok: true,
      data: {
        playerHand: game.playerHand,
        dealerHand: game.dealerHand,
        playerTotal,
        dealerTotal,
        result: 'win',
        message: 'You win!',
        multi: win.multi,
        winnings: win.winnings,
        streak: win.streak,
        amount: game.amount,
      },
    };
  }

  if (playerTotal < dealerTotal) {
    await recordBlackjackLoss(silverwolf, userId, game.amount);
    return {
      ok: true,
      data: {
        playerHand: game.playerHand,
        dealerHand: game.dealerHand,
        playerTotal,
        dealerTotal,
        result: 'loss',
        message: 'Silverwolf wins!',
        amount: game.amount,
      },
    };
  }

  await recordBlackjackTie(silverwolf, userId, game.amount);
  return {
    ok: true,
    data: {
      playerHand: game.playerHand,
      dealerHand: game.dealerHand,
      playerTotal,
      dealerTotal,
      result: 'tie',
      message: 'No one wins!',
      amount: game.amount,
    },
  };
}

// ─── Roulette ──────────────────────────────────────────────────────────────

const VALID_BET_TYPES: RouletteBetType[] = ['number', 'red', 'black', 'green', 'even', 'odd'];

export async function playRouletteWeb(
  silverwolf: Silverwolf,
  userId: string,
  amountString: string,
  betType: string,
  betValueRaw: number | null,
): Promise<BetResult<RouletteResult & { amount: number }>> {
  if (!(VALID_BET_TYPES as string[]).includes(betType)) {
    return { error: 'invalid_bet_value' };
  }
  if (betType === 'number') {
    if (betValueRaw === null || Number.isNaN(betValueRaw) || betValueRaw < 0 || betValueRaw > 36) {
      return { error: 'invalid_bet_value' };
    }
  }

  const code = await checkValidBetRaw(silverwolf as any, { id: userId }, amountString);
  const err = mapBetCode(code);
  if (err) return err;
  const amount = code;

  const result = await playRoulette(
    silverwolf,
    userId,
    amount,
    betType as RouletteBetType,
    betType === 'number' ? betValueRaw : null,
  );
  return { ok: true, data: { ...result, amount } };
}

// ─── Slots ─────────────────────────────────────────────────────────────────

export async function playSlotsWeb(
  silverwolf: Silverwolf,
  userId: string,
  amountString: string,
): Promise<BetResult<SlotsResult & { amount: number }>> {
  const code = await checkValidBetRaw(silverwolf as any, { id: userId }, amountString);
  const err = mapBetCode(code);
  if (err) return err;
  const amount = code;

  const result = await spinSlots(silverwolf, userId, amount);
  return { ok: true, data: { ...result, amount } };
}

// ─── Claim ─────────────────────────────────────────────────────────────────

export async function claimWeb(
  silverwolf: Silverwolf,
  userId: string,
): Promise<ClaimResult> {
  return processClaim(silverwolf, userId);
}

// ─── Poop log ──────────────────────────────────────────────────────────────

export interface PoopLogResult { count: number | null; }

export async function logPoopWeb(
  silverwolf: Silverwolf,
  userId: string,
  colour: string | null,
  size: string | null,
  type: string | null,
  duration: number | null,
): Promise<PoopLogResult> {
  type PoopDb = {
    db: { poop: { logPoop(
      u: string,
      c: string | null,
      s: string | null,
      t: string | null,
      d: number | null,
    ): Promise<number | null> } };
  };
  const dbAny = silverwolf as unknown as PoopDb;
  const count = await dbAny.db.poop.logPoop(userId, colour, size, type, duration);
  return { count };
}
