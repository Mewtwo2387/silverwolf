import { Effect } from '../effect';
import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
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

export const SPARKLE = createCharacter({
  name: 'Sparkle',
  title: 'Member of the Masked Fools',
  description: 'hot.',
  rarity: 6,
  hp: 80,
  element: Element.Quantum,
  tags: [TAGS.QUANTUM_GIRL, TAGS.HSR],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#000000',
    imagePath: characterImagePath('sparkle', 'jpg'),
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Monodrama',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Dreamdiver',
      description: 'Increases outgoing damage of one ally by 60% for 3 turns.',
      range: RangeType.SingleAlly,
      battleCost: Charged(1),
      effects: [
        createRangeEffect(
          RangeType.SingleAlly,
          createEffect({
            name: 'Dreamdiver',
            description: 'Increases outgoing damage by 60%.',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            duration: 3,
            positive: true,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'The Hero with a Thousand Faces',
      description: 'Regenerates 6 skill points for all allies.',
      range: RangeType.AllAllies,
      battleCost: Ultimate(35, { grantTeamSkillPoints: 6 }),
    }),
  ],
  abilities: [
    (() => {
      let redHerringSurgeSerial = 0;
      return createAbility({
        name: 'Red Herring',
        description:
          'Increases the maximum number of skill points by 2. For every skill point an ally consumes, increase their damage by 5% for 5 turns.',
        panelColor: QUANTUM_ABILITY_PANEL_COLOR,
        effects: [
          createAbilityEffect({
            range: RangeType.Self,
            effect: createEffect({
              name: 'Red Herring',
              description: '+2 to maximum team skill points.',
              type: EffectType.SkillPointsMaxBonus,
              amount: 2,
              duration: 9999,
              positive: true,
            }),
          }),
        ],
        onBattleEvent(event, owner) {
          if (event.type !== 'skill_points_consumed') return;
          if (event.side !== owner.side) return;
          if (owner.isKnockedOut) return;
          for (let i = 0; i < event.pointsConsumed; i += 1) {
            redHerringSurgeSerial += 1;
            event.consumer.addEffect(
              new Effect(
                `Red Herring •${redHerringSurgeSerial}`,
                'Outgoing damage +5% from Red Herring.',
                EffectType.OutgoingDamage,
                1.05,
                5,
                true,
              ),
            );
          }
        },
      });
    })(),
  ],
});
