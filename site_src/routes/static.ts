import path from 'path';
import type { Hono } from 'hono';
import type { AppEnv } from '../shared';

const ROOT_DIR = path.resolve(import.meta.dir, '..', '..');
const ASSETS_DIR = path.join(import.meta.dir, '..', 'Assets');
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
};
// Stickers power the favicon (WebP) and the social-embed thumbnail. The PNG
// twin of each is served as a universally-decodable fallback for link-preview
// scrapers that won't fetch WebP (see site_src/embed-meta.ts).
for (const stem of [
  'Sticker_PPG_04_Silver_Wolf_01',
  'Sticker_PPG_19_Silver_Wolf_01',
  'Sticker_PPG_02_Silver_Wolf_01',
  'Sticker_PPG_04_Silver_Wolf_02',
  'Sticker_PPG_27_Silver_Wolf_LV.999_01',
  'Sticker_PPG_27_Silver_Wolf_LV.999_02',
  'Sticker_PPG_27_Silver_Wolf_LV.999_03',
  'Sticker_PPG_27_Silver_Wolf_LV.999_04',
]) {
  STATIC_ASSETS[`/static/stickers/${stem}.webp`] = { path: path.join(IMAGES_DIR, `${stem}.webp`), contentType: 'image/webp' };
  STATIC_ASSETS[`/static/stickers/${stem}.png`] = { path: path.join(IMAGES_DIR, `${stem}.png`), contentType: 'image/png' };
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
STATIC_ASSETS['/static/svg/poker-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'poker-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/pile-of-poo-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'pile-of-poo-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/roulette-casino-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'roulette-casino-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/slots-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'slots-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/toilet-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'toilet-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/love-heart-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'love-heart-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/coin-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'coin-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/svg/wrench-screwdriver-svgrepo-com.svg'] = { path: path.join(SVG_DIR, 'wrench-screwdriver-svgrepo-com.svg'), contentType: 'image/svg+xml' };
STATIC_ASSETS['/static/game-dinonuggie.webp'] = { path: path.join(IMAGES_DIR, 'game-dinonuggie.webp'), contentType: 'image/webp' };
STATIC_ASSETS['/static/game-awdangit.jpeg'] = { path: path.join(IMAGES_DIR, 'game-awdangit.jpeg'), contentType: 'image/jpeg' };
STATIC_ASSETS['/static/game-fakequote.webp'] = { path: path.join(IMAGES_DIR, 'game-fakequote.webp'), contentType: 'image/webp' };
for (const rarity of ['gold', 'silver', 'bronze']) {
  STATIC_ASSETS[`/static/dinonuggie-${rarity}.png`] = {
    path: path.join(ROOT_DIR, 'data', 'images', `dinonuggie-${rarity}.png`),
    contentType: 'image/png',
  };
}

async function serveStatic(entry: StaticEntry) {
  const file = Bun.file(entry.path);
  if (!(await file.exists())) return new Response('not found', { status: 404 });
  const headers: Record<string, string> = {
    'content-type': entry.contentType,
    'cache-control': IMMUTABLE_CACHE,
  };
  // SVGs can carry <script> if served as a top-level document. Lock them down
  // so even a future malicious-SVG drop in Assets/svg/ can't run JS.
  if (entry.contentType === 'image/svg+xml') {
    headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }
  return new Response(file, { headers });
}

export function registerStaticRoutes(app: Hono<AppEnv>) {
  for (const [route, entry] of Object.entries(STATIC_ASSETS)) {
    app.get(route, () => serveStatic(entry));
  }
}
