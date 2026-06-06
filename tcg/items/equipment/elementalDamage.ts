import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** ELEMENTAL DAMAGE EQUIPMENTS
 * Boosts outgoing damage of a single element.
 * By default, a 1/2/3/4/5 star equipment boosts by 10/20/30/40/50%.
 * This could be BiS for many characters of their respective elements.
 */

/** Regular elemental damage equipments. */
export function elementalDamageEquipment(
  id: string,
  name: string,
  element: Element,
  stars: number,
  bonusPercent: number,
  footer?: string,
): Equipment {
  const multiplier = 1 + bonusPercent / 100;
  const typeLabel = Element[element].toLowerCase();
  return new Equipment(
    id,
    name,
    `The wearer deals ${bonusPercent}% more ${typeLabel} damage.`,
    new Rarity(stars),
    itemImagePanel(id),
    itemBackgroundForRarity(stars),
    [
      new Effect(
        name,
        `+${bonusPercent}% ${typeLabel} damage.`,
        EffectType.OutgoingDamage,
        multiplier,
        9999,
        true,
        { appliesToElement: element },
        true,
      ),
    ],
    undefined,
    footer,
  );
}

/* ------------------------------------------------------------ */

export const ANEMOCULUS = elementalDamageEquipment(
  'anemoculus',
  'Anemoculus',
  Element.Anemo,
  3,
  30,
  'Mondstadt\'s oculus. Back when you can actually find them all by exploring, and not like, this area can only be unlocked during this questline which is a continuation of another questline triggered by entering this particular cave; or like, you need this funny tree to be level 10 before you can open this door.',
);
export const CRYOCULUS = elementalDamageEquipment('cryoculus', 'Cryoculus', Element.Cryo, 3, 30);
export const DENDROCULUS = elementalDamageEquipment('dendroculus', 'Dendroculus', Element.Dendro, 3, 30);
export const ELECTROCULUS = elementalDamageEquipment('electroculus', 'Electroculus', Element.Electro, 3, 30);
export const GEOCULUS = elementalDamageEquipment('geoculus', 'Geoculus', Element.Geo, 3, 30);
export const HYDROCULUS = elementalDamageEquipment('hydroculus', 'Hydroculus', Element.Hydro, 3, 30);
export const PYROCULUS = elementalDamageEquipment('pyroculus', 'Pyroculus', Element.Pyro, 3, 30);
export const MAID_OUTFIT = elementalDamageEquipment(
  'maid_outfit',
  'Maid Outfit',
  Element.Fairy,
  3,
  30,
  'uwu :3\nOnce worn by a certain someone that swears if Japan win against Germany in the 2022 World Cup.',
);
export const RUSTED_SWORD = elementalDamageEquipment(
  'rusted_sword',
  'Rusted Sword',
  Element.Physical,
  3,
  30,
  'I don\'t know how this broken shit can increase damage but it\'s not like I know much about swordfight. At least not the straight type of swordfight.',
);
export const QUANTUM_COMPRESSOR = elementalDamageEquipment(
  'quantum_compressor',
  'Quantum Compressor',
  Element.Quantum,
  3,
  30,
  'Anyone playing modded Minecraft knows everyone loves this slop when we see it in a tech modpack. Can\'t think of an endgame goal? Just make the player obtain 10000 of every item and squeeze them into a singularity. Instantly triples playtime.',
);

/* ------------------------------------------------------------ */

export const ANEMO_GNOSIS = elementalDamageEquipment(
  'anemo_gnosis',
  'Anemo Gnosis',
  Element.Anemo,
  5,
  50,
  'Someone kicked Venti in the balls. Fortunately, his balls are so humongous that it\'s barely a tickle.',
);
export const GEO_GNOSIS = elementalDamageEquipment(
  'geo_gnosis',
  'Geo Gnosis',
  Element.Geo,
  5,
  50,
  'I wonder if it\'ll hurt if I shove it up. I guess Signora knows the answer.',
);
export const PYRO_GNOSIS = elementalDamageEquipment('pyro_gnosis', 'Pyro Gnosis', Element.Pyro, 5, 50);
export const DENDRO_GNOSIS = elementalDamageEquipment(
  'dendro_gnosis',
  'Dendro Gnosis',
  Element.Dendro,
  5,
  50,
  'Teyvat is a simulated universe in a Scepter, powered by a Stellaron. The skies of Teyvat are fake.',
);
export const ELECTRO_GNOSIS = elementalDamageEquipment(
  'electro_gnosis',
  'Electro Gnosis',
  Element.Electro,
  5,
  50,
  'Scara... who?',
);
export const CRYO_GNOSIS = elementalDamageEquipment('cryo_gnosis', 'Cryo Gnosis', Element.Cryo, 5, 50);
export const HYDRO_GNOSIS = elementalDamageEquipment('hydro_gnosis', 'Hydro Gnosis', Element.Hydro, 5, 50);
export const PINK_FOR_SLUG = elementalDamageEquipment('pink_for_slug', 'Pink for Slug!', Element.Fairy, 5, 50);
export const AK_47 = elementalDamageEquipment(
  'ak_47',
  'AK-47',
  Element.Physical,
  5,
  50,
  'Enemies die to a severe allergic reaction to metal',
);
export const BLACK_HOLE = elementalDamageEquipment(
  'black_hole',
  'Black hole',
  Element.Quantum,
  5,
  50,
  'massive and dark like your mom\'s hole',
);

/** All elemental outgoing-damage equipment in this module. */
export const elementalDamageItems: Item[] = [
  ANEMOCULUS,
  CRYOCULUS,
  DENDROCULUS,
  ELECTROCULUS,
  GEOCULUS,
  HYDROCULUS,
  PYROCULUS,
  MAID_OUTFIT,
  RUSTED_SWORD,
  QUANTUM_COMPRESSOR,
  ANEMO_GNOSIS,
  GEO_GNOSIS,
  PYRO_GNOSIS,
  DENDRO_GNOSIS,
  ELECTRO_GNOSIS,
  CRYO_GNOSIS,
  HYDRO_GNOSIS,
  PINK_FOR_SLUG,
  AK_47,
  BLACK_HOLE,
];
