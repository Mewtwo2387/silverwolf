// RoomManager owns the lifetime of every Battleships MatchRoom. Rooms are
// mutated in place (the WS handlers hold object identity, e.g. socket sets), so
// the no-param-reassign rule is disabled for this file as in the cyclic-TTT
// manager.
/* eslint-disable no-param-reassign */
//
// All state lives in this process. A Bun restart drops every active room;
// completed matches are the only thing persisted (db.battleshipsMatch on end).
//
// SECURITY MODEL: the server is fully authoritative and snapshots are built
// PER VIEWER (`snapshotFor`). A player only ever receives their own fleet plus
// the hit/miss result of their own shots — the opponent's un-sunk ship
// positions never cross the wire until the match ends. Never broadcast a single
// shared snapshot the way a symmetric-information game (cyclic TTT) can.

import { randomBytes } from 'node:crypto';
import type { WSContext } from 'hono/ws';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  BOARD_CELLS, FLEET, SIZE, validateFleet, randomFleet,
  type PlayerSymbol, type ShipPlacement,
} from './battleships';

export type RoomStatus = 'waiting' | 'placing' | 'active' | 'ended';
export type EndReason = 'win' | 'disconnect' | 'forfeit';
export type ShotResult = 'hit' | 'miss';

interface ShipState {
  id: string;
  len: number;
  cells: number[];
  hits: Set<number>;
}

interface SideState {
  fleet: ShipState[] | null;
  placed: boolean;
  // Shots that have landed on THIS side's board (keyed by cell index).
  incoming: Map<number, ShotResult>;
}

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
  status: RoomStatus;
  currentPlayer: PlayerSymbol;
  sides: { X: SideState; O: SideState };
  players: { X?: PlayerSlot; O?: PlayerSlot };
  creatorDiscordId: string;
  creatorUsername: string;
  creatorAvatarURL: string | null;
  placeDeadline: number | null;
  placeTimer: ReturnType<typeof setTimeout> | null;
  turnDeadline: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  result: { winner: PlayerSymbol | null; reason: EndReason } | null;
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

export interface FleetStatusEntry {
  id: string;
  name: string;
  len: number;
  sunk: boolean;
}

export interface RevealedShip {
  id: string;
  cells: number[];
}

// What a single seated viewer is allowed to see. Built fresh per recipient.
export interface ViewerSnapshot {
  id: string;
  status: RoomStatus;
  size: number;
  currentPlayer: PlayerSymbol;
  turnDeadline: number | null;
  placeDeadline: number | null;
  you: PlayerSymbol | null;
  youPlaced: boolean;
  opponentPlaced: boolean;
  // Own board.
  yourShips: RevealedShip[] | null;
  yourIncoming: (ShotResult | null)[];
  yourFleet: FleetStatusEntry[];
  // Enemy board (radar) — only your own shot results + revealed (sunk) ships.
  yourShots: (ShotResult | null)[];
  enemyFleet: FleetStatusEntry[];
  enemyRevealed: RevealedShip[];
  result: { winner: PlayerSymbol | null; reason: EndReason } | null;
  players: { X: PublicPlayer | null; O: PublicPlayer | null };
  creator: { discordId: string; username: string; avatarURL: string | null };
}

export interface UserInfo {
  discordId: string;
  username: string;
  avatarURL: string | null;
}

export const PLACE_TIMER_MS = 120_000;
export const TURN_TIMER_MS = 30_000;
export const DISCONNECT_GRACE_MS = 30_000;
const ABANDONED_MS = 2 * 60_000;
const WAITING_TTL_MS = 10 * 60_000;
const ENDED_TTL_MS = 5 * 60_000;
export const ROOMS_PER_USER_CAP = 5;
// Coarse process-wide ceiling; the per-user cap is the load-bearing limit.
export const MAX_ACTIVE_ROOMS_GLOBAL = 5_000;
const GC_SWEEP_MS = 60_000;

export type CreateResult =
  | { ok: true; room: MatchRoom }
  | { ok: false; reason: 'too_many_rooms' | 'server_full' };

export type AttachResult =
  | { ok: true; slot: PlayerSlot; firstSeat: boolean }
  | { ok: false; reason: 'room_full' | 'game_ended' };

function freshSide(): SideState {
  return { fleet: null, placed: false, incoming: new Map() };
}

function buildFleet(placement: ShipPlacement[]): ShipState[] {
  return placement.map((p) => ({
    id: p.id,
    len: p.cells.length,
    cells: [...p.cells],
    hits: new Set<number>(),
  }));
}

function allSunk(side: SideState): boolean {
  if (!side.fleet) return false;
  return side.fleet.every((s) => s.hits.size === s.len);
}

function other(sym: PlayerSymbol): PlayerSymbol {
  return sym === 'X' ? 'O' : 'X';
}

class BattleshipsRoomManager {
  private rooms = new Map<string, MatchRoom>();

  private silverwolf: Silverwolf | null = null;

  private gcStarted = false;

  init(silverwolf: Silverwolf) {
    this.silverwolf = silverwolf;
    if (!this.gcStarted) {
      this.gcStarted = true;
      const interval = setInterval(() => this.sweep(), GC_SWEEP_MS);
      if (typeof (interval as { unref?: () => void }).unref === 'function') {
        (interval as { unref: () => void }).unref();
      }
    }
  }

  createRoom(creator: UserInfo): CreateResult {
    if (this.rooms.size >= MAX_ACTIVE_ROOMS_GLOBAL) return { ok: false, reason: 'server_full' };
    // Count all of the creator's rooms incl. 'ended' ones pending GC, so a user
    // can't cycle through unlimited lingering rooms to evade the cap.
    const own = [...this.rooms.values()].filter((r) => r.creatorDiscordId === creator.discordId);
    if (own.length >= ROOMS_PER_USER_CAP) return { ok: false, reason: 'too_many_rooms' };

    const id = randomBytes(16).toString('base64url');
    const now = Date.now();
    const room: MatchRoom = {
      id,
      status: 'waiting',
      currentPlayer: 'X',
      sides: { X: freshSide(), O: freshSide() },
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
      placeDeadline: null,
      placeTimer: null,
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

    // Seat as O. Self-play is impossible: if X is this user the branch above
    // returns first.
    const newSlot: PlayerSlot = {
      discordId: user.discordId,
      username: user.username,
      avatarURL: user.avatarURL,
      symbol: 'O',
      sockets: new Set([ws]),
      rematchAccepted: false,
    };
    room.players.O = newSlot;
    this.beginPlacement(room);
    room.lastActivityAt = Date.now();
    return { ok: true, slot: newSlot, firstSeat: true };
  }

  // ── Placement ───────────────────────────────────────────────────────────
  private beginPlacement(room: MatchRoom) {
    room.status = 'placing';
    room.sides.X = freshSide();
    room.sides.O = freshSide();
    this.clearPlaceTimer(room);
    room.placeDeadline = Date.now() + PLACE_TIMER_MS;
    room.placeTimer = setTimeout(() => {
      if (room.status !== 'placing') return;
      // Auto-place anyone who didn't submit in time so the match can proceed.
      for (const sym of ['X', 'O'] as const) {
        if (!room.sides[sym].placed) {
          this.seatFleet(room, sym, randomFleet());
        }
      }
      this.startBattle(room);
      this.broadcast(room);
    }, PLACE_TIMER_MS);
  }

  private seatFleet(room: MatchRoom, sym: PlayerSymbol, placement: ShipPlacement[]) {
    room.sides[sym] = { fleet: buildFleet(placement), placed: true, incoming: new Map() };
  }

  submitPlacement(room: MatchRoom, user: UserInfo, fleetInput: unknown):
    { ok: true } | { ok: false; reason: string } {
    if (room.status !== 'placing') return { ok: false, reason: 'not_placing' };
    const sym = this.symbolFor(room, user.discordId);
    if (!sym) return { ok: false, reason: 'not_player' };
    if (room.sides[sym].placed) return { ok: false, reason: 'already_placed' };

    const validated = validateFleet(fleetInput);
    if (!validated.ok) return { ok: false, reason: `invalid_placement:${validated.reason}` };

    this.seatFleet(room, sym, validated.fleet);
    if (room.sides.X.placed && room.sides.O.placed) {
      this.startBattle(room);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  // ── Battle ──────────────────────────────────────────────────────────────
  private startBattle(room: MatchRoom) {
    this.clearPlaceTimer(room);
    room.status = 'active';
    room.currentPlayer = 'X';
    this.setTurnTimer(room);
  }

  // Resolve a shot at `targetSym`'s board. Mutates the target side. Returns
  // whether it sank the firer's win condition.
  private resolveShot(room: MatchRoom, targetSym: PlayerSymbol, index: number): boolean {
    const side = room.sides[targetSym];
    if (!side.fleet) return false;
    let result: ShotResult = 'miss';
    for (const ship of side.fleet) {
      if (ship.cells.includes(index)) {
        ship.hits.add(index);
        result = 'hit';
        break;
      }
    }
    side.incoming.set(index, result);
    return allSunk(side);
  }

  applyShotFromUser(room: MatchRoom, user: UserInfo, index: number):
    { ok: true } | { ok: false; reason: string } {
    if (room.status !== 'active') return { ok: false, reason: 'game_not_active' };
    const slot = room.players[room.currentPlayer];
    if (!slot || slot.discordId !== user.discordId) return { ok: false, reason: 'not_your_turn' };
    if (!Number.isInteger(index) || index < 0 || index >= BOARD_CELLS) {
      return { ok: false, reason: 'out_of_range' };
    }
    const targetSym = other(room.currentPlayer);
    if (room.sides[targetSym].incoming.has(index)) return { ok: false, reason: 'already_shot' };

    const firer = room.currentPlayer;
    const won = this.resolveShot(room, targetSym, index);
    if (won) {
      this.endRoom(room, { winner: firer, reason: 'win' });
    } else {
      room.currentPlayer = targetSym;
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
      // Swap seats so the player who went second now fires first.
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
      room.result = null;
      room.endedAt = null;
      room.createdAt = Date.now();
      this.beginPlacement(room);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  leaveRoom(room: MatchRoom, user: UserInfo) {
    const slot = this.slotFor(room, user.discordId);
    if (!slot) return;
    if (room.status === 'active' || room.status === 'placing') {
      this.endRoom(room, { winner: other(slot.symbol), reason: 'forfeit' });
    } else if (room.status === 'waiting' && room.creatorDiscordId === user.discordId) {
      this.endRoom(room, { winner: null, reason: 'disconnect' });
    }
    const sockets = [...slot.sockets];
    slot.sockets.clear();
    for (const ws of sockets) {
      try { ws.close(1000, 'left'); } catch { /* already closed */ }
    }
  }

  detachSocket(room: MatchRoom, ws: WSContext, discordId: string) {
    if (!this.rooms.has(room.id)) return;
    const slot = this.slotFor(room, discordId);
    if (!slot) return;
    slot.sockets.delete(ws);
    if (slot.sockets.size === 0 && (room.status === 'active' || room.status === 'placing')) {
      this.startDisconnectTimer(room, slot);
    }
    room.lastActivityAt = Date.now();
  }

  private symbolFor(room: MatchRoom, discordId: string): PlayerSymbol | null {
    if (room.players.X?.discordId === discordId) return 'X';
    if (room.players.O?.discordId === discordId) return 'O';
    return null;
  }

  private slotFor(room: MatchRoom, discordId: string): PlayerSlot | null {
    const sym = this.symbolFor(room, discordId);
    return sym ? room.players[sym] ?? null : null;
  }

  private setTurnTimer(room: MatchRoom) {
    this.clearTurnTimer(room);
    room.turnDeadline = Date.now() + TURN_TIMER_MS;
    room.turnTimer = setTimeout(() => {
      if (room.status !== 'active') return;
      // Auto-fire a random un-shot cell so a slow/AFK turn doesn't instantly
      // lose the whole match (disconnects are handled separately by forfeit).
      const targetSym = other(room.currentPlayer);
      const idx = this.randomUnshotCell(room, targetSym);
      if (idx === null) return; // board exhausted (unreachable before a win)
      const firer = room.currentPlayer;
      const won = this.resolveShot(room, targetSym, idx);
      if (won) {
        this.endRoom(room, { winner: firer, reason: 'win' });
      } else {
        room.currentPlayer = targetSym;
        this.setTurnTimer(room);
      }
      room.lastActivityAt = Date.now();
      this.broadcast(room);
    }, TURN_TIMER_MS);
  }

  private randomUnshotCell(room: MatchRoom, targetSym: PlayerSymbol): number | null {
    const taken = room.sides[targetSym].incoming;
    const free: number[] = [];
    for (let i = 0; i < BOARD_CELLS; i += 1) {
      if (!taken.has(i)) free.push(i);
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  private clearTurnTimer(room: MatchRoom) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnDeadline = null;
  }

  private clearPlaceTimer(room: MatchRoom) {
    if (room.placeTimer) clearTimeout(room.placeTimer);
    room.placeTimer = null;
    room.placeDeadline = null;
  }

  private startDisconnectTimer(room: MatchRoom, slot: PlayerSlot) {
    this.cancelDisconnect(room, slot.discordId);
    const timer = setTimeout(() => {
      const current = this.slotFor(room, slot.discordId);
      if (!current || current.sockets.size > 0) return;
      if (room.status !== 'active' && room.status !== 'placing') return;
      this.endRoom(room, { winner: other(current.symbol), reason: 'disconnect' });
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

  private endRoom(room: MatchRoom, result: { winner: PlayerSymbol | null; reason: EndReason }) {
    if (room.status === 'ended') return;
    this.clearTurnTimer(room);
    this.clearPlaceTimer(room);
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
      // room.id is reused across rematches; generate a fresh per-game id.
      this.silverwolf.db.battleshipsMatch.recordMatch({
        id: randomBytes(16).toString('base64url'),
        xDiscordId: x.discordId,
        oDiscordId: o.discordId,
        winnerDiscordId,
        endReason: result.reason,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
      }).catch((err: unknown) => logError('battleships match record failed:', err));
    }
  }

  // ── Per-viewer snapshot ───────────────────────────────────────────────────
  private fleetStatus(side: SideState): FleetStatusEntry[] {
    return FLEET.map((def) => {
      const ship = side.fleet?.find((s) => s.id === def.id) ?? null;
      const sunk = ship ? ship.hits.size === ship.len : false;
      return {
        id: def.id, name: def.name, len: def.len, sunk,
      };
    });
  }

  private incomingArray(side: SideState): (ShotResult | null)[] {
    const arr: (ShotResult | null)[] = new Array(BOARD_CELLS).fill(null);
    for (const [idx, res] of side.incoming) arr[idx] = res;
    return arr;
  }

  // Ships of `side` that are allowed to be shown to the opponent: sunk ships
  // during play, or the whole fleet once the match has ended (reveal).
  private revealedShips(side: SideState, full: boolean): RevealedShip[] {
    if (!side.fleet) return [];
    return side.fleet
      .filter((s) => full || s.hits.size === s.len)
      .map((s) => ({ id: s.id, cells: [...s.cells] }));
  }

  snapshotFor(room: MatchRoom, discordId: string | null): ViewerSnapshot {
    const pub = (slot?: PlayerSlot): PublicPlayer | null => (slot ? {
      discordId: slot.discordId,
      username: slot.username,
      avatarURL: slot.avatarURL,
      symbol: slot.symbol,
      connected: slot.sockets.size > 0,
      rematchAccepted: slot.rematchAccepted,
    } : null);

    const you = discordId ? this.symbolFor(room, discordId) : null;
    const ended = room.status === 'ended';
    const mySide = you ? room.sides[you] : null;
    const foeSym = you ? other(you) : null;
    const foeSide = foeSym ? room.sides[foeSym] : null;

    return {
      id: room.id,
      status: room.status,
      size: SIZE,
      currentPlayer: room.currentPlayer,
      turnDeadline: room.turnDeadline,
      placeDeadline: room.placeDeadline,
      you,
      youPlaced: mySide ? mySide.placed : false,
      opponentPlaced: foeSide ? foeSide.placed : false,
      // Own board: you always see your own fleet.
      yourShips: mySide ? this.revealedShips(mySide, true) : null,
      yourIncoming: mySide ? this.incomingArray(mySide) : new Array(BOARD_CELLS).fill(null),
      yourFleet: mySide ? this.fleetStatus(mySide) : this.fleetStatus(freshSide()),
      // Enemy board: only your own shot results + sunk/revealed ships.
      yourShots: foeSide ? this.incomingArray(foeSide) : new Array(BOARD_CELLS).fill(null),
      enemyFleet: foeSide ? this.fleetStatus(foeSide) : this.fleetStatus(freshSide()),
      enemyRevealed: foeSide ? this.revealedShips(foeSide, ended) : [],
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
    for (const sym of ['X', 'O'] as const) {
      const slot = room.players[sym];
      if (!slot) continue;
      // Built once per seat — every socket for that seat sees the same view.
      const msg = JSON.stringify({ type: 'state', room: this.snapshotFor(room, slot.discordId) });
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
      } else if (room.status === 'active' || room.status === 'placing') {
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

export const battleshipsRoomManager = new BattleshipsRoomManager();
