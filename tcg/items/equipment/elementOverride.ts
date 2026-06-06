import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** ELEMENT OVERRIDE EQUIPMENTS
 * Overrides the outgoing damage element of a character.
 * By default, pure overrides are 3*.
 */

/** Regular element override equipments. */
export function elementOverrideEquipment(
  id: string,
  name: string,
  element: Element,
  stars: number,
  footer?: string,
): Equipment {
  const typeLabel = Element[element].toLowerCase();
  return new Equipment(
    id,
    name,
    `Converts all outgoing damage from this character into ${typeLabel} damage.`,
    new Rarity(stars),
    itemImagePanel(id),
    itemBackgroundForRarity(stars),
    [
      new Effect(
        name,
        `Outgoing damage is converted to ${typeLabel}.`,
        EffectType.DamageElementOverride,
        1,
        9999,
        true,
        { overrideElement: element },
        true,
      ),
    ],
    undefined,
    footer,
  );
}

/* ------------------------------------------------------------ */

export const VENTI_HAT = elementOverrideEquipment(
  'venti_hat',
  'Venti Hat',
  Element.Anemo,
  3,
  'The one thing Gamebang put his life in defending during r/place. Might or might not give you some anemo archon powers, such as, an 8-incher.',
);

export const GRASS = elementOverrideEquipment(
  'grass',
  'Grass',
  Element.Dendro,
  3,
  'Ei is allergic to this. Kittycat and Bomby use this to their advantage.',
);

export const STRANGE_QUARK = elementOverrideEquipment(
  'strange_quark',
  'Strange Quark',
  Element.Quantum,
  3,
  'Something something decay into strange matter',
);

/* ------------------------------------------------------------ */

export const elementOverrideItems: Item[] = [
  STRANGE_QUARK,
  VENTI_HAT,
  GRASS,
];
