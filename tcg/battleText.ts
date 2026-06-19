/**
 * CLI + Discord text rendering for battles. Everything here is keyed by
 * {@link BattleTextStyle} ('cli' plain text or 'markdown' for Discord). The
 * website does NOT use this module — it renders from {@link ./battleSnapshot}.
 *
 * Action execution and target resolution live in {@link ./battleCore}.
 */
import { Battle, BattleStatus, type BattleLogEntry } from './battle';
import { SkillCategory } from './skillCategory';
import type { Skill } from './skill';
import type { CharacterInBattle } from './characterInBattle';
import { Item, ItemKind } from './item';
import {
  type BattleSide,
  type UseSkillSuccessDetail,
  type ExecuteUseSkillResult,
  type UseItemSuccessDetail,
  type ExecuteUseItemResult,
  formatActiveSlotLabel,
} from './battleCore';

export type BattleTextStyle = 'cli' | 'markdown';

const MAX_DISCORD_BATTLE_LEN = 1800;

/**
 * Human-readable gate for using this skill from the skills list UI.
 */
function formatSkillAvailabilityLine(
  battle: Battle,
  side: BattleSide,
  charIndex: number,
  char: CharacterInBattle,
  skill: Skill,
  style: BattleTextStyle,
): string {
  const activeSkills = char.getActiveSkills();
  if (!activeSkills.includes(skill)) {
    return style === 'markdown' ? 'FORM LOCKED' : '[FORM LOCKED]';
  }
  if (char.isKnockedOut) {
    return style === 'markdown' ? 'KO' : '[KO]';
  }

  if (skill.category === SkillCategory.Ultimate) {
    const need = skill.ultimateEnergyCost;
    const ok = need <= 0 || char.energy >= need;
    if (ok) return style === 'markdown' ? 'AVAILABLE (ultimate)' : '[ULTIMATE — AVAILABLE]';
    return style === 'markdown'
      ? `LOCKED (need ${need} energy)`
      : `[ULTIMATE — need ${need} energy, have ${char.energy}]`;
  }

  if (side !== battle.currentPlayer) {
    return style === 'markdown'
      ? 'Only ultimates (not your side to act)'
      : '[NORMAL/CHARGED — not your phase]';
  }
  if (charIndex !== battle.getCurrentActiveSlot()) {
    return style === 'markdown'
      ? 'Only ultimates (not active slot)'
      : `[NORMAL/CHARGED — active is ${formatActiveSlotLabel(battle)}]`;
  }
  if (battle.mainActionUsedThisPhase) {
    return style === 'markdown'
      ? 'Main action used — ultimates still OK'
      : '[NORMAL/CHARGED — already used this phase]';
  }
  if (skill.category === SkillCategory.Charged && battle.skillPointsForSide(side) < skill.skillPointsCost) {
    const spCap = battle.skillPointsCapForSide(side);
    return style === 'markdown'
      ? `LOCKED (need 1 skill point, have ${battle.skillPointsForSide(side)}/${spCap})`
      : '[CHARGED — need 1 team skill point]';
  }
  return style === 'markdown' ? 'AVAILABLE (main action)' : '[MAIN ACTION — AVAILABLE]';
}

/** Style one structured log line for a text surface (Discord markdown or CLI). */
function renderLogEntry(entry: BattleLogEntry, style: BattleTextStyle): string {
  const { kind, text } = entry;
  if (style === 'markdown') {
    switch (kind) {
      case 'turn': return `### ${text}`;
      case 'action':
      case 'item': return `**${text}**`;
      case 'ko': return `**${text}**`;
      case 'dodge': return `*${text}*`;
      default: return text;
    }
  }
  if (kind === 'turn') return `=== ${text} ===`;
  return text;
}

function renderLogEntries(entries: BattleLogEntry[], style: BattleTextStyle): string {
  return entries.map((e) => renderLogEntry(e, style)).join('\n');
}

export function formatUseSkillMessage(
  detail: UseSkillSuccessDetail,
  style: BattleTextStyle,
): string {
  if (detail.logEntries.length === 0) {
    // Fallback: no log captured (shouldn't happen on success) — synthesize a header.
    return style === 'markdown'
      ? `**${detail.characterName}** used **${detail.skillName}** on **${detail.targetName}**!`
      : `${detail.characterName} used ${detail.skillName} on ${detail.targetName}!`;
  }
  return renderLogEntries(detail.logEntries, style);
}

export function formatUseSkillFailureMessage(result: Extract<ExecuteUseSkillResult, { ok: false }>): string {
  if (!result.hints?.length) {
    return result.error;
  }
  return `${result.error} ${result.hints.join(' ')}`;
}

function describeItem(item: Item): string {
  const kindTag = item.kind === ItemKind.Equipment ? 'EQ' : 'CO';
  return `[${kindTag}] ${item.name} — ${item.description}`;
}

export function formatUseItemMessage(detail: UseItemSuccessDetail, style: BattleTextStyle): string {
  if (detail.logEntries.length === 0) {
    return style === 'markdown'
      ? `Played **${detail.itemName}** on **${detail.targetName}**!`
      : `Played ${detail.itemName} on ${detail.targetName}!`;
  }
  return renderLogEntries(detail.logEntries, style);
}

export function formatUseItemFailureMessage(result: Extract<ExecuteUseItemResult, { ok: false }>): string {
  if (!result.hints?.length) {
    return result.error;
  }
  return `${result.error} ${result.hints.join(' ')}`;
}

/** One-line summary of the side's hand for status panels / Discord. */
export function formatHandForSide(battle: Battle, side: BattleSide, style: BattleTextStyle): string {
  const hand = battle.handForSide(side);
  const deckSize = battle.deckForSide(side).length;
  const header = style === 'markdown'
    ? `**${side.toUpperCase()} hand** (${hand.size} card${hand.size === 1 ? '' : 's'}, ${deckSize} in deck):`
    : `${side.toUpperCase()} hand (${hand.size} cards, ${deckSize} in deck):`;
  if (hand.size === 0) {
    return `${header}\n  (empty)`;
  }
  // Discord auto-renumbers any markdown numbered list ("0. foo / 1. bar" becomes "1. / 2."),
  // which would silently desync the label from the id. Use backticks for markdown; literal "N." in CLI.
  const lines = Array.from(hand.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slotId, it]) => {
      const idx = style === 'markdown' ? `\`${slotId}\`` : `${slotId}.`;
      return `  ${idx} ${describeItem(it)}`;
    });
  return [header, ...lines].join('\n');
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

  const lines: string[] = [];

  if (style === 'cli') {
    lines.push(
      `\nTeam skill points ${battle.skillPointsForSide(side)}/${battle.skillPointsCapForSide(side)} — active ${formatActiveSlotLabel(battle)}`,
    );
    lines.push(`\n${char.character.name}'s skills:`);
    char.character.skills.forEach((skill) => {
      const status = formatSkillAvailabilityLine(battle, side, charIndex, char, skill, 'cli');
      lines.push(`  [${char.character.skills.indexOf(skill)}] ${skill.toString()} - ${status}`);
      lines.push(`      Description: ${skill.description}`);
    });
  } else {
    lines.push(`**${char.character.name}** (slot ${charIndex})`);
    lines.push(
      `Team skill points **${battle.skillPointsForSide(side)}** / **${battle.skillPointsCapForSide(side)}**  ·  Active: **${formatActiveSlotLabel(battle)}**`,
    );
    char.character.skills.forEach((skill, idx) => {
      const status = formatSkillAvailabilityLine(battle, side, charIndex, char, skill, 'markdown');
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
  const lines: string[] = [];

  lines.push(`**${char.character.name}** (slot ${charIndex})`);
  if (char.isKnockedOut) {
    lines.push('*Knocked out*');
  }
  lines.push(`HP **${char.currentHp}** / **${char.character.hp}**  ·  Energy **${char.energy}**`);
  lines.push(
    `Team skill points **${battle.skillPointsForSide(side)}** / **${battle.skillPointsCapForSide(side)}**  ·  Active: **${formatActiveSlotLabel(battle)}**`,
  );
  if (battle.mainActionUsedThisPhase && side === battle.currentPlayer && charIndex === battle.getCurrentActiveSlot()) {
    lines.push('*Main action used this phase (ultimates still allowed)*');
  }
  lines.push('');

  char.character.skills.forEach((skill, idx) => {
    const status = formatSkillAvailabilityLine(battle, side, charIndex, char, skill, 'markdown');
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
  const sp = battle.skillPointsForSide(battle.currentPlayer);
  const cap = battle.skillPointsCapForSide(battle.currentPlayer);
  const hand = battle.handForSide(battle.currentPlayer).size;
  const deck = battle.deckForSide(battle.currentPlayer).length;
  if (style === 'markdown') {
    return `Round **${battle.currentTurn}** — **${battle.currentPlayer.toUpperCase()}** · Active **${formatActiveSlotLabel(battle)}** · team SP **${sp}/${cap}** · hand **${hand}** (deck ${deck})`;
  }
  return `Round ${battle.currentTurn} — ${battle.currentPlayer.toUpperCase()} · Active ${formatActiveSlotLabel(battle)} · SP ${sp}/${cap} · hand ${hand} (deck ${deck})`;
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

/** Last rotation line from turn history (CLI banner helper). */
export function getLatestPhaseSummary(battle: Battle): string | null {
  const rows = battle.turnHistory.filter((h) => h.kind === 'turn');
  if (rows.length === 0) return null;
  return rows[rows.length - 1].text;
}
