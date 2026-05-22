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
import { processEat, type EatResult, formatEatItemLine } from '../utils/eat';
import { processBuyUpgrade, type BuyUpgradeResult } from '../utils/buyUpgrade';
import {
  processBuyAscensionUpgrade, type BuyAscensionResult,
  ASCENSION_UPGRADES,
  ASCENSION_AMPLIFIERS,
  ASCENSION_LEVEL_REQ,
  type AscensionUpgradeKey,
} from '../utils/buyAscensionUpgrade';
import {
  getAscensionState, processAscend, type AscensionState, type AscendResult,
} from '../utils/ascend';
import {
  getMaxLevel,
  getNextUpgradeCost,
  getMultiplierAmount,
  getMultiplierChance,
  getBekiCooldown,
} from '../utils/upgrades';
import {
  getNextAscensionUpgradeCost,
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
} from '../utils/ascensionupgrades';
import quote, { FONT_MAP } from '../utils/quote';
import { format } from '../utils/math';

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
          valueLabel: `${format(value)} ${counter}`,
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
          valueLabel: `${row.relativeWon > 0 ? '+' : ''}${format(row.relativeWon)} bets`,
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
          valueLabel: `${format(row.poopCount)} Poops`,
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
  amountLabel: string;
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
  amountLabel?: string;
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
  winningsLabel?: string;
  streak?: number;
  amount: number;
  amountLabel: string;
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

  // A finalized-or-expired entry may still have a pending setTimeout queued. If it
  // fires after we install the new game it would delete that fresh entry and
  // record a spurious loss, so cancel the old timer before overwriting.
  if (existing && existing.timeoutHandle) {
    clearTimeout(existing.timeoutHandle);
  }

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
      amountLabel: format(amount),
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
        amountLabel: format(game.amount),
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

  const amountLabel = format(game.amount);

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
        winningsLabel: format(win.winnings),
        streak: win.streak,
        amount: game.amount,
        amountLabel,
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
        amountLabel,
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
      amountLabel,
    },
  };
}

// ─── Roulette ──────────────────────────────────────────────────────────────

const VALID_BET_TYPES: RouletteBetType[] = ['number', 'red', 'black', 'green', 'even', 'odd'];

export type WebRouletteData = RouletteResult & {
  amount: number;
  amountLabel: string;
  winningsLabel: string;
};

export async function playRouletteWeb(
  silverwolf: Silverwolf,
  userId: string,
  amountString: string,
  betType: string,
  betValueRaw: number | null,
): Promise<BetResult<WebRouletteData>> {
  if (!(VALID_BET_TYPES as string[]).includes(betType)) {
    return { error: 'invalid_bet_value' };
  }
  if (betType === 'number') {
    if (betValueRaw === null || !Number.isInteger(betValueRaw) || betValueRaw < 0 || betValueRaw > 36) {
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
  return {
    ok: true,
    data: {
      ...result,
      amount,
      amountLabel: format(amount),
      winningsLabel: format(result.winnings),
    },
  };
}

// ─── Slots ─────────────────────────────────────────────────────────────────

export type WebSlotsData = SlotsResult & {
  amount: number;
  amountLabel: string;
  winningsLabel: string;
};

export async function playSlotsWeb(
  silverwolf: Silverwolf,
  userId: string,
  amountString: string,
): Promise<BetResult<WebSlotsData>> {
  const code = await checkValidBetRaw(silverwolf as any, { id: userId }, amountString);
  const err = mapBetCode(code);
  if (err) return err;
  const amount = code;

  const result = await spinSlots(silverwolf, userId, amount);
  return {
    ok: true,
    data: {
      ...result,
      amount,
      amountLabel: format(amount),
      winningsLabel: format(result.winnings),
    },
  };
}

// ─── Claim ─────────────────────────────────────────────────────────────────

// Status-discriminated label bundle so the page never has to format numbers
// — every counter shown post-claim is rendered server-side via utils/math.ts.
export type WebClaimResult = ClaimResult & {
  amountLabel?: string;
  newDinonuggiesLabel?: string;
};

export async function claimWeb(
  silverwolf: Silverwolf,
  userId: string,
): Promise<WebClaimResult> {
  const result = await processClaim(silverwolf, userId);
  if (result.status === 'broken_streak' || result.status === 'success') {
    return {
      ...result,
      amountLabel: format(result.amount),
      newDinonuggiesLabel: format(result.previousDinonuggies + result.amount),
    };
  }
  return result;
}

// ─── Dinonuggie upgrades hub ───────────────────────────────────────────────

export type UpgradeRowKey = 'multiplierAmount' | 'multiplierRarity' | 'beki';

const UPGRADE_TITLES: Record<UpgradeRowKey, string> = {
  multiplierAmount: 'Multiplier Amount Upgrade',
  multiplierRarity: 'Multiplier Rarity Upgrade',
  beki: 'Beki Cooldown Upgrade',
};

const ASCENSION_TITLES: Record<AscensionUpgradeKey, string> = {
  nuggieFlatMultiplier: 'Nuggie Flat Multiplier',
  nuggieStreakMultiplier: 'Nuggie Streak Multiplier',
  nuggieCreditsMultiplier: 'Nuggie Credits Multiplier',
  nuggiePokeMultiplier: 'Nuggie Poke Multiplier',
  nuggieNuggieMultiplier: 'Nuggie Nuggie Multiplier',
};

const ASCENSION_DESCS: Record<AscensionUpgradeKey, string> = {
  nuggieFlatMultiplier: 'Applies a flat multiplier to all claims.',
  nuggieStreakMultiplier: 'Multiplier per day of your streak.',
  nuggieCreditsMultiplier: 'Multiplier scaling with log2(credits).',
  nuggiePokeMultiplier: 'Multiplier per unique pokemon you own.',
  nuggieNuggieMultiplier: 'Multiplier scaling with log2(dinonuggies).',
};

// Hard cap on how many cumulative cost previews we precompute per ascension row.
// Ascension upgrades have no in-game purchase ceiling, but the UI's qty stepper
// realistically targets small batches — sending an array per click is plenty for
// the live total preview. Server still validates the real purchase amount.
const ASCENSION_QTY_PREVIEW = 100;

function ascensionEffectLabel(key: AscensionUpgradeKey, level: number): string {
  switch (key) {
    case 'nuggieFlatMultiplier':
      return `${format(getNuggieFlatMultiplier(level))}x flat`;
    case 'nuggieStreakMultiplier':
      return `${format(getNuggieStreakMultiplier(level) * 100)}%/day`;
    case 'nuggieCreditsMultiplier':
      return `+${format(getNuggieCreditsMultiplier(level) * 100)}% * log2(credits)`;
    case 'nuggiePokeMultiplier':
      return `+${format(getNuggiePokeMultiplier(level) * 100)}%/pokemon`;
    case 'nuggieNuggieMultiplier':
      return `+${format(getNuggieNuggieMultiplier(level) * 100)}% * log2(nuggies)`;
    default:
      return '';
  }
}

function upgradeDisplayLines(
  key: UpgradeRowKey,
  level: number,
  maxLevel: number,
): { k: string; v: string }[] {
  const next = Math.min(level + 1, maxLevel);
  if (key === 'multiplierAmount') {
    const cur = getMultiplierAmount(level);
    const nxt = getMultiplierAmount(next);
    return [
      { k: 'Gold', v: `${format(cur.gold)}x → ${format(nxt.gold)}x` },
      { k: 'Silver', v: `${format(cur.silver)}x → ${format(nxt.silver)}x` },
      { k: 'Bronze', v: `${format(cur.bronze)}x → ${format(nxt.bronze)}x` },
    ];
  }
  if (key === 'multiplierRarity') {
    const cur = getMultiplierChance(level);
    const nxt = getMultiplierChance(next);
    return [
      { k: 'Gold', v: `${format(cur.gold * 100)}% → ${format(nxt.gold * 100)}%` },
      { k: 'Silver', v: `${format(cur.silver * 100)}% → ${format(nxt.silver * 100)}%` },
      { k: 'Bronze', v: `${format(cur.bronze * 100)}% → ${format(nxt.bronze * 100)}%` },
    ];
  }
  return [
    {
      k: 'Cooldown',
      v: `${format(getBekiCooldown(level))}h → ${format(getBekiCooldown(next))}h`,
    },
  ];
}

function cumulativeUpgradeCosts(level: number, maxLevel: number): string[] {
  const cap = Math.max(0, maxLevel - level);
  const out: string[] = [];
  let running = 0;
  for (let i = 0; i < cap; i += 1) {
    running += getNextUpgradeCost(level + i);
    out.push(format(running));
  }
  return out;
}

function cumulativeAscensionCosts(level: number, amplifier: number): string[] {
  const out: string[] = [];
  let running = 0;
  for (let i = 0; i < ASCENSION_QTY_PREVIEW; i += 1) {
    running += getNextAscensionUpgradeCost(level + i, amplifier);
    out.push(format(running));
  }
  return out;
}

export interface UpgradeRowState {
  key: UpgradeRowKey;
  upgradeId: number;
  title: string;
  level: number;
  maxLevel: number;
  // displayLines[i] = { k: 'Gold', v: '2.0x → 2.2x' } etc. Ready to render as-is.
  displayLines: { k: string; v: string }[];
  // costsByQty[i] = formatted cumulative credit cost for buying (i+1) levels.
  // Empty when already maxed. The client clamps the qty input to this length.
  costsByQty: string[];
}

export interface AscensionUpgradeRowState {
  key: AscensionUpgradeKey;
  upgradeId: number;
  title: string;
  desc: string;
  level: number;
  required: number;
  unlocked: boolean;
  effectLabel: string; // "current → next"
  // costsByQty[i] = formatted cumulative heavenly-nuggie cost for (i+1) levels.
  // Capped at ASCENSION_QTY_PREVIEW; UI clamps the qty input to that length.
  costsByQty: string[];
}

export type WebAscensionState = AscensionState & {
  dinonuggiesLabel: string;
};

export interface DinoUpgradesState {
  creditsLabel: string;
  dinonuggiesLabel: string;
  heavenlyNuggiesLabel: string;
  ascensionLevel: number;
  maxLevel: number;
  upgrades: UpgradeRowState[];
  ascension: {
    state: WebAscensionState;
    rows: AscensionUpgradeRowState[];
  };
}

export async function getDinoUpgradesStateWeb(
  silverwolf: Silverwolf,
  userId: string,
): Promise<DinoUpgradesState> {
  const client = silverwolf as any;
  const ascensionLevel = await client.db.user.getUserAttr(userId, 'ascensionLevel');
  const maxLevel = getMaxLevel(ascensionLevel);

  const [
    dinonuggies, credits, heavenlyNuggies,
    multiplierAmountLevel, multiplierRarityLevel, bekiLevel,
  ] = await Promise.all([
    client.db.user.getUserAttr(userId, 'dinonuggies'),
    client.db.user.getUserAttr(userId, 'credits'),
    client.db.user.getUserAttr(userId, 'heavenlyNuggies'),
    client.db.user.getUserAttr(userId, 'multiplierAmountLevel'),
    client.db.user.getUserAttr(userId, 'multiplierRarityLevel'),
    client.db.user.getUserAttr(userId, 'bekiLevel'),
  ]);

  const buildRow = (key: UpgradeRowKey, upgradeId: number, level: number): UpgradeRowState => ({
    key,
    upgradeId,
    title: UPGRADE_TITLES[key],
    level,
    maxLevel,
    displayLines: upgradeDisplayLines(key, level, maxLevel),
    costsByQty: cumulativeUpgradeCosts(level, maxLevel),
  });

  const upgrades: UpgradeRowState[] = [
    buildRow('multiplierAmount', 1, multiplierAmountLevel),
    buildRow('multiplierRarity', 2, multiplierRarityLevel),
    buildRow('beki', 3, bekiLevel),
  ];

  const ascensionState = await getAscensionState(client, userId);

  const ascensionRows: AscensionUpgradeRowState[] = await Promise.all(
    ASCENSION_UPGRADES.map(async (key, i): Promise<AscensionUpgradeRowState> => {
      const lvl = await client.db.user.getUserAttr(userId, `${key}Level`);
      const amplifier = ASCENSION_AMPLIFIERS[key];
      const required = ASCENSION_LEVEL_REQ[key];
      return {
        key,
        upgradeId: i + 1,
        title: ASCENSION_TITLES[key],
        desc: ASCENSION_DESCS[key],
        level: lvl,
        required,
        unlocked: ascensionLevel >= required,
        effectLabel: `${ascensionEffectLabel(key, lvl)} → ${ascensionEffectLabel(key, lvl + 1)}`,
        costsByQty: cumulativeAscensionCosts(lvl, amplifier),
      };
    }),
  );

  return {
    creditsLabel: format(credits),
    dinonuggiesLabel: format(dinonuggies),
    heavenlyNuggiesLabel: format(heavenlyNuggies),
    ascensionLevel,
    maxLevel,
    upgrades,
    ascension: {
      state: { ...ascensionState, dinonuggiesLabel: format(ascensionState.dinonuggies) },
      rows: ascensionRows,
    },
  };
}

export type WebEatResult = EatResult & {
  amountLabel?: string;
  dinonuggiesLabel?: string;
  totalEarnedLabel?: string;
  // Single-eat narrative line (e.g. "You found a hidden mystichunterzium…").
  itemLine?: string;
  // Batch-eat narrative lines, one per swallowed nugget.
  itemLines?: string[];
};

export async function eatWeb(
  silverwolf: Silverwolf,
  userId: string,
  amount: number,
): Promise<WebEatResult> {
  const result = await processEat(silverwolf as any, userId, amount);
  switch (result.status) {
    case 'not_enough':
    case 'cheat':
      return {
        ...result,
        dinonuggiesLabel: format(result.dinonuggies),
        amountLabel: format(result.amount),
      };
    case 'single':
      return { ...result, itemLine: formatEatItemLine(result.item) };
    case 'batch':
      return {
        ...result,
        itemLines: result.items.map(formatEatItemLine),
        totalEarnedLabel: format(result.totalEarned),
      };
    default:
      return result;
  }
}

export type WebBuyUpgradeResult = BuyUpgradeResult & {
  costLabel?: string;
  creditsLabel?: string;
};

export async function buyUpgradeWeb(
  silverwolf: Silverwolf,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<WebBuyUpgradeResult> {
  const result = await processBuyUpgrade(silverwolf as any, userId, upgradeId, amount);
  if (result.status === 'success' || result.status === 'poor') {
    return {
      ...result,
      costLabel: format(result.cost),
      ...(result.status === 'poor' ? { creditsLabel: format(result.credits) } : {}),
    };
  }
  return result;
}

export type WebBuyAscensionResult = BuyAscensionResult & {
  costLabel?: string;
  heavenlyNuggiesLabel?: string;
};

export async function buyAscensionUpgradeWeb(
  silverwolf: Silverwolf,
  userId: string,
  upgradeId: number,
  amount: number,
): Promise<WebBuyAscensionResult> {
  const result = await processBuyAscensionUpgrade(silverwolf as any, userId, upgradeId, amount);
  if (result.status === 'success' || result.status === 'poor') {
    return {
      ...result,
      costLabel: format(result.cost),
      ...(result.status === 'poor' ? { heavenlyNuggiesLabel: format(result.heavenlyNuggies) } : {}),
    };
  }
  return result;
}

export type WebAscendResult = AscendResult & {
  gainedLabel?: string;
  dinonuggiesLabel?: string;
};

export async function ascendWeb(
  silverwolf: Silverwolf,
  userId: string,
): Promise<WebAscendResult> {
  const result = await processAscend(silverwolf as any, userId);
  if (result.status === 'too_few') {
    return { ...result, dinonuggiesLabel: format(result.dinonuggies) };
  }
  return { ...result, gainedLabel: format(result.gained) };
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

// ─── Fake quote ────────────────────────────────────────────────────────────

export type FakeQuoteErrorCode =
  | 'rate_limited'
  | 'invalid_uid'
  | 'user_not_found'
  | 'invalid_message'
  | 'invalid_options'
  | 'render_failed';

export interface FakeQuoteSuccess { ok: true; image: string; }
export interface FakeQuoteError { ok: false; error: FakeQuoteErrorCode; message?: string; retryAfter?: number; }
export type FakeQuoteResult = FakeQuoteSuccess | FakeQuoteError;

export const FAKEQUOTE_VALID_BACKGROUNDS = ['black', 'white'] as const;
export const FAKEQUOTE_VALID_PROFILE_COLORS = ['normal', 'bw', 'inverted', 'sepia', 'nightmare'] as const;
export const FAKEQUOTE_VALID_FONTS = Object.keys(FONT_MAP);

const FAKEQUOTE_RATE_WINDOW_MS = 60_000;
const FAKEQUOTE_RATE_MAX = 3;
const fakeQuoteHits = new Map<string, number[]>();

function rateLimitCheck(userId: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const window = fakeQuoteHits.get(userId)?.filter((t) => now - t < FAKEQUOTE_RATE_WINDOW_MS) ?? [];
  if (window.length >= FAKEQUOTE_RATE_MAX) {
    const oldest = window[0];
    const retryAfter = Math.max(1, Math.ceil((FAKEQUOTE_RATE_WINDOW_MS - (now - oldest)) / 1000));
    fakeQuoteHits.set(userId, window);
    return { ok: false, retryAfter };
  }
  window.push(now);
  fakeQuoteHits.set(userId, window);
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, hits] of fakeQuoteHits.entries()) {
    const fresh = hits.filter((t) => now - t < FAKEQUOTE_RATE_WINDOW_MS);
    if (fresh.length === 0) fakeQuoteHits.delete(id);
    else fakeQuoteHits.set(id, fresh);
  }
}, 5 * 60 * 1000).unref();

// Discord snowflake: 17–20 digits.
const SNOWFLAKE_RE = /^\d{17,20}$/;

export interface FakeQuoteParams {
  uid: string;
  message: string;
  nickname?: string | null;
  background?: string | null;
  textColor?: string | null;
  profileColor?: string | null;
  fontStyle?: string | null;
}

export async function generateFakeQuoteWeb(
  silverwolf: Silverwolf,
  requesterId: string,
  params: FakeQuoteParams,
): Promise<FakeQuoteResult> {
  const limit = rateLimitCheck(requesterId);
  if (!limit.ok) return { ok: false, error: 'rate_limited', retryAfter: limit.retryAfter };

  const uid = params.uid.trim();
  if (!SNOWFLAKE_RE.test(uid)) return { ok: false, error: 'invalid_uid' };

  const message = params.message.trim();
  if (!message || message.length > 1000) return { ok: false, error: 'invalid_message' };

  const background = params.background ?? 'black';
  const profileColor = params.profileColor ?? 'normal';
  const fontStyle = params.fontStyle ?? 'sans-serif';
  if (!(FAKEQUOTE_VALID_BACKGROUNDS as readonly string[]).includes(background)) {
    return { ok: false, error: 'invalid_options' };
  }
  if (!(FAKEQUOTE_VALID_PROFILE_COLORS as readonly string[]).includes(profileColor)) {
    return { ok: false, error: 'invalid_options' };
  }
  if (!FAKEQUOTE_VALID_FONTS.includes(fontStyle)) {
    return { ok: false, error: 'invalid_options' };
  }

  let person;
  try {
    person = await silverwolf.users.fetch(uid);
  } catch {
    return { ok: false, error: 'user_not_found' };
  }
  if (!person) return { ok: false, error: 'user_not_found' };

  // No guild context on the website — pick any shared guild (lets <@mention>
  // resolution work for users the bot can see); fall back gracefully if none.
  const guild = silverwolf.guilds.cache.first() ?? null;

  try {
    const buffer = await quote(
      guild,
      person,
      params.nickname?.trim() || null,
      message,
      background,
      params.textColor?.trim() || null,
      profileColor,
      'global',
      fontStyle,
    );
    const base64 = buffer.toString('base64');
    return { ok: true, image: `data:image/png;base64,${base64}` };
  } catch (err) {
    logError('fakequote render failed:', err);
    return { ok: false, error: 'render_failed', message: 'Render failed.' };
  }
}
