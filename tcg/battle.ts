import { CharacterInBattle } from './characterInBattle';
import { Character } from './character';

export enum BattleStatus {
  Ongoing = 'ongoing',
  P1Won = 'p1_won',
  P2Won = 'p2_won',
  Draw = 'draw',
}

export class Battle {
  p1cards: CharacterInBattle[];
  p2cards: CharacterInBattle[];
  currentTurn: number;
  currentPlayer: 'p1' | 'p2';
  status: BattleStatus;
  turnHistory: string[]; // Log of actions for debugging

  constructor(p1cards: Character[], p2cards: Character[]) {
    // Convert Characters to CharacterInBattle
    this.p1cards = p1cards.map(char => new CharacterInBattle(char, this, 'p1'));
    this.p2cards = p2cards.map(char => new CharacterInBattle(char, this, 'p2'));
    
    this.currentTurn = 1;
    this.currentPlayer = 'p1';
    this.status = BattleStatus.Ongoing;
    this.turnHistory = [];

    // Activate abilities at battle start
    this.activateAllAbilities();
    
    // Give starting energy
    this.allCards().forEach(char => {
      char.gainEnergy(3); // Start with 3 energy
    });
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

  /**
   * Activate all passive abilities at battle start
   * Each effect in each ability is checked individually with its own activation condition
   */
  activateAllAbilities() {
    this.allCards().forEach(character => {
      character.character.abilities.forEach(ability => {
        const context = {
          character,
          getAllies: () => this.ally(character.side),
          getAllCards: () => this.allCards(),
        };
        
        // applyEffects checks each effect's activation condition individually
        ability.applyEffects(context);
      });
    });
  }

  /**
   * Get all alive characters for a side
   */
  getAliveAlly(side: string): CharacterInBattle[] {
    return this.ally(side).filter(char => !char.isKnockedOut);
  }

  /**
   * Get all alive opponents for a side
   */
  getAliveOpponent(side: string): CharacterInBattle[] {
    return this.opponent(side).filter(char => !char.isKnockedOut);
  }

  /**
   * Check if a side has any alive characters
   */
  hasAliveCharacters(side: string): boolean {
    return this.getAliveAlly(side).length > 0;
  }

  /**
   * Check victory conditions and update battle status
   */
  checkVictory(): BattleStatus {
    const p1Alive = this.hasAliveCharacters('p1');
    const p2Alive = this.hasAliveCharacters('p2');

    if (!p1Alive && !p2Alive) {
      return BattleStatus.Draw;
    } else if (!p1Alive) {
      return BattleStatus.P2Won;
    } else if (!p2Alive) {
      return BattleStatus.P1Won;
    }
    return BattleStatus.Ongoing;
  }

  /**
   * Use a skill from a character
   * @param character The character using the skill
   * @param skillIndex Index of the skill to use
   * @param target Target character (can be null for self-targeting skills)
   * @returns true if successful, false otherwise
   */
  useSkill(character: CharacterInBattle, skillIndex: number, target: CharacterInBattle | null): boolean {
    if (this.status !== BattleStatus.Ongoing) {
      return false;
    }

    if (character.isKnockedOut) {
      return false;
    }

    // Verify character belongs to current player
    if (character.side !== this.currentPlayer) {
      return false;
    }

    const success = character.useSkill(skillIndex, target);
    
    if (success) {
      this.turnHistory.push(`${character.character.name} used skill ${skillIndex}`);
      // Check for victory after each action
      this.status = this.checkVictory();
    }

    return success;
  }

  /**
   * End the current turn and start the next turn
   */
  endTurn() {
    if (this.status !== BattleStatus.Ongoing) {
      return;
    }

    const currentSide = this.currentPlayer;

    // Process end of turn for all characters
    this.allCards().forEach(character => {
      if (!character.isKnockedOut) {
        character.processEndOfTurn();
      }
    });

    // Switch to next player
    if (this.currentPlayer === 'p1') {
      this.currentPlayer = 'p2';
    } else {
      this.currentPlayer = 'p1';
      this.currentTurn += 1;
    }

    // Start of turn effects - gain energy from 2d6 roll
    const energyGains: { name: string; amount: number }[] = [];
    this.getAliveAlly(this.currentPlayer).forEach(character => {
      const energyGained = character.nextTurn(); // This also gains energy from 2d6 roll
      energyGains.push({ name: character.character.name, amount: energyGained });
    });
    
    // Log energy gains for this turn
    if (energyGains.length > 0) {
      const gainMessages = energyGains.map(g => `${g.name}: +${g.amount}`).join(', ');
      this.turnHistory.push(`Energy gained (2d6): ${gainMessages}`);
    }

    // Check for victory
    this.status = this.checkVictory();
    
    this.turnHistory.push(`Turn ${this.currentTurn} - ${this.currentPlayer}'s turn`);
  }

  /**
   * Get battle state for display/debugging
   */
  getBattleState() {
    return {
      turn: this.currentTurn,
      currentPlayer: this.currentPlayer,
      status: this.status,
      p1: {
        alive: this.getAliveAlly('p1').map(char => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map(e => e.toString()),
        })),
      },
      p2: {
        alive: this.getAliveAlly('p2').map(char => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map(e => e.toString()),
        })),
      },
    };
  }

  /**
   * Get a string representation of the battle status
   */
  toString(): string {
    const lines: string[] = [];
    lines.push(`Turn: ${this.currentTurn}, Current Player: ${this.currentPlayer}, Status: ${this.status}`);
    lines.push('\nP1:');
    this.getAliveAlly('p1').forEach(char => {
      lines.push(`  ${char.toString()}`);
    });
    lines.push('\nP2:');
    this.getAliveAlly('p2').forEach(char => {
      lines.push(`  ${char.toString()}`);
    });
    return lines.join('\n');
  }
}
