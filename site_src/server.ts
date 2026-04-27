import path from 'path';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { log, logError } from '../utils/log';
import type { Silverwolf } from '../classes/silverwolf';
import { AboutPage } from './pages/about';
import { LeaderboardsPage } from './pages/leaderboards';
import { BirthdaysPage } from './pages/birthdays';
import { GamesPage } from './pages/games';
import { EightBallPage } from './pages/games/8ball';
import { FlipPage } from './pages/games/flip';
import { FortunePage } from './pages/games/fortune';
import {
  getLeaderboard,
  getAllBirthdaysByMonth,
  getEightBallResponses,
  getFortunes,
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
const SVG_DIR = path.join(ASSETS_DIR, 'svg');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

interface StaticEntry {
  path: string;
  contentType: string;
}

const STATIC_ASSETS: Record<string, StaticEntry> = {
  '/static/silverwolf.webp': { path: path.join(ROOT_DIR, 'silverwolf.webp'), contentType: 'image/webp' },
  '/static/silverwolf.avif': { path: path.join(ROOT_DIR, 'silverwolf.avif'), contentType: 'image/avif' },
  '/static/silverwolfLv.999.webp': { path: path.join(ROOT_DIR, 'silverwolfLv.999.webp'), contentType: 'image/webp' },
  '/static/silverwolfLv.999.avif': { path: path.join(ROOT_DIR, 'silverwolfLv.999.avif'), contentType: 'image/avif' },
  '/static/styles.css': { path: path.join(ASSETS_DIR, 'styles.css'), contentType: 'text/css; charset=utf-8' },
  '/static/fonts/italianno.woff2': { path: path.join(FONTS_DIR, 'italianno.woff2'), contentType: 'font/woff2' },
};
// Stickers: WebP only — they're tiny (~30 KB) and AVIF savings don't justify the decode overhead.
for (const name of [
  'Sticker_PPG_04_Silver_Wolf_01.webp',
  'Sticker_PPG_19_Silver_Wolf_01.webp',
  'Sticker_PPG_02_Silver_Wolf_01.webp',
  'Sticker_PPG_04_Silver_Wolf_02.webp',
  'Sticker_PPG_27_Silver_Wolf_LV.999_01.webp',
  'Sticker_PPG_27_Silver_Wolf_LV.999_02.webp',
  'Sticker_PPG_27_Silver_Wolf_LV.999_03.webp',
  'Sticker_PPG_27_Silver_Wolf_LV.999_04.webp',
]) {
  STATIC_ASSETS[`/static/stickers/${name}`] = { path: path.join(IMAGES_DIR, name), contentType: 'image/webp' };
}
// Eidolons: serve both WebP and AVIF; <picture> in pages/about.ts picks the best.
for (let i = 1; i <= 6; i += 1) {
  for (const variant of ['', 'LV.999_']) {
    const stem = `Character_Silver_Wolf_${variant}Eidolon_${i}`;
    STATIC_ASSETS[`/static/eidolons/${stem}.webp`] = { path: path.join(IMAGES_DIR, `${stem}.webp`), contentType: 'image/webp' };
    STATIC_ASSETS[`/static/eidolons/${stem}.avif`] = { path: path.join(IMAGES_DIR, `${stem}.avif`), contentType: 'image/avif' };
  }
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

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function rateLimiter(limit: number, windowMs: number) {
  return async (c: any, next: any) => {
    const rawIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const ip = rawIp.split(',')[0].trim();
    const now = Date.now();
    let record = rateLimitMap.get(ip);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(ip, record);
    }
    record.count += 1;
    if (record.count > limit) {
      return c.text('Too Many Requests', 429);
    }
    return next();
  };
}

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono<{ Variables: { nonce: string } }>();

  app.use('*', rateLimiter(120, 60000)); // 120 reqs per minute per IP
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/static/')) return next();
    const nonce = randomBytes(16).toString('base64');
    c.set('nonce', nonce);
    await next();
    c.header('Content-Security-Policy', buildCsp(nonce));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Frame-Options', 'DENY');
  });

  app.get('/', (c) => c.redirect('/about'));

  app.get('/about', (c) => c.html(AboutPage({ nonce: c.get('nonce'), lv999: c.req.query('lv') === '999' }).toString()));

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

  app.get('/games', (c) => c.html(GamesPage({ nonce: c.get('nonce') }).toString()));

  app.get('/games/8ball', (c) => {
    const { normal, savage } = getEightBallResponses();
    return c.html(EightBallPage({ normal, savage, nonce: c.get('nonce') }).toString());
  });

  app.get('/games/flip', (c) => c.html(FlipPage({ nonce: c.get('nonce') }).toString()));

  app.get('/games/fortune', (c) => {
    const fortunes = getFortunes();
    return c.html(FortunePage({ fortunes, nonce: c.get('nonce') }).toString());
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
