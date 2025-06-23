const Canvas = require('canvas');

const BackgroundType = {
  SOLID: 0,
  GRADIENT: 1,
  IMAGE: 2,
};

const TopBarType = {
  SOLID: 0,
  TRANSLUCENT: 1,
  FADE: 2,
};

/**
 * Background class
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
class Background {
  constructor(backgroundType, backgroundOptions, borderColor, topBarType, topBarOptions) {
    this.backgroundType = backgroundType;
    this.backgroundOptions = backgroundOptions;
    this.borderColor = borderColor;
    this.topBarType = topBarType;
    this.topBarOptions = topBarOptions;
  }

  async generateBackground(ctx) {
    // Draw background
    switch (this.backgroundType) {
      case BackgroundType.SOLID:
        ctx.fillStyle = this.backgroundOptions.color;
        ctx.fillRect(0, 0, 1080, 1920);
        break;
      case BackgroundType.GRADIENT: {
        const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
        gradient.addColorStop(0, this.backgroundOptions.color1);
        gradient.addColorStop(1, this.backgroundOptions.color2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);
        break;
      }
      case BackgroundType.IMAGE: {
        const image = await Canvas.loadImage(this.backgroundOptions.image);
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
      case TopBarType.SOLID:
        ctx.fillStyle = this.topBarOptions.color;
        ctx.fillRect(0, 0, 1080, 128);
        break;
      case TopBarType.TRANSLUCENT:
        ctx.fillStyle = this.topBarOptions.color;
        ctx.globalAlpha = this.topBarOptions.opacity;
        ctx.fillRect(0, 0, 1080, 128);
        break;
      case TopBarType.FADE: {
        // Create a gradient from top to bottom with opacity1 to opacity2
        const fadeGradient = ctx.createLinearGradient(0, 0, 0, 128);
        fadeGradient.addColorStop(0, this.topBarOptions.color);
        fadeGradient.addColorStop(1, this.topBarOptions.color);
        ctx.fillStyle = fadeGradient;

        // Apply gradient opacity by drawing multiple rectangles with decreasing alpha
        const steps = 20; // Number of gradient steps
        const stepHeight = 128 / steps;
        const opacityStep = (this.topBarOptions.opacity1 - this.topBarOptions.opacity2) / steps;

        for (let i = 0; i < steps; i += 1) {
          const currentOpacity = this.topBarOptions.opacity1 - (opacityStep * i);
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

module.exports = { Background, BackgroundType, TopBarType };
