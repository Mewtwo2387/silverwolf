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
import { HomePage, type DashboardProfile } from './pages/home';
import type { NavUser } from './components/navbar';
import {
  getLeaderboard,
  getAllBirthdaysByMonth,
  getEightBallResponses,
  getFortunes,
  resolveUser,
  type LeaderboardKind,
} from './bot-bridge';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordMe,
} from './auth/discord-oauth';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  constantTimeEqual,
  createSession,
  loadSession,
  newRandomId,
  readOAuthStateCookie,
  readSessionId,
  setOAuthStateCookie,
  setSessionCookie,
  SESSION_TTL_MS,
} from './auth/session';

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
STATIC_ASSETS['/static/svg/pool-8-ball-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'pool-8-ball-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/fortune-cookie-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'fortune-cookie-svgrepo-com.svg'), contentType: 'image/svg+xml' };

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

const RATE_LIMIT_MAX_ENTRIES = 50_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// Cloudflare overwrites cf-connecting-ip on every request, so it can't be spoofed
// by clients. The deploy MUST keep origin port unreachable except via Cloudflare
// (firewall to CF IP ranges, cloudflared tunnel, or 127.0.0.1 bind behind a local
// proxy) — otherwise direct callers all collapse into the same 'unknown' bucket.
function clientIp(c: any): string {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf.trim();
  const peer = c.env?.requestIP?.(c.req.raw);
  return peer?.address ?? 'unknown';
}

function rateLimiter(limit: number, windowMs: number) {
  return async (c: any, next: any) => {
    if (c.req.path.startsWith('/static/')) return next();
    const ip = clientIp(c);
    const now = Date.now();
    let record = rateLimitMap.get(ip);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(ip, record);
      if (rateLimitMap.size > RATE_LIMIT_MAX_ENTRIES) {
        const firstKey = rateLimitMap.keys().next().value;
        if (firstKey !== undefined) rateLimitMap.delete(firstKey);
      }
    }
    record.count += 1;
    if (record.count > limit) {
      return c.text('Too Many Requests', 429);
    }
    return next();
  };
}

interface SessionUser {
  discordId: string;
  sessionId: string;
  nav: NavUser;
}

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono<{ Variables: { nonce: string; user: SessionUser | null } }>();

  const navUser = (c: any): NavUser | null => {
    const u = c.get('user');
    return u ? u.nav : null;
  };

  app.use('*', rateLimiter(120, 60000)); // 120 reqs per minute per IP
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/static/')) {
      await next();
      return;
    }
    const nonce = randomBytes(16).toString('base64');
    c.set('nonce', nonce);
    await next();
    c.header('Content-Security-Policy', buildCsp(nonce));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Frame-Options', 'DENY');
  });

  // Session middleware: populate c.var.user from cookie. Skips static assets.
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/static/')) return next();
    const sessionId = readSessionId(c);
    if (!sessionId) {
      c.set('user', null);
      return next();
    }
    try {
      const session = await loadSession(silverwolf, sessionId);
      if (!session) {
        clearSessionCookie(c);
        c.set('user', null);
      } else {
        const display = await resolveUser(silverwolf, session.discordId);
        c.set('user', {
          discordId: session.discordId,
          sessionId: session.id,
          nav: { username: display.username, avatarURL: display.avatarURL },
        });
        // Sliding expiry: bump on every authed request.
        await silverwolf.db.webSession.touchSession(session.id, SESSION_TTL_MS);
      }
    } catch (err) {
      logError('session middleware failed:', err);
      c.set('user', null);
    }
    return next();
  });

  app.get('/auth/discord/login', (c) => {
    try {
      const state = newRandomId(16);
      setOAuthStateCookie(c, state);
      return c.redirect(buildAuthorizeUrl(state));
    } catch (err) {
      logError('login init failed:', err);
      return c.text('Login is not configured', 500);
    }
  });

  app.get('/auth/discord/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const expectedState = readOAuthStateCookie(c);
    clearOAuthStateCookie(c);

    if (!code || !state || !expectedState || !constantTimeEqual(state, expectedState)) {
      return c.text('Invalid OAuth state', 400);
    }

    try {
      const { accessToken } = await exchangeCode(code);
      const me = await fetchDiscordMe(accessToken);
      // Ensure a User row exists so downstream pages can read stats by Discord ID.
      await silverwolf.db.user.getUser(me.id);
      const { id: sessionId } = await createSession(silverwolf, me.id);
      setSessionCookie(c, sessionId);
      return c.redirect('/me');
    } catch (err) {
      logError('OAuth callback failed:', err);
      return c.text('Login failed', 500);
    }
  });

  app.get('/auth/logout', async (c) => {
    const user = c.get('user');
    if (user) {
      try {
        await silverwolf.db.webSession.deleteSession(user.sessionId);
      } catch (err) {
        logError('logout failed:', err);
      }
    }
    clearSessionCookie(c);
    return c.redirect('/');
  });

  app.get('/me', async (c) => {
    const user = c.get('user');
    if (!user) return c.redirect('/');
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    try {
      const stats = await silverwolf.db.user.getUser(user.discordId);
      const pokemonCount = await silverwolf.db.pokemon.getUniquePokemonCount(user.discordId);
      const marriageBenefits = await silverwolf.db.marriage.getMarriageBenefits(user.discordId);

      const profile: DashboardProfile = {
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        stats,
        pokemonCount,
        marriageBenefits,
      };
      return c.html(HomePage({
        profile, user: user.nav, nonce, lv999,
      }).toString());
    } catch (err) {
      logError('website /me dashboard failed:', err);
      return c.text('Failed to load dashboard', 500);
    }
  });

  app.get('/', (c) => {
    const user = c.get('user');
    return c.redirect(user ? '/me' : '/about');
  });

  app.get('/about', (c) => c.html(AboutPage({ nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c) }).toString()));

  for (const [route, entry] of Object.entries(STATIC_ASSETS)) {
    app.get(route, () => serveStatic(entry));
  }

  app.get('/leaderboards', async (c) => {
    const raw = c.req.query('board');
    const selected = raw && (VALID_BOARDS as string[]).includes(raw) ? (raw as LeaderboardKind) : undefined;
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';

    const user = navUser(c);
    if (!selected) {
      return c.html(LeaderboardsPage({ nonce, lv999, user }).toString());
    }

    try {
      const result = await getLeaderboard(silverwolf, selected);
      return c.html(LeaderboardsPage({
        selected, result, nonce, lv999, user,
      }).toString());
    } catch (err) {
      logError('website /leaderboards failed:', err);
      return c.html(
        LeaderboardsPage({
          selected, error: 'Failed to load leaderboard.', nonce, lv999, user,
        }).toString(),
        500,
      );
    }
  });

  app.get('/birthdays', async (c) => {
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const user = navUser(c);
    try {
      const grouped = await getAllBirthdaysByMonth(silverwolf);
      return c.html(BirthdaysPage({
        grouped, nonce, lv999, user,
      }).toString());
    } catch (err) {
      logError('website /birthdays failed:', err);
      return c.html(BirthdaysPage({
        grouped: {}, error: 'Failed to load birthdays.', nonce, lv999, user,
      }).toString(), 500);
    }
  });

  app.get('/games', (c) => c.html(GamesPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/8ball', (c) => {
    const { normal, savage } = getEightBallResponses();
    return c.html(EightBallPage({
      normal, savage, nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
    }).toString());
  });

  app.get('/games/flip', (c) => c.html(FlipPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/fortune', (c) => {
    const fortunes = getFortunes();
    return c.html(FortunePage({
      fortunes, nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
    }).toString());
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
