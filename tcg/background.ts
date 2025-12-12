import Canvas from 'canvas';
import { DrawableFixed } from './interfaces/drawable';

export enum BackgroundType {
  Solid,
  Gradient,
  Image,
}

export enum TopBarType {
  Solid,
  Translucent,
  Fade,
}

/**
 * Background of a card
 * @param {BackgroundType} backgroundType - The type of background to generate: SOLID, GRADIENT, IMAGE
 * @param {Object} backgroundOptions - The options for the background: color, color1, color2, image
 * @param {string} backgroundOptions.color - The color of the background if SOLID
 * @param {string} backgroundOptions.color1 - The first color of the gradient if GRADIENT
 * @param {string} backgroundOptions.color2 - The second color of the gradient if GRADIENT
 * @param {string} backgroundOptions.image - The image of the background if IMAGE
 * @param {string} borderColor - The color of the border, if null, no border is drawn
 * @param {string} topBarType - The type of top bar to generate: SOLID, TRANSLUCENT, FADE
 * @param {string} topBarOptions - The options for the top bar: color, opacity, opacity1, opacity2
 * @param {string} topBarOptions.color - The color of the top bar
 * @param {string} topBarOptions.opacity - The opacity of the top bar if TRANSLUCENT
 * @param {string} topBarOptions.opacity1 - The first opacity of the top bar if FADE
 * @param {string} topBarOptions.opacity2 - The second opacity of the top bar if FADE
 * @returns {void}
 */
export class Background implements DrawableFixed {
  backgroundType: BackgroundType;
  backgroundOptions: {
    color?: string;
    color1?: string;
    color2?: string;
    image?: string;
  };
  borderColor: string;
  topBarType: TopBarType;
  topBarOptions: {
    color?: string;
    opacity?: number;
    opacity1?: number;
    opacity2?: number;
  };

  constructor(backgroundType: BackgroundType, backgroundOptions: { color?: string; color1?: string; color2?: string; image?: string; }, borderColor: string, topBarType: TopBarType, topBarOptions: { color?: string; opacity?: number; opacity1?: number; opacity2?: number; }) {
    this.backgroundType = backgroundType;
    this.backgroundOptions = backgroundOptions;
    this.borderColor = borderColor;
    this.topBarType = topBarType;
    this.topBarOptions = topBarOptions;
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D): Promise<void> {
    // Draw background
    switch (this.backgroundType) {
      case BackgroundType.Solid:
        ctx.fillStyle = this.backgroundOptions.color || '#FFFFFF';
        ctx.fillRect(0, 0, 1080, 1920);
        break;
      case BackgroundType.Gradient: {
        const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
        gradient.addColorStop(0, this.backgroundOptions.color1 || '#FFFFFF');
        gradient.addColorStop(1, this.backgroundOptions.color2 || '#FFFFFF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);
        break;
      }
      case BackgroundType.Image: {
        const image = await Canvas.loadImage(this.backgroundOptions.image || '');
        ctx.drawImage(image, 0, 0, 1080, 1920);
        break;
      }
      default:
        throw new Error('Invalid background type');
    }

    // Draw border
    if (this.borderColor) {
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = 8;
      ctx.strokeRect(32, 32, 1016, 1856);
    }

    // Draw top bar
    switch (this.topBarType) {
      case TopBarType.Solid:
        ctx.fillStyle = this.topBarOptions.color || '#FFFFFF';
        ctx.fillRect(0, 0, 1080, 128);
        break;
      case TopBarType.Translucent:
        ctx.fillStyle = this.topBarOptions.color || '#FFFFFF';
        ctx.globalAlpha = this.topBarOptions.opacity || 1;
        ctx.fillRect(0, 0, 1080, 128);
        break;
      case TopBarType.Fade: {
        // Create a gradient from top to bottom with opacity1 to opacity2
        const fadeGradient = ctx.createLinearGradient(0, 0, 0, 128);
        fadeGradient.addColorStop(0, this.topBarOptions.color || '#FFFFFF');
        fadeGradient.addColorStop(1, this.topBarOptions.color || '#FFFFFF');
        ctx.fillStyle = fadeGradient;

        // Apply gradient opacity by drawing multiple rectangles with decreasing alpha
        const steps = 20; // Number of gradient steps
        const stepHeight = 128 / steps;
        const opacityStep = ((this.topBarOptions.opacity1 || 1) - (this.topBarOptions.opacity2 || 0)) / steps;

        for (let i = 0; i < steps; i += 1) {
          const currentOpacity = (this.topBarOptions.opacity1 || 1) - (opacityStep * i);
          ctx.globalAlpha = currentOpacity;
          ctx.fillRect(0, i * stepHeight, 1080, stepHeight);
        }

        ctx.globalAlpha = 1; // Reset global alpha
        break;
      }
      default:
        throw new Error('Invalid top bar type');
    }
  }
}
