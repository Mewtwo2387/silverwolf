import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar, type NavActive, type NavUser } from './navbar';
import { Footer } from './footer';

const FAVICON_STICKERS = [
  '/static/stickers/Sticker_PPG_04_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_19_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_02_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_04_Silver_Wolf_02.webp',
];

const FAVICON_STICKERS_LV999 = [
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_01.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_02.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_03.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_04.webp',
];

const faviconLink = (lv999: boolean) => {
  const pool = lv999 ? FAVICON_STICKERS_LV999 : FAVICON_STICKERS;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return raw(`<link rel="icon" type="image/webp" href="${pick}" />`);
};

const pageHead = (nonce: string) => raw(`
<link rel="stylesheet" href="/static/styles.css" />
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
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t !== 'flashbang' && t !== 'blackout') return;
  document.documentElement.setAttribute('data-theme', t);

  function patch(a) {
    try {
      var u = new URL(a.href, location.origin);
      if (u.origin !== location.origin) return;
      if (u.searchParams.has('theme')) return;
      u.searchParams.set('theme', t);
      a.href = u.toString();
    } catch (e) {}
  }

  // Patch all internal anchors once the DOM is ready (keeps hover URLs accurate)
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href]').forEach(patch);
  });

  // Capture-phase click delegation: bulletproof fallback for any anchor
  // (mobile drawer links, dynamically inserted links, etc.) — runs before
  // any other click handler so href is patched by the time navigation happens.
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a) patch(a);
  }, true);
})();
</script>
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
      <body class="font-sans bg-ink-900 text-fog-100 min-h-screen flex flex-col">
        ${Navbar(opts.active, opts.nonce, opts.lv999, opts.user)}
        <main class="flex-1 w-full max-w-[1100px] mx-auto py-8 px-[clamp(1rem,4vw,3rem)]">${opts.body}</main>
        ${Footer(opts.nonce)}
      </body>
    </html>`;
}
