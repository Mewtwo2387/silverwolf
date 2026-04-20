import { CharacterInBattle } from './characterInBattle';
import { Character } from './character';
import { SkillCategory } from './skillCategory';
import type { Skill } from './skill';

export enum BattleStatus {
  Ongoing = 'ongoing',
  P1Won = 'p1_won',
  P2Won = 'p2_won',
  Draw = 'draw',
}

export const SKILL_POINTS_START = 2;
export const SKILL_POINTS_CAP = 5;
const ENERGY_AFTER_NORMAL = 5;
const ENERGY_AFTER_CHARGED = 15;

/**
 * Turn order: P1 slot 0 → P2 slot 0 → P1 slot 1 → P2 slot 1 → … (wraps each round).
 * `currentTurn` increments after each full round of both sides' slots.
 */
export class Battle {
  p1cards: CharacterInBattle[];
  p2cards: CharacterInBattle[];
  /** Round counter; increases when the rotation completes a full cycle. */
  currentTurn: number;
  /** 0 … (2 * teamSize - 1); even = P1, odd = P2; slot = floor(phaseIndex / 2) % teamSize */
  phaseIndex: number;
  p1SkillPoints: number;
  p2SkillPoints: number;
  /** Whether the current active character has already used their normal or charged action this phase. */
  mainActionUsedThisPhase: boolean;
  slotsPerSide: number;
  status: BattleStatus;
  turnHistory: string[];

  constructor(p1cards: Character[], p2cards: Character[]) {
    this.p1cards = p1cards.map((char) => new CharacterInBattle(char, this, 'p1'));
    this.p2cards = p2cards.map((char) => new CharacterInBattle(char, this, 'p2'));

    this.slotsPerSide = Math.max(this.p1cards.length, this.p2cards.length);
    this.currentTurn = 1;
    this.phaseIndex = 0;
    this.p1SkillPoints = SKILL_POINTS_START;
    this.p2SkillPoints = SKILL_POINTS_START;
    this.mainActionUsedThisPhase = false;
    this.status = BattleStatus.Ongoing;
    this.turnHistory = [];

    this.activateAllAbilities();
    this.turnHistory.push(
      `Round ${this.currentTurn} — ${this.currentPlayer.toUpperCase()}'s active slot ${this.getCurrentActiveSlot()} (${this.getActiveCharacterForCurrentPhase()?.character.name ?? 'none'})`,
    );
  }

  /** Whose “turn” it is: the side that may act (normals / charged / ultimates). */
  get currentPlayer(): 'p1' | 'p2' {
    return this.phaseIndex % 2 === 0 ? 'p1' : 'p2';
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

  skillPointsForSide(side: 'p1' | 'p2'): number {
    return side === 'p1' ? this.p1SkillPoints : this.p2SkillPoints;
  }

  private setSkillPoints(side: 'p1' | 'p2', value: number) {
    const clamped = Math.max(0, Math.min(SKILL_POINTS_CAP, value));
    if (side === 'p1') this.p1SkillPoints = clamped;
    else this.p2SkillPoints = clamped;
  }

  private changeSkillPoints(side: 'p1' | 'p2', delta: number) {
    this.setSkillPoints(side, this.skillPointsForSide(side) + delta);
  }

  /**
   * Index along the front row (0..slots-1) for the side that is acting this phase.
   */
  getCurrentActiveSlot(): number {
    return Math.floor(this.phaseIndex / 2) % this.slotsPerSide;
  }

  /**
   * The character who must act if using a normal or charged attack; may be knocked out.
   */
  getActiveCharacterForCurrentPhase(): CharacterInBattle | null {
    const side = this.currentPlayer;
    const allies = this.ally(side);
    const slot = this.getCurrentActiveSlot();
    return allies[slot] ?? null;
  }

  activateAllAbilities() {
    this.allCards().forEach((character) => {
      character.character.abilities.forEach((ability) => {
        const context = {
          character,
          getAllies: () => this.ally(character.side),
          getAllCards: () => this.allCards(),
        };

        ability.applyEffects(context);
      });
    });
  }

  getAliveAlly(side: string): CharacterInBattle[] {
    return this.ally(side).filter((char) => !char.isKnockedOut);
  }

  getAliveOpponent(side: string): CharacterInBattle[] {
    return this.opponent(side).filter((char) => !char.isKnockedOut);
  }

  hasAliveCharacters(side: string): boolean {
    return this.getAliveAlly(side).length > 0;
  }

  checkVictory(): BattleStatus {
    const p1Alive = this.hasAliveCharacters('p1');
    const p2Alive = this.hasAliveCharacters('p2');

    if (!p1Alive && !p2Alive) {
      return BattleStatus.Draw;
    }
    if (!p1Alive) {
      return BattleStatus.P2Won;
    }
    if (!p2Alive) {
      return BattleStatus.P1Won;
    }
    return BattleStatus.Ongoing;
  }

  private assertAlive(actor: CharacterInBattle): boolean {
    return !actor.isKnockedOut;
  }

  private skillAllowedInForm(actor: CharacterInBattle, skill: Skill): boolean {
    return actor.getActiveSkills().includes(skill);
  }

  /**
   * Normal or charged attack from the currently active character only.
   */
  useMainAction(character: CharacterInBattle, skillIndex: number, target: CharacterInBattle | null): boolean {
    if (this.status !== BattleStatus.Ongoing) {
      return false;
    }
    if (!this.assertAlive(character)) {
      return false;
    }
    if (character.side !== this.currentPlayer) {
      return false;
    }

    const activeExpected = this.getActiveCharacterForCurrentPhase();
    if (!activeExpected || activeExpected !== character) {
      return false;
    }
    if (this.mainActionUsedThisPhase) {
      return false;
    }

    const skill = character.getSkillByOriginalIndex(skillIndex);
    if (!skill) {
      return false;
    }
    if (skill.category !== SkillCategory.Normal && skill.category !== SkillCategory.Charged) {
      return false;
    }
    if (!this.skillAllowedInForm(character, skill)) {
      return false;
    }

    const side = character.side as 'p1' | 'p2';
    const spCost = skill.skillPointsCost;
    if (skill.category === SkillCategory.Charged && this.skillPointsForSide(side) < spCost) {
      return false;
    }

    skill.useSkill(character, target);
    character.onSkillCompleted(skill, target);

    if (skill.category === SkillCategory.Normal) {
      this.changeSkillPoints(side, skill.skillPointsGranted);
      character.gainEnergy(ENERGY_AFTER_NORMAL);
    } else {
      this.changeSkillPoints(side, -spCost);
      character.gainEnergy(ENERGY_AFTER_CHARGED);
    }

    this.mainActionUsedThisPhase = true;
    this.turnHistory.push(`${character.character.name} used ${skill.category} skill [${skillIndex}] ${skill.name}`);
    this.status = this.checkVictory();
    return true;
  }

  /**
   * Ultimate: any alive ally on your side, any number of times per phase; costs energy.
   */
  useUltimate(character: CharacterInBattle, skillIndex: number, target: CharacterInBattle | null): boolean {
    if (this.status !== BattleStatus.Ongoing) {
      return false;
    }
    if (!this.assertAlive(character)) {
      return false;
    }
    if (character.side !== this.currentPlayer) {
      return false;
    }

    const skill = character.getSkillByOriginalIndex(skillIndex);
    if (!skill || skill.category !== SkillCategory.Ultimate) {
      return false;
    }
    if (!this.skillAllowedInForm(character, skill)) {
      return false;
    }
    const energy = skill.ultimateEnergyCost;
    if (character.energy < energy) {
      return false;
    }

    character.spendEnergy(energy);
    skill.useSkill(character, target);
    character.onSkillCompleted(skill, target);

    this.turnHistory.push(`${character.character.name} used ultimate [${skillIndex}] ${skill.name}`);
    this.status = this.checkVictory();
    return true;
  }

  /**
   * Pass to the next slot in the rotation. Durations tick once per full round (after both players’ slots).
   */
  endTurn() {
    if (this.status !== BattleStatus.Ongoing) {
      return;
    }

    const phasesPerRound = this.slotsPerSide * 2;
    const previousPhase = this.phaseIndex;
    this.phaseIndex = (this.phaseIndex + 1) % phasesPerRound;
    this.mainActionUsedThisPhase = false;

    if (this.phaseIndex < previousPhase) {
      this.allCards().forEach((c) => {
        if (!c.isKnockedOut) {
          c.processEndOfTurn();
        }
      });
      this.currentTurn += 1;
    }

    this.turnHistory.push(
      `Round ${this.currentTurn} — ${this.currentPlayer.toUpperCase()}'s active slot ${this.getCurrentActiveSlot()} (${this.getActiveCharacterForCurrentPhase()?.character.name ?? 'none'})`,
    );
    this.status = this.checkVictory();
  }

  getBattleState() {
    return {
      turn: this.currentTurn,
      phaseIndex: this.phaseIndex,
      currentPlayer: this.currentPlayer,
      activeSlot: this.getCurrentActiveSlot(),
      p1SkillPoints: this.p1SkillPoints,
      p2SkillPoints: this.p2SkillPoints,
      status: this.status,
      p1: {
        alive: this.getAliveAlly('p1').map((char) => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map((e) => e.toString()),
        })),
      },
      p2: {
        alive: this.getAliveAlly('p2').map((char) => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map((e) => e.toString()),
        })),
      },
    };
  }

  toString(): string {
    const lines: string[] = [];
    lines.push(
      `Round: ${this.currentTurn}, Acting: ${this.currentPlayer.toUpperCase()}, Active slot: ${this.getCurrentActiveSlot()} (${this.getActiveCharacterForCurrentPhase()?.character.name ?? '—'})`,
    );
    lines.push(`Team skill points — P1: ${this.p1SkillPoints}/${SKILL_POINTS_CAP}  P2: ${this.p2SkillPoints}/${SKILL_POINTS_CAP}`);
    if (this.mainActionUsedThisPhase) {
      lines.push(`This phase: main action already used by active character`);
    }
    lines.push(`Status: ${this.status}`);

    lines.push('\nP1:');
    this.getAliveAlly('p1').forEach((char) => {
      lines.push(`  ${char.toString()}`);
    });

    lines.push('\nP2:');
    this.getAliveAlly('p2').forEach((char) => {
      lines.push(`  ${char.toString()}`);
    });
    return lines.join('\n');
  }
}
