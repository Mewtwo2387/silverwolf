/* eslint-disable */
const Canvas = require('canvas');

class Card {
  constructor(name, titleDesc, rarity, hp, type, image, background, attacks, abilities){
    this.name = name;
    this.titleDesc = titleDesc;
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
      const typeImage = await Canvas.loadImage(`./card/assets/types/${this.type.toLowerCase()}.png`);
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

    let currentY = await this.titleDesc.generateTitleDesc(ctx, 192);

    // Draw image and background
    ctx.fillStyle = '#000000';
    ctx.fillRect(64, currentY, 956, 512);

    const image = await Canvas.loadImage(this.image);
    ctx.drawImage(image, 64, currentY, 956, 512);

    currentY += 512 + 96;

    for (const attack of this.attacks) {
      currentY = await attack.generateAttack(ctx, currentY);
    }

    for (const ability of this.abilities) {
      currentY = await ability.generateAbility(ctx, currentY);
    }

    return canvas;
  }
}

module.exports = { Card };