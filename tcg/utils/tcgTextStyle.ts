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
 * Draw text with an outlined TCG-like treatment.
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
 * Draw wrapped text using the same outlined treatment line-by-line.
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
