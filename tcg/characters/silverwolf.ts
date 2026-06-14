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
import { TAGS } from '../characterTags';
import { QUANTUM_ABILITY_PANEL_COLOR, QUANTUM_TEXT_COLORS } from './shared';

export const SILVERWOLF = createCharacter({
  name: 'Silverwolf',
  title: 'Hacker of the Stellaron Hunters',
  description: 'hot.',
  rarity: 6,
  hp: 80,
  element: Element.Quantum,
  tags: [TAGS.SILVERWOLF, TAGS.QUANTUM_GIRL, TAGS.HSR],
  imagePanel: {
    imagePath: characterImagePath('silverwolf', 'jpg'),
    mode: ImagePanelMode.Crop,
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'System Warning',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Allow Changes?',
      description: 'Increases incoming quantum damage of one opponent by 50% for 5 turns.',
      damage: 10,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
      effects: [
        createRangeEffect(
          RangeType.SingleOpponent,
          createEffect({
            name: 'Allow Changes?',
            description: 'Increases incoming quantum damage by 50%.',
            type: EffectType.IncomingDamage,
            amount: 1.5,
            duration: 5,
            appliesToElement: Element.Quantum,
            positive: false,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'User Banned',
      description: 'Increases incoming damage of all opponents by 50% for 5 turns.',
      damage: 25,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'User Banned',
            description: 'Increases incoming damage by 50%.',
            type: EffectType.IncomingDamage,
            amount: 1.5,
            duration: 5,
            positive: false,
          }),
        ),
      ],
    }),
  ],
  abilities: [
    (() => {
      const effect1 = createEffect({
        name: 'Bug: Incoming Damage',
        description: 'Incoming damage increased by 10%.',
        type: EffectType.IncomingDamage,
        amount: 1.1,
        duration: 3,
        positive: false,
      });

      const effect2 = createEffect({
        name: 'Bug: Outgoing Damage',
        description: 'Outgoing damage decreased by 10%.',
        type: EffectType.OutgoingDamage,
        amount: 0.9,
        duration: 3,
        positive: false,
      });

      const effect3 = createEffect({
        name: 'Bug: Energy Gain',
        description: 'Energy gain decreased by 10%.',
        type: EffectType.EnergyGain,
        amount: 0.9,
        duration: 3,
        positive: false,
      });

      let selectedEffectIndex: number | null = null;

      return createAbility({
        name: 'Awaiting System Response...',
        description: 'After attacking an opponent, implants one of the following three effects on them for 3 turns: increases incoming damage by 10%, decreases outgoing damage by 10%, or decreases energy gain by 10%.',
        panelColor: QUANTUM_ABILITY_PANEL_COLOR,
        effects: [
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect1,
            condition: (_context: AbilityActivationContext) => {
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              return selectedEffectIndex === 0;
            },
          }),
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect2,
            condition: (_context: AbilityActivationContext) => {
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              return selectedEffectIndex === 1;
            },
          }),
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect3,
            condition: (_context: AbilityActivationContext) => {
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              const result = selectedEffectIndex === 2;
              selectedEffectIndex = null;
              return result;
            },
          }),
        ],
      });
    })(),
  ],
});
