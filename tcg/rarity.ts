import Canvas from 'canvas';
import { DrawableFixed } from './interfaces/drawable';

/**
 * The rarity of a card. Literally just an integer.
 * Does not have effects in battle other than being a visual indicator.
 * @param rarity - The rarity of the card (1-6 stars)
 */
export class Rarity implements DrawableFixed {
  rarity: number;

  constructor(rarity: number) {
    if (rarity < 1 || rarity > 6) {
      throw new Error('Rarity must be between 1 and 6');
    }
    this.rarity = rarity;
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D): Promise<void> {
    const topBarHeight = 128;
    const starSize = 42;
    const starSpacing = 6;
    const star = await Canvas.loadImage('./tcg/assets/common/star.png');
    let x = 1080 - 128 - starSize - starSpacing;
    const y = (topBarHeight - starSize) / 2;

    // Add a soft golden glow around stars for a more premium TCG look.
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 120, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    for (let i = 0; i < this.rarity; i += 1) {
      ctx.drawImage(star, x, y, starSize, starSize);
      x -= starSize + starSpacing;
    }

    ctx.restore();
  }
}
