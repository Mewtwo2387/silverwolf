import type { Item } from '../item';
import { equipmentItems } from './equipment';
import { consumableItems } from './consumables';

/** Item categories aggregated for the catalog. Add new top-level modules here only. */
const ITEM_CATEGORIES: readonly (readonly Item[])[] = [
  equipmentItems,
  consumableItems,
];

/** Full item catalog; derived from category `items` arrays (no per-item listing). */
export const ALL_ITEMS: Item[] = ITEM_CATEGORIES.flat();

/** Map item id → Item, for hydrating decks loaded from the database. */
export const ITEMS_BY_ID: Record<string, Item> = ALL_ITEMS.reduce<Record<string, Item>>((acc, it) => {
  acc[it.id] = it;
  return acc;
}, {});

/** Discord choice list for any command that accepts an item id (e.g. deckset). */
export const ITEM_DISCORD_CHOICES = ALL_ITEMS.map((it) => ({
  name: it.name,
  value: it.id,
}));
