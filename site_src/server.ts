import { Hono } from 'hono';
import { log, logError } from '../utils/log';
import type { Silverwolf } from '../classes/silverwolf';
import { AboutPage } from './pages/about';
import { LeaderboardsPage } from './pages/leaderboards';
import { BirthdaysPage } from './pages/birthdays';
import {
  getLeaderboard,
  getAllBirthdaysByMonth,
  type LeaderboardKind,
} from './bot-bridge';

const PORT = 6769;
// Bind to 0.0.0.0 so the site is reachable when the bot runs inside a container.
const HOSTNAME = '0.0.0.0';
const VALID_BOARDS: LeaderboardKind[] = ['gambler', 'murder', 'nuggie', 'poop'];

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono();

  app.get('/', (c) => c.redirect('/about'));

  app.get('/about', (c) => c.html(AboutPage().toString()));

  app.get('/static/silverwolf.webp', () => {
    const file = Bun.file('./silverwolf.webp');
    return new Response(file, {
      headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=3600' },
    });
  });

  app.get('/leaderboards', async (c) => {
    const raw = c.req.query('board');
    const selected = raw && (VALID_BOARDS as string[]).includes(raw) ? (raw as LeaderboardKind) : undefined;

    if (!selected) {
      return c.html(LeaderboardsPage({}).toString());
    }

    try {
      const result = await getLeaderboard(silverwolf, selected);
      return c.html(LeaderboardsPage({ selected, result }).toString());
    } catch (err) {
      logError('website /leaderboards failed:', err);
      return c.html(
        LeaderboardsPage({ selected, error: 'Failed to load leaderboard.' }).toString(),
        500,
      );
    }
  });

  app.get('/birthdays', async (c) => {
    try {
      const grouped = await getAllBirthdaysByMonth(silverwolf);
      return c.html(BirthdaysPage({ grouped }).toString());
    } catch (err) {
      logError('website /birthdays failed:', err);
      return c.html(BirthdaysPage({ grouped: {}, error: 'Failed to load birthdays.' }).toString(), 500);
    }
  });

  app.notFound((c) => c.text('not found', 404));

  const server = Bun.serve({
    port: PORT,
    hostname: HOSTNAME,
    fetch: app.fetch,
  });

  log(`site_src listening on http://${server.hostname}:${server.port}`);
  return server;
}
