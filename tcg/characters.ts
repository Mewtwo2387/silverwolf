import fs from 'fs';

import { Character } from './character';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background, BackgroundType, TopBarType } from './background';
import { Skill } from './skill';
import { Ability } from './ability';
import { RangeEffect } from './rangeEffect';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { RangeType } from './rangeType';

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
  'Fairy',
  'https://static.wikia.nocookie.net/bocchi-the-rock/images/9/98/Hitori_Gotoh_Character_Design_2.png/revision/latest?cb=20220915114341',
  new Background(BackgroundType.Gradient, { color: '#FFFFFF', color1: '#D5ABB2', color2: '#B76E79', image: '' }, '#68343B', TopBarType.Fade, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('Unlimited Doge Works', 'Basic Attack when in Doge Form.', 5, 0, RangeType.SingleOpponent),
    new Skill('Slay Queen', 'Basic Attack when in Kaitlin Form.', 35, 0, RangeType.SingleOpponent),
    new Skill('Estrogen', 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.', 0, 70, RangeType.Self, [
      new RangeEffect(RangeType.Self, new Effect('Estrogen', 'Converted into Kaitlin Form.', EffectType.FormChange, 1, 999)),
    ]),
  ],
  [
    new Ability('Lover of the TGP Queen', 'Deals 40% more damage when Venfei is in the team.', [
      new RangeEffect(RangeType.Self, new Effect('Lover of the TGP Queen', 'Deals 40% more damage when Venfei is in the team.', EffectType.OutgoingDamage, 1.4, 999)),
    ]),
  ],
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
  'Fairy',
  '',
  new Background(BackgroundType.Gradient, { color1: '#D5ABB2', color2: '#B76E79' }, '#68343B', TopBarType.Fade, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('h', 'h', 5, 0, RangeType.SingleOpponent),
    new Skill('aaaaaaa', 'Increases outgoing damage of all allies by 30%', 0, 50, RangeType.AllAllies, [
      new RangeEffect(RangeType.AllAllies, new Effect('aaaaaaa', 'Increases outgoing damage of all allies by 30%', EffectType.OutgoingDamage, 1.3, 50)),
    ]),
  ],
);

const CHARACTERS = [KAITLIN, VENFEI];

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('./tcg/kaitlin.png', buffer);
}

setTimeout(testGenerateCard, 1000);

module.exports = { CHARACTERS };
