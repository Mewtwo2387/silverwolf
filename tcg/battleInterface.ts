import { Battle, BattleStatus } from './battle';
import { CharacterInBattle } from './characterInBattle';
import { CHARACTERS } from './characters';
import type { Skill } from './skill';
import { RangeType } from './rangeType';

export type BattleSide = 'p1' | 'p2';
export type BattleTextStyle = 'cli' | 'markdown';

const MAX_DISCORD_BATTLE_LEN = 1800;

/** Same teams as the interactive demo everywhere (CLI + Discord). */
export function createDemoBattle(): Battle {
  const [kaitlin, venfei, ei, silverwolf, sparkle] = CHARACTERS;
  return new Battle([kaitlin, kaitlin, venfei], [ei, silverwolf, sparkle]);
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

/** Human-readable who this skill applies to (matches damage range; used in CLI + Discord). */
export function formatSkillTargetLabel(
  skill: Skill,
  caster: CharacterInBattle,
  resolved: CharacterInBattle | null,
): string {
  switch (skill.damageRange) {
    case RangeType.Self:
      return 'self';
    case RangeType.AllOpponents:
      return 'all opponents';
    case RangeType.AllAllies:
      return 'all allies';
    case RangeType.AllCards:
      return 'everyone';
    case RangeType.SingleOpponent:
      return resolved ? resolved.character.name : '(unknown)';
    case RangeType.SingleAlly:
      if (!resolved) return '(unknown)';
      return resolved === caster ? 'self' : resolved.character.name;
    default:
      return resolved ? resolved.character.name : 'self';
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
  if (skillWantsAllyIndex(skill)) {
    const allAllies = battle.getAliveAlly(side);
    if (targetIndex >= 0 && targetIndex < allAllies.length) {
      return { ok: true, target: allAllies[targetIndex] };
    }
    return { ok: false, error: `Invalid ally target index: ${targetIndex}` };
  }
  const opponents = battle.getAliveOpponent(side);
  if (targetIndex >= 0 && targetIndex < opponents.length) {
    return { ok: true, target: opponents[targetIndex] };
  }
  const allAllies = battle.getAliveAlly(side);
  if (targetIndex >= 0 && targetIndex < allAllies.length) {
    return { ok: true, target: allAllies[targetIndex] };
  }
  return { ok: false, error: `Invalid target index: ${targetIndex}` };
}

export interface UseSkillSuccessDetail {
  characterName: string;
  skillName: string;
  targetName: string;
}

export type ExecuteUseSkillResult =
  | { ok: true; detail: UseSkillSuccessDetail }
  | { ok: false; error: string; hints?: string[] };

/**
 * Attempt to use a skill for the given side (must be that side's turn).
 * Shared by CLI and Discord.
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

  const success = battle.useSkill(character, skillIndex, resolved.target);
  if (success) {
    const currentSkill = character.character.skills[skillIndex];
    const skillName = currentSkill?.name ?? `skill ${skillIndex}`;
    const targetName = currentSkill
      ? formatSkillTargetLabel(currentSkill, character, resolved.target)
      : '(unknown)';
    return {
      ok: true,
      detail: {
        characterName: character.character.name,
        skillName,
        targetName,
      },
    };
  }

  const hints: string[] = [];
  if (character.hasUsedSkillThisTurn) {
    hints.push('Character has already used a skill this turn (1 skill per character per turn).');
  }
  const activeSkills = character.getActiveSkills();
  const currentSkill = character.character.skills[skillIndex];
  if (currentSkill && !activeSkills.includes(currentSkill)) {
    hints.push('Skill not available in current form.');
  }
  if (currentSkill && character.energy < currentSkill.cost) {
    hints.push(`Not enough energy (need ${currentSkill.cost}, have ${character.energy}).`);
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

export function formatUseSkillMessage(
  detail: UseSkillSuccessDetail,
  style: BattleTextStyle,
): string {
  if (style === 'markdown') {
    return `**${detail.characterName}** used **${detail.skillName}** on **${detail.targetName}**!`;
  }
  return `${detail.characterName} used ${detail.skillName} on ${detail.targetName}!`;
}

export function formatUseSkillFailureMessage(result: Extract<ExecuteUseSkillResult, { ok: false }>): string {
  if (!result.hints?.length) {
    return result.error;
  }
  return `${result.error} ${result.hints.join(' ')}`;
}

export function formatSkillsForSide(
  battle: Battle,
  side: BattleSide,
  charIndex: number,
  style: BattleTextStyle,
): { ok: true; text: string } | { ok: false; error: string } {
  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (charIndex < 0 || charIndex >= allies.length) {
    return {
      ok: false,
      error: `Invalid character index: ${charIndex}${style === 'markdown' ? ` (use 0–${allies.length - 1})` : ''}`,
    };
  }

  const char = allies[charIndex];
  if (char.isKnockedOut) {
    return { ok: false, error: `${char.character.name} is knocked out.` };
  }

  const activeSkills = char.getActiveSkills();
  const lines: string[] = [];

  if (style === 'cli') {
    lines.push(`\n${char.character.name}'s skills:`);
    char.character.skills.forEach((skill, idx) => {
      const isActive = activeSkills.includes(skill);
      const canUse = isActive && char.energy >= skill.cost;
      let status: string;
      if (!isActive) {
        status = '[FORM LOCKED]';
      } else if (canUse) {
        status = '[AVAILABLE]';
      } else {
        status = `[LOCKED - Need ${skill.cost} energy, have ${char.energy}]`;
      }
      lines.push(`  [${idx}] ${skill.toString()} - ${status}`);
      lines.push(`      Description: ${skill.description}`);
    });
  } else {
    lines.push(`**${char.character.name}** (slot ${charIndex})`);
    char.character.skills.forEach((skill, idx) => {
      const isActive = activeSkills.includes(skill);
      const canUse = isActive && char.energy >= skill.cost;
      let status: string;
      if (!isActive) {
        status = 'FORM LOCKED';
      } else if (canUse) {
        status = 'AVAILABLE';
      } else {
        status = `LOCKED (need ${skill.cost} energy, have ${char.energy})`;
      }
      lines.push(`**[${idx}]** ${skill.name} — ${status}`);
      lines.push(skill.description);
    });
  }

  return { ok: true, text: lines.join('\n') };
}

/**
 * Discord: one ally’s skills (same layout as formatSkillsForSide markdown), plus HP/energy and all current effects with descriptions.
 * Unlike formatSkillsForSide, knocked-out allies are included so you can inspect effects and skill list.
 */
export function formatAllyStatusForDiscord(
  battle: Battle,
  side: BattleSide,
  charIndex: number,
): { ok: true; text: string } | { ok: false; error: string } {
  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (charIndex < 0 || charIndex >= allies.length) {
    return {
      ok: false,
      error: `Invalid character id: ${charIndex} (use 0–${allies.length - 1})`,
    };
  }

  const char = allies[charIndex];
  const activeSkills = char.getActiveSkills();
  const lines: string[] = [];

  lines.push(`**${char.character.name}** (slot ${charIndex})`);
  if (char.isKnockedOut) {
    lines.push('*Knocked out*');
  }
  lines.push(`HP **${char.currentHp}** / **${char.character.hp}**  ·  Energy **${char.energy}**`);
  if (char.hasUsedSkillThisTurn) {
    lines.push('*Already used a skill this turn*');
  }
  lines.push('');

  char.character.skills.forEach((skill, idx) => {
    const isActive = activeSkills.includes(skill);
    const canUse = isActive && !char.isKnockedOut && char.energy >= skill.cost;
    let status: string;
    if (char.isKnockedOut) {
      status = 'KO';
    } else if (!isActive) {
      status = 'FORM LOCKED';
    } else if (canUse) {
      status = 'AVAILABLE';
    } else {
      status = `LOCKED (need ${skill.cost} energy, have ${char.energy})`;
    }
    lines.push(`**[${idx}]** ${skill.name} — ${status}`);
    lines.push(skill.description);
  });

  lines.push('');
  lines.push('**Effects**');
  if (char.effects.length === 0) {
    lines.push('*None*');
  } else {
    char.effects.forEach((e) => {
      const dur = e.duration < 999 ? `${e.duration} turn(s) left` : 'permanent';
      lines.push(`**${e.name}** (${dur})`);
      lines.push(e.description || '—');
    });
  }

  return { ok: true, text: lines.join('\n') };
}

export function formatBattleStatus(battle: Battle): string {
  return battle.toString();
}

/** Short line for turn / outcome (CLI + Discord). */
export function statusLine(battle: Battle, style: BattleTextStyle = 'markdown'): string {
  if (battle.status !== BattleStatus.Ongoing) {
    return style === 'markdown'
      ? `Battle finished: **${battle.status}**`
      : `Battle finished: ${battle.status}`;
  }
  if (style === 'markdown') {
    return `Turn **${battle.currentTurn}** — **${battle.currentPlayer.toUpperCase()}** to act`;
  }
  return `Turn ${battle.currentTurn} — ${battle.currentPlayer.toUpperCase()} to act`;
}

/** Discord: labels + battle snapshot in a code block, length-capped. */
export function formatBattleForDiscord(
  battle: Battle,
  p1Label: string,
  p2Label: string,
): string {
  let text = `**P1** ${p1Label}  ·  **P2** ${p2Label}\n`;
  text += `\`\`\`\n${battle.toString()}\n\`\`\``;
  if (text.length > MAX_DISCORD_BATTLE_LEN) {
    text = `${text.slice(0, MAX_DISCORD_BATTLE_LEN - 20)}\n…(truncated)\`\`\``;
  }
  return text;
}

export function debugMaxEnergy(battle: Battle): void {
  battle.p1cards.forEach((c) => {
    c.gainEnergy(9999);
  });
  battle.p2cards.forEach((c) => {
    c.gainEnergy(9999);
  });
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

/** Text after a turn switch (CLI banner helper). */
export function getLatestEnergyGainSummary(battle: Battle): string | null {
  const energyGainEntries = battle.turnHistory.filter((h) => h.includes('Energy gained (2d6)'));
  if (energyGainEntries.length === 0) return null;
  const latestEnergyGain = energyGainEntries[energyGainEntries.length - 1];
  return latestEnergyGain.replace('Energy gained (2d6): ', '');
}
