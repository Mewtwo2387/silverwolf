/* eslint-disable */
const Canvas = require('canvas');
const fs = require('fs');
const { Background, BackgroundType, TopBarType } = require('./background');
const Rarity = require('./rarity');
const Attack = require('./attack');
const Ability = require('./ability');

class Card {
  constructor(name, description, rarity, hp, type, image, background, attacks, abilities){
    this.name = name;
    this.description = description;
    this.rarity = rarity;
    this.hp = hp;
    this.type = type;
    this.image = image;
    this.background = background;
    this.attacks = attacks;
    this.abilities = abilities;
  }

  async generateCard() {
    const canvas = Canvas.createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // Set background
    await this.background.generateBackground(ctx);

    try {
      const typeImage = await Canvas.loadImage(`./assets/types/${this.type.toLowerCase()}.png`);
      ctx.drawImage(typeImage, 0, 0, 128, 128);
    } catch (error) {
      console.warn(`Type image not found for: ${this.type}`);
    }

    // Draw HP on the rightmost side
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(`HP:`, 1048, 32);

    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.hp}`, 1048, 96);

    await this.rarity.generateRarity(ctx);

    ctx.font = '96px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 144, 96);

    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(this.description, 256, 192);
    

    // Draw image and background
    ctx.fillStyle = '#000000';
    ctx.fillRect(64, 256, 956, 512);

    const image = await Canvas.loadImage(this.image);
    ctx.drawImage(image, 64, 256, 956, 512);

    let currentY = 896;

    for (const attack of this.attacks) {
      currentY = await attack.generateAttack(ctx, currentY);
    }

    for (const ability of this.abilities) {
      currentY = await ability.generateAbility(ctx, currentY);
    }

    return canvas;
  }
}



async function testGenerateCard() {
  const card = new Card(
    'Kaitlin',
    'Herrscher of Egg',
    new Rarity(6),
    100,
    'Fairy',
    'https://static.wikia.nocookie.net/bocchi-the-rock/images/9/98/Hitori_Gotoh_Character_Design_2.png/revision/latest?cb=20220915114341',
    new Background(BackgroundType.GRADIENT, { color1: '#D5ABB2', color2: '#B76E79' }, '#68343B', TopBarType.FADE, { color: '#440000', opacity1: 0.6, opacity2: 0.3 }),
    [
      new Attack('Unlimited Doge Works', 'Basic Attack when in Doge Form', 5, 0),
      new Attack('Slay Queen', 'Basic Attack when in Kaitlin Form', 35, 0),
      new Attack('Estrogen', 'Converts to Kaitlin Form', 0, 70),
    ],
    [
      new Ability('Lover of the TGP Queen', 'Deals 40% more damage when Venfei is in the team')
    ]
  );
  const canvas = await card.generateCard();
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('kaitlin.png', buffer);
}

setTimeout(testGenerateCard, 1000);

module.exports = { Card, Attack };