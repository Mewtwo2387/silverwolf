import type { WSContext, WSEvents } from 'hono/ws';
import { constantTimeEqual } from '../auth/session';
import { logError } from '../../utils/log';
import {
  tcgRoomManager,
  type TcgRoom,
  type TcgUserInfo,
} from './tcgRooms';

interface AuthedUser extends TcgUserInfo {
  csrfToken: string;
}

// Same burst policy as the cyclic-ttt socket: sustained ~10 msg/s, instantaneous
// burst up to 30 in a 3s window; anything above closes the socket with 1008.
const WS_BURST_WINDOW_MS = 3_000;
const WS_BURST_MAX = 30;

function send(ws: WSContext, payload: unknown) {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket closing */ }
}

function asInt(v: unknown): number {
  return typeof v === 'number' ? Math.trunc(v) : Number.NaN;
}

export function createTcgWsEvents(roomId: string, user: AuthedUser): WSEvents {
  let authed = false;
  let room: TcgRoom | null = null;
  let bucketResetAt = 0;
  let bucketCount = 0;

  return {
    onMessage(event, ws) {
      const now = Date.now();
      if (bucketResetAt < now) {
        bucketResetAt = now + WS_BURST_WINDOW_MS;
        bucketCount = 0;
      }
      bucketCount += 1;
      if (bucketCount > WS_BURST_MAX) {
        send(ws, { type: 'error', code: 'rate_limited' });
        try { ws.close(1008, 'rate_limited'); } catch { /* already closed */ }
        return;
      }

      const raw = typeof event.data === 'string' ? event.data : null;
      if (!raw) {
        try { ws.close(1003, 'binary_not_supported'); } catch { /* */ }
        return;
      }
      let parsed: { type?: unknown; [k: string]: unknown };
      try {
        parsed = JSON.parse(raw) as { type?: unknown };
      } catch {
        try { ws.close(1003, 'malformed_json'); } catch { /* */ }
        return;
      }
      const type = typeof parsed.type === 'string' ? parsed.type : '';

      if (!authed) {
        if (type !== 'join') {
          send(ws, { type: 'error', code: 'auth_required' });
          try { ws.close(1008, 'auth_required'); } catch { /* */ }
          return;
        }
        const csrf = typeof parsed.csrf === 'string' ? parsed.csrf : '';
        if (!csrf || !constantTimeEqual(csrf, user.csrfToken)) {
          send(ws, { type: 'error', code: 'bad_csrf' });
          try { ws.close(1008, 'bad_csrf'); } catch { /* */ }
          return;
        }
        const found = tcgRoomManager.getRoom(roomId);
        if (!found) {
          send(ws, { type: 'error', code: 'room_not_found' });
          try { ws.close(1008, 'room_not_found'); } catch { /* */ }
          return;
        }
        const attach = tcgRoomManager.attachSocket(found, user, ws);
        if (!attach.ok) {
          send(ws, { type: 'error', code: attach.reason });
          try { ws.close(1008, attach.reason); } catch { /* */ }
          return;
        }
        authed = true;
        room = found;
        tcgRoomManager.broadcast(found);
        return;
      }

      const r = room;
      if (!r) return; // unreachable while authed
      try {
        if (type === 'use_skill') {
          const charIndex = asInt(parsed.charIndex);
          const skillIndex = asInt(parsed.skillIndex);
          if (!Number.isInteger(charIndex) || !Number.isInteger(skillIndex)) {
            send(ws, { type: 'error', code: 'invalid_index' });
            return;
          }
          const target = parsed.target == null ? null : String(parsed.target);
          const res = tcgRoomManager.useSkill(r, user, charIndex, skillIndex, target);
          if (!res.ok) { send(ws, { type: 'error', code: res.reason }); return; }
          tcgRoomManager.broadcast(r);
        } else if (type === 'use_item') {
          const handSlotId = asInt(parsed.handSlotId);
          const charIndex = asInt(parsed.charIndex);
          if (!Number.isInteger(handSlotId) || !Number.isInteger(charIndex)) {
            send(ws, { type: 'error', code: 'invalid_index' });
            return;
          }
          const res = tcgRoomManager.useItem(r, user, handSlotId, charIndex);
          if (!res.ok) { send(ws, { type: 'error', code: res.reason }); return; }
          tcgRoomManager.broadcast(r);
        } else if (type === 'end_turn') {
          const res = tcgRoomManager.endTurn(r, user);
          if (!res.ok) { send(ws, { type: 'error', code: res.reason }); return; }
          tcgRoomManager.broadcast(r);
        } else if (type === 'rematch_request') {
          const res = tcgRoomManager.requestRematch(r, user);
          if (!res.ok) { send(ws, { type: 'error', code: res.reason ?? 'rematch_failed' }); return; }
          tcgRoomManager.broadcast(r);
        } else if (type === 'leave') {
          tcgRoomManager.leaveRoom(r, user);
          tcgRoomManager.broadcast(r);
          try { ws.close(1000, 'left'); } catch { /* */ }
        } else if (type === 'ping') {
          send(ws, { type: 'pong' });
        } else {
          send(ws, { type: 'error', code: 'unknown_type' });
        }
      } catch (err) {
        logError('tcg ws message handler error:', err);
        send(ws, { type: 'error', code: 'server' });
      }
    },

    onClose(_event, ws) {
      if (!authed || !room) return;
      try {
        tcgRoomManager.detachSocket(room, ws, user.discordId);
        tcgRoomManager.broadcast(room);
      } catch (err) {
        logError('tcg ws close handler error:', err);
      }
    },
  };
}
