import type { WSContext, WSEvents } from 'hono/ws';
import { constantTimeEqual } from '../auth/session';
import { logError } from '../../utils/log';
import {
  battleshipsRoomManager,
  type MatchRoom,
  type UserInfo,
} from './battleships_rooms';

interface AuthedUser extends UserInfo {
  csrfToken: string;
}

// Sustained ~10 msg/s; instantaneous burst up to 30 in a 3s window. Above that
// closes the socket with 1008.
const WS_BURST_WINDOW_MS = 3_000;
const WS_BURST_MAX = 30;
// A full fleet is 5 ships; cap the parsed message so a crafted huge `fleet`
// array can't be used to burn CPU/memory before validation rejects it.
const MAX_RAW_MESSAGE_BYTES = 8 * 1024;

function send(ws: WSContext, payload: unknown) {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket closing */ }
}

export function createBattleshipsWsEvents(matchId: string, user: AuthedUser): WSEvents {
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
      if (raw.length > MAX_RAW_MESSAGE_BYTES) {
        send(ws, { type: 'error', code: 'message_too_large' });
        try { ws.close(1009, 'message_too_large'); } catch { /* */ }
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
        const found = battleshipsRoomManager.getRoom(matchId);
        if (!found) {
          send(ws, { type: 'error', code: 'room_not_found' });
          try { ws.close(1008, 'room_not_found'); } catch { /* */ }
          return;
        }
        const attach = battleshipsRoomManager.attachSocket(found, {
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
        battleshipsRoomManager.broadcast(found);
        return;
      }

      const r = room;
      if (!r) return; // unreachable while authed
      try {
        if (type === 'place') {
          // `fleet` is fully re-validated server-side; we pass it through raw.
          const res = battleshipsRoomManager.submitPlacement(r, user, parsed.fleet);
          if (!res.ok) {
            send(ws, { type: 'error', code: res.reason });
            return;
          }
          battleshipsRoomManager.broadcast(r);
        } else if (type === 'fire') {
          const idxRaw = parsed.index;
          const idx = typeof idxRaw === 'number' ? Math.trunc(idxRaw) : Number.NaN;
          if (!Number.isInteger(idx)) {
            send(ws, { type: 'error', code: 'invalid_index' });
            return;
          }
          const res = battleshipsRoomManager.applyShotFromUser(r, user, idx);
          if (!res.ok) {
            send(ws, { type: 'error', code: res.reason });
            return;
          }
          battleshipsRoomManager.broadcast(r);
        } else if (type === 'rematch_request') {
          const res = battleshipsRoomManager.requestRematch(r, user);
          if (!res.ok) {
            send(ws, { type: 'error', code: res.reason ?? 'rematch_failed' });
            return;
          }
          battleshipsRoomManager.broadcast(r);
        } else if (type === 'leave') {
          battleshipsRoomManager.leaveRoom(r, user);
          battleshipsRoomManager.broadcast(r);
          try { ws.close(1000, 'left'); } catch { /* */ }
        } else if (type === 'ping') {
          send(ws, { type: 'pong' });
        } else {
          send(ws, { type: 'error', code: 'unknown_type' });
        }
      } catch (err) {
        logError('battleships ws message handler error:', err);
        send(ws, { type: 'error', code: 'server' });
      }
    },

    onClose(_event, ws) {
      if (!authed || !room) return;
      try {
        battleshipsRoomManager.detachSocket(room, ws, user.discordId);
        battleshipsRoomManager.broadcast(room);
      } catch (err) {
        logError('battleships ws close handler error:', err);
      }
    },
  };
}
