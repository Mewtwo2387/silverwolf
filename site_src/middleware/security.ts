import { randomBytes } from 'node:crypto';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../shared';

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // TODO(security): drop 'unsafe-inline' once every inline style="…" / <style>
    // block is migrated to a class or hash. Today this allowance gives any future
    // XSS a CSS-injection exfil channel (background-image: url(...) leaks).
    "style-src 'self' 'unsafe-inline'",
    // blob: is required by the Backrooms player model. three.js's GLTFLoader
    // extracts a GLB's embedded textures with URL.createObjectURL and loads
    // them through an <img>, so without it every material on the figure renders
    // untextured white. It is a narrow allowance: a blob: URL can only ever
    // name bytes this page itself created, so it adds no new remote origin and
    // no exfiltration channel.
    "img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net https://media.tenor.com https://c.tenor.com https://drive.google.com https://media.forgecdn.net",
    "font-src 'self'",
    // blob: here for the same reason as img-src above, and it is the half that
    // actually matters: three.js decodes a GLB's embedded textures with
    // ImageBitmapLoader, which fetch()es the object URL, so the load is
    // governed by connect-src rather than img-src. Both are needed — img-src
    // covers the <img> fallback path on browsers without createImageBitmap.
    "connect-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

export async function securityHeadersMiddleware(c: Context<AppEnv>, next: Next) {
  if (c.req.path.startsWith('/static/')) {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    return;
  }
  const nonce = randomBytes(16).toString('base64');
  c.set('nonce', nonce);
  await next();
  c.header('Content-Security-Policy', buildCsp(nonce));
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  // Per-user / nonce-bearing HTML must never be cached by intermediaries.
  // A single CF "Cache Everything" misconfiguration would otherwise reuse one
  // user's nonce (and /me payload) across visitors.
  c.header('Cache-Control', 'private, no-store');
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
