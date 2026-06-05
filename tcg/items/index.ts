/**
 * TCG item catalog. Definitions live under `tcg/items/` by function; each module
 * exports an `items` array that {@link ./catalog.ts} aggregates into {@link ALL_ITEMS}.
 */

export * from './catalog';
export * from './deck';
export * from './shared';
export * from './equipment';
export * from './consumables';
