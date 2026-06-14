import { Battle, BattleStatus } from './battle';
import { CharacterInBattle } from './characterInBattle';
import { CHARACTERS } from './characters';
import type { Skill } from './skill';
import { RangeType } from './rangeType';
import { SkillCategory } from './skillCategory';
import { Item, Equipment, ItemKind } from './item';
import { buildExampleDeck } from './items';

export type BattleSide = 'p1' | 'p2';
export type BattleTextStyle = 'cli' | 'markdown';

const MAX_DISCORD_BATTLE_LEN = 1800;

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

/** Find the absolute slot index of a character in the battle (searches both teams). */
function findSlotIndex(battle: Battle, char: CharacterInBattle): number | null {
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
function formatActiveSlotLabel(battle: Battle): string {
  const slot = battle.getCurrentActiveSlot();
  const active = battle.getActiveCharacterForCurrentPhase();
  return active ? `Slot ${slot} (${active.character.name})` : `Slot ${slot}`;
}

/** Human-readable who this skill applies to (matches damage range; used in CLI + Discord). */
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

export interface UseSkillSuccessDetail {
  characterName: string;
  skillName: string;
  targetName: string;
  /** Battle events (damage, effects applied, KOs) produced during the skill's resolution. */
  logLines: string[];
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
        logLines: battle.getLastActionLog(),
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

export function formatUseSkillMessage(
  detail: UseSkillSuccessDetail,
  style: BattleTextStyle,
): string {
  const header = style === 'markdown'
    ? `**${detail.characterName}** used **${detail.skillName}** on **${detail.targetName}**!`
    : `${detail.characterName} used ${detail.skillName} on ${detail.targetName}!`;
  if (detail.logLines.length === 0) {
    return header;
  }
  return [header, ...detail.logLines].join('\n');
}

export function formatUseSkillFailureMessage(result: Extract<ExecuteUseSkillResult, { ok: false }>): string {
  if (!result.hints?.length) {
    return result.error;
  }
  return `${result.error} ${result.hints.join(' ')}`;
}

// ---------------------------------------------------------------------------
// Item / hand handling
// ---------------------------------------------------------------------------

export interface UseItemSuccessDetail {
  itemName: string;
  itemKind: ItemKind;
  targetName: string;
  /** Battle events produced during the item's resolution (equip lines, heals, etc.). */
  logLines: string[];
}

export type ExecuteUseItemResult =
  | { ok: true; detail: UseItemSuccessDetail }
  | { ok: false; error: string; hints?: string[] };

/**
 * Attempt to play an item from `side`'s hand onto an own character.
 * Shared by CLI and Discord.
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
      logLines: battle.getLastActionLog(),
    },
  };
}

export function formatUseItemMessage(detail: UseItemSuccessDetail, style: BattleTextStyle): string {
  const header = style === 'markdown'
    ? `Played **${detail.itemName}** on **${detail.targetName}**!`
    : `Played ${detail.itemName} on ${detail.targetName}!`;
  if (detail.logLines.length === 0) {
    return header;
  }
  return [header, ...detail.logLines].join('\n');
}

export function formatUseItemFailureMessage(result: Extract<ExecuteUseItemResult, { ok: false }>): string {
  if (!result.hints?.length) {
    return result.error;
  }
  return `${result.error} ${result.hints.join(' ')}`;
}

function describeItem(item: Item): string {
  const kindTag = item.kind === ItemKind.Equipment ? 'EQ' : 'CO';
  return `[${kindTag}] ${item.name} — ${item.description}`;
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

/** Last rotation line from turn history (CLI banner helper). */
export function getLatestPhaseSummary(battle: Battle): string | null {
  const rows = battle.turnHistory.filter((h) => h.startsWith('Round '));
  if (rows.length === 0) return null;
  return rows[rows.length - 1];
}
