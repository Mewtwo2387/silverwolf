/**
 * Transport-agnostic battle actions and helpers. This layer knows nothing about
 * Discord, the CLI, or the website — it validates and executes player actions
 * against a {@link Battle} and returns structured results (no markdown/CLI text).
 *
 * Presentation lives in {@link ./battleText} (CLI + Discord strings) and
 * {@link ./battleSnapshot} (serializable DTO for the website).
 */
import { Battle, BattleStatus, type BattleLogEntry } from './battle';
import { CharacterInBattle } from './characterInBattle';
import { CHARACTERS } from './characters';
import type { Skill } from './skill';
import { RangeType } from './rangeType';
import { SkillCategory } from './skillCategory';
import { Equipment, ItemKind } from './item';
import { buildExampleDeck } from './items';

export type BattleSide = 'p1' | 'p2';

/** Same teams as the interactive demo everywhere (CLI + Discord). */
export function createDemoBattle(): Battle {
  const [kaitlin, venfei, ei, silverwolf, sparkle, electro] = CHARACTERS;
  return new Battle(
    [kaitlin, electro, venfei],
    [ei, silverwolf, sparkle],
    { p1Deck: buildExampleDeck(), p2Deck: buildExampleDeck() },
  );
}

export function parseBattleSide(raw: string): BattleSide | null {
  const s = raw.toLowerCase();
  if (s === 'p1' || s === 'p2') return s;
  return null;
}

/** Skill needs an opponent index or ally index (not used for AoE / pure self). */
export function skillNeedsExplicitTarget(skill: Skill): boolean {
  if (skill.damageRange === RangeType.SingleOpponent || skill.damageRange === RangeType.SingleAlly) {
    return true;
  }
  return skill.effects.some(
    (e) => e.range === RangeType.SingleOpponent || e.range === RangeType.SingleAlly,
  );
}

function skillWantsAllyIndex(skill: Skill): boolean {
  return skill.damageRange === RangeType.SingleAlly
    || skill.effects.some((e) => e.range === RangeType.SingleAlly);
}

/** Which side an explicit target lives on: 'opponent', 'ally', or 'none' (AoE / self). */
export function skillTargetKind(skill: Skill): 'opponent' | 'ally' | 'none' {
  if (!skillNeedsExplicitTarget(skill)) return 'none';
  return skillWantsAllyIndex(skill) ? 'ally' : 'opponent';
}

/** Find the absolute slot index of a character in the battle (searches both teams). */
export function findSlotIndex(battle: Battle, char: CharacterInBattle): number | null {
  const p1 = battle.p1cards.indexOf(char);
  if (p1 >= 0) return p1;
  const p2 = battle.p2cards.indexOf(char);
  if (p2 >= 0) return p2;
  return null;
}

function formatCharWithSlot(battle: Battle, char: CharacterInBattle): string {
  const slot = findSlotIndex(battle, char);
  return slot != null ? `${char.character.name} (slot ${slot})` : char.character.name;
}

/** Describes the current active slot like "Slot 2 (Kaitlin)". */
export function formatActiveSlotLabel(battle: Battle): string {
  const slot = battle.getCurrentActiveSlot();
  const active = battle.getActiveCharacterForCurrentPhase();
  return active ? `Slot ${slot} (${active.character.name})` : `Slot ${slot}`;
}

/** Human-readable who this skill applies to (plain text; matches damage range). */
export function formatSkillTargetLabel(
  battle: Battle,
  skill: Skill,
  caster: CharacterInBattle,
  resolved: CharacterInBattle | null,
): string {
  switch (skill.damageRange) {
    case RangeType.Self:
      return `self (slot ${findSlotIndex(battle, caster) ?? '?'})`;
    case RangeType.AllOpponents:
      return 'all opponents';
    case RangeType.AdjacentOpponents:
      return 'adjacent opponents';
    case RangeType.AllAllies:
      return 'all allies';
    case RangeType.AllCards:
      return 'everyone';
    case RangeType.SingleOpponent:
      return resolved ? formatCharWithSlot(battle, resolved) : '(unknown)';
    case RangeType.SingleAlly:
      if (!resolved) return '(unknown)';
      if (resolved === caster) return `self (slot ${findSlotIndex(battle, caster) ?? '?'})`;
      return formatCharWithSlot(battle, resolved);
    default:
      return resolved ? formatCharWithSlot(battle, resolved) : `self (slot ${findSlotIndex(battle, caster) ?? '?'})`;
  }
}

export function resolveTargetForSkill(
  battle: Battle,
  side: BattleSide,
  character: CharacterInBattle,
  skillIndex: number,
  targetRaw: string | null,
): { ok: true; target: CharacterInBattle | null } | { ok: false; error: string } {
  const skill = character.character.skills[skillIndex];
  if (!skill) {
    return { ok: false, error: `Invalid skill index: ${skillIndex}` };
  }

  const targetStr = (targetRaw?.trim() ?? '').toLowerCase();

  if (targetStr === 'self') {
    if (skillWantsAllyIndex(skill)) {
      return { ok: true, target: character };
    }
    return { ok: true, target: null };
  }
  if (targetStr === '-1' || targetStr === 'null') {
    return { ok: true, target: null };
  }

  if (!skillNeedsExplicitTarget(skill)) {
    return { ok: true, target: null };
  }

  const targetIndex = parseInt((targetRaw?.trim() || '0'), 10);
  // Target indices are ABSOLUTE slot indices — they never shift when a character is KO'd.
  // Slot 1 is always slot 1 even if slot 0 is gone.
  if (skillWantsAllyIndex(skill)) {
    const allies = battle.ally(side);
    if (targetIndex < 0 || targetIndex >= allies.length) {
      return { ok: false, error: `Invalid ally target slot: ${targetIndex}` };
    }
    const target = allies[targetIndex];
    if (target.isKnockedOut) {
      return { ok: false, error: `Ally slot ${targetIndex} is knocked out.` };
    }
    return { ok: true, target };
  }
  const opponents = battle.opponent(side);
  if (targetIndex >= 0 && targetIndex < opponents.length) {
    const target = opponents[targetIndex];
    if (target.isKnockedOut) {
      return { ok: false, error: `Opponent slot ${targetIndex} is knocked out.` };
    }
    return { ok: true, target };
  }
  return { ok: false, error: `Invalid target slot: ${targetIndex}` };
}

export interface SkillAvailability {
  available: boolean;
  /** Plain-text explanation (used as a tooltip / disabled-reason; not styled). */
  reason: string;
}

/**
 * Transport-neutral availability gate for a skill, shared by the snapshot DTO and
 * (indirectly) the text formatters. Mirrors the rules enforced in {@link executeUseSkill}.
 */
export function computeSkillAvailability(
  battle: Battle,
  side: BattleSide,
  charIndex: number,
  char: CharacterInBattle,
  skill: Skill,
): SkillAvailability {
  if (!char.getActiveSkills().includes(skill)) {
    return { available: false, reason: 'Not available in current form.' };
  }
  if (char.isKnockedOut) {
    return { available: false, reason: 'Knocked out.' };
  }

  if (skill.category === SkillCategory.Ultimate) {
    const need = skill.ultimateEnergyCost;
    if (need <= 0 || char.energy >= need) {
      return { available: true, reason: 'Ultimate ready.' };
    }
    return { available: false, reason: `Needs ${need} energy (have ${char.energy}).` };
  }

  if (side !== battle.currentPlayer) {
    return { available: false, reason: 'Not your side to act.' };
  }
  if (charIndex !== battle.getCurrentActiveSlot()) {
    return {
      available: false,
      reason: `Only the active character (${formatActiveSlotLabel(battle)}) may use normal/charged.`,
    };
  }
  if (battle.mainActionUsedThisPhase) {
    return { available: false, reason: 'Main action already used this phase.' };
  }
  if (skill.category === SkillCategory.Charged && battle.skillPointsForSide(side) < skill.skillPointsCost) {
    return {
      available: false,
      reason: `Needs ${skill.skillPointsCost} team skill point(s) (have ${battle.skillPointsForSide(side)}/${battle.skillPointsCapForSide(side)}).`,
    };
  }
  return { available: true, reason: 'Available (main action).' };
}

export interface UseSkillSuccessDetail {
  characterName: string;
  skillName: string;
  targetName: string;
  /** Structured battle-log lines (announcement, damage, effects, KOs) produced by the skill. */
  logEntries: BattleLogEntry[];
}

export type ExecuteUseSkillResult =
  | { ok: true; detail: UseSkillSuccessDetail }
  | { ok: false; error: string; hints?: string[] };

/**
 * Attempt to use a skill for the given side (must be that side's turn).
 * Shared by CLI, Discord, and the website.
 */
export function executeUseSkill(
  battle: Battle,
  side: BattleSide,
  charIndex: number,
  skillIndex: number,
  targetRaw: string | null,
): ExecuteUseSkillResult {
  if (side !== battle.currentPlayer) {
    return {
      ok: false,
      error: `It's not ${side}'s turn. Current player: ${battle.currentPlayer}`,
    };
  }

  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (charIndex < 0 || charIndex >= allies.length) {
    return { ok: false, error: `Invalid character index: ${charIndex}` };
  }

  const character = allies[charIndex];
  if (character.isKnockedOut) {
    return { ok: false, error: `${character.character.name} is knocked out.` };
  }

  const resolved = resolveTargetForSkill(battle, side, character, skillIndex, targetRaw);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const currentSkill = character.character.skills[skillIndex];
  if (!currentSkill) {
    return { ok: false, error: `Invalid skill index: ${skillIndex}` };
  }

  const success = currentSkill.category === SkillCategory.Ultimate
    ? battle.useUltimate(character, skillIndex, resolved.target)
    : battle.useMainAction(character, skillIndex, resolved.target);
  if (success) {
    const skillName = currentSkill?.name ?? `skill ${skillIndex}`;
    const targetName = formatSkillTargetLabel(battle, currentSkill, character, resolved.target);
    return {
      ok: true,
      detail: {
        characterName: character.character.name,
        skillName,
        targetName,
        logEntries: battle.getLastActionLogEntries(),
      },
    };
  }

  const hints: string[] = [];
  const activeSkills = character.getActiveSkills();
  if (currentSkill && !activeSkills.includes(currentSkill)) {
    hints.push('Skill not available in current form.');
  }
  if (currentSkill?.category === SkillCategory.Ultimate && currentSkill.ultimateEnergyCost > 0) {
    if (character.energy < currentSkill.ultimateEnergyCost) {
      hints.push(`Ultimate needs ${currentSkill.ultimateEnergyCost} energy (have ${character.energy}).`);
    }
  }
  if (currentSkill
    && (currentSkill.category === SkillCategory.Normal || currentSkill.category === SkillCategory.Charged)) {
    if (charIndex !== battle.getCurrentActiveSlot()) {
      hints.push(
        `Only the active character (${formatActiveSlotLabel(battle)}) may use normal/charged right now.`,
      );
    }
    if (battle.mainActionUsedThisPhase) {
      hints.push('Normal/charged already used this phase; end turn or use ultimates.');
    }
    const shortOnSp = currentSkill.category === SkillCategory.Charged
      && battle.skillPointsForSide(side) < currentSkill.skillPointsCost;
    if (shortOnSp) {
      hints.push(
        `Need ${currentSkill.skillPointsCost} team skill point(s) (have ${battle.skillPointsForSide(side)}/${battle.skillPointsCapForSide(side)}).`,
      );
    }
  }
  if (!currentSkill) {
    hints.push('Invalid skill index.');
  }
  if (character.isKnockedOut) {
    hints.push('Character is knocked out.');
  }

  return {
    ok: false,
    error: 'Failed to use skill.',
    hints: hints.length > 0 ? hints : undefined,
  };
}

export interface UseItemSuccessDetail {
  itemName: string;
  itemKind: ItemKind;
  targetName: string;
  /** Structured battle-log lines produced during the item's resolution (equip, heals, etc.). */
  logEntries: BattleLogEntry[];
}

export type ExecuteUseItemResult =
  | { ok: true; detail: UseItemSuccessDetail }
  | { ok: false; error: string; hints?: string[] };

/**
 * Attempt to play an item from `side`'s hand onto an own character.
 * Shared by CLI, Discord, and the website.
 *
 * @param handSlotId stable slot id for the card (as in `/tcgbattle hand`); not a dense 0..n-1.
 * @param targetCharIndex absolute character slot on the same side.
 */
export function executeUseItem(
  battle: Battle,
  side: BattleSide,
  handSlotId: number,
  targetCharIndex: number,
): ExecuteUseItemResult {
  if (side !== battle.currentPlayer) {
    return { ok: false, error: `It's not ${side}'s turn. Current player: ${battle.currentPlayer}` };
  }
  const hand = battle.handForSide(side);
  if (!hand.has(handSlotId)) {
    return {
      ok: false,
      error: `No item in hand slot \`${handSlotId}\` (${hand.size} card${hand.size === 1 ? '' : 's'} held; slots keep stable ids, gaps are normal).`,
    };
  }
  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (targetCharIndex < 0 || targetCharIndex >= allies.length) {
    return { ok: false, error: `Invalid target slot: ${targetCharIndex}` };
  }
  const target = allies[targetCharIndex];
  if (target.isKnockedOut) {
    return { ok: false, error: `${target.character.name} (slot ${targetCharIndex}) is knocked out.` };
  }
  const item = hand.get(handSlotId)!;

  if (item instanceof Equipment && target.equipments.length >= 3) {
    return {
      ok: false,
      error: `${target.character.name} already has 3 equipments.`,
      hints: ['Each character can hold up to 3 equipments.'],
    };
  }

  const gate = item.canApply(target, battle);
  if (!gate.ok) {
    return { ok: false, error: gate.reason };
  }

  const ok = battle.useItem(side, handSlotId, target);
  if (!ok) {
    return { ok: false, error: 'Failed to play item.' };
  }
  return {
    ok: true,
    detail: {
      itemName: item.name,
      itemKind: item.kind,
      targetName: formatCharWithSlot(battle, target),
      logEntries: battle.getLastActionLogEntries(),
    },
  };
}

export type EndTurnResult =
  | { ok: true; switched: boolean; previous: BattleSide; next: BattleSide }
  | { ok: false; error: string };

export function endTurnAsCurrentPlayer(battle: Battle, side: BattleSide): EndTurnResult {
  if (battle.status !== BattleStatus.Ongoing) {
    return { ok: false, error: `Battle is not ongoing (${battle.status}).` };
  }
  if (battle.currentPlayer !== side) {
    return {
      ok: false,
      error: `It's not ${side}'s turn. Current player: ${battle.currentPlayer}`,
    };
  }

  const previous = battle.currentPlayer;
  battle.endTurn();
  const next = battle.currentPlayer;
  return {
    ok: true,
    switched: previous !== next,
    previous,
    next,
  };
}

export function debugMaxEnergy(battle: Battle): void {
  battle.p1cards.forEach((c) => {
    c.gainEnergy(9999);
  });
  battle.p2cards.forEach((c) => {
    c.gainEnergy(9999);
  });
}
