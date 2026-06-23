/* eslint-disable no-param-reassign */
// In-memory TCG battle room manager. Mirrors the cyclic-tic-tac-toe RoomManager
// pattern: all state lives in this process; a Bun restart drops active rooms.
//
// Two modes:
//  - 'pvp':  two logged-in users. Creator seats p1 at create; the second player
//            seats p2 via join (picks their own team) which starts the battle.
//  - 'solo': one user drives both sides (mirrors the Discord solo flow where
//            p1UserId === p2UserId). `sideForUser` returns battle.currentPlayer.
//
// Teams and decks are always built server-side from validated roster values and
// the user's saved deck — client-sent card data is never trusted.

import { randomBytes } from 'node:crypto';
import type { WSContext } from 'hono/ws';
import type { Silverwolf } from '../../classes/silverwolf';
import type { Character } from '../../tcg/character';
import type { Item } from '../../tcg/item';
import { Battle, BattleStatus } from '../../tcg/battle';
import {
  type BattleSide,
  executeUseSkill,
  executeUseItem,
  endTurnAsCurrentPlayer,
} from '../../tcg/battleCore';
import { buildBattleSnapshot, type BattleSnapshot } from '../../tcg/battleSnapshot';

export type TcgMode = 'pvp' | 'solo';
export type TcgRoomStatus = 'lobby' | 'active' | 'ended';
export type TcgWinner = 'p1' | 'p2' | 'draw' | null;
export type TcgEndReason = 'victory' | 'forfeit' | 'timeout' | 'disconnect';

export interface TcgPlayerSlot {
  discordId: string;
  username: string;
  avatarURL: string | null;
  sockets: Set<WSContext>;
  rematchAccepted: boolean;
}

export interface TcgChatMessage {
  id: number;
  /** 'chat' = a user message; 'system' = a join/leave/spectator notice. */
  kind: 'chat' | 'system';
  /** Discord id of the sender ('' for system messages). */
  senderId: string;
  username: string;
  text: string;
  /** Sender is a seated player (UI shows a player icon); false for spectators/system. */
  isPlayer: boolean;
  ts: number;
}

export interface TcgSpectatorSlot {
  discordId: string;
  username: string;
  avatarURL: string | null;
  sockets: Set<WSContext>;
}

export interface TcgRoom {
  id: string;
  mode: TcgMode;
  status: TcgRoomStatus;
  battle: Battle | null;
  p1?: TcgPlayerSlot;
  p2?: TcgPlayerSlot;
  // Locked team/deck per side; used to (re)build the Battle when it starts.
  p1Team: Character[];
  p1Deck: Item[];
  p2Team?: Character[];
  p2Deck?: Item[];
  creatorDiscordId: string;
  creatorUsername: string;
  creatorAvatarURL: string | null;
  result: { winner: TcgWinner; reason: TcgEndReason } | null;
  turnDeadline: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  spectators: Map<string, TcgSpectatorSlot>;
  chat: TcgChatMessage[];
  chatSeq: number;
  createdAt: number;
  endedAt: number | null;
  lastActivityAt: number;
}

export interface TcgPublicPlayer {
  discordId: string;
  username: string;
  avatarURL: string | null;
  side: BattleSide;
  connected: boolean;
  rematchAccepted: boolean;
}

export interface TcgRoomSnapshot {
  id: string;
  mode: TcgMode;
  status: TcgRoomStatus;
  result: { winner: TcgWinner; reason: TcgEndReason } | null;
  /** The side this snapshot is for (whose hand the battle DTO includes). */
  yourSide: BattleSide | null;
  turnDeadline: number | null;
  players: { p1: TcgPublicPlayer | null; p2: TcgPublicPlayer | null };
  creator: { discordId: string; username: string; avatarURL: string | null };
  battle: BattleSnapshot | null;
  chat: TcgChatMessage[];
  /** True when this snapshot is for a spectator (not seated; hand omitted, no actions). */
  spectator: boolean;
  /** Number of distinct spectators currently watching. */
  spectatorCount: number;
}

export interface TcgUserInfo {
  discordId: string;
  username: string;
  avatarURL: string | null;
}

export interface TcgCreateInput {
  mode: TcgMode;
  team: Character[];
  deck: Item[];
}

export interface TcgJoinInput {
  team: Character[];
  deck: Item[];
}

// PvP turn timer (solo has no timer — you control both sides at your own pace).
export const TCG_TURN_TIMER_MS = 90_000;
export const TCG_DISCONNECT_GRACE_MS = 45_000;
const ABANDONED_MS = 5 * 60_000;
const LOBBY_TTL_MS = 10 * 60_000;
const ENDED_TTL_MS = 5 * 60_000;
export const TCG_ROOMS_PER_USER_CAP = 5;
export const TCG_MAX_ACTIVE_ROOMS_GLOBAL = 2_000;
const GC_SWEEP_MS = 60_000;
// Chat: max characters per message, and how many recent messages a room retains.
export const TCG_CHAT_MAX_LEN = 300;
export const TCG_CHAT_HISTORY = 60;
// Cap concurrent spectators per room (guards memory / broadcast fan-out).
export const TCG_MAX_SPECTATORS = 50;

export type TcgCreateResult =
  | { ok: true; room: TcgRoom }
  | { ok: false; reason: 'too_many_rooms' | 'server_full' };

export type TcgJoinResult =
  | { ok: true; room: TcgRoom }
  | { ok: false; reason: 'room_not_found' | 'not_pvp' | 'already_full' | 'is_creator' | 'not_lobby' };

function newSlot(user: TcgUserInfo, ws?: WSContext): TcgPlayerSlot {
  return {
    discordId: user.discordId,
    username: user.username,
    avatarURL: user.avatarURL,
    sockets: ws ? new Set([ws]) : new Set(),
    rematchAccepted: false,
  };
}

class TcgRoomManager {
  private rooms = new Map<string, TcgRoom>();

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

  createRoom(creator: TcgUserInfo, input: TcgCreateInput): TcgCreateResult {
    if (this.rooms.size >= TCG_MAX_ACTIVE_ROOMS_GLOBAL) return { ok: false, reason: 'server_full' };
    const owned = [...this.rooms.values()].filter((r) => r.creatorDiscordId === creator.discordId);
    if (owned.length >= TCG_ROOMS_PER_USER_CAP) return { ok: false, reason: 'too_many_rooms' };

    const id = randomBytes(16).toString('base64url');
    const now = Date.now();
    const room: TcgRoom = {
      id,
      mode: input.mode,
      status: 'lobby',
      battle: null,
      p1: newSlot(creator),
      p1Team: input.team,
      p1Deck: input.deck,
      creatorDiscordId: creator.discordId,
      creatorUsername: creator.username,
      creatorAvatarURL: creator.avatarURL,
      result: null,
      turnDeadline: null,
      turnTimer: null,
      disconnectTimers: new Map(),
      spectators: new Map(),
      chat: [],
      chatSeq: 0,
      createdAt: now,
      endedAt: null,
      lastActivityAt: now,
    };

    if (input.mode === 'solo') {
      // One user controls both sides; the opponent mirrors the creator's team/deck.
      room.p2Team = input.team;
      room.p2Deck = input.deck;
      this.startBattle(room);
    }

    this.rooms.set(id, room);
    return { ok: true, room };
  }

  /** PvP: the second player picks their team and joins, starting the battle. */
  joinPvp(roomId: string, user: TcgUserInfo, input: TcgJoinInput): TcgJoinResult {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: 'room_not_found' };
    if (room.mode !== 'pvp') return { ok: false, reason: 'not_pvp' };
    if (room.creatorDiscordId === user.discordId) return { ok: false, reason: 'is_creator' };
    if (room.status !== 'lobby') return { ok: false, reason: 'not_lobby' };
    if (room.p2) return { ok: false, reason: 'already_full' };

    room.p2 = newSlot(user);
    room.p2Team = input.team;
    room.p2Deck = input.deck;
    this.startBattle(room);
    room.lastActivityAt = Date.now();
    return { ok: true, room };
  }

  private startBattle(room: TcgRoom) {
    const p2Team = room.p2Team ?? room.p1Team;
    const p2Deck = room.p2Deck ?? room.p1Deck;
    room.battle = new Battle(room.p1Team, p2Team, { p1Deck: room.p1Deck, p2Deck });
    room.status = 'active';
    room.result = null;
    room.endedAt = null;
    this.setTurnTimer(room);
  }

  getRoom(id: string): TcgRoom | null {
    return this.rooms.get(id) ?? null;
  }

  listForUser(discordId: string): TcgRoom[] {
    return [...this.rooms.values()].filter(
      (r) => r.status !== 'ended'
        && (r.creatorDiscordId === discordId
          || r.p1?.discordId === discordId
          || r.p2?.discordId === discordId),
    );
  }

  /** Which battle side this user acts as. Solo → the currently-acting side. */
  sideForUser(room: TcgRoom, discordId: string): BattleSide | null {
    if (room.mode === 'solo') {
      if (room.creatorDiscordId !== discordId) return null;
      return room.battle ? room.battle.currentPlayer : 'p1';
    }
    if (room.p1?.discordId === discordId) return 'p1';
    if (room.p2?.discordId === discordId) return 'p2';
    return null;
  }

  private slotForUser(room: TcgRoom, discordId: string): TcgPlayerSlot | null {
    if (room.p1?.discordId === discordId) return room.p1;
    if (room.p2?.discordId === discordId) return room.p2;
    return null;
  }

  /**
   * Attach a socket. Seated players (p1/p2, or the solo creator) reconnect into their
   * slot; any other logged-in user attaches as a **spectator** (read-only, can chat).
   * A spectator's first socket logs a "joined" system message.
   */
  attachSocket(room: TcgRoom, user: TcgUserInfo, ws: WSContext):
    { ok: true } | { ok: false; reason: string } {
    const slot = this.slotForUser(room, user.discordId);
    if (slot) {
      slot.sockets.add(ws);
      this.cancelDisconnect(room, user.discordId);
      room.lastActivityAt = Date.now();
      return { ok: true };
    }
    // Spectator path.
    const existing = room.spectators.get(user.discordId);
    if (!existing && room.spectators.size >= TCG_MAX_SPECTATORS) {
      return { ok: false, reason: 'too_many_spectators' };
    }
    if (existing) {
      existing.sockets.add(ws);
    } else {
      room.spectators.set(user.discordId, {
        discordId: user.discordId,
        username: user.username,
        avatarURL: user.avatarURL,
        sockets: new Set([ws]),
      });
      this.logSystem(room, `${user.username} joined as a spectator`);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  detachSocket(room: TcgRoom, ws: WSContext, discordId: string) {
    if (!this.rooms.has(room.id)) return;
    const slot = this.slotForUser(room, discordId);
    if (slot) {
      slot.sockets.delete(ws);
      if (slot.sockets.size === 0 && room.status === 'active' && room.mode === 'pvp') {
        this.startDisconnectTimer(room, discordId);
      }
      room.lastActivityAt = Date.now();
      return;
    }
    // Spectator: drop their socket; on the last one, remove them + log a "left" notice.
    const spec = room.spectators.get(discordId);
    if (!spec) return;
    spec.sockets.delete(ws);
    if (spec.sockets.size === 0) {
      room.spectators.delete(discordId);
      this.logSystem(room, `${spec.username} stopped spectating`);
    }
    room.lastActivityAt = Date.now();
  }

  useSkill(room: TcgRoom, user: TcgUserInfo, charIndex: number, skillIndex: number, targetRaw: string | null):
    { ok: true } | { ok: false; reason: string } {
    const acted = this.actionGuard(room, user);
    if (!acted.ok) return acted;
    const res = executeUseSkill(room.battle!, acted.side, charIndex, skillIndex, targetRaw);
    if (!res.ok) return { ok: false, reason: res.hints?.length ? `${res.error} ${res.hints.join(' ')}` : res.error };
    this.afterAction(room);
    return { ok: true };
  }

  useItem(room: TcgRoom, user: TcgUserInfo, handSlotId: number, charIndex: number):
    { ok: true } | { ok: false; reason: string } {
    const acted = this.actionGuard(room, user);
    if (!acted.ok) return acted;
    const res = executeUseItem(room.battle!, acted.side, handSlotId, charIndex);
    if (!res.ok) return { ok: false, reason: res.error };
    this.afterAction(room);
    return { ok: true };
  }

  endTurn(room: TcgRoom, user: TcgUserInfo): { ok: true } | { ok: false; reason: string } {
    const acted = this.actionGuard(room, user);
    if (!acted.ok) return acted;
    const res = endTurnAsCurrentPlayer(room.battle!, acted.side);
    if (!res.ok) return { ok: false, reason: res.error };
    this.afterAction(room);
    return { ok: true };
  }

  private actionGuard(room: TcgRoom, user: TcgUserInfo):
    { ok: true; side: BattleSide } | { ok: false; reason: string } {
    if (room.status !== 'active' || !room.battle) return { ok: false, reason: 'game_not_active' };
    const side = this.sideForUser(room, user.discordId);
    if (!side) return { ok: false, reason: 'not_a_player' };
    if (side !== room.battle.currentPlayer) return { ok: false, reason: 'not_your_turn' };
    return { ok: true, side };
  }

  /** Post-action: settle victory, refresh PvP turn timer, bump activity. */
  private afterAction(room: TcgRoom) {
    room.lastActivityAt = Date.now();
    const battle = room.battle!;
    if (battle.status !== BattleStatus.Ongoing) {
      this.endRoom(room, this.winnerFromStatus(battle.status), 'victory');
      return;
    }
    this.setTurnTimer(room);
  }

  private winnerFromStatus(status: BattleStatus): TcgWinner {
    if (status === BattleStatus.P1Won) return 'p1';
    if (status === BattleStatus.P2Won) return 'p2';
    if (status === BattleStatus.Draw) return 'draw';
    return null;
  }

  requestRematch(room: TcgRoom, user: TcgUserInfo): { ok: boolean; reason?: string } {
    if (room.status !== 'ended') return { ok: false, reason: 'not_ended' };
    if (room.mode === 'solo') {
      if (room.creatorDiscordId !== user.discordId) return { ok: false, reason: 'not_player' };
      this.startBattle(room);
      room.lastActivityAt = Date.now();
      return { ok: true };
    }
    const slot = this.slotForUser(room, user.discordId);
    if (!slot) return { ok: false, reason: 'not_player' };
    slot.rematchAccepted = true;
    if (room.p1?.rematchAccepted && room.p2?.rematchAccepted) {
      room.p1.rematchAccepted = false;
      room.p2.rematchAccepted = false;
      room.createdAt = Date.now();
      this.startBattle(room);
    }
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  /**
   * Append a chat message from a seated player. Any participant may chat regardless of
   * whose turn it is (or whether the battle has ended). Text is sanitised + length-capped;
   * the chat ring buffer keeps only the most recent {@link TCG_CHAT_HISTORY} messages.
   * Returns `empty` when nothing remains after sanitising — callers should drop it silently.
   */
  postChat(room: TcgRoom, user: TcgUserInfo, textRaw: string):
    { ok: true } | { ok: false; reason: string } {
    const isPlayer = !!this.slotForUser(room, user.discordId);
    const isSpectator = room.spectators.has(user.discordId);
    if (!isPlayer && !isSpectator) return { ok: false, reason: 'not_a_player' };
    const text = String(textRaw)
      .replace(/\p{Cc}/gu, ' ') // strip control chars (incl. newlines)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, TCG_CHAT_MAX_LEN);
    if (!text) return { ok: false, reason: 'empty' };
    this.appendChat(room, {
      kind: 'chat', senderId: user.discordId, username: user.username, text, isPlayer,
    });
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  /** Push a chat/system entry onto the room's chat ring buffer. */
  private appendChat(room: TcgRoom, m: Omit<TcgChatMessage, 'id' | 'ts'>) {
    room.chatSeq += 1;
    room.chat.push({ id: room.chatSeq, ts: Date.now(), ...m });
    if (room.chat.length > TCG_CHAT_HISTORY) {
      room.chat.splice(0, room.chat.length - TCG_CHAT_HISTORY);
    }
  }

  /** Append a system notice (join/leave) to the chat stream. */
  private logSystem(room: TcgRoom, text: string) {
    this.appendChat(room, {
      kind: 'system', senderId: '', username: '', text, isPlayer: false,
    });
  }

  leaveRoom(room: TcgRoom, user: TcgUserInfo) {
    const slot = this.slotForUser(room, user.discordId);
    if (!slot) return;
    if (room.status === 'active' && room.mode === 'pvp') {
      const side = this.sideForUser(room, user.discordId);
      const winner: TcgWinner = side === 'p1' ? 'p2' : 'p1';
      this.endRoom(room, winner, 'forfeit');
    } else if (room.status !== 'ended') {
      this.endRoom(room, null, 'disconnect');
    }
    const sockets = [...slot.sockets];
    slot.sockets.clear();
    for (const ws of sockets) {
      try { ws.close(1000, 'left'); } catch { /* already closed */ }
    }
  }

  private setTurnTimer(room: TcgRoom) {
    this.clearTurnTimer(room);
    if (room.mode !== 'pvp' || room.status !== 'active' || !room.battle) return;
    room.turnDeadline = Date.now() + TCG_TURN_TIMER_MS;
    room.turnTimer = setTimeout(() => {
      if (room.status !== 'active' || !room.battle) return;
      const loser = room.battle.currentPlayer;
      const winner: TcgWinner = loser === 'p1' ? 'p2' : 'p1';
      this.endRoom(room, winner, 'timeout');
      this.broadcast(room);
    }, TCG_TURN_TIMER_MS);
  }

  private clearTurnTimer(room: TcgRoom) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnDeadline = null;
  }

  private startDisconnectTimer(room: TcgRoom, discordId: string) {
    this.cancelDisconnect(room, discordId);
    const timer = setTimeout(() => {
      const slot = this.slotForUser(room, discordId);
      if (!slot || slot.sockets.size > 0) return;
      if (room.status !== 'active') return;
      const side = this.sideForUser(room, discordId);
      const winner: TcgWinner = side === 'p1' ? 'p2' : 'p1';
      this.endRoom(room, winner, 'disconnect');
      this.broadcast(room);
    }, TCG_DISCONNECT_GRACE_MS);
    room.disconnectTimers.set(discordId, timer);
  }

  private cancelDisconnect(room: TcgRoom, discordId: string) {
    const t = room.disconnectTimers.get(discordId);
    if (t) {
      clearTimeout(t);
      room.disconnectTimers.delete(discordId);
    }
  }

  private endRoom(room: TcgRoom, winner: TcgWinner, reason: TcgEndReason) {
    if (room.status === 'ended') return;
    this.clearTurnTimer(room);
    for (const t of room.disconnectTimers.values()) clearTimeout(t);
    room.disconnectTimers.clear();
    room.result = { winner, reason };
    room.status = 'ended';
    room.endedAt = Date.now();
    room.lastActivityAt = room.endedAt;
  }

  private publicPlayer(slot: TcgPlayerSlot | undefined, side: BattleSide): TcgPublicPlayer | null {
    if (!slot) return null;
    return {
      discordId: slot.discordId,
      username: slot.username,
      avatarURL: slot.avatarURL,
      side,
      connected: slot.sockets.size > 0,
      rematchAccepted: slot.rematchAccepted,
    };
  }

  /**
   * Build a snapshot for a viewer. `viewerSide` is the seated side for a player, or
   * null for a spectator — spectators render p1 at the bottom and get **no hand**
   * (the battle DTO is built with `spectator: true`).
   */
  snapshotFor(room: TcgRoom, viewerSide: BattleSide | null): TcgRoomSnapshot {
    const spectator = viewerSide == null;
    // In solo, both public players are the creator; the battle DTO uses the
    // currently-acting side so the right hand is shown.
    const p2Public = room.mode === 'solo'
      ? this.publicPlayer(room.p1, 'p2')
      : this.publicPlayer(room.p2, 'p2');
    // Spectators have no side of their own; lay the board out from p1's perspective.
    const layoutSide: BattleSide = viewerSide ?? 'p1';
    return {
      id: room.id,
      mode: room.mode,
      status: room.status,
      result: room.result,
      yourSide: layoutSide,
      turnDeadline: room.turnDeadline,
      players: {
        p1: this.publicPlayer(room.p1, 'p1'),
        p2: p2Public,
      },
      creator: {
        discordId: room.creatorDiscordId,
        username: room.creatorUsername,
        avatarURL: room.creatorAvatarURL,
      },
      battle: room.battle ? buildBattleSnapshot(room.battle, layoutSide, spectator) : null,
      chat: room.chat,
      spectator,
      spectatorCount: room.spectators.size,
    };
  }

  /** Send a viewer-aware snapshot to every connected socket (hands stay private). */
  broadcast(room: TcgRoom) {
    const sendTo = (slot: TcgPlayerSlot | undefined, side: BattleSide | null) => {
      if (!slot) return;
      // Recompute the side per send so solo reflects the live acting side.
      const viewerSide = this.sideForUser(room, slot.discordId) ?? side;
      const msg = JSON.stringify({ type: 'state', room: this.snapshotFor(room, viewerSide) });
      for (const ws of slot.sockets) {
        try { ws.send(msg); } catch { /* closing */ }
      }
    };
    sendTo(room.p1, 'p1');
    if (room.mode === 'pvp') sendTo(room.p2, 'p2');
    // Spectators all share one hand-less snapshot.
    if (room.spectators.size > 0) {
      const specMsg = JSON.stringify({ type: 'state', room: this.snapshotFor(room, null) });
      for (const spec of room.spectators.values()) {
        for (const ws of spec.sockets) {
          try { ws.send(specMsg); } catch { /* closing */ }
        }
      }
    }
  }

  private sweep() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      if (room.status === 'lobby' && now - room.createdAt > LOBBY_TTL_MS) {
        this.endRoom(room, null, 'disconnect');
        this.rooms.delete(id);
      } else if (room.status === 'ended' && room.endedAt && now - room.endedAt > ENDED_TTL_MS) {
        this.rooms.delete(id);
      } else if (room.status === 'active') {
        const anyConnected = (room.p1?.sockets.size ?? 0) > 0 || (room.p2?.sockets.size ?? 0) > 0;
        if (!anyConnected && now - room.lastActivityAt > ABANDONED_MS) {
          this.endRoom(room, null, 'disconnect');
          this.rooms.delete(id);
        }
      }
    }
  }
}

export const tcgRoomManager = new TcgRoomManager();
// Surfaced for tests/diagnostics; the manager owns all lifecycle in practice.
export type { TcgRoomManager };
