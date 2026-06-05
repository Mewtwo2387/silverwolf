import Canvas from 'canvas';
import { DrawableFixed } from './interfaces/drawable';
import { tcgAssetPaths } from './assetPaths';

const CARD_WIDTH = 1080;
const TOP_BAR_HEIGHT = 128;
const STAR_SIZE = 42;
const STAR_SPACING = 6;

/** Character cards reserve the right edge for HP; item cards can place stars closer in. */
export type RarityDrawLayout = 'character' | 'item';

const RARITY_RIGHT_MARGIN: Record<RarityDrawLayout, number> = {
  character: 128,
  item: 32,
};

/** Left edge (x) of the leftmost star in the top bar, for reserving title space. */
export function rarityStarsBlockLeftEdge(layout: RarityDrawLayout, starCount: number): number {
  const rightMargin = RARITY_RIGHT_MARGIN[layout];
  const rightmostStarX = CARD_WIDTH - rightMargin - STAR_SIZE - STAR_SPACING;
  if (starCount <= 1) return rightmostStarX;
  return rightmostStarX - (starCount - 1) * (STAR_SIZE + STAR_SPACING);
}

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

  async draw(ctx: Canvas.CanvasRenderingContext2D, layout: RarityDrawLayout = 'character'): Promise<void> {
    const star = await Canvas.loadImage(`${tcgAssetPaths.common}/star.png`);
    const rightMargin = RARITY_RIGHT_MARGIN[layout];
    let x = CARD_WIDTH - rightMargin - STAR_SIZE - STAR_SPACING;
    const y = (TOP_BAR_HEIGHT - STAR_SIZE) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 120, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    for (let i = 0; i < this.rarity; i += 1) {
      ctx.drawImage(star, x, y, STAR_SIZE, STAR_SIZE);
      x -= STAR_SIZE + STAR_SPACING;
    }

    ctx.restore();
  }
}
