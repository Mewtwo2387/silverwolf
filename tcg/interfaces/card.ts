import Canvas from 'canvas';

/**
 * A card, which can be a character or an item
 */
export interface Card {
  name: string;
  generateCard: () => Promise<Canvas.Canvas>;
}