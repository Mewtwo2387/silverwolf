import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  type AppEnv, authedGameRequest, navUser, readGameBody,
} from '../shared';
import {
  CyclicTicTacToeMultiplayerLandingPage,
  type ActiveRoomBrief,
} from '../pages/games/cyclic_tictactoe_multiplayer_landing';
import { CyclicTicTacToeMultiplayerRoomPage } from '../pages/games/cyclic_tictactoe_multiplayer_room';
import {
  roomManager,
  ROOMS_PER_USER_CAP,
} from '../multiplayer/cyclic_tictactoe_rooms';
import { clampBoardSize } from '../multiplayer/cyclicTicTacToe';
import { createCyclicTttWsEvents } from '../multiplayer/ws';

const LANDING_PATH = '/games/cyclic-tictactoe/multiplayer';

export function registerCyclicTttMpRoutes(
  app: Hono<AppEnv>,
  silverwolf: Silverwolf,
  upgradeWebSocket: UpgradeWebSocket,
) {
  // Make sure the RoomManager has a DB handle for persisting completed matches.
  roomManager.init(silverwolf);

  app.get(LANDING_PATH, (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    if (!user) {
      return c.html(
        CyclicTicTacToeMultiplayerLandingPage({
          nonce, lv999, user: nav, csrf: null, activeRooms: [],
        }).toString(),
      );
    }
    const rooms = roomManager.listForUser(user.discordId);
    const briefs: ActiveRoomBrief[] = rooms.map((r) => {
      const youAreCreator = r.creatorDiscordId === user.discordId;
      const x = r.players.X;
      const o = r.players.O;
      const otherSlot = youAreCreator ? o : x;
      const opp = (otherSlot && otherSlot.discordId !== user.discordId)
        ? otherSlot.username
        : null;
      return {
        id: r.id,
        boardSize: r.boardSize,
        status: r.status,
        opponentUsername: opp,
        youAreCreator,
      };
    });
    return c.html(
      CyclicTicTacToeMultiplayerLandingPage({
        nonce, lv999, user: nav, csrf: user.csrfToken, activeRooms: briefs,
      }).toString(),
    );
  });

  app.post('/games/cyclic-tictactoe/multiplayer/create', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const sizeRaw = body!.boardSize;
    const size = clampBoardSize(typeof sizeRaw === 'number' ? sizeRaw : Number(sizeRaw));
    const result = roomManager.createRoom(
      {
        discordId: auth.discordId,
        username: auth.nav.username,
        avatarURL: auth.nav.avatarURL,
      },
      size,
    );
    if (!result.ok) {
      if (result.reason === 'too_many_rooms') {
        return c.json({
          ok: false,
          error: `You already have ${ROOMS_PER_USER_CAP} active rooms. Finish or leave one before creating another.`,
        }, 429);
      }
      // server_full
      return c.json({ ok: false, error: 'Server is at capacity. Try again later.' }, 503);
    }
    return c.json({ ok: true, id: result.room.id });
  });

  app.get('/games/cyclic-tictactoe/multiplayer/:id', (c) => {
    const matchId = c.req.param('id');
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const loginReturnPath = `${LANDING_PATH}/${matchId}`;

    if (!user) {
      return c.html(
        CyclicTicTacToeMultiplayerRoomPage({
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
    const room = roomManager.getRoom(matchId);
    if (!room) {
      return c.html(
        CyclicTicTacToeMultiplayerRoomPage({
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
      CyclicTicTacToeMultiplayerRoomPage({
        nonce,
        lv999,
        user: nav,
        matchId,
        selfDiscordId: user.discordId,
        csrf: user.csrfToken,
        snapshot: roomManager.snapshot(room),
        loginReturnPath,
      }).toString(),
    );
  });

  // WebSocket upgrade. The pre-check rejects unauthenticated and
  // cross-origin requests with 401/403 before Bun's upgrade is attempted, so
  // cross-origin probes never reach the game protocol. The CSRF token in the
  // first `join` message is still the load-bearing defense; the Origin check
  // is belt-and-suspenders against browsers that ever send cookies on a
  // cross-origin WS handshake.
  app.get(
    '/games/cyclic-tictactoe/multiplayer/ws/:id',
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
        // Should be unreachable thanks to the pre-check, but keep a guard so the
        // WS protocol never runs without a session.
        return {
          onOpen(_evt, ws) {
            try {
              ws.send(JSON.stringify({ type: 'error', code: 'auth_required' }));
              ws.close(1008, 'auth_required');
            } catch (err) {
              logError('cyclic-ttt ws unauth open failed:', err);
            }
          },
        };
      }
      return createCyclicTttWsEvents(matchId, {
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        csrfToken: user.csrfToken,
      });
    }),
  );
}
