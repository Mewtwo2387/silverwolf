import type { WSContext, WSEvents } from 'hono/ws';
import { constantTimeEqual } from '../auth/session';
import { logError } from '../../utils/log';
import {
  roomManager,
  type MatchRoom,
  type UserInfo,
} from './cyclic_tictactoe_rooms';

interface AuthedUser extends UserInfo {
  csrfToken: string;
}

// Sustained ~10 msg/s; instantaneous burst up to 30 in a 3s window. Anything
// above that closes the socket with code 1008 — clients should backoff via the
// `error` payload before close.
const WS_BURST_WINDOW_MS = 3_000;
const WS_BURST_MAX = 30;

function send(ws: WSContext, payload: unknown) {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket closing */ }
}

export function createCyclicTttWsEvents(matchId: string, user: AuthedUser): WSEvents {
  let authed = false;
  let room: MatchRoom | null = null;
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
        const found = roomManager.getRoom(matchId);
        if (!found) {
          send(ws, { type: 'error', code: 'room_not_found' });
          try { ws.close(1008, 'room_not_found'); } catch { /* */ }
          return;
        }
        const attach = roomManager.attachSocket(found, {
          discordId: user.discordId,
          username: user.username,
          avatarURL: user.avatarURL,
        }, ws);
        if (!attach.ok) {
          send(ws, { type: 'error', code: attach.reason });
          try { ws.close(1008, attach.reason); } catch { /* */ }
          return;
        }
        authed = true;
        room = found;
        roomManager.broadcast(found);
        return;
      }

      const r = room;
      if (!r) return; // unreachable while authed
      try {
        if (type === 'move') {
          const indexRaw = parsed.index;
          const idx = typeof indexRaw === 'number' ? Math.trunc(indexRaw) : Number.NaN;
          if (!Number.isInteger(idx)) {
            send(ws, { type: 'error', code: 'invalid_index' });
            return;
          }
          const res = roomManager.applyMoveFromUser(r, user, idx);
          if (!res.ok) {
            send(ws, { type: 'error', code: res.reason });
            return;
          }
          roomManager.broadcast(r);
        } else if (type === 'rematch_request') {
          const res = roomManager.requestRematch(r, user);
          if (!res.ok) {
            send(ws, { type: 'error', code: res.reason ?? 'rematch_failed' });
            return;
          }
          roomManager.broadcast(r);
        } else if (type === 'leave') {
          roomManager.leaveRoom(r, user);
          roomManager.broadcast(r);
          try { ws.close(1000, 'left'); } catch { /* */ }
        } else if (type === 'ping') {
          send(ws, { type: 'pong' });
        } else {
          send(ws, { type: 'error', code: 'unknown_type' });
        }
      } catch (err) {
        logError('cyclic-ttt ws message handler error:', err);
        send(ws, { type: 'error', code: 'server' });
      }
    },

    onClose(_event, ws) {
      if (!authed || !room) return;
      try {
        roomManager.detachSocket(room, ws, user.discordId);
        roomManager.broadcast(room);
      } catch (err) {
        logError('cyclic-ttt ws close handler error:', err);
      }
    },
  };
}
