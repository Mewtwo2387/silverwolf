import { DECK_SIZE } from '../battle';
import type { Item } from '../item';
import { ALL_ITEMS, ITEMS_BY_ID } from './catalog';

/** Per-card cap to keep decks varied. */
export const PER_CARD_MAX = 10;

/** Max copies in a deck with rarity ≥ 5 (includes 6★ if added later). */
export const DECK_MAX_FIVE_STAR_OR_ABOVE = 5;
/** Max copies in a deck with rarity ≥ 4 (includes all 5★+ copies). */
export const DECK_MAX_FOUR_STAR_OR_ABOVE = 15;

export type DeckComposition = Record<string, number>;

export type DeckValidationResult = { ok: true } | { ok: false; reason: string };

/** Count cards in a composition whose catalog rarity is at least `minRarity`. */
export function countDeckCardsAtLeastRarity(composition: DeckComposition, minRarity: number): number {
  let total = 0;
  Object.entries(composition).forEach(([id, count]) => {
    const item = ITEMS_BY_ID[id];
    if (!item || count <= 0) return;
    if (item.rarity.rarity >= minRarity) {
      total += count;
    }
  });
  return total;
}

/** Default deck composition: 25 cards, respects rarity caps (mostly sub-5★ items). */
export function defaultDeckComposition(): DeckComposition {
  const composition: DeckComposition = {};
  ALL_ITEMS.forEach((it) => {
    composition[it.id] = 0;
  });

  const fillerIds = ALL_ITEMS.filter((it) => it.rarity.rarity < 5).map((it) => it.id);
  let remaining = DECK_SIZE;
  let idx = 0;
  while (remaining > 0 && fillerIds.length > 0) {
    const id = fillerIds[idx % fillerIds.length];
    if (composition[id] < PER_CARD_MAX) {
      composition[id] += 1;
      remaining -= 1;
    }
    idx += 1;
    if (idx > fillerIds.length * PER_CARD_MAX) break;
  }
  return composition;
}

/**
 * Expand a {itemId: count} composition into an array of Item references. Unknown ids
 * are dropped. If the result has fewer than {@link DECK_SIZE} cards, it's left short
 * (caller can decide to pad with the default).
 */
export function expandDeckComposition(composition: DeckComposition): Item[] {
  const cards: Item[] = [];
  Object.entries(composition).forEach(([id, count]) => {
    const item = ITEMS_BY_ID[id];
    if (!item || count <= 0) return;
    for (let i = 0; i < count; i += 1) {
      cards.push(item);
    }
  });
  return cards;
}

/**
 * Build a 25-card example deck by repeating the catalog. Used for the
 * CLI demo battle where there's no associated user.
 */
export function buildExampleDeck(): Item[] {
  return expandDeckComposition(defaultDeckComposition());
}

/** Validate deck size, per-card cap, and rarity band limits (5★+ / 4★+ caps include lower bands). */
export function validateDeckComposition(composition: DeckComposition): DeckValidationResult {
  let total = 0;
  for (const [id, count] of Object.entries(composition)) {
    if (!ITEMS_BY_ID[id]) {
      return { ok: false, reason: `Unknown item id: ${id}` };
    }
    if (!Number.isInteger(count) || count < 0 || count > PER_CARD_MAX) {
      return { ok: false, reason: `Each card must be 0–${PER_CARD_MAX} copies.` };
    }
    total += count;
  }
  if (total !== DECK_SIZE) {
    return {
      ok: false,
      reason: `Deck must have exactly ${DECK_SIZE} cards (currently ${total}).`,
    };
  }
  const fivePlus = countDeckCardsAtLeastRarity(composition, 5);
  if (fivePlus > DECK_MAX_FIVE_STAR_OR_ABOVE) {
    return {
      ok: false,
      reason: `At most ${DECK_MAX_FIVE_STAR_OR_ABOVE} cards may be 5★ or higher (currently ${fivePlus}).`,
    };
  }
  const fourPlus = countDeckCardsAtLeastRarity(composition, 4);
  if (fourPlus > DECK_MAX_FOUR_STAR_OR_ABOVE) {
    return {
      ok: false,
      reason: `At most ${DECK_MAX_FOUR_STAR_OR_ABOVE} cards may be 4★ or higher (currently ${fourPlus}, includes 5★+).`,
    };
  }
  return { ok: true };
}

/** True when the composition passes {@link validateDeckComposition}. */
export function isLegalDeck(composition: DeckComposition): boolean {
  return validateDeckComposition(composition).ok;
}
