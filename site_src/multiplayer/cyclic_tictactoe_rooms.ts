// RoomManager owns the lifetime of every MatchRoom object — the rest of the
// module mutates rooms in place as the canonical pattern. Cloning each room on
// every state transition would be much more expensive and would lose object
// identity that the WS handlers rely on (e.g. socket sets).
/* eslint-disable no-param-reassign */
// In-memory match room manager for multiplayer cyclic tic-tac-toe.
//
// All state lives in this process. A Bun restart drops every active room —
// completed matches are the only thing persisted (via db.cyclicTttMatch on end).
// Active games show "match ended" on the client when they reconnect and find
// no room with that id.

import { randomBytes } from 'node:crypto';
import type { WSContext } from 'hono/ws';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  applyMove, checkWin, clampBoardSize, emptyBoard, markLimitFor,
  type Cell, type PlayerSymbol,
} from './cyclicTicTacToe';

export type RoomStatus = 'waiting' | 'active' | 'ended';
export type EndReason = 'win' | 'draw' | 'timeout' | 'disconnect' | 'forfeit';

export interface PlayerSlot {
  discordId: string;
  username: string;
  avatarURL: string | null;
  symbol: PlayerSymbol;
  sockets: Set<WSContext>;
  rematchAccepted: boolean;
}

export interface MatchRoom {
  id: string;
  boardSize: number;
  markLimit: number;
  board: Cell[];
  history: { X: number[]; O: number[] };
  currentPlayer: PlayerSymbol;
  status: RoomStatus;
  players: { X?: PlayerSlot; O?: PlayerSlot };
  creatorDiscordId: string;
  creatorUsername: string;
  creatorAvatarURL: string | null;
  turnDeadline: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  result: { winner: PlayerSymbol | null; line?: number[]; reason: EndReason } | null;
  createdAt: number;
  endedAt: number | null;
  lastActivityAt: number;
}

export interface PublicPlayer {
  discordId: string;
  username: string;
  avatarURL: string | null;
  symbol: PlayerSymbol;
  connected: boolean;
  rematchAccepted: boolean;
}

export interface RoomSnapshot {
  id: string;
  boardSize: number;
  markLimit: number;
  board: Cell[];
  history: { X: number[]; O: number[] };
  currentPlayer: PlayerSymbol;
  status: RoomStatus;
  turnDeadline: number | null;
  result: { winner: PlayerSymbol | null; line?: number[]; reason: EndReason } | null;
  players: { X: PublicPlayer | null; O: PublicPlayer | null };
  creator: { discordId: string; username: string; avatarURL: string | null };
}

export interface UserInfo {
  discordId: string;
  username: string;
  avatarURL: string | null;
}

export const TURN_TIMER_MS = 25_000;
export const DISCONNECT_GRACE_MS = 30_000;
const ABANDONED_MS = 2 * 60_000;
const WAITING_TTL_MS = 10 * 60_000;
const ENDED_TTL_MS = 5 * 60_000;
export const ROOMS_PER_USER_CAP = 5;
const GC_SWEEP_MS = 60_000;

export type CreateResult =
  | { ok: true; room: MatchRoom }
  | { ok: false; reason: 'too_many_rooms' };

export type AttachResult =
  | { ok: true; slot: PlayerSlot; firstSeat: boolean }
  | { ok: false; reason: 'room_full' | 'self_play' | 'game_ended' };

class RoomManager {
  private rooms = new Map<string, MatchRoom>();

  private silverwolf: Silverwolf | null = null;

  private gcStarted = false;

  init(silverwolf: Silverwolf) {
    this.silverwolf = silverwolf;
    if (!this.gcStarted) {
      this.gcStarted = true;
      const interval = setInterval(() => this.sweep(), GC_SWEEP_MS);
      // Don't let the GC keep the process alive on shutdown.
      if (typeof (interval as { unref?: () => void }).unref === 'function') {
        (interval as { unref: () => void }).unref();
      }
    }
  }

  createRoom(creator: UserInfo, boardSize: number): CreateResult {
    const active = [...this.rooms.values()].filter(
      (r) => r.creatorDiscordId === creator.discordId && r.status !== 'ended',
    );
    if (active.length >= ROOMS_PER_USER_CAP) return { ok: false, reason: 'too_many_rooms' };

    const n = clampBoardSize(boardSize);
    const id = randomBytes(16).toString('base64url');
    const now = Date.now();
    const room: MatchRoom = {
      id,
      boardSize: n,
      markLimit: markLimitFor(n),
      board: emptyBoard(n),
      history: { X: [], O: [] },
      currentPlayer: 'X',
      status: 'waiting',
      players: {
        X: {
          discordId: creator.discordId,
          username: creator.username,
          avatarURL: creator.avatarURL,
          symbol: 'X',
          sockets: new Set(),
          rematchAccepted: false,
        },
      },
      creatorDiscordId: creator.discordId,
      creatorUsername: creator.username,
      creatorAvatarURL: creator.avatarURL,
      turnDeadline: null,
      turnTimer: null,
      disconnectTimers: new Map(),
      result: null,
      createdAt: now,
      endedAt: null,
      lastActivityAt: now,
    };
    this.rooms.set(id, room);
    return { ok: true, room };
  }

  getRoom(id: string): MatchRoom | null {
    return this.rooms.get(id) ?? null;
  }

  listForUser(discordId: string): MatchRoom[] {
    return [...this.rooms.values()].filter(
      (r) => r.status !== 'ended'
        && (r.creatorDiscordId === discordId
          || r.players.X?.discordId === discordId
          || r.players.O?.discordId === discordId),
    );
  }

  // Seat (or re-seat) a user on this room via an open WebSocket.
  attachSocket(room: MatchRoom, user: UserInfo, ws: WSContext): AttachResult {
    // Re-attach to the existing seat for multi-tab / reconnect.
    if (room.players.X?.discordId === user.discordId) {
      const slot = room.players.X;
      slot.sockets.add(ws);
      this.cancelDisconnect(room, user.discordId);
      room.lastActivityAt = Date.now();
      return { ok: true, slot, firstSeat: false };
    }
    if (room.players.O?.discordId === user.discordId) {
      const slot = room.players.O;
      slot.sockets.add(ws);
      this.cancelDisconnect(room, user.discordId);
      room.lastActivityAt = Date.now();
      return { ok: true, slot, firstSeat: false };
    }

    if (room.status === 'ended') return { ok: false, reason: 'game_ended' };
    if (room.players.X && room.players.O) return { ok: false, reason: 'room_full' };

    // Empty O seat. Refuse if the same Discord ID already owns X.
    if (room.players.X && room.players.X.discordId === user.discordId) {
      return { ok: false, reason: 'self_play' };
    }
    const newSlot: PlayerSlot = {
      discordId: user.discordId,
      username: user.username,
      avatarURL: user.avatarURL,
      symbol: 'O',
      sockets: new Set([ws]),
      rematchAccepted: false,
    };
    room.players.O = newSlot;
    this.startGame(room);
    room.lastActivityAt = Date.now();
    return { ok: true, slot: newSlot, firstSeat: true };
  }

  // HTTP /join — seat the second player before they open the WebSocket so the
  // room page renders with the joiner already shown.
  seatJoiner(room: MatchRoom, user: UserInfo):
    { ok: true } | { ok: false; reason: 'room_full' | 'self_play' | 'game_ended' | 'already_seated' } {
    if (room.players.X?.discordId === user.discordId) return { ok: true };
    if (room.players.O?.discordId === user.discordId) return { ok: true };
    if (room.status === 'ended') return { ok: false, reason: 'game_ended' };
    if (room.players.X && room.players.O) return { ok: false, reason: 'room_full' };
    if (room.players.X && room.players.X.discordId === user.discordId) {
      return { ok: false, reason: 'self_play' };
    }
    room.players.O = {
      discordId: user.discordId,
      username: user.username,
      avatarURL: user.avatarURL,
      symbol: 'O',
      sockets: new Set(),
      rematchAccepted: false,
    };
    this.startGame(room);
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  applyMoveFromUser(room: MatchRoom, user: UserInfo, index: number):
    { ok: true } | { ok: false; reason: string } {
    if (room.status !== 'active') return { ok: false, reason: 'game_not_active' };
    const slot = room.players[room.currentPlayer];
    if (!slot || slot.discordId !== user.discordId) return { ok: false, reason: 'not_your_turn' };
    const res = applyMove(
      {
        board: room.board, history: room.history, size: room.boardSize, markLimit: room.markLimit,
      },
      room.currentPlayer,
      index,
    );
    if (!res.ok) return { ok: false, reason: res.reason };
    const win = checkWin(room.board, room.boardSize);
    if (win) {
      this.endRoom(room, { winner: win.winner, line: win.line, reason: 'win' });
    } else if (!room.board.includes(null)) {
      this.endRoom(room, { winner: null, reason: 'draw' });
    } else {
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      this.setTurnTimer(room);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  requestRematch(room: MatchRoom, user: UserInfo): { ok: boolean; reason?: string } {
    if (room.status !== 'ended') return { ok: false, reason: 'game_not_ended' };
    const slot = this.slotFor(room, user.discordId);
    if (!slot) return { ok: false, reason: 'not_player' };
    slot.rematchAccepted = true;
    const x = room.players.X;
    const o = room.players.O;
    if (x && o && x.rematchAccepted && o.rematchAccepted) {
      // Swap symbols so each player alternates first-move privilege across games.
      const newX: PlayerSlot = {
        discordId: o.discordId,
        username: o.username,
        avatarURL: o.avatarURL,
        symbol: 'X',
        sockets: o.sockets,
        rematchAccepted: false,
      };
      const newO: PlayerSlot = {
        discordId: x.discordId,
        username: x.username,
        avatarURL: x.avatarURL,
        symbol: 'O',
        sockets: x.sockets,
        rematchAccepted: false,
      };
      room.players.X = newX;
      room.players.O = newO;
      room.board = emptyBoard(room.boardSize);
      room.history = { X: [], O: [] };
      room.result = null;
      room.endedAt = null;
      // Reset so the next match record's createdAt..endedAt window measures
      // the rematch itself, not the original lobby creation.
      room.createdAt = Date.now();
      this.startGame(room);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  leaveRoom(room: MatchRoom, user: UserInfo) {
    const slot = this.slotFor(room, user.discordId);
    if (!slot) return;
    if (room.status === 'active') {
      const winner: PlayerSymbol = slot.symbol === 'X' ? 'O' : 'X';
      this.endRoom(room, { winner, reason: 'forfeit' });
    } else if (room.status === 'waiting' && room.creatorDiscordId === user.discordId) {
      this.endRoom(room, { winner: null, reason: 'disconnect' });
    }
    const sockets = [...slot.sockets];
    slot.sockets.clear();
    for (const ws of sockets) {
      try { ws.close(1000, 'left'); } catch { /* already closed */ }
    }
  }

  // Called from WS onClose.
  detachSocket(room: MatchRoom, ws: WSContext, discordId: string) {
    const slot = this.slotFor(room, discordId);
    if (!slot) return;
    slot.sockets.delete(ws);
    if (slot.sockets.size === 0 && room.status === 'active') {
      this.startDisconnectTimer(room, slot);
    }
    room.lastActivityAt = Date.now();
  }

  private slotFor(room: MatchRoom, discordId: string): PlayerSlot | null {
    if (room.players.X?.discordId === discordId) return room.players.X;
    if (room.players.O?.discordId === discordId) return room.players.O;
    return null;
  }

  private startGame(room: MatchRoom) {
    room.status = 'active';
    room.currentPlayer = 'X';
    this.setTurnTimer(room);
  }

  private setTurnTimer(room: MatchRoom) {
    this.clearTurnTimer(room);
    room.turnDeadline = Date.now() + TURN_TIMER_MS;
    room.turnTimer = setTimeout(() => {
      // Re-check at fire time: a race with applyMoveFromUser shouldn't be possible
      // (JS is single-threaded) but if the room ended via another path, skip.
      if (room.status !== 'active') return;
      const loser = room.currentPlayer;
      const winner: PlayerSymbol = loser === 'X' ? 'O' : 'X';
      this.endRoom(room, { winner, reason: 'timeout' });
      this.broadcast(room);
    }, TURN_TIMER_MS);
  }

  private clearTurnTimer(room: MatchRoom) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnDeadline = null;
  }

  private startDisconnectTimer(room: MatchRoom, slot: PlayerSlot) {
    this.cancelDisconnect(room, slot.discordId);
    const timer = setTimeout(() => {
      const current = this.slotFor(room, slot.discordId);
      if (!current || current.sockets.size > 0) return;
      if (room.status !== 'active') return;
      const winner: PlayerSymbol = current.symbol === 'X' ? 'O' : 'X';
      this.endRoom(room, { winner, reason: 'disconnect' });
      this.broadcast(room);
    }, DISCONNECT_GRACE_MS);
    room.disconnectTimers.set(slot.discordId, timer);
  }

  private cancelDisconnect(room: MatchRoom, discordId: string) {
    const t = room.disconnectTimers.get(discordId);
    if (t) {
      clearTimeout(t);
      room.disconnectTimers.delete(discordId);
    }
  }

  private endRoom(
    room: MatchRoom,
    result: { winner: PlayerSymbol | null; line?: number[]; reason: EndReason },
  ) {
    if (room.status === 'ended') return;
    this.clearTurnTimer(room);
    for (const t of room.disconnectTimers.values()) clearTimeout(t);
    room.disconnectTimers.clear();
    room.result = result;
    room.status = 'ended';
    room.endedAt = Date.now();
    room.lastActivityAt = room.endedAt;

    const x = room.players.X;
    const o = room.players.O;
    if (this.silverwolf && x && o) {
      let winnerDiscordId: string | null = null;
      if (result.winner === 'X') winnerDiscordId = x.discordId;
      else if (result.winner === 'O') winnerDiscordId = o.discordId;
      // The match record id must be unique per *game*; room.id is reused across
      // rematches, so we generate a fresh id here.
      this.silverwolf.db.cyclicTttMatch.recordMatch({
        id: randomBytes(16).toString('base64url'),
        xDiscordId: x.discordId,
        oDiscordId: o.discordId,
        winnerDiscordId,
        endReason: result.reason,
        boardSize: room.boardSize,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
      }).catch((err: unknown) => logError('cyclic-ttt match record failed:', err));
    }
  }

  snapshot(room: MatchRoom): RoomSnapshot {
    const pub = (slot?: PlayerSlot): PublicPlayer | null => (slot ? {
      discordId: slot.discordId,
      username: slot.username,
      avatarURL: slot.avatarURL,
      symbol: slot.symbol,
      connected: slot.sockets.size > 0,
      rematchAccepted: slot.rematchAccepted,
    } : null);
    return {
      id: room.id,
      boardSize: room.boardSize,
      markLimit: room.markLimit,
      board: room.board,
      history: { X: [...room.history.X], O: [...room.history.O] },
      currentPlayer: room.currentPlayer,
      status: room.status,
      turnDeadline: room.turnDeadline,
      result: room.result,
      players: { X: pub(room.players.X), O: pub(room.players.O) },
      creator: {
        discordId: room.creatorDiscordId,
        username: room.creatorUsername,
        avatarURL: room.creatorAvatarURL,
      },
    };
  }

  broadcast(room: MatchRoom) {
    const msg = JSON.stringify({ type: 'state', room: this.snapshot(room) });
    for (const sym of ['X', 'O'] as const) {
      const slot = room.players[sym];
      if (!slot) continue;
      for (const ws of slot.sockets) {
        try { ws.send(msg); } catch { /* socket closing; will be detached */ }
      }
    }
  }

  private sweep() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      if (room.status === 'waiting' && now - room.createdAt > WAITING_TTL_MS) {
        this.endRoom(room, { winner: null, reason: 'disconnect' });
        this.rooms.delete(id);
      } else if (room.status === 'ended' && room.endedAt && now - room.endedAt > ENDED_TTL_MS) {
        this.rooms.delete(id);
      } else if (room.status === 'active') {
        const xConnected = (room.players.X?.sockets.size ?? 0) > 0;
        const oConnected = (room.players.O?.sockets.size ?? 0) > 0;
        if (!xConnected && !oConnected && now - room.lastActivityAt > ABANDONED_MS) {
          this.endRoom(room, { winner: null, reason: 'disconnect' });
          this.rooms.delete(id);
        }
      }
    }
  }
}

export const roomManager = new RoomManager();
