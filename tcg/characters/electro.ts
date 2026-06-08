import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import { AbilityActivationContext } from '../ability';
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
import { TAGS } from '../characterTags';
import { ELECTRO_ABILITY_PANEL_COLOR, ELECTRO_TEXT_COLORS } from './shared';

export const ELECTRO = createCharacter({
  name: 'Electro',
  title: "Furina's Wife",
  description: 'bottom + whale + yuri',
  rarity: 6,
  hp: 100,
  element: Element.Electro,
  tags: [TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#39AACC',
    imagePath: characterImagePath('electro', 'jpg'),
  },
  background: createSimpleBackground('#39AACC', '#7ADDFF'),
  textColors: ELECTRO_TEXT_COLORS,
  twoColumnSkills: true,
  skills: [
    createSkill({
      name: '60',
      description: '$1.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: '300+30',
      description: '$5.',
      damage: 15,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
    }),
    createSkill({
      name: '980+110',
      description: '$15.',
      damage: 35,
      range: RangeType.SingleOpponent,
      battleCost: Charged(2),
    }),
    createSkill({
      name: '1980+260',
      description: '$30.',
      damage: 60,
      range: RangeType.SingleOpponent,
      battleCost: Charged(3),
    }),
    createSkill({
      name: '3280+600',
      description: '$50.',
      damage: 90,
      range: RangeType.SingleOpponent,
      battleCost: Charged(4),
    }),
    createSkill({
      name: '6480+1600',
      description: '$100.',
      damage: 120,
      range: RangeType.SingleOpponent,
      battleCost: Charged(5),
    }),
    createSkill({
      name: 'Shop sweep',
      description: 'All of them.',
      damage: 100,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(100),
    }),
  ],
  abilities: [
    createAbility({
      name: "Furina's Bottom",
      description: 'When Furina is in the same team, decrease damage taken by 40%',
      panelColor: ELECTRO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: "Furina's Bottom",
            description: 'Decreases damage taken by 40%.',
            type: EffectType.IncomingDamage,
            amount: 0.6,
            duration: 9999,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().some((ally) => ally.character.name === 'Furina')
          ),
        }),
      ],
    }),
  ],
});
