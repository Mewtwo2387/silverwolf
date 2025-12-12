import Canvas from 'canvas';

/**
 * A part of a card that can be drawn and does not depend on other part's positions.
 * Used for things in fixed positions, such as the background.
*/
export interface DrawableFixed {
  /**
   * Draw that part on a card
   * @param ctx - The canvas context
   */
  draw(ctx: Canvas.CanvasRenderingContext2D): Promise<void>;
}

/**
 * A part of a card that can be drawn and depends on other part's positions.
 * Used for things drawn below other parts, such as the skill and ability descriptions.
 */
export interface DrawableBlock {
  /**
   * Draw that part on a card
   * @param ctx - The canvas context
   * @param y - The y position to start drawing at
   * @returns The new y position after drawing
   */
  draw(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number>;
}