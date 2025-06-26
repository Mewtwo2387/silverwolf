import { CardInBattle } from './cardInBattle.ts';

export class Battle {
  p1cards: CardInBattle[];
  p2cards: CardInBattle[];

  constructor(p1cards: CardInBattle[], p2cards: CardInBattle[]) {
    this.p1cards = p1cards;
    this.p2cards = p2cards;
  }

  ally(side: string): CardInBattle[] {
    return side === 'p1' ? this.p1cards : this.p2cards;
  }

  opponent(side: string): CardInBattle[] {
    return side === 'p1' ? this.p2cards : this.p1cards;
  }

  allCards(): CardInBattle[] {
    return [...this.p1cards, ...this.p2cards];
  }
}
