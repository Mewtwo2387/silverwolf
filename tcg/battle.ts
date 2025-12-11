import { CharacterInBattle } from './characterInBattle';

export class Battle {
  p1cards: CharacterInBattle[];
  p2cards: CharacterInBattle[];

  constructor(p1cards: CharacterInBattle[], p2cards: CharacterInBattle[]) {
    this.p1cards = p1cards;
    this.p2cards = p2cards;
  }

  ally(side: string): CharacterInBattle[] {
    return side === 'p1' ? this.p1cards : this.p2cards;
  }

  opponent(side: string): CharacterInBattle[] {
    return side === 'p1' ? this.p2cards : this.p1cards;
  }

  allCards(): CharacterInBattle[] {
    return [...this.p1cards, ...this.p2cards];
  }
}
