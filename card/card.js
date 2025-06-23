/* eslint-disable */
const Canvas = require('canvas');
const fs = require('fs');
const { Background, BackgroundType, TopBarType } = require('./background');
const Rarity = require('./rarity');
const Attack = require('./attack');

class Card {
  constructor(name, description, rarity, hp, type, image, background, attacks){
    this.name = name;
    this.description = description;
    this.rarity = rarity;
    this.hp = hp;
    this.type = type;
    this.image = image;
    this.background = background;
    this.attacks = attacks;
  }

  async generateCard() {
    const canvas = Canvas.createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // Set background
    await this.background.generateBackground(ctx);

    await this.rarity.generateRarity(ctx);

    ctx.font = '96px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 128, 96);

    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(`HP:`, 32, 32);

    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.hp}`, 64, 96);

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
  );
  const canvas = await card.generateCard();
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('kaitlin.png', buffer);
}

setTimeout(testGenerateCard, 1000);

module.exports = { Card, Attack };