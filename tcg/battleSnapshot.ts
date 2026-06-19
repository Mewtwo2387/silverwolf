/**
 * Serializable, viewer-aware battle snapshot. This is the single data contract the
 * website client renders from — it contains no canvas objects, no class instances,
 * and never leaks the opponent's hand.
 *
 * Discord/CLI render text via {@link ./battleText}; the website renders HTML from
 * the {@link BattleSnapshot} produced here.
 */
import { Battle, BattleStatus, type BattleLogEntry } from './battle';
import type { CharacterInBattle } from './characterInBattle';
import { ItemKind } from './item';
import { type BattleSide, computeSkillAvailability, skillTargetKind } from './battleCore';

export type SnapshotSkillCategory = 'normal' | 'charged' | 'ultimate';

export interface SnapshotEffect {
  name: string;
  description: string;
  /** Remaining turns; >= 999 means effectively permanent (equipment). */
  duration: number;
  positive: boolean;
}

export interface SnapshotSkill {
  /** Original index into the character's skill array (use as the skill id for actions). */
  index: number;
  name: string;
  description: string;
  category: SnapshotSkillCategory;
  /** Card-facing damage label (e.g. "4x4", "30", "--"). */
  damageText: string;
  /** Whether this skill can be used right now by the snapshot's perspective. */
  available: boolean;
  /** Plain-text reason (tooltip / disabled hint). */
  reason: string;
  /** Energy required (ultimates only; 0 otherwise). */
  energyCost: number;
  /** Team skill points consumed (charged only; 0 otherwise). */
  spCost: number;
  /** Team skill points granted (normal/ultimate; 0 otherwise). */
  spGranted: number;
  /** True when the skill needs an explicit opponent/ally target. */
  needsTarget: boolean;
  /** 'opponent' | 'ally' | 'none' — which side the explicit target is on. */
  targetKind: 'opponent' | 'ally' | 'none';
}

export interface SnapshotEquip {
  /** Item catalog id (used for the card PNG path). */
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
}

export interface SnapshotCharacter {
  slot: number;
  name: string;
  slug: string;
  maxHp: number;
  currentHp: number;
  energy: number;
  isKnockedOut: boolean;
  equipmentCount: number;
  /** Attached equipment, rich enough to render each item's card on click. */
  equipments: SnapshotEquip[];
  effects: SnapshotEffect[];
  skills: SnapshotSkill[];
}

export interface SnapshotSideMeta {
  skillPoints: number;
  skillPointsCap: number;
  handSize: number;
  deckSize: number;
}

export interface SnapshotHandCard {
  /** Stable hand slot id (pass back to use_item). */
  slotId: number;
  /** Item catalog id (used for the card PNG path). */
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
}

export interface BattleSnapshot {
  status: BattleStatus;
  currentPlayer: BattleSide;
  activeSlot: number;
  currentTurn: number;
  mainActionUsedThisPhase: boolean;
  /** The side this snapshot was built for (whose hand is included). */
  viewerSide: BattleSide;
  sides: { p1: SnapshotSideMeta; p2: SnapshotSideMeta };
  teams: { p1: SnapshotCharacter[]; p2: SnapshotCharacter[] };
  /** The viewer's hand only — never the opponent's. */
  hand: SnapshotHandCard[];
  /** Structured log lines from the most recent action (text + kind for styling). */
  lastActionLog: BattleLogEntry[];
}

function snapshotSideMeta(battle: Battle, side: BattleSide): SnapshotSideMeta {
  return {
    skillPoints: battle.skillPointsForSide(side),
    skillPointsCap: battle.skillPointsCapForSide(side),
    handSize: battle.handForSide(side).size,
    deckSize: battle.deckForSide(side).length,
  };
}

function snapshotTeam(battle: Battle, side: BattleSide): SnapshotCharacter[] {
  const team = side === 'p1' ? battle.p1cards : battle.p2cards;
  return team.map((char: CharacterInBattle, slot: number) => ({
    slot,
    name: char.character.name,
    slug: char.character.slug,
    maxHp: char.character.hp,
    currentHp: char.currentHp,
    energy: char.energy,
    isKnockedOut: char.isKnockedOut,
    equipmentCount: char.equipments.length,
    equipments: char.equipments.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      description: e.description,
    })),
    effects: char.effects.map((e) => ({
      name: e.name,
      description: e.description,
      duration: e.duration,
      positive: e.positive,
    })),
    skills: char.character.skills.map((skill, index) => {
      const availability = computeSkillAvailability(battle, side, slot, char, skill);
      const targetKind = skillTargetKind(skill);
      return {
        index,
        name: skill.name,
        description: skill.description,
        category: skill.battleCost.kind,
        damageText: skill.damageDisplayText,
        available: availability.available,
        reason: availability.reason,
        energyCost: skill.ultimateEnergyCost,
        spCost: skill.skillPointsCost,
        spGranted: skill.skillPointsGranted,
        needsTarget: targetKind !== 'none',
        targetKind,
      };
    }),
  }));
}

/**
 * Build a JSON-safe snapshot of the battle for one viewer. Only `viewerSide`'s hand
 * is included; both teams' public state (hp/energy/effects/skills) is always visible.
 */
export function buildBattleSnapshot(battle: Battle, viewerSide: BattleSide): BattleSnapshot {
  const hand: SnapshotHandCard[] = Array.from(battle.handForSide(viewerSide).entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slotId, item]) => ({
      slotId,
      id: item.id,
      name: item.name,
      kind: item.kind,
      description: item.description,
    }));

  return {
    status: battle.status,
    currentPlayer: battle.currentPlayer,
    activeSlot: battle.getCurrentActiveSlot(),
    currentTurn: battle.currentTurn,
    mainActionUsedThisPhase: battle.mainActionUsedThisPhase,
    viewerSide,
    sides: {
      p1: snapshotSideMeta(battle, 'p1'),
      p2: snapshotSideMeta(battle, 'p2'),
    },
    teams: {
      p1: snapshotTeam(battle, 'p1'),
      p2: snapshotTeam(battle, 'p2'),
    },
    hand,
    lastActionLog: battle.getLastActionLogEntries(),
  };
}
