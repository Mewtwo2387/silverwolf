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
  Ultimate,
} from '../characterBuilder';
import { ImagePanelMode } from '../imagePanel';
import { characterImagePath } from '../assetPaths';
import { TAGS } from '../characterTags';
import { FAIRY_ABILITY_PANEL_COLOR, FAIRY_TEXT_COLORS } from './shared';

export const KAITLIN = createCharacter({
  name: 'Kaitlin',
  title: 'Herrscher of Egg',
  description: 'Starts in Doge form. Converts into Kaitlin form after casting skill.',
  rarity: 6,
  hp: 100,
  element: Element.Fairy,
  tags: [TAGS.KAITLIN, TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    imagePath: characterImagePath('kaitlin'),
    mode: ImagePanelMode.Crop,
  },
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  textColors: FAIRY_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Unlimited Doge Works',
      description: 'Basic Attack when in Doge Form.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Slay Queen',
      description: 'Basic Attack when in Kaitlin Form.',
      damage: 35,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Estrogen',
      description: 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.',
      range: RangeType.Self,
      battleCost: Ultimate(30),
      effects: [
        createRangeEffect(
          RangeType.Self,
          createEffect({
            name: 'Estrogen',
            description: 'Converted into Kaitlin Form.',
            type: EffectType.FormChange,
            amount: 1,
            positive: true,
          }),
        ),
      ],
      formChange: [1, 2],
    }),
  ],
  abilities: [
    createAbility({
      name: 'Coincidence? I Think Not.',
      description: 'Deals 15/40% more damage when there are 1/2 allies with name starting in "V".',
      panelColor: FAIRY_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().filter((ally) => ally.character.name.startsWith('V')).length === 1
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().filter((ally) => ally.character.name.startsWith('V')).length === 2
          ),
        }),
      ],
    }),
  ],
  defaultForm: [0, 2],
});
