import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { DEFAULT_EQUIPMENT_COMBINE_COUNT } from '../../equipmentCombine';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** OUTGOING DAMAGE EQUIPMENTS
 * Buffs all outgoing damage by a certain percentage.
 * By default, a 1/2/3/4/5 star equipment buffs by 8/16/24/32/40%.
 * As this buffs all outgoing damage, the buff is slightly lower than those buffing a certain element or skill type.
 * Which, considering that a character can only have one type, makes this always worse than the element-specific buffs. So these are never BiS for any character.
 * However though because this works on any character, it could be useful in teams with multiple elements if you don't want to rely on luck to slot the right element-specific buffs.
 */

/** Regular outgoing damage equipments. */
export function outgoingDamageEquipment(
  id: string,
  name: string,
  stars: number,
  bonusPercent: number,
  footer?: string,
): Equipment {
  const multiplier = 1 + bonusPercent / 100;
  return new Equipment(
    id,
    name,
    `The wearer deals ${bonusPercent}% more damage.`,
    new Rarity(stars),
    itemImagePanel(id),
    itemBackgroundForRarity(stars),
    [
      new Effect(
        name,
        `+${bonusPercent}% damage.`,
        EffectType.OutgoingDamage,
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

/**
 * Outgoing-damage equipment that combines into `combinesInto` after {@link DEFAULT_EQUIPMENT_COMBINE_COUNT}
 * copies are equipped (stackable per copy until combine).
 */
export function mergableOutgoingDamageEquipment(
  id: string,
  name: string,
  stars: number,
  bonusPercent: number,
  combinesInto: Equipment,
  footer?: string,
  combineOptions?: {
    requiredCount?: number;
    description?: string;
  },
): Equipment {
  const multiplier = 1 + bonusPercent / 100;
  const required = combineOptions?.requiredCount ?? DEFAULT_EQUIPMENT_COMBINE_COUNT;
  const equipment = new Equipment(
    id,
    name,
    combineOptions?.description
      ?? `Increases outgoing damage by ${bonusPercent}%. When equipping ${required} ${name}s, it will be combined into a ${combinesInto.name}.`,
    new Rarity(stars),
    itemImagePanel(id),
    itemBackgroundForRarity(stars),
    [
      new Effect(
        name,
        `+${bonusPercent}% outgoing damage.`,
        EffectType.OutgoingDamage,
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
  equipment.combinesWhenEquipped = { into: combinesInto, requiredCount: required };
  return equipment;
}

/* ------------------------------------------------------------ */

export const WOODEN_TOOL = outgoingDamageEquipment(
  'wooden_tool',
  'Wooden Tools',
  1,
  8,
  'Does anyone actually ever use these other than their first pickaxe? And the wooden axe I use to worldedit everything.',
);
export const STONE_TOOL = outgoingDamageEquipment(
  'stone_tool',
  'Stone Tools',
  2,
  16,
);
export const IRON_TOOL = outgoingDamageEquipment(
  'iron_tool',
  'Iron Tools',
  3,
  24,
);
export const DIAMOND_TOOL = outgoingDamageEquipment(
  'diamond_tool',
  'Diamond Tools',
  4,
  32,
);
export const NETHERITE_TOOL = outgoingDamageEquipment(
  'netherite_tool',
  'Netherite Tools',
  5,
  40,
  'The eternal weapon that can stop a certain person that loves video journal machines from respawning.',
);

export const BAN = outgoingDamageEquipment(
  'ban',
  'Ban',
  5,
  40,
  'How did you even get this in modern day TGP? There\'s barely enough activity for you to get 5 warns that quickly. Either that, or you\'re a pedo.',
);

export const MUTE = mergableOutgoingDamageEquipment(
  'mute',
  'Mute',
  4,
  32,
  BAN,
  'Someone forgot they already have 2 warns in hand and got a little bit too naughty.',
);

export const WARN = mergableOutgoingDamageEquipment(
  'warn',
  'Warn',
  2,
  16,
  MUTE,
  'Some treat it like an undesired thing that\'ll taint you for 2 months. Some treat it like you\'re allowed one rule break every 2 months. Legends say that someone got over 20 of these. Reasons of giving out these include but is not limited to: Misspelling Ningguang, posting a gif of kicking a stickman in the balls, and posting a Ganyu spider.',
);

export const NOTICE = mergableOutgoingDamageEquipment(
  'notice',
  'Notice',
  1,
  8,
  WARN,
  'On the bright side, this is given out when a certain someone\'s pissed off at someone, but the mod doesn\'t really want to warn so they give out one of these for show to calm the certain someone. On the dark side, this is given out at completely arbitrary rule breaks that doesn\'t really break any rule.',
);

/* ------------------------------------------------------------ */

/** All generic outgoing-damage equipment in this module. */
export const outgoingDamageItems: Item[] = [
  WOODEN_TOOL,
  STONE_TOOL,
  IRON_TOOL,
  DIAMOND_TOOL,
  NETHERITE_TOOL,
  NOTICE,
  WARN,
  MUTE,
  BAN,
];
