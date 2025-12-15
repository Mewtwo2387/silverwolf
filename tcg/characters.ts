import fs from 'fs';

import { Character } from './character';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background, BackgroundType, TopBarType } from './background';
import { Skill } from './skill';
import { Ability, AbilityActivationContext } from './ability';
import { RangeEffect } from './rangeEffect';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { RangeType } from './rangeType';
import { Element } from './element';

/**
 * A list of all characters in the game
 */

export const KAITLIN = new Character(
  'Kaitlin',
  new TitleDesc(
    'Herrscher of Egg',
    'Starts in Doge form. Converts into Kaitlin form after casting skill.',
    '#777777',
  ),
  new Rarity(6),
  100,
  Element.Fairy,
  'https://static.wikia.nocookie.net/bocchi-the-rock/images/9/98/Hitori_Gotoh_Character_Design_2.png/revision/latest?cb=20220915114341',
  new Background(BackgroundType.Gradient, { color: '#FFFFFF', color1: '#D5ABB2', color2: '#B76E79', image: '' }, '#68343B', TopBarType.Fade, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('Unlimited Doge Works', 'Basic Attack when in Doge Form.', 5, 0, RangeType.SingleOpponent),
    new Skill('Slay Queen', 'Basic Attack when in Kaitlin Form.', 35, 0, RangeType.SingleOpponent),
    new Skill('Estrogen', 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.', 0, 30, RangeType.Self, [
      new RangeEffect(RangeType.Self, new Effect('Estrogen', 'Converted into Kaitlin Form.', EffectType.FormChange, 1, 9999)),
    ], [1, 2]), // When transformed, skills 1 (Slay Queen) and 2 (Estrogen) become active
  ],
  [
    new Ability(
      'Coincidence? I Think Not.',
      'Deals 15/40% more damage when there are 1/2 allies with name starting in "V".',
      [
        {
          effect: new RangeEffect(RangeType.Self, new Effect('Coincidence? I Think Not.', 'Increases outgoing damage by 15%.', EffectType.OutgoingDamage, 1.15, 9999)),
          activationCondition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.name.startsWith('V')).length == 1;
          }
        },
        {
          effect: new RangeEffect(RangeType.Self, new Effect('Coincidence? I Think Not.', 'Increases outgoing damage by 40%.', EffectType.OutgoingDamage, 1.4, 9999)),
          activationCondition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.name.startsWith('V')).length == 2;
          }
        }
      ]
    ),
  ],
  [0, 2], // Default form (Doge): skills 0 (Unlimited Doge Works) and 2 (Estrogen) are available
);

export const VENFEI = new Character(
  'Venfei',
  new TitleDesc(
    'The TGP Queen',
    '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
    '#777777',
  ),
  new Rarity(6),
  80,
  Element.Fairy,
  '',
  new Background(BackgroundType.Gradient, { color1: '#D5ABB2', color2: '#B76E79' }, '#68343B', TopBarType.Fade, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('h', 'h', 5, 0, RangeType.SingleOpponent),
    new Skill('aaaaaaa', 'Increases outgoing damage of all allies by 30% for 5 turns.', 0, 20, RangeType.AllAllies, [
      new RangeEffect(RangeType.AllAllies, new Effect('aaaaaaa', 'Increases outgoing damage by 30%', EffectType.OutgoingDamage, 1.3, 5)),
    ]),
  ],
);

export const CHARACTERS = [KAITLIN, VENFEI];

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/kaitlin.png', buffer);
}

// setTimeout(testGenerateCard, 1000);
