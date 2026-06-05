import { Rarity } from '../../rarity';
import { Consumable } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { healPercentOfMaxPlusFlat, itemImagePanel } from '../shared';

export const HEALING_POTION = new Consumable(
  'healing_potion',
  'Healing Potion',
  'Immediately restores 20 HP to the target.',
  new Rarity(2),
  itemImagePanel('healing_potion'),
  itemBackgroundForRarity(2),
  (target) => {
    target.heal(20);
  },
);

export const MYSTIC_CHICKEN = new Consumable(
  'mystic_chicken',
  'Mystic Chicken',
  'Restores 30% of max HP plus 30 HP.',
  new Rarity(5),
  itemImagePanel('mystic_chicken'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.3, 30);
  },
  'A polychromatic, polyspiced, polyherbal, polysauced bowl of chicken sat beside a polygrain medley on a polyhedral platter.',
);

export const XEI_PIZZA = new Consumable(
  'xei_pizza',
  'Xei Pizza',
  'Restores 50% of max HP plus 10 HP.',
  new Rarity(5),
  itemImagePanel('xei_pizza'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.5, 10);
  },
);

/** Consumables that restore HP. */
export const healingItems: Item[] = [
  HEALING_POTION,
  MYSTIC_CHICKEN,
  XEI_PIZZA,
];
