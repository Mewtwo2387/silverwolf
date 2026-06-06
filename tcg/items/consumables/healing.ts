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

export const COPIUM = new Consumable(
  'copium',
  'Copium',
  'Immediately restores 10 HP to the target.',
  new Rarity(1),
  itemImagePanel('copium'),
  itemBackgroundForRarity(1),
  (target) => {
    target.heal(10);
  },
  'Like Hopium, but worse, because there isn\'t even any hope left.',
);

export const HOPIUM = new Consumable(
  'hopium',
  'Hopium',
  'Immediately restores 20 HP to the target.',
  new Rarity(2),
  itemImagePanel('hopium'),
  itemBackgroundForRarity(2),
  (target) => {
    target.heal(20);
  },
  'It will- It won\'t.',
);

export const DINONUGGIES = new Consumable(
  'dinonuggies',
  'Dinonuggies',
  'Immediately restores 30 HP to the target.',
  new Rarity(3),
  itemImagePanel('dinonuggies'),
  itemBackgroundForRarity(3),
  (target) => {
    target.heal(30);
  },
  'A bunch of dinonuggies baked by Beki. Apparently Fit and Finch have over 1 quadrillion of these because the dinonuggie economy is so broken.',
);

export const COCOGOAT_MILK = new Consumable(
  'cocogoat_milk',
  'Cocogoat Milk',
  'Immediately restores 40 HP to the target.',
  new Rarity(4),
  itemImagePanel('cocogoat_milk'),
  itemBackgroundForRarity(4),
  (target) => {
    target.heal(40);
  },
  'Legend says that there was once a battle between Gamebang and Sideways for this milk, known as the Battle of the Cocogoat Milk.',
);

export const MYSTIC_CHICKEN = new Consumable(
  'mystic_chicken',
  'Mystic Chicken',
  'Restores 20% of max HP plus 30 HP.',
  new Rarity(5),
  itemImagePanel('mystic_chicken'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.2, 30);
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
    healPercentOfMaxPlusFlat(target, 0.4, 10);
  },
);

/* ------------------------------------------------------------ */

export const healingItems: Item[] = [
  COPIUM,
  HOPIUM,
  COCOGOAT_MILK,
  MYSTIC_CHICKEN,
  XEI_PIZZA,
];
