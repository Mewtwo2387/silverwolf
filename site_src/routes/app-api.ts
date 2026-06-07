import type { Hono } from 'hono';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  getLeaderboard,
  getAllBirthdaysByMonth,
  type LeaderboardKind,
} from '../bot-bridge';
import type { AppEnv } from '../shared';

const VALID_BOARDS: LeaderboardKind[] = ['gambler', 'murder', 'nuggie', 'poop'];

/**
 * JSON read API for native clients (the Android app). These endpoints expose the
 * same data the HTML pages in `routes/pages.ts` render, but as JSON. They reuse
 * the cached fetchers in `bot-bridge.ts` — no new queries — and require the same
 * session auth (cookie or `Authorization: Bearer <token>`, see `auth/session.ts`).
 */
export function registerAppApiRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  // Per-session CSRF token, so native clients can attach it to game POSTs the
  // same way the web pages embed it in rendered HTML.
  app.get('/api/me/csrf', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    return c.json({ csrf: user.csrfToken });
  });

  app.get('/api/me/profile', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    try {
      const [stats, pokemonCount, marriageBenefits, poopStats, poopProfile] = await Promise.all([
        silverwolf.db.user.getUser(user.discordId),
        silverwolf.db.pokemon.getUniquePokemonCount(user.discordId),
        silverwolf.db.marriage.getMarriageBenefits(user.discordId),
        silverwolf.db.poop.getUserStats(user.discordId),
        silverwolf.db.poop.getProfile(user.discordId),
      ]);
      return c.json({
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        stats,
        pokemonCount,
        marriageBenefits,
        poopStats,
        poopProfile,
      });
    } catch (err) {
      logError('app-api /api/me/profile failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.get('/api/leaderboards/:board', async (c) => {
    const raw = c.req.param('board');
    if (!(VALID_BOARDS as string[]).includes(raw)) {
      return c.json({ error: 'invalid_board' }, 400);
    }
    const board = raw as LeaderboardKind;
    try {
      const result = await getLeaderboard(silverwolf, board);
      return c.json(result);
    } catch (err) {
      logError('app-api /api/leaderboards failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.get('/api/birthdays', async (c) => {
    try {
      const grouped = await getAllBirthdaysByMonth(silverwolf);
      return c.json(grouped);
    } catch (err) {
      logError('app-api /api/birthdays failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });
}
