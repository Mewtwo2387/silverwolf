import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { SignatureEquipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { round2 } from '../../../utils/math';
import { itemImagePanel } from '../shared';

/** SIGNATURE EQUIPMENTS
 * We know what a signature is.
 * Signature equipment for 6* characters are 5*.
 * It could be a mix-and-match of several other buffs.
 * /

/** Kaitlin form skill indices (Slay Queen + Estrogen ultimate), same as her transformation skill. */
const KAITLIN_FORM_SKILL_INDICES = [1, 2];

export const ESTROGEN = new SignatureEquipment(
  'estrogen',
  'Estrogen',
  'Kaitlin',
  'Converts all outgoing damage to Fairy type and increases Fairy damage by 20%. If the holder is already Fairy, increases Fairy damage by an additional 20%. When held by Kaitlin, instantly transforms to Kaitlin form.',
  new Rarity(5),
  itemImagePanel('estrogen', { whiteBackground: true }),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Estrogen',
      'Outgoing damage is converted to fairy.',
      EffectType.DamageElementOverride,
      1,
      9999,
      true,
      { overrideElement: Element.Fairy },
      true,
    ),
    new Effect(
      'Estrogen',
      '+20% fairy damage.',
      EffectType.OutgoingDamage,
      1.2,
      9999,
      true,
      { appliesToElement: Element.Fairy },
      true,
    ),
  ],
  (target) => {
    if (target.character.element === Element.Fairy) {
      target.addEffect(
        new Effect(
          'Estrogen (Innate Fairy)',
          '+20% additional fairy damage for Fairy-type holders.',
          EffectType.OutgoingDamage,
          1.2,
          9999,
          true,
          { appliesToElement: Element.Fairy },
          true,
        ),
      );
    }
    if (target.character.name === 'Kaitlin') {
      target.addEffect(
        new Effect(
          'Kaitlin Form',
          'Converted into Kaitlin Form.',
          EffectType.FormChange,
          1,
          9999,
          true,
          { activeSkillIndices: KAITLIN_FORM_SKILL_INDICES },
        ),
      );
      target.battle.logEvent(`${target.character.name} transformed into Kaitlin Form!`);
    }
  },
  'You want this too, don\'t you? uwu :3',
);

export const SILVERWOLF_KEYCHAIN = new SignatureEquipment(
  'silverwolf_keychain',
  'Silverwolf Keychain',
  'Ei',
  'Increases quantum damage by 20%. Additionally increases quantum damage by 10% for each quantum ally on your team. When held by Ei, reduces incoming damage by 20% and grants a 20% chance to dodge attacks.',
  new Rarity(5),
  itemImagePanel('silverwolf_keychain'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Silverwolf Keychain',
      '+20% quantum damage.',
      EffectType.OutgoingDamage,
      1.2,
      9999,
      true,
      { appliesToElement: Element.Quantum },
      true,
    ),
  ],
  (target) => {
    const quantumCount = target.battle.ally(target.side)
      .filter((c) => c.character.element === Element.Quantum).length;
    if (quantumCount > 0) {
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Team)',
          `+${quantumCount * 10}% quantum damage (${quantumCount} quantum ${quantumCount === 1 ? 'ally' : 'allies'}).`,
          EffectType.OutgoingDamage,
          round2(1 + 0.1 * quantumCount),
          9999,
          true,
          { appliesToElement: Element.Quantum },
          true,
        ),
      );
    }
    if (target.character.name === 'Ei') {
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Ei Guard)',
          '-20% incoming damage.',
          EffectType.IncomingDamage,
          0.8,
          9999,
          true,
          undefined,
          true,
        ),
      );
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Ei Dodge)',
          '20% chance to dodge attacks.',
          EffectType.DodgeChance,
          0.2,
          9999,
          true,
          undefined,
          true,
        ),
      );
    }
  },
  'The thing that Ei brings everywhere like it protects him or some shit',
);

export const CREDIT_CARD = new SignatureEquipment(
  'credit_card',
  'Credit Card',
  'Electro',
  'Increases charged attack damage by 20%. For each skill point spent on a charged attack, that attack deals 10% more damage.',
  new Rarity(5),
  itemImagePanel('credit_card'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Credit Card',
      '+20% charged attack damage.',
      EffectType.ChargedOutgoingDamage,
      1.2,
      9999,
      true,
      undefined,
      true,
    ),
    new Effect(
      'Credit Card',
      '+10% charged attack damage per skill point spent on the attack.',
      EffectType.ChargedSkillPointScaling,
      0.1,
      9999,
      true,
      undefined,
      true,
    ),
  ],
  undefined,
  'The best card in the game',
);

/* ------------------------------------------------------------ */

export const signatureEquipmentItems: Item[] = [
  ESTROGEN,
  SILVERWOLF_KEYCHAIN,
  CREDIT_CARD,
];
