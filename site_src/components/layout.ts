import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar } from './navbar';
import { Footer } from './footer';

const pageHead = (nonce: string) => raw(`
<link rel="stylesheet" href="/static/styles.css" />
<style>
  /* Smooth cross-fade between pages on browsers that support it (Safari iOS 18+, Chromium 126+).
     Older browsers ignore the rule and navigate normally. */
  @view-transition { navigation: auto; }

  /* On touch devices, the bottom-fixed liquid-glass dock would otherwise cover
     the tail of the page content — reserve space for it (plus iOS home indicator). */
  @media (hover: none) and (pointer: coarse) {
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
  active?: 'about' | 'leaderboards' | 'birthdays' | 'games';
  extraHead?: HtmlEscapedString;
  body: HtmlEscapedString;
  nonce: string;
  lv999?: boolean;
}) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${opts.title}</title>
        ${pageHead(opts.nonce)}
        ${opts.extraHead ?? ''}
      </head>
      <body class="font-sans bg-ink-900 text-fog-100 min-h-screen flex flex-col">
        ${Navbar(opts.active, opts.nonce, opts.lv999)}
        <main class="flex-1 w-full max-w-[1100px] mx-auto py-8 px-[clamp(1rem,4vw,3rem)]">${opts.body}</main>
        ${Footer()}
      </body>
    </html>`;
}
