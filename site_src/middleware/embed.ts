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

// x-forwarded-* are attacker-controllable on any request that doesn't actually
// transit our proxy, so validate before trusting: proto must be exactly http(s),
// and host must look like host[:port] with no scheme, path, userinfo or control
// chars. These embed URLs (og:image/og:url) are absolute, so a spoofed host
// would point a shared link's preview at an attacker domain.
const FWD_PROTO_RE = /^https?$/;
const FWD_HOST_RE = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

// Public origin for absolute embed URLs, resolved fail-closed:
//   1. PUBLIC_ORIGIN env — explicit and authoritative; set this in production
//      (behind Cloudflare the origin server sees plain http on an internal
//      port) so spoofed forwarded headers can never take effect.
//   2. x-forwarded-proto/-host — only when each passes validation above.
//   3. The request URL — local dev, where there is no proxy.
// Untrusted or malformed forwarded headers are ignored, not trusted.
function publicOrigin(c: Context<AppEnv>): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const url = new URL(c.req.url);
  const fwdProto = c.req.header('x-forwarded-proto');
  const fwdHost = c.req.header('x-forwarded-host');
  const proto = fwdProto && FWD_PROTO_RE.test(fwdProto) ? fwdProto : url.protocol.replace(':', '');
  const host = fwdHost && FWD_HOST_RE.test(fwdHost) ? fwdHost : url.host;
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
