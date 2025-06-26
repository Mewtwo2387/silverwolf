const fs = require('fs');

const { Card } = require('./card');
const { TitleDesc } = require('./titleDesc');
const { Rarity } = require('./rarity');
const { Background, BackgroundType, TopBarType } = require('./background');
const { Skill } = require('./skill');
const { Ability } = require('./ability');
const { SkillEffect, SkillEffectType } = require('./skillEffect');
const { Effect, EffectType } = require('./effect');

const KAITLIN = new Card(
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
  new Background(BackgroundType.GRADIENT, { color1: '#D5ABB2', color2: '#B76E79' }, '#68343B', TopBarType.FADE, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('Unlimited Doge Works', 'Basic Attack when in Doge Form.', 5, 0),
    new Skill('Slay Queen', 'Basic Attack when in Kaitlin Form.', 35, 0),
    new Skill('Estrogen', 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.', 0, 70, [
      new SkillEffect(SkillEffectType.SELF, new Effect('Estrogen', 'Converted into Kaitlin Form.', EffectType.FORM_CHANGE, 1, 999)),
    ]),
  ],
  [
    new Ability('Lover of the TGP Queen', 'Deals 40% more damage when Venfei is in the team.', [
      new SkillEffect(SkillEffectType.SELF, new Effect('Lover of the TGP Queen', 'Deals 40% more damage when Venfei is in the team.', EffectType.OUTGOING_DAMAGE, 1.4, 999)),
    ]),
  ],
);

const VENFEI = new Card(
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
  new Background(BackgroundType.GRADIENT, { color1: '#D5ABB2', color2: '#B76E79' }, '#68343B', TopBarType.FADE, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
  [
    new Skill('h', 'h', 5, 0),
    new Skill('aaaaaaa', 'Increases outgoing damage of all allies by 30%', 0, 50, [
      new SkillEffect(SkillEffectType.ALL_ALLIES, new Effect('aaaaaaa', 'Increases outgoing damage of all allies by 30%', EffectType.OUTGOING_DAMAGE, 1.3, 50)),
    ]),
  ],
);

const CARDS = [KAITLIN, VENFEI];

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('card/kaitlin.png', buffer);
}

setTimeout(testGenerateCard, 1000);

module.exports = { CARDS };
