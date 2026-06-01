import { CharacterInBattle } from './characterInBattle';
import { Character } from './character';
import { SkillCategory } from './skillCategory';
import type { Skill } from './skill';
import type { BattleEvent } from './battleEvents';
import { EffectType } from './effectType';
import { Item } from './item';
import { log } from '../utils/log';

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

export const DECK_SIZE = 25;
export const STARTING_HAND = 5;
export const DRAW_PER_ROUND = 2;

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
  /** Event lines produced during the most recent useMainAction / useUltimate call. */
  currentActionLog: string[];
  /** Per-side item deck; cards are drawn from index 0 (top). */
  p1Deck: Item[];
  p2Deck: Item[];
  /**
   * Per-side hand: stable slot id → item. Ids are never reused: using slot 2 leaves
   * gaps so remaining cards stay 0,1,3,4, and the next draw gets the next id (e.g. 5).
   */
  p1Hand: Map<number, Item>;
  p2Hand: Map<number, Item>;
  /** Next hand slot id to assign when drawing from the deck (monotonic per side). */
  p1HandNextSlot: number;
  p2HandNextSlot: number;

  constructor(p1cards: Character[], p2cards: Character[], options?: { p1Deck?: Item[]; p2Deck?: Item[] }) {
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
    this.currentActionLog = [];

    this.p1Deck = Battle.shuffle(options?.p1Deck ?? []).slice(0, DECK_SIZE);
    this.p2Deck = Battle.shuffle(options?.p2Deck ?? []).slice(0, DECK_SIZE);
    this.p1Hand = new Map();
    this.p2Hand = new Map();
    this.p1HandNextSlot = 0;
    this.p2HandNextSlot = 0;
    this.drawCards('p1', STARTING_HAND);
    this.drawCards('p2', STARTING_HAND);

    this.activateAllAbilities();
    this.turnHistory.push(
      `Round ${this.currentTurn} — ${this.currentPlayer.toUpperCase()}'s active slot ${this.getCurrentActiveSlot()} (${this.getActiveCharacterForCurrentPhase()?.character.name ?? 'none'})`,
    );
  }

  private static shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  deckForSide(side: 'p1' | 'p2'): Item[] {
    return side === 'p1' ? this.p1Deck : this.p2Deck;
  }

  handForSide(side: 'p1' | 'p2'): Map<number, Item> {
    return side === 'p1' ? this.p1Hand : this.p2Hand;
  }

  /**
   * Draw up to `n` cards from the side's deck into their hand. Stops early if the deck runs out.
   * Returns the number actually drawn.
   */
  drawCards(side: 'p1' | 'p2', n: number): number {
    const deck = this.deckForSide(side);
    const hand = this.handForSide(side);
    let slot = side === 'p1' ? this.p1HandNextSlot : this.p2HandNextSlot;
    let drawn = 0;
    for (let i = 0; i < n && deck.length > 0; i += 1) {
      const card = deck.shift();
      if (!card) break;
      hand.set(slot, card);
      slot += 1;
      drawn += 1;
    }
    if (side === 'p1') {
      this.p1HandNextSlot = slot;
    } else {
      this.p2HandNextSlot = slot;
    }
    if (drawn > 0) {
      this.logEvent(`${side.toUpperCase()} drew ${drawn} card${drawn === 1 ? '' : 's'}`);
    }
    return drawn;
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

  /**
   * Base cap ({@link SKILL_POINTS_CAP}) plus sum of {@link EffectType.SkillPointsMaxBonus} on alive allies.
   */
  skillPointsCapForSide(side: 'p1' | 'p2'): number {
    let bonus = 0;
    this.ally(side).forEach((c) => {
      if (c.isKnockedOut) return;
      c.effects
        .filter((e) => e.type === EffectType.SkillPointsMaxBonus)
        .forEach((e) => {
          bonus += e.amount;
        });
    });
    return SKILL_POINTS_CAP + Math.floor(bonus);
  }

  /**
   * Append a line to the currently-accumulating action log (and the full turn history).
   * Call sites: damage resolution, effect application, knockouts, etc.
   */
  logEvent(message: string): void {
    this.currentActionLog.push(message);
    this.turnHistory.push(message);
    log(`[tcg] ${message}`);
  }

  /** Snapshot of the lines produced during the most recent action. */
  getLastActionLog(): string[] {
    return [...this.currentActionLog];
  }

  /**
   * Fan-out for passive hooks (skill point spend, gains, etc.).
   */
  dispatchBattleEvent(event: BattleEvent): void {
    this.allCards().forEach((cib) => {
      if (cib.isKnockedOut) return;
      cib.character.abilities.forEach((ability) => {
        ability.notifyBattleEvent(event, cib);
      });
    });
  }

  private setSkillPoints(side: 'p1' | 'p2', value: number) {
    const cap = this.skillPointsCapForSide(side);
    const clamped = Math.max(0, Math.min(cap, value));
    if (side === 'p1') this.p1SkillPoints = clamped;
    else this.p2SkillPoints = clamped;
  }

  private changeSkillPoints(
    side: 'p1' | 'p2',
    delta: number,
    meta?: {
      consumer?: CharacterInBattle;
      sourceCharacter?: CharacterInBattle | null;
      gainReason?: 'normal_attack' | 'ultimate' | 'other';
    },
  ): void {
    const before = this.skillPointsForSide(side);
    this.setSkillPoints(side, before + delta);
    const after = this.skillPointsForSide(side);
    const gained = Math.max(0, after - before);
    const lost = Math.max(0, before - after);
    if (lost > 0 && meta?.consumer) {
      this.dispatchBattleEvent({
        type: 'skill_points_consumed',
        side,
        consumer: meta.consumer,
        pointsConsumed: lost,
      });
    }
    if (gained > 0) {
      this.dispatchBattleEvent({
        type: 'skill_points_gained',
        side,
        pointsGained: gained,
        sourceCharacter: meta?.sourceCharacter ?? null,
        reason: meta?.gainReason ?? 'other',
      });
    }
  }

  /** Re-clamp pools after effect durations change (e.g. max-SP bonus expired). */
  private clampSkillPointsToCaps(): void {
    (['p1', 'p2'] as const).forEach((side) => {
      this.setSkillPoints(side, this.skillPointsForSide(side));
    });
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

    this.currentActionLog = [];
    skill.useSkill(character, target);
    character.onSkillCompleted(skill, target);

    if (skill.category === SkillCategory.Normal) {
      this.changeSkillPoints(side, skill.skillPointsGranted, {
        sourceCharacter: character,
        gainReason: 'normal_attack',
      });
      character.gainEnergy(ENERGY_AFTER_NORMAL);
    } else {
      this.changeSkillPoints(side, -spCost, { consumer: character });
      character.gainEnergy(ENERGY_AFTER_CHARGED);
    }

    this.mainActionUsedThisPhase = true;
    this.turnHistory.push(`${character.character.name} used ${skill.category} skill [${skillIndex}] ${skill.name}`);
    this.status = this.checkVictory();
    this.clampSkillPointsToCaps();
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

    this.currentActionLog = [];
    character.spendEnergy(energy);
    skill.useSkill(character, target);
    character.onSkillCompleted(skill, target);

    const spGrant = skill.teamSkillPointsGrantedOnUltimate;
    if (spGrant > 0) {
      this.changeSkillPoints(character.side as 'p1' | 'p2', spGrant, {
        sourceCharacter: character,
        gainReason: 'ultimate',
      });
    }

    this.turnHistory.push(`${character.character.name} used ultimate [${skillIndex}] ${skill.name}`);
    this.status = this.checkVictory();
    this.clampSkillPointsToCaps();
    return true;
  }

  /**
   * Play an item from the side's hand onto an own character. Allowed only on that side's turn.
   * Items don't count as the main action and don't consume energy / skill points.
   * @param handSlotId Stable slot id (see / hand list), not a dense 0..n-1 index.
   * @returns true if the item was played; false otherwise (rule violation).
   */
  useItem(side: 'p1' | 'p2', handSlotId: number, target: CharacterInBattle): boolean {
    if (this.status !== BattleStatus.Ongoing) return false;
    if (side !== this.currentPlayer) return false;

    const hand = this.handForSide(side);
    if (!hand.has(handSlotId)) return false;

    if (target.side !== side) return false;
    if (target.isKnockedOut) return false;

    const item = hand.get(handSlotId)!;
    this.currentActionLog = [];
    this.logEvent(`${side.toUpperCase()} used [${item.name}] on ${target.character.name}`);
    const ok = item.apply(target, this);
    if (!ok) {
      // Roll back the log line; the application failed (e.g. equipment cap reached).
      this.currentActionLog = [];
      return false;
    }
    hand.delete(handSlotId);
    this.status = this.checkVictory();
    this.clampSkillPointsToCaps();
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
      this.clampSkillPointsToCaps();
      this.currentTurn += 1;
      // New round → both sides draw their per-round cards.
      this.drawCards('p1', DRAW_PER_ROUND);
      this.drawCards('p2', DRAW_PER_ROUND);
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
      p1SkillPointsCap: this.skillPointsCapForSide('p1'),
      p2SkillPointsCap: this.skillPointsCapForSide('p2'),
      status: this.status,
      p1: {
        alive: this.getAliveAlly('p1').map((char) => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map((e) => e.toString()),
          equipments: char.equipments.map((e) => e.name),
        })),
        handSize: this.p1Hand.size,
        deckSize: this.p1Deck.length,
      },
      p2: {
        alive: this.getAliveAlly('p2').map((char) => ({
          name: char.character.name,
          hp: char.currentHp,
          maxHp: char.character.hp,
          energy: char.energy,
          effects: char.effects.map((e) => e.toString()),
          equipments: char.equipments.map((e) => e.name),
        })),
        handSize: this.p2Hand.size,
        deckSize: this.p2Deck.length,
      },
    };
  }

  toString(): string {
    const lines: string[] = [];
    lines.push(
      `Round: ${this.currentTurn}, Acting: ${this.currentPlayer.toUpperCase()}, Active slot: ${this.getCurrentActiveSlot()} (${this.getActiveCharacterForCurrentPhase()?.character.name ?? '—'})`,
    );
    lines.push(
      `Team skill points — P1: ${this.p1SkillPoints}/${this.skillPointsCapForSide('p1')}  P2: ${this.p2SkillPoints}/${this.skillPointsCapForSide('p2')}`,
    );
    lines.push(
      `Items — P1 hand ${this.p1Hand.size} (deck ${this.p1Deck.length})  P2 hand ${this.p2Hand.size} (deck ${this.p2Deck.length})`,
    );
    if (this.mainActionUsedThisPhase) {
      lines.push('This phase: main action already used by active character');
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
