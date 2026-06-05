import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** All-type incoming damage reduction equipment (stackable). */
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
  20,
  'Silverwolf can tie me up using this.',
);
export const IRON_ARMOR = incomingReductionEquipment('iron_armor', 'Iron Armor', 3, 30);
export const DIAMOND_ARMOR = incomingReductionEquipment('diamond_armor', 'Diamond Armor', 4, 40);
export const NETHERITE_ARMOR = incomingReductionEquipment(
  'netherite_armor',
  'Netherite Armor',
  5,
  50,
  'There\'s something written on the boots, but I can\'t understand it as it\'s written in parkour.',
);

/** All incoming-damage reduction equipment in this module. */
export const incomingReductionItems: Item[] = [
  LEATHER_ARMOR,
  CHAIN_ARMOR,
  IRON_ARMOR,
  DIAMOND_ARMOR,
  NETHERITE_ARMOR,
];
