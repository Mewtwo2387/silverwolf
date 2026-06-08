import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import { AbilityActivationContext } from '../ability';
import type { CharacterInBattle } from '../characterInBattle';
import {
  createCharacter,
  createSkill,
  createEffect,
  createAbility,
  createAbilityEffect,
  createSimpleBackground,
  Normal,
  Charged,
  Ultimate,
} from '../characterBuilder';
import { ImagePanelMode } from '../imagePanel';
import { characterImagePath } from '../assetPaths';
import { TAGS, countTaggedAllies } from '../characterTags';
import { round2 } from '../../utils/math';
import { ANEMO_ABILITY_PANEL_COLOR, ANEMO_TEXT_COLORS } from './shared';

const POLYGROWTH_STACK_NAME = 'Polygrowth Stack';
const POLYGROWTH_BONUS_NAME = 'Polygrowth';
const POLYGROWTH_DURATION = 5;
const POLYGROWTH_MAX_STACKS = 5;

/** Mystic charged skill: stack markers + outgoing-damage bonus at 20% × stacks². */
function applyPolygrowthStack(caster: CharacterInBattle): void {
  caster.addEffect(createEffect({
    name: POLYGROWTH_STACK_NAME,
    description: 'One Polygrowth stack.',
    type: EffectType.OutgoingDamage,
    amount: 1,
    duration: POLYGROWTH_DURATION,
    positive: true,
    stackable: true,
    maxStacks: POLYGROWTH_MAX_STACKS,
  }));

  const stacks = Math.min(
    POLYGROWTH_MAX_STACKS,
    caster.effects.filter((e) => e.name === POLYGROWTH_STACK_NAME).length,
  );
  const bonusMultiplier = round2(1 + 0.2 * stacks * stacks);

  caster.removeEffectsByName(POLYGROWTH_BONUS_NAME);

  caster.addEffect(createEffect({
    name: POLYGROWTH_BONUS_NAME,
    description: `Outgoing damage +${Math.round((bonusMultiplier - 1) * 100)}% (${stacks} stack${stacks === 1 ? '' : 's'}).`,
    type: EffectType.OutgoingDamage,
    amount: bonusMultiplier,
    duration: POLYGROWTH_DURATION,
    positive: true,
  }));
}

export const MYSTIC = createCharacter({
  name: 'Mystic',
  title: 'Herrscher of Poly',
  description: '-',
  rarity: 6,
  hp: 100,
  element: Element.Anemo,
  tags: [TAGS.TGP],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#5FBF8A',
    imagePath: characterImagePath('mystic'),
  },
  background: createSimpleBackground('#5FBF8A', '#2D6B4A'),
  textColors: ANEMO_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Polyrhythm',
      description: 'Deals 4 damage to one target 4 times.',
      damage: 4,
      hitCount: 4,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Polynomial Polygrowth',
      description: 'Gains one stack of [Polygrowth] for 5 turns. Increases outgoing damage by 20% x stacks² (max 5 stacks).',
      range: RangeType.Self,
      battleCost: Charged(1),
      onUse: (caster) => {
        applyPolygrowthStack(caster);
      },
    }),
    createSkill({
      name: 'Polychromatic Polystrike',
      description: 'Deals 20 damage of 3 random elements to all targets.',
      damage: 20,
      hitCount: 3,
      randomElementPerHit: true,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
    }),
  ],
  abilities: [
    createAbility({
      name: 'Polymorphism',
      description: 'For every TGP member in the team, increase outgoing damage by 20%.',
      panelColor: ANEMO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 20%.',
            type: EffectType.OutgoingDamage,
            amount: 1.2,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 1
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 2
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 60%.',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 3
          ),
        }),
      ],
    }),
  ],
});
