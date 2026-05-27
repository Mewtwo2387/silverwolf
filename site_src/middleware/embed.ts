import type { Context, Next } from 'hono';
import type { AppEnv } from '../shared';
import { embedMetaTags } from '../embed-meta';

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const ENTITY_DECODE: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
};

// Reuse the page's own <title> as the embed title. It arrives HTML-escaped from
// the template, so decode it back to plain text before embed-meta re-escapes it
// for an attribute (otherwise "&" would become "&amp;amp;").
function pageTitle(html: string): string {
  const m = TITLE_RE.exec(html);
  if (!m) return 'Silverwolf';
  const decoded = m[1].replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (e) => ENTITY_DECODE[e]).trim();
  return decoded || 'Silverwolf';
}

// Public origin. Behind Cloudflare the origin server sees plain http on an
// internal port, so trust x-forwarded-proto/-host (CF sets both) and only fall
// back to the request URL for local dev.
function publicOrigin(c: Context<AppEnv>): string {
  const url = new URL(c.req.url);
  const proto = c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = c.req.header('x-forwarded-host') ?? url.host;
  return `${proto}://${host}`;
}

/**
 * Inject Open Graph / Twitter embed tags so shared links unfurl into a rich
 * preview. Registered as the outermost middleware: it transforms the final HTML
 * body and leaves everything else (404 text, JSON APIs, static assets,
 * redirects) untouched — so invalid links never get an embed.
 *
 * Replacing c.res preserves the security headers: Hono's `set res` merges the
 * previous response's headers (CSP, cookies, …) onto the new one.
 */
export async function embedMetaMiddleware(c: Context<AppEnv>, next: Next) {
  await next();
  if (c.req.method !== 'GET') return;

  const contentType = c.res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return;

  const body = await c.res.text();
  const headClose = body.indexOf('</head>');
  if (headClose === -1) return;

  const tags = embedMetaTags({
    origin: publicOrigin(c),
    path: c.req.path,
    title: pageTitle(body),
    lv999: c.req.query('lv') === '999',
  });

  // eslint-disable-next-line no-param-reassign -- the Hono idiom for replacing the response body
  c.res = new Response(
    `${body.slice(0, headClose)}${tags}\n${body.slice(headClose)}`,
    { status: c.res.status, statusText: c.res.statusText, headers: { 'content-type': contentType } },
  );
}
