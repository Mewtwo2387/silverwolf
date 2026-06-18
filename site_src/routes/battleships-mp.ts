import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  type AppEnv, authedGameRequest, navUser, readGameBody,
} from '../shared';
import {
  BattleshipsMultiplayerLandingPage,
  type ActiveRoomBrief,
} from '../pages/games/battleships_multiplayer_landing';
import { BattleshipsMultiplayerRoomPage } from '../pages/games/battleships_multiplayer_room';
import {
  battleshipsRoomManager,
  ROOMS_PER_USER_CAP,
} from '../multiplayer/battleships_rooms';
import { createBattleshipsWsEvents } from '../multiplayer/battleships_ws';

const LANDING_PATH = '/games/battleships/multiplayer';

export function registerBattleshipsMpRoutes(
  app: Hono<AppEnv>,
  silverwolf: Silverwolf,
  upgradeWebSocket: UpgradeWebSocket,
) {
  // Give the RoomManager a DB handle for persisting completed matches.
  battleshipsRoomManager.init(silverwolf);

  app.get(LANDING_PATH, (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    if (!user) {
      return c.html(
        BattleshipsMultiplayerLandingPage({
          nonce, lv999, user: nav, csrf: null, activeRooms: [],
        }).toString(),
      );
    }
    const rooms = battleshipsRoomManager.listForUser(user.discordId);
    const briefs: ActiveRoomBrief[] = rooms.map((r) => {
      const youAreCreator = r.creatorDiscordId === user.discordId;
      const otherSlot = youAreCreator ? r.players.O : r.players.X;
      const opp = (otherSlot && otherSlot.discordId !== user.discordId)
        ? otherSlot.username
        : null;
      return {
        id: r.id,
        status: r.status,
        opponentUsername: opp,
        youAreCreator,
      };
    });
    return c.html(
      BattleshipsMultiplayerLandingPage({
        nonce, lv999, user: nav, csrf: user.csrfToken, activeRooms: briefs,
      }).toString(),
    );
  });

  app.post(`${LANDING_PATH}/create`, async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const result = battleshipsRoomManager.createRoom({
      discordId: auth.discordId,
      username: auth.nav.username,
      avatarURL: auth.nav.avatarURL,
    });
    if (!result.ok) {
      if (result.reason === 'too_many_rooms') {
        return c.json({
          ok: false,
          error: `You're at the limit of ${ROOMS_PER_USER_CAP} rooms. Recently finished rooms still count for a few minutes — wait for them to clear, or leave one.`,
        }, 429);
      }
      return c.json({ ok: false, error: 'Server is at capacity. Try again later.' }, 503);
    }
    return c.json({ ok: true, id: result.room.id });
  });

  app.get(`${LANDING_PATH}/:id`, (c) => {
    const matchId = c.req.param('id');
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const loginReturnPath = `${LANDING_PATH}/${matchId}`;

    if (!user) {
      return c.html(
        BattleshipsMultiplayerRoomPage({
          nonce,
          lv999,
          user: null,
          matchId,
          selfDiscordId: null,
          csrf: null,
          snapshot: null,
          loginReturnPath,
        }).toString(),
      );
    }
    const room = battleshipsRoomManager.getRoom(matchId);
    if (!room) {
      return c.html(
        BattleshipsMultiplayerRoomPage({
          nonce,
          lv999,
          user: nav,
          matchId,
          selfDiscordId: user.discordId,
          csrf: user.csrfToken,
          snapshot: null,
          roomMissing: true,
          loginReturnPath,
        }).toString(),
        404,
      );
    }
    return c.html(
      BattleshipsMultiplayerRoomPage({
        nonce,
        lv999,
        user: nav,
        matchId,
        selfDiscordId: user.discordId,
        csrf: user.csrfToken,
        snapshot: battleshipsRoomManager.snapshotFor(room, user.discordId),
        loginReturnPath,
      }).toString(),
    );
  });

  // WebSocket upgrade. The pre-check rejects unauthenticated and cross-origin
  // requests with 401/403 before Bun's upgrade. The CSRF token in the first
  // `join` message is still the load-bearing defense.
  app.get(
    `${LANDING_PATH}/ws/:id`,
    async (c, next) => {
      const user = c.get('user');
      if (!user) return c.text('login required', 401);
      const origin = c.req.header('origin');
      const host = c.req.header('host');
      if (!origin || !host) return c.text('forbidden', 403);
      try {
        if (new URL(origin).host !== host) return c.text('forbidden origin', 403);
      } catch {
        return c.text('invalid origin', 400);
      }
      return next();
    },
    upgradeWebSocket((c) => {
      const matchId = c.req.param('id') ?? '';
      const user = c.get('user');
      if (!user) {
        return {
          onOpen(_evt, ws) {
            try {
              ws.send(JSON.stringify({ type: 'error', code: 'auth_required' }));
              ws.close(1008, 'auth_required');
            } catch (err) {
              logError('battleships ws unauth open failed:', err);
            }
          },
        };
      }
      return createBattleshipsWsEvents(matchId, {
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        csrfToken: user.csrfToken,
      });
    }),
  );
}
