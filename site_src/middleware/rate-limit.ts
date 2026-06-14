import type { Context, Next } from 'hono';
import type { AppEnv } from '../shared';

const RATE_LIMIT_MAX_ENTRIES = 50_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// Cloudflare overwrites cf-connecting-ip on every request, so it can't be spoofed
// by clients. The deploy MUST keep origin port unreachable except via Cloudflare
// (firewall to CF IP ranges, cloudflared tunnel, or 127.0.0.1 bind behind a local
// proxy) — otherwise direct callers all collapse into the same 'unknown' bucket.
export function clientIp(c: Context<AppEnv>): string {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf.trim();
  const peer = (c as any).env?.requestIP?.(c.req.raw);
  return peer?.address ?? 'unknown';
}

// IPv6 ISPs hand out /64 subnets (2^64 addresses) per customer. Per-IP rate
// limiting on raw IPv6 means an attacker can rotate addresses inside their
// /64 and bypass the limit forever. Bucket by /64 instead.
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  // Expand "::" if present so we can grab the first 4 hextets reliably.
  const [head, tail] = ip.split('::', 2);
  let hextets: string[];
  if (tail !== undefined) {
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const fillCount = 8 - headParts.length - tailParts.length;
    hextets = [...headParts, ...Array(Math.max(0, fillCount)).fill('0'), ...tailParts];
  } else {
    hextets = ip.split(':');
  }
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

export function rateLimiter(limit: number, windowMs: number) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.path.startsWith('/static/')) return next();
    const ip = rateLimitKey(clientIp(c));
    const now = Date.now();
    let record = rateLimitMap.get(ip);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(ip, record);
      if (rateLimitMap.size > RATE_LIMIT_MAX_ENTRIES) {
        const firstKey = rateLimitMap.keys().next().value;
        if (firstKey !== undefined) rateLimitMap.delete(firstKey);
      }
    }
    record.count += 1;
    if (record.count > limit) {
      return c.text('Too Many Requests', 429);
    }
    return next();
  };
}
