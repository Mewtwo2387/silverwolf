import path from 'path';
import { randomBytes } from 'node:crypto';
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

// Resolve from this file's directory, not process.cwd(), so the server works regardless of launch dir.
const ROOT_DIR = path.resolve(import.meta.dir, '..');
const ASSETS_DIR = path.join(import.meta.dir, 'Assets');
const IMAGES_DIR = path.join(ASSETS_DIR, 'Images');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

interface StaticEntry {
  path: string;
  contentType: string;
}

const STATIC_ASSETS: Record<string, StaticEntry> = {
  '/static/silverwolf.webp': { path: path.join(ROOT_DIR, 'silverwolf.webp'), contentType: 'image/webp' },
  '/static/styles.css': { path: path.join(ASSETS_DIR, 'styles.css'), contentType: 'text/css; charset=utf-8' },
  '/static/fonts/italianno.woff2': { path: path.join(FONTS_DIR, 'italianno.woff2'), contentType: 'font/woff2' },
};
for (const name of [
  'Sticker_PPG_04_Silver_Wolf_01.webp',
  'Sticker_PPG_19_Silver_Wolf_01.webp',
  'Sticker_PPG_02_Silver_Wolf_01.webp',
  'Sticker_PPG_04_Silver_Wolf_02.webp',
]) {
  STATIC_ASSETS[`/static/stickers/${name}`] = { path: path.join(IMAGES_DIR, name), contentType: 'image/webp' };
}
for (let i = 1; i <= 6; i++) {
  const name = `Character_Silver_Wolf_Eidolon_${i}.webp`;
  STATIC_ASSETS[`/static/eidolons/${name}`] = { path: path.join(IMAGES_DIR, name), contentType: 'image/webp' };
}

async function serveStatic(entry: StaticEntry) {
  const file = Bun.file(entry.path);
  if (!(await file.exists())) return new Response('not found', { status: 404 });
  return new Response(file, {
    headers: { 'content-type': entry.contentType, 'cache-control': IMMUTABLE_CACHE },
  });
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // style-src keeps 'unsafe-inline' to cover the many style="" attributes used across pages.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://cdn.discordapp.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono<{ Variables: { nonce: string } }>();

  app.use('*', async (c, next) => {
    const nonce = randomBytes(16).toString('base64');
    c.set('nonce', nonce);
    await next();
    c.header('Content-Security-Policy', buildCsp(nonce));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Frame-Options', 'DENY');
  });

  app.get('/', (c) => c.redirect('/about'));

  app.get('/about', (c) => c.html(AboutPage({ nonce: c.get('nonce') }).toString()));

  for (const [route, entry] of Object.entries(STATIC_ASSETS)) {
    app.get(route, () => serveStatic(entry));
  }

  app.get('/leaderboards', async (c) => {
    const raw = c.req.query('board');
    const selected = raw && (VALID_BOARDS as string[]).includes(raw) ? (raw as LeaderboardKind) : undefined;
    const nonce = c.get('nonce');

    if (!selected) {
      return c.html(LeaderboardsPage({ nonce }).toString());
    }

    try {
      const result = await getLeaderboard(silverwolf, selected);
      return c.html(LeaderboardsPage({ selected, result, nonce }).toString());
    } catch (err) {
      logError('website /leaderboards failed:', err);
      return c.html(
        LeaderboardsPage({ selected, error: 'Failed to load leaderboard.', nonce }).toString(),
        500,
      );
    }
  });

  app.get('/birthdays', async (c) => {
    const nonce = c.get('nonce');
    try {
      const grouped = await getAllBirthdaysByMonth(silverwolf);
      return c.html(BirthdaysPage({ grouped, nonce }).toString());
    } catch (err) {
      logError('website /birthdays failed:', err);
      return c.html(BirthdaysPage({ grouped: {}, error: 'Failed to load birthdays.', nonce }).toString(), 500);
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
