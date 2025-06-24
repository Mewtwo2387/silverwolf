const Canvas = require('canvas');

class Rarity {
  constructor(rarity) {
    if (rarity < 1 || rarity > 6) {
      throw new Error('Rarity must be between 1 and 6');
    }
    this.rarity = rarity;
  }

  async generateRarity(ctx) {
    const starSize = 64;
    const starSpacing = 16;
    const star = await Canvas.loadImage('./assets/common/star.png');
    let x = 1080 - 128 - starSize - starSpacing;
    const y = 32;
    for (let i = 0; i < this.rarity; i += 1) {
      ctx.drawImage(star, x, y, starSize, starSize);
      x -= starSize + starSpacing;
    }
  }
}

module.exports = Rarity;
