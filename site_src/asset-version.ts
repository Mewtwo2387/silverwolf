import { statSync, readFileSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';

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

// Content-hash map for every image in a directory, keyed by basename WITHOUT
// extension: { 'spit-skin-special': 'ab12cd34', 'p51-fus-desert': '...' }.
// Reuses the mtime-cached per-file hashing above. Injected into the plane pages
// as a JSON island so the client's Three.js texture loads can cache-bust
// /static/planes/*.jpg the same way styles.css / app.js do — no manual ?v bump.
// The directory listing is itself cached by the dir's mtime (adding/removing a
// file moves it), so a warm call only re-stats the files it already knows.
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const dirListCache = new Map<string, { mtime: number; names: string[] }>();

export function assetVersionMap(dirAbs: string): Record<string, string> {
  let names: string[];
  try {
    const mtime = statSync(dirAbs).mtimeMs;
    const cached = dirListCache.get(dirAbs);
    if (cached && cached.mtime === mtime) {
      names = cached.names;
    } else {
      names = readdirSync(dirAbs).filter((n) => IMG_EXT.has(extname(n).toLowerCase()));
      dirListCache.set(dirAbs, { mtime, names });
    }
  } catch {
    return {};
  }
  const map: Record<string, string> = {};
  for (const n of names) {
    // Key by basename without extension; the client references textures by
    // that stem (e.g. 'asphalt', 'spit-skin-special') and assumes .jpg.
    map[basename(n, extname(n))] = assetVersion(join(dirAbs, n));
  }
  return map;
}
