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
import { TAGS, allyHasTag } from '../characterTags';
import { DENDRO_ABILITY_PANEL_COLOR, DENDRO_TEXT_COLORS } from './shared';

/** One stack of Keqisław's Dendro damage-over-time; list twice on a skill to apply two stacks. */
function bloomStack() {
  return createRangeEffect(
    RangeType.AllOpponents,
    createEffect({
      name: 'Bloom',
      description: 'Takes 4 dendro damage per turn.',
      type: EffectType.Dot,
      amount: 4,
      duration: 3,
      positive: false,
      stackable: true,
      appliesToElement: Element.Dendro,
    }),
  );
}

export const KEQISLAW = createCharacter({
  name: 'Keqisław Keqowski',
  slug: 'keqislaw',
  title: 'Wisdom of the North',
  description: 'A Snezhnayan diplomat and bow user hunting the Słowacki family treasure.',
  rarity: 4,
  hp: 75,
  element: Element.Dendro,
  tags: [TAGS.KEQISLAW],
  imagePanel: {
    mode: ImagePanelMode.Crop,
    imagePath: characterImagePath('keqislaw', 'jpg'),
  },
  background: createSimpleBackground('#5FA63A', '#234012'),
  textColors: DENDRO_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Zielone Łucznictwo',
      description: 'Fires 5 repeating arrows at one opponent, each dealing 3 Dendro damage.',
      damage: 3,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
      hitCount: 5,
      damageElement: Element.Dendro,
    }),
    createSkill({
      name: 'Machine of Conductivity',
      description: 'Deploys a Dendro Construct that deals 20 damage to one opponent and heals Keqisław for 15 HP.',
      damage: 20,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
      damageElement: Element.Dendro,
      onUse: (caster) => {
        caster.heal(15);
      },
    }),
    createSkill({
      name: 'Apology of Słowacki',
      description: 'Summons a spirit that rains Dendro tears on all opponents, dealing 30 damage and inflicting 2 stacks of [Bloom] for 3 turns. Targets inflicted with Bloom take 4 dendro DoT damage per turn.',
      damage: 30,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      damageElement: Element.Dendro,
      effects: [bloomStack(), bloomStack()],
    }),
  ],
  abilities: [
    createAbility({
      name: 'To Follow His Footsteps',
      description: 'When Ei is in the team, Keqisław looks up to her idol and increases outgoing damage by 25%.',
      panelColor: DENDRO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'To Follow His Footsteps',
            description: 'Increases outgoing damage by 25%.',
            type: EffectType.OutgoingDamage,
            amount: 1.25,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            allyHasTag(context.getAllies(), TAGS.EI)
          ),
        }),
      ],
    }),
    createAbility({
      name: 'Superior Intellect',
      description: 'Keqisław raises the team skill point cap by 1.',
      panelColor: DENDRO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Superior Intellect',
            description: '+1 maximum team skill points.',
            type: EffectType.SkillPointsMaxBonus,
            amount: 1,
            positive: true,
          }),
        }),
      ],
    }),
  ],
});
