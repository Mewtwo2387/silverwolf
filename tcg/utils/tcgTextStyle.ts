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
/** Shorten text with an ellipsis so it fits within `maxWidth` at the current `ctx.font`. */
export function truncateTextToWidth(
  ctx: Canvas.CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  ellipsis = '…',
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(`${truncated}${ellipsis}`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? `${truncated}${ellipsis}` : ellipsis;
}

interface FittedTcgTextOptions extends TcgTextOptions {
  maxFontSize?: number;
  minFontSize?: number;
  fontWeight?: string;
}

/**
 * Draw a single-line title: shrink font down to fit, then ellipsis-truncate at the minimum size.
 */
export function drawFittedTcgText(
  ctx: Canvas.CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: FittedTcgTextOptions,
): void {
  const maxFontSize = options.maxFontSize ?? 84;
  const minFontSize = options.minFontSize ?? 48;
  const fontWeight = options.fontWeight ?? '700';
  const family = '"Bahnschrift"';

  let fontSize = maxFontSize;
  while (fontSize >= minFontSize) {
    const font = `${fontWeight} ${fontSize}px ${family}`;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) {
      drawTcgText(ctx, text, x, y, { ...options, font });
      return;
    }
    fontSize -= 4;
  }

  const font = `${fontWeight} ${minFontSize}px ${family}`;
  ctx.font = font;
  const displayText = truncateTextToWidth(ctx, text, maxWidth);
  drawTcgText(ctx, displayText, x, y, { ...options, font });
}

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
