// applyMove mutates the passed-in MoveState in place by design — the caller
// owns the state container and we'd otherwise have to clone the board on every
// move. Disable the mutation rule for this file only.
/* eslint-disable no-param-reassign */

export type PlayerSymbol = 'X' | 'O';
export type Cell = PlayerSymbol | null;

export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 15;

export function clampBoardSize(n: number): number {
  if (!Number.isFinite(n)) return MIN_BOARD_SIZE;
  const i = Math.trunc(n);
  if (i < MIN_BOARD_SIZE) return MIN_BOARD_SIZE;
  if (i > MAX_BOARD_SIZE) return MAX_BOARD_SIZE;
  return i;
}

export function markLimitFor(size: number): number {
  return Math.ceil(1.5 * size);
}

export function emptyBoard(size: number): Cell[] {
  return new Array(size * size).fill(null);
}

export interface WinInfo {
  winner: PlayerSymbol;
  line: number[];
}

export function checkWin(b: Cell[], s: number): WinInfo | null {
  for (let r = 0; r < s; r += 1) {
    const start = r * s;
    const first = b[start];
    if (first) {
      let win = true;
      const line: number[] = [];
      for (let i = 0; i < s; i += 1) {
        line.push(start + i);
        if (b[start + i] !== first) { win = false; break; }
      }
      if (win) return { winner: first, line };
    }
  }
  for (let c = 0; c < s; c += 1) {
    const first = b[c];
    if (first) {
      let win = true;
      const line: number[] = [];
      for (let i = 0; i < s; i += 1) {
        line.push(i * s + c);
        if (b[i * s + c] !== first) { win = false; break; }
      }
      if (win) return { winner: first, line };
    }
  }
  let d1 = true;
  let d2 = true;
  const l1: number[] = [];
  const l2: number[] = [];
  for (let i = 0; i < s; i += 1) {
    l1.push(i * s + i);
    if (b[i * s + i] !== b[0]) d1 = false;
    l2.push(i * s + (s - 1 - i));
    if (b[i * s + (s - 1 - i)] !== b[s - 1]) d2 = false;
  }
  if (d1 && b[0]) return { winner: b[0] as PlayerSymbol, line: l1 };
  if (d2 && b[s - 1]) return { winner: b[s - 1] as PlayerSymbol, line: l2 };
  return null;
}

export interface ApplyMoveOk {
  ok: true;
  expired: number | null;
}
export interface ApplyMoveErr {
  ok: false;
  reason: 'out_of_range' | 'cell_taken';
}
export type ApplyMoveResult = ApplyMoveOk | ApplyMoveErr;

export interface MoveState {
  board: Cell[];
  history: { X: number[]; O: number[] };
  size: number;
  markLimit: number;
}

// Mutates state in place. Caller is responsible for turn ownership / game-active
// checks; this only enforces structural validity and the cyclic mark-expiry rule.
export function applyMove(state: MoveState, player: PlayerSymbol, index: number): ApplyMoveResult {
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length) {
    return { ok: false, reason: 'out_of_range' };
  }
  if (state.board[index] !== null) {
    return { ok: false, reason: 'cell_taken' };
  }
  state.board[index] = player;
  state.history[player].push(index);
  let expired: number | null = null;
  if (state.history[player].length > state.markLimit) {
    const oldest = state.history[player].shift();
    if (oldest !== undefined) {
      state.board[oldest] = null;
      expired = oldest;
    }
  }
  return { ok: true, expired };
}
