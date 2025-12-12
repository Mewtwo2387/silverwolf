import Canvas from 'canvas';
import { DrawableFixed } from './interfaces/drawable';

export class Rarity implements DrawableFixed {
  rarity: number;

  constructor(rarity: number) {
    if (rarity < 1 || rarity > 6) {
      throw new Error('Rarity must be between 1 and 6');
    }
    this.rarity = rarity;
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D): Promise<void> {
    const starSize = 64;
    const starSpacing = 16;
    const star = await Canvas.loadImage('./tcg/assets/common/star.png');
    let x = 1080 - 128 - starSize - starSpacing;
    const y = 32;
    for (let i = 0; i < this.rarity; i += 1) {
      ctx.drawImage(star, x, y, starSize, starSize);
      x -= starSize + starSpacing;
    }
  }
}
