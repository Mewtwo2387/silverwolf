import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../shared';

// Async variants run on libuv's threadpool, so compression never blocks the
// single JS event loop. That keeps the bot + every other request responsive
// while a page is being compressed, and lets concurrent compressions use
// multiple cores (sync brotli serialized everything onto one thread).
const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// Only compress text-ish payloads. Images (webp/avif/png/jpeg), woff2 fonts and
// other binary assets are already compressed — re-compressing wastes CPU and can
// grow the body. Static assets are handled (and cached) in routes/static.ts, so
// this middleware deliberately skips /static/.
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg\+xml)/i;

// Below this size the gzip/brotli header overhead and CPU aren't worth it; a
// typed redirect or tiny JSON ack is faster sent raw.
const MIN_BYTES = 1024;

// Brotli quality 4: on this site's pages it is both faster *and* smaller than
// gzip level 6 (≈0.45ms vs 0.58ms for the 90 KB games page), so prefer it
// whenever the client advertises `br`. HTML here is `no-store`, so every page
// view is compressed fresh — keep the per-request cost low.
const BR_OPTS = { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } };

/**
 * Compress dynamic HTML/JSON responses on the way out. Registered as the
 * OUTERMOST middleware so it runs last and sees the final body *after*
 * embedMetaMiddleware has injected its <meta> tags.
 *
 * The Cloudflare tunnel carries the origin→edge leg uncompressed today; this
 * cuts that transfer (and the France VM's egress) by ~70% on every page view.
 */
export async function compressMiddleware(c: Context<AppEnv>, next: Next) {
  await next();

  // Static assets serve their own cached compressed buffers.
  if (c.req.path.startsWith('/static/')) return;

  const res = c.res;
  // 101/204/304 etc. carry no compressible body; already-encoded responses are
  // left alone so we never double-encode.
  if (!res.body || res.headers.get('content-encoding')) return;
  if (res.status === 204 || res.status === 304) return;

  const type = res.headers.get('content-type') ?? '';
  if (!COMPRESSIBLE.test(type)) return;

  const accept = c.req.header('accept-encoding') ?? '';
  const useBr = accept.includes('br');
  const useGzip = !useBr && accept.includes('gzip');
  if (!useBr && !useGzip) return;

  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length < MIN_BYTES) {
    // Body was already consumed by arrayBuffer(); hand back an identical copy.
    // eslint-disable-next-line no-param-reassign -- Hono idiom for replacing the body
    c.res = new Response(raw, { status: res.status, statusText: res.statusText, headers: res.headers });
    return;
  }

  const encoded = useBr ? await brotliAsync(raw, BR_OPTS) : await gzipAsync(raw, { level: 6 });

  const headers = new Headers(res.headers);
  headers.set('content-encoding', useBr ? 'br' : 'gzip');
  headers.set('vary', 'Accept-Encoding');
  headers.delete('content-length'); // stale; runtime sets the compressed length
  // eslint-disable-next-line no-param-reassign -- Hono idiom for replacing the body
  c.res = new Response(encoded, { status: res.status, statusText: res.statusText, headers });
}
