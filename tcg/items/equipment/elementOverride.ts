import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

export const STRANGE_QUARK = new Equipment(
  'strange_quark',
  'Strange Quark',
  'Converts all outgoing damage from this character into quantum damage.',
  new Rarity(3),
  itemImagePanel('strange_quark'),
  itemBackgroundForRarity(3),
  [
    new Effect(
      'Strange Quark',
      'Outgoing damage is converted to quantum.',
      EffectType.DamageElementOverride,
      1,
      9999,
      true,
      { overrideElement: Element.Quantum },
      true,
    ),
  ],
  undefined,
  'Something something decay into strange matter',
);

/** Equipment that overrides outgoing damage element. */
export const elementOverrideItems: Item[] = [STRANGE_QUARK];
