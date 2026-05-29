// Server-authoritative skills layer for multiplayer cyclic tic-tac-toe.
//
// The resolution math here mirrors the single-player implementation in
// site_src/pages/games/cyclic_tictactoe.ts, but lives on the server so neither
// client can fabricate energy, bypass cooldowns, or place skill marks the rules
// don't allow. The room owns a SkillCtx (board/history/skill sides) and these
// functions mutate it in place — same ownership pattern as applyMove.
/* eslint-disable no-param-reassign */

import {
  checkWin, type Cell, type PlayerSymbol,
} from './cyclicTicTacToe';

// Skills are only offered on grids this size or larger. Below it a single skill
// decides the game instantly, so the lobby refuses to enable them.
export const SKILL_MIN_SIZE = 8;
export const ENERGY_CAP = 10;
export const ENERGY_PER_TURN = 1;

export type SkillId = 'bomb' | 'dome' | 'collapse' | 'dissonance' | 'air';

export interface SkillMeta {
  name: string;
  cost: number;
  cooldown: number;
  target: boolean;
  desc: string;
}

// Tunable balance constants. cost in energy, cooldown in the caster's turns.
export const SKILLS: Record<SkillId, SkillMeta> = {
  bomb: {
    name: 'Bomb', cost: 7, cooldown: 12, target: true, desc: 'Fill a 3×3 area with your marks (overrides foes). Ends your turn.',
  },
  dome: {
    name: 'Iron Dome', cost: 4, cooldown: 10, target: false, desc: 'Deflect the next enemy skill (75%). Lasts 10 turns.',
  },
  collapse: {
    name: 'Collapse', cost: 0, cooldown: 0, target: false, desc: 'Clear the 2 most-filled lines. Once per game; foe gains +3⚡.',
  },
  dissonance: {
    name: 'Dissonance', cost: 6, cooldown: 14, target: false, desc: 'Foe misplaces (75%) for their next 5 turns.',
  },
  air: {
    name: 'Air Support', cost: 8, cooldown: 20, target: false, desc: 'A bonus auto-placed mark each of your next 5 turns.',
  },
};

export const SKILL_ORDER: SkillId[] = ['bomb', 'dome', 'collapse', 'dissonance', 'air'];

export interface SkillSide {
  energy: number;
  cd: { bomb: number; dome: number; dissonance: number; air: number };
  collapseUsed: boolean;
  shieldTurns: number; // Iron Dome: caster's turns remaining
  dissonanceTurns: number; // debuff turns remaining on this player as victim
  airTurns: number; // Air Support: caster's turns remaining
}

export function freshSkillSide(): SkillSide {
  return {
    energy: 0,
    cd: {
      bomb: 0, dome: 0, dissonance: 0, air: 0,
    },
    collapseUsed: false,
    shieldTurns: 0,
    dissonanceTurns: 0,
    airTurns: 0,
  };
}

export interface SkillCtx {
  board: Cell[];
  history: { X: number[]; O: number[] };
  size: number;
  markLimit: number;
  skills: { X: SkillSide; O: SkillSide };
}

// One entry in the per-room activity feed. `by` is the actor; clients phrase the
// event relative to themselves (you / opponent).
export type SkillEvent =
  | 'bomb' | 'dome' | 'air' | 'collapse' | 'dissonance'
  | 'dissonance_blocked' | 'bomb_blocked' | 'scramble';
export interface SkillLogEntry {
  by: PlayerSymbol;
  event: SkillEvent;
  at: number;
}
export const SKILL_LOG_CAP = 30;

export function otherSym(p: PlayerSymbol): PlayerSymbol {
  return p === 'X' ? 'O' : 'X';
}

export function canCast(ctx: SkillCtx, player: PlayerSymbol, id: SkillId): boolean {
  const meta = SKILLS[id];
  const st = ctx.skills[player];
  if (st.energy < meta.cost) return false;
  if (id === 'collapse') return !st.collapseUsed;
  return st.cd[id] === 0;
}

function spendSkill(st: SkillSide, id: SkillId) {
  const meta = SKILLS[id];
  st.energy = Math.max(0, st.energy - meta.cost);
  if (id !== 'collapse') st.cd[id] = meta.cooldown;
}

// Per-turn upkeep for the player who just completed a turn: gain energy, tick
// down cooldowns, and decay an active Iron Dome.
export function turnUpkeep(st: SkillSide) {
  st.energy = Math.min(ENERGY_CAP, st.energy + ENERGY_PER_TURN);
  (Object.keys(st.cd) as (keyof SkillSide['cd'])[]).forEach((k) => {
    if (st.cd[k] > 0) st.cd[k] -= 1;
  });
  if (st.shieldTurns > 0) st.shieldTurns -= 1;
}

function removeFromHistory(history: number[], idx: number) {
  const at = history.indexOf(idx);
  if (at !== -1) history.splice(at, 1);
}

// Every row, column and the two diagonals as arrays of cell indices.
function allLines(size: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r += 1) {
    const l: number[] = [];
    for (let i = 0; i < size; i += 1) l.push(r * size + i);
    lines.push(l);
  }
  for (let c = 0; c < size; c += 1) {
    const l: number[] = [];
    for (let i = 0; i < size; i += 1) l.push(i * size + c);
    lines.push(l);
  }
  const d1: number[] = [];
  const d2: number[] = [];
  for (let i = 0; i < size; i += 1) {
    d1.push(i * size + i);
    d2.push(i * size + (size - 1 - i));
  }
  lines.push(d1);
  lines.push(d2);
  return lines;
}

// Iron Dome: consume the shield to deflect an incoming skill (75%).
function tryBlock(ctx: SkillCtx, victim: PlayerSymbol): boolean {
  const st = ctx.skills[victim];
  if (st.shieldTurns > 0 && Math.random() < 0.75) {
    st.shieldTurns = 0;
    return true;
  }
  return false;
}

// ── Heuristic (ported from single-player bot) ─────────────────────────────
// Used by Air Support to drop a bonus mark for the caster.
function evaluatePosition(board: Cell[], size: number, index: number, player: PlayerSymbol): number {
  let score = 0;
  const r = Math.floor(index / size);
  const c = index % size;
  const dirs = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
  for (const { dr, dc } of dirs) {
    let count = 0;
    for (let step = 1; step < size; step += 1) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      const v = board[nr * size + nc];
      if (v === player) count += 1;
      else if (v !== null) { count = -1; break; }
    }
    if (count !== -1) {
      for (let step = 1; step < size; step += 1) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
        const v = board[nr * size + nc];
        if (v === player) count += 1;
        else if (v !== null) { count = -1; break; }
      }
    }
    if (count !== -1) score += 10 ** count;
  }
  return score;
}

export function heuristicMove(board: Cell[], size: number, me: PlayerSymbol): number | undefined {
  const opp = otherSym(me);
  const empty: number[] = [];
  for (let i = 0; i < board.length; i += 1) if (board[i] === null) empty.push(i);
  if (empty.length === 0) return undefined;
  for (const idx of empty) {
    const sim = board.slice();
    sim[idx] = me;
    if (checkWin(sim, size)) return idx;
  }
  for (const idx of empty) {
    const sim = board.slice();
    sim[idx] = opp;
    if (checkWin(sim, size)) return idx;
  }
  let bestScore = -Infinity;
  let bestIdx = empty[0];
  for (const idx of empty) {
    const r = Math.floor(idx / size);
    const c = idx % size;
    let score = -(Math.abs(r - (size - 1) / 2) + Math.abs(c - (size - 1) / 2));
    score += evaluatePosition(board, size, idx, me) * 1.5;
    score += evaluatePosition(board, size, idx, opp);
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  }
  return bestIdx;
}

// ── Resolution ─────────────────────────────────────────────────────────────

// Dissonance: the victim's chosen cell may be redirected to a random empty one.
// Decrements the victim's debuff counter. Returns the (possibly new) index and
// whether a scramble actually landed.
export function maybeDisrupt(
  ctx: SkillCtx,
  player: PlayerSymbol,
  index: number,
): { index: number; scrambled: boolean } {
  const st = ctx.skills[player];
  if (st.dissonanceTurns > 0) {
    st.dissonanceTurns -= 1;
    if (Math.random() < 0.75) {
      const empties: number[] = [];
      for (let i = 0; i < ctx.board.length; i += 1) {
        if (ctx.board[i] === null && i !== index) empties.push(i);
      }
      if (empties.length) {
        return { index: empties[Math.floor(Math.random() * empties.length)], scrambled: true };
      }
    }
  }
  return { index, scrambled: false };
}

// Air Support: if active, place one heuristic bonus mark for the caster. Returns
// the placed index (and any expired mark) so the room can paint/win-check, or
// null if no bonus was placed.
export function applyAirBonus(
  ctx: SkillCtx,
  player: PlayerSymbol,
): { placed: number; expired: number | null } | null {
  const st = ctx.skills[player];
  if (st.airTurns <= 0) return null;
  st.airTurns -= 1;
  const bonus = heuristicMove(ctx.board, ctx.size, player);
  if (bonus === undefined || ctx.board[bonus] !== null) return null;
  ctx.board[bonus] = player;
  ctx.history[player].push(bonus);
  let expired: number | null = null;
  if (ctx.history[player].length > ctx.markLimit) {
    const oldest = ctx.history[player].shift();
    if (oldest !== undefined) { ctx.board[oldest] = null; expired = oldest; }
  }
  return { placed: bonus, expired };
}

// Bomb: fill the 3×3 around centre with the caster's marks, overriding foes
// (unless their Iron Dome deflects the override). Enforces the cyclic hold cap.
// Caller spends energy and treats this as the caster's whole turn.
function resolveBomb(ctx: SkillCtx, player: PlayerSymbol, center: number): { blocked: boolean } {
  const opp = otherSym(player);
  const blocked = tryBlock(ctx, opp);
  const cr = Math.floor(center / ctx.size);
  const cc = center % ctx.size;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nr >= ctx.size || nc < 0 || nc >= ctx.size) continue;
      const idx = nr * ctx.size + nc;
      if (ctx.board[idx] === player) continue;
      if (ctx.board[idx] === opp) {
        if (blocked) continue; // shield protects existing enemy marks
        removeFromHistory(ctx.history[opp], idx);
      }
      ctx.board[idx] = player;
      ctx.history[player].push(idx);
    }
  }
  while (ctx.history[player].length > ctx.markLimit) {
    const oldest = ctx.history[player].shift();
    if (oldest !== undefined) ctx.board[oldest] = null;
  }
  return { blocked };
}

// Collapse: clear the two most-filled lines; foe gains tempo (+3 energy).
function resolveCollapse(ctx: SkillCtx, player: PlayerSymbol) {
  const lines = allLines(ctx.size);
  const occ = (line: number[]) => line.reduce((n, idx) => n + (ctx.board[idx] ? 1 : 0), 0);
  lines.sort((a, b) => occ(b) - occ(a));
  for (const line of lines.slice(0, 2)) {
    for (const idx of line) {
      const owner = ctx.board[idx];
      if (owner) { removeFromHistory(ctx.history[owner], idx); ctx.board[idx] = null; }
    }
  }
  ctx.skills[player].collapseUsed = true;
  const opp = otherSym(player);
  ctx.skills[opp].energy = Math.min(ENERGY_CAP, ctx.skills[opp].energy + 3);
}

export type CastOutcome =
  | { ok: false; reason: 'unknown_skill' | 'cannot_cast' | 'bad_target' }
  | {
    ok: true;
    consumesTurn: boolean; // true for Bomb
    events: SkillEvent[]; // activity-feed events attributed to the caster
  };

// Spend + resolve a skill for `player`. Mutates ctx. Does NOT advance the turn,
// run win checks, or persist — the room orchestrates that based on the result.
export function castSkill(
  ctx: SkillCtx,
  player: PlayerSymbol,
  id: SkillId,
  targetIndex?: number,
): CastOutcome {
  if (!(id in SKILLS)) return { ok: false, reason: 'unknown_skill' };
  if (!canCast(ctx, player, id)) return { ok: false, reason: 'cannot_cast' };
  const opp = otherSym(player);

  if (id === 'bomb') {
    if (!Number.isInteger(targetIndex) || (targetIndex as number) < 0
      || (targetIndex as number) >= ctx.board.length) {
      return { ok: false, reason: 'bad_target' };
    }
    spendSkill(ctx.skills[player], id);
    const { blocked } = resolveBomb(ctx, player, targetIndex as number);
    return { ok: true, consumesTurn: true, events: blocked ? ['bomb', 'bomb_blocked'] : ['bomb'] };
  }

  spendSkill(ctx.skills[player], id);
  if (id === 'dome') {
    ctx.skills[player].shieldTurns = 10;
    return { ok: true, consumesTurn: false, events: ['dome'] };
  }
  if (id === 'air') {
    ctx.skills[player].airTurns = 5;
    return { ok: true, consumesTurn: false, events: ['air'] };
  }
  if (id === 'dissonance') {
    if (tryBlock(ctx, opp)) {
      return { ok: true, consumesTurn: false, events: ['dissonance_blocked'] };
    }
    ctx.skills[opp].dissonanceTurns = 5;
    return { ok: true, consumesTurn: false, events: ['dissonance'] };
  }
  // collapse
  resolveCollapse(ctx, player);
  return { ok: true, consumesTurn: false, events: ['collapse'] };
}
