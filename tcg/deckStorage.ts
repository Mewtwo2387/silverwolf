import { logError } from '../utils/log';
import {
  DeckComposition,
  defaultDeckComposition,
  expandDeckComposition,
  isLegalDeck,
  ALL_ITEMS,
} from './items';
import { DECK_SIZE } from './battle';
import type { Item } from './item';
import { loadTeamState, updateActiveSlotDeck } from './teamSlotStorage';

/**
 * Per-user TCG deck access, routed to the **active team slot** (see
 * `teamSlotStorage.ts`): a user's deck is whichever deck their active slot holds, so
 * every existing deck surface (web deck builder, Discord `/tcgbattle deckset`,
 * `buildDeckForUser`) edits/reads the active slot without knowing about slots.
 * A slot with no deck (null) falls back to {@link defaultDeckComposition}.
 *
 * The composition format stays a sparse `{itemId: count}` map so "edit deck" UIs can
 * mutate one entry at a time without rebuilding the whole deck.
 */

interface DbLike {
  user: {
    getUserAttr(userId: string, attribute: string): Promise<any>;
    setUserAttr(userId: string, field: string, value: any): Promise<void>;
  };
}

/**
 * Read the active slot's deck composition **as saved** — possibly illegal (slots keep
 * whatever the user last saved; legality is display-only until battle time). A slot
 * with no deck (null) yields the default composition.
 */
export async function loadDeckCompositionForUser(
  db: DbLike,
  userId: string,
): Promise<DeckComposition> {
  try {
    const state = await loadTeamState(db, userId);
    return state.slots[state.active].deck ?? defaultDeckComposition();
  } catch (err) {
    logError('Failed to load TCG deck for user', err);
    return defaultDeckComposition();
  }
}

/** Persist a composition to the active slot. Illegal compositions save fine (shown red). */
export async function saveDeckCompositionForUser(
  db: DbLike,
  userId: string,
  composition: DeckComposition,
): Promise<void> {
  await updateActiveSlotDeck(db, userId, composition);
}

/**
 * Build a 25-Item array for the given user for a battle. An illegal saved deck falls
 * back to the default here (Discord battles have no pre-battle legality gate; the web
 * create/join routes reject illegal decks before ever getting this far).
 */
export async function buildDeckForUser(db: DbLike, userId: string): Promise<Item[]> {
  const composition = await loadDeckCompositionForUser(db, userId);
  const cards = expandDeckComposition(isLegalDeck(composition) ? composition : defaultDeckComposition());
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
