import { Rarity } from '../../rarity';
import { Consumable } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { round2 } from '../../../utils/math';
import type { CharacterInBattle } from '../../characterInBattle';
import { itemImagePanel } from '../shared';

/** HEALING CONSUMABLES
 * Restores HP to the target.
 * By default, a 1/2/3/4/5 star consumable restores 10/20/30/40/50 HP to a 100HP character. (e.g. a 1* could restore 10HP, or 10% of max HP, or 5% of max HP plus 5HP)
 */

/** Heal `percent` of the target's max HP (0–1) plus a flat amount. */
function healPercentOfMaxPlusFlat(target: CharacterInBattle, percent: number, flat: number): void {
  target.heal(round2(target.character.hp * percent + flat));
}

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
  'Restores 20% of max HP plus 30 HP.',
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
  'Restores 40% of max HP plus 10 HP.',
  new Rarity(5),
  itemImagePanel('xei_pizza'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.5, 10);
  },
);

/* ------------------------------------------------------------ */

export const healingItems: Item[] = [
  HEALING_POTION,
  MYSTIC_CHICKEN,
  XEI_PIZZA,
];
