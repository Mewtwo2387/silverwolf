import { GAMES } from './pages/games';
import { FAVICON_STICKERS, FAVICON_STICKERS_LV999 } from './components/layout';

const SITE_NAME = 'Silverwolf';

// Shown as the embed body text on /about and on any page we don't special-case
// below. Mirrors the opening paragraph in pages/about.ts.
const ABOUT_INTRO = 'Silverwolf-bot is a multipurpose bot made by Ei and XeIris. Mostly inside jokes, parodies and tech stack exploration, it runs on Bun using Typescript.';

// Discord paints the embed's left accent bar from <meta name="theme-color">.
// Neon cyan to match the site's accent.
const THEME_COLOR = '#22d3ff';

const STATIC_DESCRIPTIONS: Record<string, string> = {
  '/about': ABOUT_INTRO,
  '/leaderboards': 'Browse every Silverwolf leaderboard — gambler, murder, nuggie and poop.',
  '/birthdays': 'See whose birthday is coming up next, laid out month by month.',
  '/games': 'Play games on Silverwolf — gamble credits, flip coins, claim dinonuggies and more.',
};

/** Drop trailing slashes so "/games/" and "/games" map to the same entry. */
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * The embed description for a route. /games/{game} reuses that game's card
 * blurb (single source of truth); anything we don't recognise falls back to the
 * site's opening paragraph.
 */
export function embedDescriptionForPath(path: string): string {
  const p = normalizePath(path);
  if (p in STATIC_DESCRIPTIONS) return STATIC_DESCRIPTIONS[p];
  const game = GAMES.find((g) => g.href === p);
  if (game) return game.info;
  return ABOUT_INTRO;
}

const ATTR_ESCAPES: Record<string, string> = {
  '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;',
};
function attr(value: string): string {
  return value.replace(/[&"<>]/g, (ch) => ATTR_ESCAPES[ch]);
}

// All stickers are square; only this one is 340px (the rest default to 256).
const STICKER_SIZE: Record<string, number> = {
  Sticker_PPG_02_Silver_Wolf_01: 340,
};
const DEFAULT_STICKER_SIZE = 256;

interface Thumbnail {
  /** PNG fallback served to scrapers that won't decode WebP. */
  png: string;
  size: number;
}

function pickThumbnail(lv999: boolean): Thumbnail {
  const pool = lv999 ? FAVICON_STICKERS_LV999 : FAVICON_STICKERS;
  const webp = pool[Math.floor(Math.random() * pool.length)]; // e.g. /static/stickers/Foo.webp
  const stem = webp.slice(webp.lastIndexOf('/') + 1, -'.webp'.length);
  return { png: webp.replace(/\.webp$/, '.png'), size: STICKER_SIZE[stem] ?? DEFAULT_STICKER_SIZE };
}

const meta = (kind: 'property' | 'name', key: string, content: string) => `<meta ${kind}="${key}" content="${attr(content)}" />`;

/**
 * Open Graph + Twitter-card <meta> tags so chat apps (Discord, WhatsApp, Slack,
 * Instagram, …) unfurl a shared link into a rich preview. The thumbnail is a
 * random Silver Wolf sticker (PNG, for the widest scraper support); image/url
 * are absolute because most scrapers require it, and the explicit dimensions
 * let scrapers lay out the card before the image loads.
 */
export function embedMetaTags(opts: {
  origin: string;
  path: string;
  title: string;
  lv999?: boolean;
}): string {
  const description = embedDescriptionForPath(opts.path);
  const thumb = pickThumbnail(opts.lv999 ?? false);
  const image = `${opts.origin}${thumb.png}`;
  const url = `${opts.origin}${normalizePath(opts.path)}`;
  return [
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:title', opts.title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', String(thumb.size)),
    meta('property', 'og:image:height', String(thumb.size)),
    meta('property', 'og:image:alt', `${SITE_NAME} sticker`),
    meta('property', 'og:url', url),
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', opts.title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'theme-color', THEME_COLOR),
    meta('name', 'description', description),
  ].join('\n');
}
