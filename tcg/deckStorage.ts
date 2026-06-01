import { logError } from '../utils/log';
import {
  DeckComposition,
  defaultDeckComposition,
  expandDeckComposition,
  isLegalDeck,
  ITEMS_BY_ID,
  ALL_ITEMS,
  PER_CARD_MAX,
} from './items';
import { DECK_SIZE } from './battle';
import type { Item } from './item';

/**
 * Persistence layer for per-user TCG item decks. We store deck composition as JSON
 * (`{itemId: count}`) in `User.tcg_deck`. When the column is null/empty/invalid,
 * `loadDeckCompositionForUser` falls back to {@link defaultDeckComposition}.
 *
 * The storage format is deliberately a sparse map rather than a card list so that
 * nicer "edit deck" UIs (e.g. /tcgbattle deckset <item> <count>) can mutate one
 * entry at a time without rebuilding the whole deck.
 */

interface DbLike {
  user: {
    getUserAttr(userId: string, attribute: string): Promise<any>;
    setUserAttr(userId: string, field: string, value: any): Promise<void>;
  };
}

/**
 * Read & validate a user's deck composition from the DB. Falls back to the default
 * composition if the column is missing, malformed, or doesn't form a legal deck.
 */
export async function loadDeckCompositionForUser(
  db: DbLike,
  userId: string,
): Promise<DeckComposition> {
  try {
    const raw = await db.user.getUserAttr(userId, 'tcgDeck');
    if (!raw || typeof raw !== 'string') {
      return defaultDeckComposition();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultDeckComposition();
    }
    const composition: DeckComposition = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, count]) => {
      if (typeof count === 'number' && Number.isFinite(count) && ITEMS_BY_ID[id]) {
        composition[id] = Math.max(0, Math.min(PER_CARD_MAX, Math.floor(count)));
      }
    });
    if (!isLegalDeck(composition)) {
      return defaultDeckComposition();
    }
    return composition;
  } catch (err) {
    logError('Failed to load TCG deck for user', err);
    return defaultDeckComposition();
  }
}

/** Persist a composition to the DB. Caller should validate first via {@link isLegalDeck}. */
export async function saveDeckCompositionForUser(
  db: DbLike,
  userId: string,
  composition: DeckComposition,
): Promise<void> {
  await db.user.setUserAttr(userId, 'tcgDeck', JSON.stringify(composition));
}

/** Build a 25-Item array for the given user, using their saved composition or the default. */
export async function buildDeckForUser(db: DbLike, userId: string): Promise<Item[]> {
  const composition = await loadDeckCompositionForUser(db, userId);
  const cards = expandDeckComposition(composition);
  // Defensive: if validation passes the deck is exactly DECK_SIZE, but if anything
  // upstream changed we top it up with the default so battles never start short.
  if (cards.length < DECK_SIZE) {
    cards.push(...expandDeckComposition(defaultDeckComposition()).slice(0, DECK_SIZE - cards.length));
  }
  return cards.slice(0, DECK_SIZE);
}

/**
 * Format a deck composition as human-readable lines for Discord/CLI display.
 * Lists every catalog item (including 0-count) so players can see what's available.
 */
export function formatDeckComposition(composition: DeckComposition, style: 'cli' | 'markdown' = 'markdown'): string {
  const total = Object.values(composition).reduce((s, n) => s + n, 0);
  const header = style === 'markdown'
    ? `**Deck** (${total}/${DECK_SIZE} cards):`
    : `Deck (${total}/${DECK_SIZE} cards):`;
  const lines = ALL_ITEMS.map((it) => {
    const count = composition[it.id] ?? 0;
    const tag = it.kind === 'equipment' ? 'EQ' : 'CO';
    const namePart = style === 'markdown' ? `**${it.name}**` : it.name;
    return `  ${count} × [${tag}] ${namePart} — ${it.description}`;
  });
  return [header, ...lines].join('\n');
}
