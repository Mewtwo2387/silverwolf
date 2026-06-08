import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import { AbilityActivationContext } from '../ability';
import {
  createCharacter,
  createSkill,
  createEffect,
  createRangeEffect,
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
import { QUANTUM_ABILITY_PANEL_COLOR, QUANTUM_TEXT_COLORS } from './shared';

export const EI = createCharacter({
  name: 'Ei',
  title: 'Herrscher of Horny',
  description: 'silverwolfsbf',
  rarity: 6,
  hp: 100,
  element: Element.Quantum,
  tags: [TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#49497d',
    imagePath: characterImagePath('ei'),
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Plap',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'uuoohhh',
      description: 'Attacks a single opponent.',
      damage: 45,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
    }),
    createSkill({
      name: 'PLAP PLAP PLAP GET CORRECTED',
      description: 'All your [redacted] needs correction! Attacks all opponents, reducing their outgoing damage by 35% for 5 turns.',
      damage: 35,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'PLAP PLAP PLAP GET CORRECTED',
            description: 'Reduces outgoing damage by 35%.',
            type: EffectType.OutgoingDamage,
            amount: 0.65,
            duration: 5,
            positive: false,
          }),
        ),
      ],
    }),
  ],
  abilities: [
    createAbility({
      name: 'I love all my quantum girls',
      description: 'Deals 15/40% more damage when there are 1/2 quantum allies',
      panelColor: QUANTUM_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.QUANTUM_GIRL) === 2
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.QUANTUM_GIRL) === 3
          ),
        }),
      ],
    }),
  ],
});
