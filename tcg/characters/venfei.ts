import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import {
  createCharacter,
  createSkill,
  createEffect,
  createRangeEffect,
  createSimpleBackground,
  Normal,
  Charged,
  Ultimate,
} from '../characterBuilder';
import { ImagePanelMode } from '../imagePanel';
import { characterImagePath } from '../assetPaths';
import { TAGS } from '../characterTags';
import { FAIRY_TEXT_COLORS } from './shared';

export const VENFEI = createCharacter({
  name: 'Venfei',
  title: 'The TGP Queen',
  description: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
  rarity: 6,
  hp: 80,
  element: Element.Fairy,
  tags: [TAGS.VENFEI, TAGS.TGP],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#FFFFFF',
    imagePath: characterImagePath('venfei'),
  },
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  textColors: FAIRY_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'h',
      description: 'h',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'aaaaaaa',
      description: 'Increases outgoing damage of one ally by 60% for 3 turns.',
      range: RangeType.SingleAlly,
      battleCost: Charged(1),
      effects: [
        createRangeEffect(
          RangeType.SingleAlly,
          createEffect({
            name: 'aaaaaaa',
            description: 'Increases outgoing damage by 60%',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            duration: 3,
            positive: true,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'aaaaaaaaaaaaaa',
      description: 'Increases outgoing damage of all allies by 35% for 5 turns.',
      range: RangeType.AllAllies,
      battleCost: Ultimate(20),
      effects: [
        createRangeEffect(
          RangeType.AllAllies,
          createEffect({
            name: 'aaaaaaaaaaaaaa',
            description: 'Increases outgoing damage by 35%',
            type: EffectType.OutgoingDamage,
            amount: 1.35,
            duration: 5,
            positive: true,
          }),
        ),
      ],
    }),
  ],
});
