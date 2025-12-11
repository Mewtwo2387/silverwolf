import Canvas from 'canvas';
export interface Card {
  name: string;
  generateCard: () => Promise<Canvas.Canvas>;
}