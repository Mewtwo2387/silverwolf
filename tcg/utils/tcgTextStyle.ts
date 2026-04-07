import Canvas from 'canvas';

interface TcgTextOptions {
  font: string;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  textAlign?: Canvas.CanvasTextAlign;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

/**
 * Render text using an outlined "TCG" (trading-card) style.
 *
 * Applies font, alignment, stroke, fill, line join and optional shadow settings from `options`,
 * draws the text stroke first then the fill, and preserves the canvas context state.
 *
 * @param ctx - Canvas 2D rendering context to draw into
 * @param text - Text to render
 * @param x - X coordinate for the text baseline
 * @param y - Y coordinate for the text baseline
 * @param options - Styling options (font required; other fields control fill, stroke, line width, alignment, and shadow)
 */
export function drawTcgText(
  ctx: Canvas.CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TcgTextOptions,
): void {
  ctx.save();

  ctx.font = options.font;
  ctx.textAlign = options.textAlign || 'left';
  ctx.fillStyle = options.fillStyle || '#F5E9D3';
  ctx.strokeStyle = options.strokeStyle || '#1A1A1A';
  ctx.lineWidth = options.lineWidth || 4;
  ctx.lineJoin = 'round';
  ctx.shadowColor = options.shadowColor || 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = options.shadowBlur ?? 6;
  ctx.shadowOffsetX = options.shadowOffsetX ?? 0;
  ctx.shadowOffsetY = options.shadowOffsetY ?? 2;

  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * Render multiple lines of outlined TCG-style text stacked vertically.
 *
 * @param ctx - Canvas 2D rendering context to draw into
 * @param lines - Array of text lines to render in order
 * @param x - X coordinate for the left/aligned position of each line
 * @param y - Y coordinate for the baseline of the first line
 * @param lineHeight - Vertical distance between baselines of consecutive lines
 * @param options - Styling and font options for the outlined text
 */
export function drawWrappedTcgText(
  ctx: Canvas.CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  options: TcgTextOptions,
): void {
  lines.forEach((line, index) => {
    drawTcgText(ctx, line, x, y + (index * lineHeight), options);
  });
}
