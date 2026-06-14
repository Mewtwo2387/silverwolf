import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Element } from '../../element';
import { SignatureEquipment } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { round2 } from '../../../utils/math';
import { itemImagePanel } from '../shared';
import { TAGS, allyHasTag } from '../../characterTags';
import type { CharacterInBattle } from '../../characterInBattle';

function enterBloodMoon(holder: CharacterInBattle): void {
  holder.removeEffectsByName('Blood Moon (Pyro)');
  holder.removeEffectsByName('Blood Moon (DoT)');
  holder.addEffect(
    new Effect(
      'Blood Moon (Pyro)',
      '+30% pyro damage during Blood Moon.',
      EffectType.OutgoingDamage,
      1.3,
      2,
      true,
      { appliesToElement: Element.Pyro },
      true,
    ),
  );
  holder.addEffect(
    new Effect(
      'Blood Moon (DoT)',
      '+30% DoT during Blood Moon.',
      EffectType.DotDamageBonus,
      1.3,
      2,
      true,
      undefined,
      true,
    ),
  );
  holder.battle.logEvent(`${holder.character.name} entered [Blood Moon]!`);
}

/** SIGNATURE EQUIPMENTS
 * We know what a signature is.
 * Signature equipment for 6* characters are 5*.
 * It could be a mix-and-match of several other buffs.
 */

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
    if (target.character.hasTag(TAGS.KAITLIN)) {
      target.addEffect(
        new Effect(
          'Kaitlin Form',
          'Converted into Kaitlin Form.',
          EffectType.FormChange,
          1,
          9999,
          true,
          { activeSkillIndices: [1, 2] },
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
    const quantumGirlCount = target.battle.ally(target.side)
      .filter((c) => c.character.hasTag(TAGS.QUANTUM_GIRL)).length;
    if (quantumGirlCount > 0) {
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Team)',
          `+${quantumGirlCount * 10}% quantum damage (${quantumGirlCount} quantum ${quantumGirlCount === 1 ? 'ally' : 'allies'}).`,
          EffectType.OutgoingDamage,
          round2(1 + 0.1 * quantumGirlCount),
          9999,
          true,
          { appliesToElement: Element.Quantum },
          true,
        ),
      );
    }
    if (target.character.hasTag(TAGS.EI)) {
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

export const MOONLIGHT_ALTER = new SignatureEquipment(
  'moonlight_alter',
  'Moonlight Alter',
  'missingEi',
  'Increases DoT by 30%. Every 5 turns, enter the [Blood Moon] state for 2 turns. In the [Blood Moon] state, increase Pyro DMG and DoT by a further 30%. When equipped by missingEi, obtain [Fly me to the moon] which gives a 20% dodge chance. If Keqislaw is also in the team, obtain [And let me play among the stars] that increases missingEi\'s ult dmg by 20%.',
  new Rarity(5),
  itemImagePanel('moonlight_alter'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Moonlight Alter',
      '+30% DoT dealt.',
      EffectType.DotDamageBonus,
      1.3,
      9999,
      true,
      undefined,
      true,
    ),
  ],
  (target) => {
    if (!target.character.hasTag(TAGS.MISSING_EI)) return;
    target.addEffect(
      new Effect(
        'Fly me to the moon',
        '20% chance to dodge attacks.',
        EffectType.DodgeChance,
        0.2,
        9999,
        true,
        undefined,
        true,
      ),
    );
    if (allyHasTag(target.battle.ally(target.side), TAGS.KEQISLAW_KEQOWSKI)) {
      target.addEffect(
        new Effect(
          'And let me play among the stars',
          '+20% ultimate damage.',
          EffectType.UltimateOutgoingDamage,
          1.2,
          9999,
          true,
          undefined,
          true,
        ),
      );
    }
  },
);

MOONLIGHT_ALTER.onTurnEnd = (holder) => {
  if (holder.battle.currentTurn % 5 !== 0) return;
  enterBloodMoon(holder);
};

/* ------------------------------------------------------------ */

export const signatureEquipmentItems: Item[] = [
  ESTROGEN,
  SILVERWOLF_KEYCHAIN,
  CREDIT_CARD,
  MOONLIGHT_ALTER,
];
