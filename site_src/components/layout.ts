import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar } from './navbar';
import { Footer } from './footer';

const pageHead = (nonce: string) => raw(`
<link rel="stylesheet" href="/static/styles.css" />
<script nonce="${nonce}">
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t === 'flashbang' || t === 'blackout') document.documentElement.setAttribute('data-theme', t);
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
