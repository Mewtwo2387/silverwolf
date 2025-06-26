import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight, drawWrappedText } from './utils/textWrapper';

export class TitleDesc {
  title: string;
  description: string;
  color: string;

  constructor(title: string, description: string, color: string) {
    this.title = title;
    this.description = description;
    this.color = color;
  }

  async generateTitleDesc(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number> {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping
    const titleLineHeight = 48;
    const descLineHeight = 32;

    // Wrap text
    ctx.font = '48px "Bahnschrift"';
    const titleLines = wrapText(ctx, this.title, maxTextWidth);

    ctx.font = '32px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const titleHeight = calculateWrappedTextHeight(titleLines, titleLineHeight);
    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);
    const totalTextHeight = titleHeight + descHeight + 16; // 16px spacing between title and description

    // Trapezium dimensions - now dynamic based on text height
    const trapeziumHeight = Math.max(100, totalTextHeight + 40); // Minimum 100px, or text height + padding
    const trapeziumTopWidth = maxTextWidth + 128; // Text width + padding
    const trapeziumBottomWidth = trapeziumTopWidth + 64; // Slightly wider at bottom
    const trapeziumLeft = 32; // Starting position
    const trapeziumTop = currentY - 40; // Position above the text

    // Create gradient for trapezium using this.color
    const gradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft + trapeziumBottomWidth,
      trapeziumTop + trapeziumHeight,
    );

    // Convert hex color to RGB and create translucent versions
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : null;
    };

    const rgb = hexToRgb(this.color);
    if (rgb) {
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`); // Translucent at top
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`); // More translucent in middle
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`); // Most translucent at bottom
    } else {
      // Fallback to original gray colors if color parsing fails
      gradient.addColorStop(0, 'rgba(240, 240, 240, 0.8)');
      gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.5)');
      gradient.addColorStop(1, 'rgba(200, 200, 200, 0.2)');
    }

    // Draw trapezium container with gradient
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(51, 51, 51, 0.7)'; // Semi-transparent dark border
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(trapeziumLeft, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumTopWidth, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumBottomWidth, trapeziumTop + trapeziumHeight);
    ctx.lineTo(trapeziumLeft, trapeziumTop + trapeziumHeight);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw title on top of trapezium
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, titleLines, 64, currentY, titleLineHeight);

    currentY += titleHeight + 16; // Add spacing between title and description

    // Draw description on top of trapezium
    ctx.font = '32px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, descLines, 64, currentY, descLineHeight);

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }
}