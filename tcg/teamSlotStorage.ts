import { logError } from '../utils/log';
import {
  type DeckComposition,
  ITEMS_BY_ID,
  PER_CARD_MAX,
} from './items';

/**
 * Persistence for the five per-user **team slots**. Every battle plays from the
 * currently-active slot; there is no separate "unsaved" team. A slot bundles a
 * character lineup and an item-deck composition, stored together as JSON in
 * `User.tcg_teams`:
 *   { active: 0..4, slots: [{ team: rosterValue[0..3], deck: {itemId: count} | null }, ...] }
 *
 * `deck: null` means "use the default deck". Lineup edits and deck edits (web deck
 * builder, Discord `/tcgbattle deckset` — via `deckStorage`, which routes to the
 * active slot) write straight into the active slot; switching slots switches the
 * whole loadout. On first load, a legacy `User.tcg_deck` is migrated into slot 1.
 */

export interface TcgTeamSlot {
  /** 0..3 roster values (a battle needs exactly 3). */
  team: string[];
  /** Sparse {itemId: count}; null = default deck. */
  deck: DeckComposition | null;
}

export interface TcgTeamState {
  active: number;
  /** Always exactly {@link TEAM_SLOT_COUNT} entries. */
  slots: TcgTeamSlot[];
}

export const TEAM_SLOT_COUNT = 5;
const TEAM_SIZE = 3;

interface DbLike {
  user: {
    getUserAttr(userId: string, attribute: string): Promise<any>;
    setUserAttr(userId: string, field: string, value: any): Promise<void>;
  };
}

function sanitizeTeam(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, TEAM_SIZE);
}

/**
 * Drop unknown items / clamp counts. Illegal (short/over-cap) compositions are kept
 * as-is — legality is surfaced in the UI and enforced at battle time, not at save.
 * Only a non-object collapses to null ("never set" → default deck); an explicitly
 * saved empty deck stays `{}` so the user sees 0/25 rather than a silent default.
 */
function sanitizeDeck(v: unknown): DeckComposition | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const composition: DeckComposition = {};
  Object.entries(v as Record<string, unknown>).forEach(([id, count]) => {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0 && ITEMS_BY_ID[id]) {
      composition[id] = Math.max(0, Math.min(PER_CARD_MAX, Math.floor(count)));
    }
  });
  return composition;
}

function emptySlot(): TcgTeamSlot {
  return { team: [], deck: null };
}

function sanitizeSlot(v: unknown): TcgTeamSlot {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return emptySlot();
  const o = v as Record<string, unknown>;
  return { team: sanitizeTeam(o.team), deck: sanitizeDeck(o.deck) };
}

export async function loadTeamState(db: DbLike, userId: string): Promise<TcgTeamState> {
  try {
    const raw = await db.user.getUserAttr(userId, 'tcgTeams');
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw) as any;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.slots)) {
        const slots: TcgTeamSlot[] = [];
        for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) slots.push(sanitizeSlot(parsed.slots[i]));
        const active = (Number.isInteger(parsed.active) && parsed.active >= 0 && parsed.active < TEAM_SLOT_COUNT)
          ? parsed.active as number
          : 0;
        return { active, slots };
      }
    }
  } catch (err) {
    logError('Failed to load TCG team slots for user', err);
  }
  // First use (or corrupt data): fresh slots, seeding slot 1 with any legacy single deck.
  const state: TcgTeamState = { active: 0, slots: Array.from({ length: TEAM_SLOT_COUNT }, emptySlot) };
  try {
    const legacy = await db.user.getUserAttr(userId, 'tcgDeck');
    if (legacy && typeof legacy === 'string') {
      state.slots[0].deck = sanitizeDeck(JSON.parse(legacy));
    }
  } catch { /* no legacy deck — leave defaults */ }
  return state;
}

async function saveTeamState(db: DbLike, userId: string, state: TcgTeamState): Promise<void> {
  await db.user.setUserAttr(userId, 'tcgTeams', JSON.stringify(state));
}

export async function setActiveSlot(db: DbLike, userId: string, index: number): Promise<TcgTeamState> {
  const state = await loadTeamState(db, userId);
  if (Number.isInteger(index) && index >= 0 && index < TEAM_SLOT_COUNT) state.active = index;
  await saveTeamState(db, userId, state);
  return state;
}

/**
 * Overwrite one slot's lineup (0..3 values; roster validation is the caller's job).
 * Slot-explicit — not "the active slot" — so a quick slot switch mid-edit can never
 * misattribute a pending save.
 */
export async function updateSlotLineup(
  db: DbLike,
  userId: string,
  index: number,
  team: string[],
): Promise<TcgTeamState> {
  const state = await loadTeamState(db, userId);
  if (Number.isInteger(index) && index >= 0 && index < TEAM_SLOT_COUNT) {
    state.slots[index].team = sanitizeTeam(team);
    await saveTeamState(db, userId, state);
  }
  return state;
}

/** Overwrite the active slot's deck (empty/invalid collapses to the default deck). */
export async function updateActiveSlotDeck(db: DbLike, userId: string, deck: DeckComposition): Promise<void> {
  const state = await loadTeamState(db, userId);
  state.slots[state.active].deck = sanitizeDeck(deck);
  await saveTeamState(db, userId, state);
}
