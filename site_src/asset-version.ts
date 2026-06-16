import { statSync, readFileSync } from 'fs';

// Static assets are served with `immutable, max-age=1y`, so without a cache
// buster the browser never re-fetches after a rebuild. Hash the file contents
// and append `?v=<hash>` to its URL: same contents → same URL → still cached;
// changed contents → new URL → fresh fetch. stat() each request is microseconds;
// the hash is only recomputed when the file's mtime moves.
const cache = new Map<string, { mtime: number; hash: string }>();

export function assetVersion(absPath: string): string {
  const prev = cache.get(absPath);
  try {
    const mtime = statSync(absPath).mtimeMs;
    if (!prev || mtime !== prev.mtime) {
      const bytes = readFileSync(absPath);
      const hash = new Bun.CryptoHasher('md5').update(bytes).digest('hex').slice(0, 8);
      const next = { mtime, hash };
      cache.set(absPath, next);
      return hash;
    }
    return prev.hash;
  } catch {
    // Keep last good (or "dev") if the file vanishes mid-build.
    return prev ? prev.hash : 'dev';
  }
}
