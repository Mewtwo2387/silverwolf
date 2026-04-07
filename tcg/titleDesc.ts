import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight } from './utils/textWrapper';
import { DrawableBlock } from './interfaces/drawable';
import { drawWrappedTcgText } from './utils/tcgTextStyle';
import { CharacterTextColors, DEFAULT_CHARACTER_TEXT_COLORS } from './textTheme';

/**
 * The title and description of a character.
 * Does not have effects in battle other than being a visual indicator.
 * @param title - The title of the character
 * @param description - The description of the character
 * @param color - The color of the title and description
 */
export class TitleDesc implements DrawableBlock {
  title: string;
  description: string;
  color: string;

  constructor(title: string, description: string, color: string) {
    this.title = title;
    this.description = description;
    this.color = color;
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D, y: number, textColors: CharacterTextColors = DEFAULT_CHARACTER_TEXT_COLORS): Promise<number> {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping
    const titleLineHeight = 48;
    const descLineHeight = 32;
    const topTextPadding = 6;
    const titleToDescSpacing = 10;

    // Wrap text
    ctx.font = '48px "Bahnschrift"';
    const titleLines = wrapText(ctx, this.title, maxTextWidth);

    ctx.font = '32px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const titleHeight = calculateWrappedTextHeight(titleLines, titleLineHeight);
    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);
    const totalTextHeight = topTextPadding + titleHeight + titleToDescSpacing + descHeight;

    // Trapezium dimensions
    const trapeziumHeight = Math.max(104, totalTextHeight + 44);
    const trapeziumTopWidth = maxTextWidth + 120;
    const trapeziumBottomWidth = trapeziumTopWidth + 56;
    const trapeziumLeft = 32;
    const trapeziumTop = currentY - 42;
    const cornerRadius = 22;
    const rightTop = trapeziumLeft + trapeziumTopWidth;
    const rightBottom = trapeziumLeft + trapeziumBottomWidth;

    const drawTrapeziumPath = () => {
      ctx.beginPath();
      ctx.moveTo(trapeziumLeft + cornerRadius, trapeziumTop);
      ctx.lineTo(rightTop - cornerRadius, trapeziumTop);
      ctx.quadraticCurveTo(rightTop, trapeziumTop, rightTop + (cornerRadius * 0.75), trapeziumTop + cornerRadius);
      ctx.lineTo(rightBottom, trapeziumTop + trapeziumHeight - cornerRadius);
      ctx.quadraticCurveTo(rightBottom, trapeziumTop + trapeziumHeight, rightBottom - cornerRadius, trapeziumTop + trapeziumHeight);
      ctx.lineTo(trapeziumLeft + cornerRadius, trapeziumTop + trapeziumHeight);
      ctx.quadraticCurveTo(trapeziumLeft, trapeziumTop + trapeziumHeight, trapeziumLeft, trapeziumTop + trapeziumHeight - cornerRadius);
      ctx.lineTo(trapeziumLeft, trapeziumTop + cornerRadius);
      ctx.quadraticCurveTo(trapeziumLeft, trapeziumTop, trapeziumLeft + cornerRadius, trapeziumTop);
      ctx.closePath();
    };

    // Create gradient for trapezium using this.color
    const gradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft,
      trapeziumTop + trapeziumHeight,
    );

    // Convert hex color to RGB and create translucent versions
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : null;
    };

    const rgb = hexToRgb(this.color);
    if (rgb) {
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`);
      gradient.addColorStop(0.55, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.68)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`);
    } else {
      // Fallback to original gray colors if color parsing fails
      gradient.addColorStop(0, 'rgba(245, 245, 245, 0.9)');
      gradient.addColorStop(0.55, 'rgba(225, 225, 225, 0.65)');
      gradient.addColorStop(1, 'rgba(205, 205, 205, 0.34)');
    }

    // Draw panel drop shadow first so the panel pops from the background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    drawTrapeziumPath();
    ctx.fill();
    ctx.restore();

    // Draw trapezium container with gradient
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(32, 32, 32, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawTrapeziumPath();
    ctx.fill();
    ctx.stroke();

    // Add a soft glossy band near the top for extra depth
    const glossGradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft,
      trapeziumTop + (trapeziumHeight * 0.48),
    );
    glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)');
    glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    drawTrapeziumPath();
    ctx.clip();
    ctx.fillStyle = glossGradient;
    ctx.fillRect(trapeziumLeft, trapeziumTop, trapeziumBottomWidth + 8, trapeziumHeight * 0.52);
    ctx.restore();

    // Thin inner highlight so edges read cleaner against busy backgrounds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = 1.1;
    drawTrapeziumPath();
    ctx.stroke();

    // Draw title on top of trapezium
    drawWrappedTcgText(ctx, titleLines, 64, currentY + topTextPadding, titleLineHeight, {
      font: '700 48px "Bahnschrift"',
      fillStyle: textColors.titleFill,
      strokeStyle: textColors.titleStroke,
      lineWidth: 4,
      textAlign: 'left',
      shadowBlur: 8,
      shadowOffsetY: 2,
    });

    currentY += topTextPadding + titleHeight + titleToDescSpacing;

    // Draw description on top of trapezium
    drawWrappedTcgText(ctx, descLines, 64, currentY, descLineHeight, {
      font: '600 32px "Bahnschrift"',
      fillStyle: textColors.titleDescFill,
      strokeStyle: textColors.titleDescStroke,
      lineWidth: 3,
      textAlign: 'left',
      shadowBlur: 4,
      shadowOffsetY: 1,
    });

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }
}