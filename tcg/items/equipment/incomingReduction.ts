import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** INCOMING DAMAGE REDUCTION EQUIPMENTS
 * Reduces all incoming damage by a certain percentage.
 * By default, a 1/2/3/4/5 star equipment reduces by 10/17/24/29/34%.
 * I did this instead of a linear 10/20/30/40/50% reduction because a 50% damage reduction actually divides the damage by 2, and therefore requires a 100% damage increase to be nullified.
 * So instead, it divides the damage by 1.1/1.2/1.3/1.4/1.5.
 */

/** Regular incoming damage reduction equipments. */
export function incomingReductionEquipment(
  id: string,
  name: string,
  stars: number,
  reductionPercent: number,
  footer?: string,
): Equipment {
  const multiplier = 1 - reductionPercent / 100;
  return new Equipment(
    id,
    name,
    `Reduces incoming damage by ${reductionPercent}%.`,
    new Rarity(stars),
    itemImagePanel(id),
    itemBackgroundForRarity(stars),
    [
      new Effect(
        name,
        `-${reductionPercent}% incoming damage.`,
        EffectType.IncomingDamage,
        multiplier,
        9999,
        true,
        undefined,
        true,
      ),
    ],
    undefined,
    footer,
  );
}

/* ------------------------------------------------------------ */

export const LEATHER_ARMOR = incomingReductionEquipment(
  'leather_armor',
  'Leather Armor',
  1,
  10,
  'In parkour civilization, no one jumps for the beef.',
);
export const CHAIN_ARMOR = incomingReductionEquipment(
  'chain_armor',
  'Chain Armor',
  2,
  17,
  'Silverwolf can tie me up using this.',
);
export const IRON_ARMOR = incomingReductionEquipment('iron_armor', 'Iron Armor', 3, 24);
export const DIAMOND_ARMOR = incomingReductionEquipment('diamond_armor', 'Diamond Armor', 4, 29);
export const NETHERITE_ARMOR = incomingReductionEquipment(
  'netherite_armor',
  'Netherite Armor',
  5,
  34,
  'There\'s something written on the boots, but I can\'t understand it as it\'s written in parkour.',
);

/* ------------------------------------------------------------ */

export const incomingReductionItems: Item[] = [
  LEATHER_ARMOR,
  CHAIN_ARMOR,
  IRON_ARMOR,
  DIAMOND_ARMOR,
  NETHERITE_ARMOR,
];
