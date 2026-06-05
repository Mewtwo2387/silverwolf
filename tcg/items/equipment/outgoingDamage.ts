import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** All-element outgoing damage equipment (stackable). */
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

export const WOODEN_TOOL = outgoingDamageEquipment(
  'wooden_tool',
  'Wooden Tools',
  1,
  10,
  'Does anyone actually ever use these other than their first pickaxe? And the wooden axe I use to worldedit everything.',
);
export const STONE_TOOL = outgoingDamageEquipment('stone_tool', 'Stone Tools', 2, 20);
export const IRON_TOOL = outgoingDamageEquipment('iron_tool', 'Iron Tools', 3, 30);
export const DIAMOND_TOOL = outgoingDamageEquipment('diamond_tool', 'Diamond Tools', 4, 40);
export const NETHERITE_TOOL = outgoingDamageEquipment(
  'netherite_tool',
  'Netherite Tools',
  5,
  50,
  'The eternal weapon that can stop a certain person that loves video journal machines from respawning.',
);

export const MUTE = new Equipment(
  'mute',
  'Mute',
  'Increases outgoing damage by 40%.',
  new Rarity(3),
  itemImagePanel('mute'),
  itemBackgroundForRarity(3),
  [
    new Effect(
      'Mute',
      '+40% outgoing damage.',
      EffectType.OutgoingDamage,
      1.4,
      9999,
      true,
    ),
  ],
  undefined,
  'Someone forgot they already have 2 warns in hand and got a little bit too naughty.',
);

export const WARN = new Equipment(
  'warn',
  'Warn',
  'Increases outgoing damage by 20%. When equipping 3 Warns, it will be combined into a Mute.',
  new Rarity(2),
  itemImagePanel('warn'),
  itemBackgroundForRarity(2),
  [
    new Effect(
      'Warn',
      '+20% outgoing damage.',
      EffectType.OutgoingDamage,
      1.2,
      9999,
      true,
      undefined,
      true,
    ),
  ],
  undefined,
  'Some treat it like an undesired thing that\'ll taint you for 2 months. Some treat it like you\'re allowed one rule break every 2 months. Legends say that someone got over 20 of these. Reasons of giving out these include but is not limited to: Misspelling Ningguang, posting a gif of kicking a stickman in the balls, and posting a Ganyu spider.',
);
WARN.combinesWhenEquipped = { into: MUTE };

export const NOTICE = new Equipment(
  'notice',
  'Notice',
  'Increases outgoing damage by 10%. When equipping 3 Notices, it will be combined into a Warn.',
  new Rarity(1),
  itemImagePanel('notice'),
  itemBackgroundForRarity(1),
  [
    new Effect(
      'Notice',
      '+10% outgoing damage.',
      EffectType.OutgoingDamage,
      1.1,
      9999,
      true,
      undefined,
      true,
    ),
  ],
  undefined,
  'On the bright side, this is given out when a certain someone\'s pissed off at someone, but the mod doesn\'t really want to warn so they give out one of these for show to calm the certain someone. On the dark side, this is given out at completely arbitrary rule breaks that doesn\'t really break any rule.',
);
NOTICE.combinesWhenEquipped = { into: WARN };

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
];
