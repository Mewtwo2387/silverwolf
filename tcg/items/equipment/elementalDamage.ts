import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { Equipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** Equipment that boosts outgoing damage of a single element (stackable). */
export function elementalDamageEquipment(
  id: string,
  name: string,
  element: Element,
  options: {
    rarity: Rarity;
    damageMultiplier: number;
    description?: string;
    footer?: string;
  },
): Equipment {
  const typeLabel = Element[element].toLowerCase();
  const bonusPct = Math.round((options.damageMultiplier - 1) * 100);
  return new Equipment(
    id,
    name,
    options.description ?? `The wearer deals ${bonusPct}% more ${typeLabel} damage.`,
    options.rarity,
    itemImagePanel(id),
    itemBackgroundForRarity(options.rarity),
    [
      new Effect(
        name,
        `+${bonusPct}% ${typeLabel} damage.`,
        EffectType.OutgoingDamage,
        options.damageMultiplier,
        9999,
        true,
        { appliesToElement: element },
        true,
      ),
    ],
    undefined,
    options.footer,
  );
}

const ELEMENTAL_25 = { rarity: new Rarity(3), damageMultiplier: 1.25 } as const;
const ELEMENTAL_50 = { rarity: new Rarity(5), damageMultiplier: 1.5 } as const;

export const ANEMOCULUS = elementalDamageEquipment(
  'anemoculus',
  'Anemoculus',
  Element.Anemo,
  {
    ...ELEMENTAL_25,
    footer: 'Mondstadt\'s oculus. Back when you can actually find them all by exploring, and not like, this area can only be unlocked during this questline which is a continuation of another questline triggered by entering this particular cave; or like, you need this funny tree to be level 10 before you can open this door.',
  },
);
export const CRYOCULUS = elementalDamageEquipment('cryoculus', 'Cryoculus', Element.Cryo, ELEMENTAL_25);
export const DENDROCULUS = elementalDamageEquipment('dendroculus', 'Dendroculus', Element.Dendro, ELEMENTAL_25);
export const ELECTROCULUS = elementalDamageEquipment('electroculus', 'Electroculus', Element.Electro, ELEMENTAL_25);
export const GEOCULUS = elementalDamageEquipment('geoculus', 'Geoculus', Element.Geo, ELEMENTAL_25);
export const HYDROCULUS = elementalDamageEquipment('hydroculus', 'Hydroculus', Element.Hydro, ELEMENTAL_25);
export const PYROCULUS = elementalDamageEquipment('pyroculus', 'Pyroculus', Element.Pyro, ELEMENTAL_25);
export const MAID_OUTFIT = elementalDamageEquipment(
  'maid_outfit',
  'Maid Outfit',
  Element.Fairy,
  {
    ...ELEMENTAL_25,
    footer: 'uwu :3\nOnce worn by a certain someone that swears if Japan win against Germany in the 2022 World Cup.',
  },
);
export const RUSTED_SWORD = elementalDamageEquipment(
  'rusted_sword',
  'Rusted Sword',
  Element.Physical,
  {
    ...ELEMENTAL_25,
    footer: 'I don\'t know how this broken shit can increase damage but it\'s not like I know much about swordfight. At least not the straight type of swordfight.',
  },
);
export const QUANTUM_COMPRESSOR = elementalDamageEquipment(
  'quantum_compressor',
  'Quantum Compressor',
  Element.Quantum,
  {
    ...ELEMENTAL_25,
    footer: 'Anyone playing modded Minecraft knows everyone loves this slop when we see it in a tech modpack. Can\'t think of an endgame goal? Just make the player obtain 10000 of every item and squeeze them into a singularity. Instantly triples playtime.',
  },
);

export const ANEMO_GNOSIS = elementalDamageEquipment(
  'anemo_gnosis',
  'Anemo Gnosis',
  Element.Anemo,
  {
    ...ELEMENTAL_50,
    footer: 'Someone kicked Venti in the balls. Fortunately, his balls are so humongous that it\'s barely a tickle.',
  },
);
export const GEO_GNOSIS = elementalDamageEquipment(
  'geo_gnosis',
  'Geo Gnosis',
  Element.Geo,
  {
    ...ELEMENTAL_50,
    footer: 'I wonder if it\'ll hurt if I shove it up. I guess Signora knows the answer.',
  },
);
export const PYRO_GNOSIS = elementalDamageEquipment('pyro_gnosis', 'Pyro Gnosis', Element.Pyro, ELEMENTAL_50);
export const DENDRO_GNOSIS = elementalDamageEquipment('dendro_gnosis', 'Dendro Gnosis', Element.Dendro, {
  ...ELEMENTAL_50,
  footer: 'Teyvat is a simulated universe in a Scepter, powered by a Stellaron. The skies of Teyvat are fake.',
});
export const ELECTRO_GNOSIS = elementalDamageEquipment('electro_gnosis', 'Electro Gnosis', Element.Electro, {
  ...ELEMENTAL_50,
  footer: 'Scara... who?',
});
export const CRYO_GNOSIS = elementalDamageEquipment('cryo_gnosis', 'Cryo Gnosis', Element.Cryo, ELEMENTAL_50);
export const HYDRO_GNOSIS = elementalDamageEquipment('hydro_gnosis', 'Hydro Gnosis', Element.Hydro, ELEMENTAL_50);
export const PINK_FOR_SLUG = elementalDamageEquipment('pink_for_slug', 'Pink for Slug!', Element.Fairy, ELEMENTAL_50);
export const AK_47 = elementalDamageEquipment(
  'ak_47',
  'AK-47',
  Element.Physical,
  {
    ...ELEMENTAL_50,
    footer: 'Enemies die to a severe allergic reaction to metal',
  },
);
export const BLACK_HOLE = elementalDamageEquipment(
  'black_hole',
  'Black hole',
  Element.Quantum,
  {
    ...ELEMENTAL_50,
    footer: 'massive and dark like your mom\'s hole',
  },
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
