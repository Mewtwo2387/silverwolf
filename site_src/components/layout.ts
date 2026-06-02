import { html, raw } from 'hono/html';
import path from 'path';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar, type NavActive, type NavUser } from './navbar';
import { Footer } from './footer';
import { Search } from './search';
import { STICKER_STEMS, STICKER_STEMS_LV999, stickerWebpUrl } from '../stickers';
import { assetVersion } from '../asset-version';

const STYLES_PATH = path.resolve(import.meta.dir, '..', 'Assets', 'styles.css');
const APP_JS_PATH = path.resolve(import.meta.dir, '..', 'Assets', 'app.js');

// Exported so the embed-meta middleware can reuse the same pool for the social
// thumbnail — the link preview shows a random favicon sticker, matching the tab.
export const FAVICON_STICKERS = STICKER_STEMS.map(stickerWebpUrl);
export const FAVICON_STICKERS_LV999 = STICKER_STEMS_LV999.map(stickerWebpUrl);

const faviconLink = (lv999: boolean) => {
  const pool = lv999 ? FAVICON_STICKERS_LV999 : FAVICON_STICKERS;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return raw(`<link rel="icon" type="image/webp" href="${pick}" />`);
};

const pageHead = (nonce: string) => raw(`
<link rel="preload" href="/static/fonts/Outfit.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/static/styles.css?v=${assetVersion(STYLES_PATH)}" />
<style>
  /* Guard against any descendant (entrance-animation transforms, full-bleed
     images, etc.) accidentally pushing the page wider than the viewport.
     Applies everywhere — Chrome responsive mode doesn't always match the
     touch media query, so scoping this to touch leaves desktop responsive
     previews able to get stuck mid-overflow on first paint. */
  html, body { overflow-x: clip; }

  /* Paint the dark background on <html> itself (not just <body>) so Chromium
     doesn't flash white between navigations — Chromium uses the html element's
     background for the initial canvas + cross-document paint hold. color-scheme
     also keeps form controls / scrollbars dark from the first frame. */
  html { background-color: #06080f; color-scheme: dark; }
  html[data-theme="flashbang"] { background-color: #eef3ff; color-scheme: light; }
  html[data-theme="blackout"] { background-color: #020308; color-scheme: dark; }

  /* When the bottom-fixed liquid-glass dock is visible, it would otherwise
     cover the tail of the page content — reserve space for it (plus iOS home
     indicator). Match navbar.ts: width-based OR touch query. */
  @media (max-width: 1024px), (hover: none) and (pointer: coarse) {
    main { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
  }
</style>
<script nonce="${nonce}">
// Pre-paint only: set <html data-theme> before first paint to avoid a flash of
// the wrong theme. The heavier link-patching lives in /static/app.js.
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t === 'flashbang' || t === 'blackout') document.documentElement.setAttribute('data-theme', t);
})();
</script>
<script src="/static/app.js?v=${assetVersion(APP_JS_PATH)}" defer></script>
`);

export function Layout(opts: {
  title: string;
  active?: NavActive;
  extraHead?: HtmlEscapedString;
  body: HtmlEscapedString;
  nonce: string;
  lv999?: boolean;
  user?: NavUser | null;
}) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${opts.title}</title>
        ${faviconLink(opts.lv999 ?? false)}
        ${pageHead(opts.nonce)}
        ${opts.extraHead ?? ''}
      </head>
      <body class="font-sans bg-ink-900 text-fog-100 min-h-screen flex flex-col scanlines cyber-grid">
        ${Navbar(opts.active, opts.lv999, opts.user)}
        <main class="flex-1 w-full max-w-[1100px] mx-auto py-8 px-[clamp(1rem,4vw,3rem)]">${opts.body}</main>
        ${Footer(opts.nonce)}
        ${Search()}
      </body>
    </html>`;
}
