import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  type AppEnv, authedGameRequest, navUser, readGameBody,
} from '../shared';
import {
  TcgBrowsePage,
  TcgCreatePage,
  type TcgBrowseRoom,
  type TcgHistoryEntry,
  type TcgRoster,
} from './pages/landing';
import { TcgBattleRoomPage, TcgBattleJoinPage } from './pages/room';
import { TcgMatchDetailPage } from './pages/match';
import {
  TcgDeckBuilderPage,
  type DeckBuilderItem,
} from './pages/deck-builder';
import {
  tcgRoomManager,
  TCG_ROOMS_PER_USER_CAP,
  type TcgMode,
} from './rooms';
import { createTcgWsEvents } from './ws';
import { buildTeamOfThree, CHARACTER_ROSTER_DISCORD_CHOICES } from '../../tcg/characterRoster';
import { CHARACTERS } from '../../tcg/characters';
import { buildCharacterCatalog } from './pages/detail';
import {
  ALL_ITEMS,
  ITEMS_BY_ID,
  PER_CARD_MAX,
  DECK_MAX_FIVE_STAR_OR_ABOVE,
  DECK_MAX_FOUR_STAR_OR_ABOVE,
  expandDeckComposition,
  isLegalDeck,
  validateDeckComposition,
  type DeckComposition,
} from '../../tcg/items';
import { DECK_SIZE } from '../../tcg/battle';
import { loadDeckCompositionForUser, saveDeckCompositionForUser } from '../../tcg/deckStorage';

const LANDING_PATH = '/games/tcg';

const ROSTER: TcgRoster[] = CHARACTER_ROSTER_DISCORD_CHOICES.map((c) => ({ value: c.value, name: c.name }));
const CHARACTER_CATALOG = buildCharacterCatalog(CHARACTERS);

const DECK_BUILDER_ITEMS: DeckBuilderItem[] = [...ALL_ITEMS]
  .map((it) => ({
    id: it.id,
    name: it.name,
    kind: it.kind as 'equipment' | 'consumable',
    rarity: it.rarity.rarity,
    description: it.description,
  }))
  .sort((a, b) => (b.rarity - a.rarity) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

const DECK_CAPS = {
  deckSize: DECK_SIZE,
  perCard: PER_CARD_MAX,
  fiveStarMax: DECK_MAX_FIVE_STAR_OR_ABOVE,
  fourStarMax: DECK_MAX_FOUR_STAR_OR_ABOVE,
};

function parseTeam(raw: unknown): [string, string, string] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const vals = raw.map((v) => (typeof v === 'string' ? v : ''));
  if (vals.some((v) => !v)) return null;
  return [vals[0], vals[1], vals[2]];
}

export function registerTcgBattleRoutes(
  app: Hono<AppEnv>,
  silverwolf: Silverwolf,
  upgradeWebSocket: UpgradeWebSocket,
) {
  tcgRoomManager.init(silverwolf);

  // ── Browse (default): all in-progress battles + recent match history ────────
  app.get(LANDING_PATH, async (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';

    if (!user) {
      return c.html(
        TcgBrowsePage({
          nonce, lv999, user: nav, rooms: [], history: [], loginReturnPath: LANDING_PATH,
        }).toString(),
      );
    }

    const rooms: TcgBrowseRoom[] = tcgRoomManager.listActive().map((r) => ({
      id: r.id,
      mode: r.mode,
      status: r.status,
      p1: r.p1?.username ?? null,
      p2: r.mode === 'solo' ? (r.p1?.username ?? null) : (r.p2?.username ?? null),
      spectators: r.spectators.size,
      you: r.creatorDiscordId === user.discordId
        || r.p1?.discordId === user.discordId
        || r.p2?.discordId === user.discordId,
      openLobby: r.mode === 'pvp' && r.status === 'lobby' && !r.p2,
    }));

    const historyRows = await silverwolf.db.tcgMatch.getRecent(40);
    const history: TcgHistoryEntry[] = historyRows.map((row: Record<string, any>) => ({
      id: row.id,
      mode: row.mode === 'solo' ? 'solo' : 'pvp',
      p1: row.p1Username,
      p2: row.p2Username,
      winner: row.winner ?? null,
      endReason: row.endReason,
      rounds: row.rounds,
      endedAt: row.endedAt,
    }));

    return c.html(
      TcgBrowsePage({
        nonce, lv999, user: nav, rooms, history, loginReturnPath: LANDING_PATH,
      }).toString(),
    );
  });

  // ── Create a battle ─────────────────────────────────────────────────────────
  app.post('/games/tcg/create', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const modeRaw = body!.mode;
    const mode: TcgMode | null = (modeRaw === 'pvp' || modeRaw === 'solo') ? modeRaw : null;
    if (!mode) return c.json({ ok: false, error: 'Pick a valid mode.' }, 400);

    const teamVals = parseTeam(body!.team);
    if (!teamVals) return c.json({ ok: false, error: 'Pick three characters.' }, 400);
    const team = buildTeamOfThree(teamVals[0], teamVals[1], teamVals[2]);
    if (!team) return c.json({ ok: false, error: 'Unknown character selected.' }, 400);

    const composition = await loadDeckCompositionForUser(silverwolf.db, auth.discordId);
    if (!isLegalDeck(composition)) {
      return c.json({ ok: false, error: 'Your saved deck is not legal. Edit your deck first.' }, 400);
    }
    const deck = expandDeckComposition(composition);

    const result = tcgRoomManager.createRoom(
      { discordId: auth.discordId, username: auth.nav.username, avatarURL: auth.nav.avatarURL },
      { mode, team, deck },
    );
    if (!result.ok) {
      if (result.reason === 'too_many_rooms') {
        return c.json({
          ok: false,
          error: `You're at the limit of ${TCG_ROOMS_PER_USER_CAP} battles. Finish or leave one, then try again.`,
        }, 429);
      }
      return c.json({ ok: false, error: 'Server is at capacity. Try again later.' }, 503);
    }
    return c.json({ ok: true, id: result.room.id });
  });

  // ── Join an existing PvP battle ─────────────────────────────────────────────
  app.post('/games/tcg/:id/join', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const matchId = c.req.param('id');
    const teamVals = parseTeam(body!.team);
    if (!teamVals) return c.json({ ok: false, error: 'Pick three characters.' }, 400);
    const team = buildTeamOfThree(teamVals[0], teamVals[1], teamVals[2]);
    if (!team) return c.json({ ok: false, error: 'Unknown character selected.' }, 400);

    const composition = await loadDeckCompositionForUser(silverwolf.db, auth.discordId);
    if (!isLegalDeck(composition)) {
      return c.json({ ok: false, error: 'Your saved deck is not legal. Edit your deck first.' }, 400);
    }
    const deck = expandDeckComposition(composition);

    const result = tcgRoomManager.joinPvp(
      matchId,
      { discordId: auth.discordId, username: auth.nav.username, avatarURL: auth.nav.avatarURL },
      { team, deck },
    );
    if (!result.ok) {
      const messages: Record<string, string> = {
        room_not_found: 'This battle no longer exists.',
        not_pvp: 'This battle is not joinable.',
        already_full: 'This battle is already full.',
        is_creator: "You can't join your own battle as the opponent.",
        not_lobby: 'This battle has already started.',
      };
      return c.json({ ok: false, error: messages[result.reason] ?? 'Failed to join.' }, 400);
    }
    return c.json({ ok: true });
  });

  // ── Deck builder (registered before the :id route so "deck" isn't captured) ──
  app.get('/games/tcg/deck', async (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const loginReturnPath = '/games/tcg/deck';

    if (!user) {
      return c.html(
        TcgDeckBuilderPage({
          nonce,
          lv999,
          user: nav,
          csrf: null,
          items: DECK_BUILDER_ITEMS,
          composition: {},
          caps: DECK_CAPS,
          loginReturnPath,
        }).toString(),
      );
    }

    const composition = await loadDeckCompositionForUser(silverwolf.db, user.discordId);
    return c.html(
      TcgDeckBuilderPage({
        nonce,
        lv999,
        user: nav,
        csrf: user.csrfToken,
        items: DECK_BUILDER_ITEMS,
        composition,
        caps: DECK_CAPS,
        loginReturnPath,
      }).toString(),
    );
  });

  app.post('/games/tcg/deck/save', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const raw = body!.composition;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return c.json({ ok: false, error: 'Invalid deck.' }, 400);
    }

    // Whitelist + coerce every entry before validating; never trust client counts.
    const composition: DeckComposition = {};
    for (const [id, count] of Object.entries(raw as Record<string, unknown>)) {
      if (!ITEMS_BY_ID[id]) return c.json({ ok: false, error: `Unknown item: ${id}` }, 400);
      const n = typeof count === 'number' ? Math.trunc(count) : Number.NaN;
      if (!Number.isInteger(n) || n < 0 || n > PER_CARD_MAX) {
        return c.json({ ok: false, error: 'Card counts out of range.' }, 400);
      }
      if (n > 0) composition[id] = n;
    }

    const validation = validateDeckComposition(composition);
    if (!validation.ok) return c.json({ ok: false, error: validation.reason }, 400);

    try {
      await saveDeckCompositionForUser(silverwolf.db, auth.discordId, composition);
    } catch (err) {
      logError('tcg deck save failed:', err);
      return c.json({ ok: false, error: 'Failed to save deck.' }, 500);
    }
    return c.json({ ok: true });
  });

  // ── Create page (registered before :id so "create" isn't captured) ──────────
  app.get('/games/tcg/create', async (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const loginReturnPath = '/games/tcg/create';

    if (!user) {
      return c.html(
        TcgCreatePage({
          nonce,
          lv999,
          user: nav,
          csrf: null,
          roster: ROSTER,
          characterCatalog: CHARACTER_CATALOG,
          deckLegal: false,
          loginReturnPath,
        }).toString(),
      );
    }

    const composition = await loadDeckCompositionForUser(silverwolf.db, user.discordId);
    return c.html(
      TcgCreatePage({
        nonce,
        lv999,
        user: nav,
        csrf: user.csrfToken,
        roster: ROSTER,
        characterCatalog: CHARACTER_CATALOG,
        deckLegal: isLegalDeck(composition),
        loginReturnPath,
      }).toString(),
    );
  });

  // ── Match detail (permanent post-game state; before :id) ────────────────────
  app.get('/games/tcg/match/:id', async (c) => {
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const matchId = c.req.param('id');

    const base = {
      nonce, lv999, user: nav, id: matchId,
    } as const;

    const blank = {
      mode: 'pvp' as const,
      p1: '',
      p2: '',
      winner: null,
      endReason: '',
      rounds: 0,
      endedAt: 0,
      snapshot: null,
      feed: [],
    };

    if (!user) {
      return c.html(TcgMatchDetailPage({ ...base, ...blank }).toString());
    }

    const row = await silverwolf.db.tcgMatch.getById(matchId);
    if (!row) {
      return c.html(TcgMatchDetailPage({ ...base, ...blank, notFound: true }).toString(), 404);
    }

    let snapshot = null;
    let feed: any[] = [];
    if (row.finalState) {
      try {
        const parsed = JSON.parse(row.finalState);
        snapshot = parsed.snapshot ?? null;
        if (Array.isArray(parsed.feed)) {
          feed = parsed.feed;
        } else {
          // Fallback for any pre-feed rows: log lines, then chat.
          const log = Array.isArray(parsed.log) ? parsed.log : [];
          const chat = Array.isArray(parsed.chat) ? parsed.chat : [];
          feed = [...log.map((e: any) => ({ kind: 'log', e })), ...chat.map((m: any) => ({ kind: 'chat', m }))];
        }
      } catch { /* corrupt blob → show summary only */ }
    }

    return c.html(TcgMatchDetailPage({
      ...base,
      mode: row.mode === 'solo' ? 'solo' : 'pvp',
      p1: row.p1Username,
      p2: row.p2Username,
      winner: row.winner ?? null,
      endReason: row.endReason,
      rounds: row.rounds,
      endedAt: row.endedAt,
      snapshot,
      feed,
    }).toString());
  });

  // ── Room page (play or join variant) ────────────────────────────────────────
  app.get('/games/tcg/:id', async (c) => {
    const matchId = c.req.param('id');
    const user = c.get('user');
    const nav = navUser(c);
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const loginReturnPath = `${LANDING_PATH}/${matchId}`;

    if (!user) {
      return c.html(
        TcgBattleRoomPage({
          nonce, lv999, user: null, matchId, selfDiscordId: null, csrf: null, snapshot: null, loginReturnPath,
        }).toString(),
      );
    }

    const room = tcgRoomManager.getRoom(matchId);
    if (!room) {
      // Closed rooms become permanent history under the same id — send old live links there.
      const record = await silverwolf.db.tcgMatch.getById(matchId);
      if (record) return c.redirect(`/games/tcg/match/${encodeURIComponent(matchId)}`);
      return c.html(
        TcgBattleRoomPage({
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

    const isParticipant = room.creatorDiscordId === user.discordId
      || room.p1?.discordId === user.discordId
      || room.p2?.discordId === user.discordId;

    if (isParticipant) {
      const side = tcgRoomManager.sideForUser(room, user.discordId);
      return c.html(
        TcgBattleRoomPage({
          nonce,
          lv999,
          user: nav,
          matchId,
          selfDiscordId: user.discordId,
          csrf: user.csrfToken,
          snapshot: tcgRoomManager.snapshotFor(room, side),
          loginReturnPath,
        }).toString(),
      );
    }

    // Not a participant: offer to join an open PvP lobby…
    if (room.mode === 'pvp' && room.status === 'lobby' && !room.p2) {
      const composition = await loadDeckCompositionForUser(silverwolf.db, user.discordId);
      return c.html(
        TcgBattleJoinPage({
          nonce,
          lv999,
          user: nav,
          matchId,
          csrf: user.csrfToken,
          roster: ROSTER,
          characterCatalog: CHARACTER_CATALOG,
          deckLegal: isLegalDeck(composition),
        }).toString(),
      );
    }

    // …otherwise let them spectate (read-only; no hand, can chat). The snapshot is
    // built with a null viewer side, which the manager renders as a spectator view.
    return c.html(
      TcgBattleRoomPage({
        nonce,
        lv999,
        user: nav,
        matchId,
        selfDiscordId: user.discordId,
        csrf: user.csrfToken,
        snapshot: tcgRoomManager.snapshotFor(room, null),
        loginReturnPath,
      }).toString(),
    );
  });

  // ── WebSocket upgrade ───────────────────────────────────────────────────────
  app.get(
    '/games/tcg/ws/:id',
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
              logError('tcg ws unauth open failed:', err);
            }
          },
        };
      }
      return createTcgWsEvents(matchId, {
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        csrfToken: user.csrfToken,
      });
    }),
  );
}
