import Canvas from 'canvas';
import { DrawableBlock } from './interfaces/drawable';

export enum ImagePanelMode {
  None = 'none', // Do not draw any image, only the panel background
  Stretch = 'stretch', // Stretch the image to fill the panel, not preserving the aspect ratio
  Crop = 'crop', // Crop the image to fill the panel, preserving the aspect ratio
  Background = 'background', // Preserve the aspect ratio and let the side areas show the panel background
}

export interface ImagePanelOptions {
  mode?: ImagePanelMode;
  x?: number;
  width?: number;
  height?: number;
  spacingAfter?: number;
  backgroundColor?: string;
}

/**
 * Draws the character art panel with configurable aspect-ratio behavior.
 */
export class ImagePanel implements DrawableBlock {
  imagePath: string;
  mode: ImagePanelMode;
  x: number;
  width: number;
  height: number;
  spacingAfter: number;
  backgroundColor: string;

  constructor(imagePath: string = '', options: ImagePanelOptions = {}) {
    this.imagePath = imagePath || '';
    this.mode = options.mode || ImagePanelMode.Crop;
    this.x = options.x ?? 64;
    this.width = options.width ?? 956;
    this.height = options.height ?? 512;
    this.spacingAfter = options.spacingAfter ?? 96;
    this.backgroundColor = options.backgroundColor || '#000000';
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number> {
    const top = y;

    // Base panel background used by contain mode and as a safe fallback.
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(this.x, top, this.width, this.height);

    if (this.mode === ImagePanelMode.None || !this.imagePath) {
      return top + this.height + this.spacingAfter;
    }

    try {
      const image = await Canvas.loadImage(this.imagePath);
      const imageRatio = image.width / image.height;
      const panelRatio = this.width / this.height;

      switch (this.mode) {
        case ImagePanelMode.Stretch:
          ctx.drawImage(image, this.x, top, this.width, this.height);
          return top + this.height + this.spacingAfter;
        case ImagePanelMode.Crop: {
          let sx = 0;
          let sy = 0;
          let sWidth = image.width;
          let sHeight = image.height;

          if (imageRatio > panelRatio) {
            // Source is wider than target: crop left/right.
            sWidth = image.height * panelRatio;
            sx = (image.width - sWidth) / 2;
          } else {
            // Source is taller than target: crop top/bottom.
            sHeight = image.width / panelRatio;
            sy = (image.height - sHeight) / 2;
          }

          ctx.drawImage(image, sx, sy, sWidth, sHeight, this.x, top, this.width, this.height);
          return top + this.height + this.spacingAfter;
        }
        case ImagePanelMode.Background:
        default: {
          // Background mode: preserve aspect ratio and let side areas show panel background.
          let drawWidth = this.width;
          let drawHeight = this.height;
          let dx = this.x;
          let dy = top;

          if (imageRatio > panelRatio) {
            drawHeight = this.width / imageRatio;
            dy = top + ((this.height - drawHeight) / 2);
          } else {
            drawWidth = this.height * imageRatio;
            dx = this.x + ((this.width - drawWidth) / 2);
          }

          ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
        }
      }
    } catch (error) {
      console.warn(`Image not found for panel: ${this.imagePath}`);
    }

    return top + this.height + this.spacingAfter;
  }
}
