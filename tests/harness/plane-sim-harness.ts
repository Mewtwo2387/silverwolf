// Standalone dev harness for the client-side Three.js games (Plane Sim, its
// model inspector and the Wave Sim). Renders the real page components and
// serves `site_src/Assets/` as `/static/`, so the games can be loaded in a
// browser without booting the Discord bot, the database or the OAuth stack.
//
//   bun run test:harness        # then open http://127.0.0.1:7788/games/plane-sim
//
// Why this exists: `bun run build:js` does NOT catch undefined identifiers — a
// call to a function you forgot to import bundles fine (Bun treats it as a
// global) and only throws `ReferenceError` once the page runs. A green build is
// not enough; after touching `plane-sim.src.js` or any `plane-sim-*.js` module,
// load it here and check the console.
//
// The pages are passed logged-out props (`user: null`), so anything behind a
// login — the Medals tab, stat submission — renders its signed-out state. That
// is deliberate: the harness covers the 3D scene, not the account plumbing.
//
// NOT part of the server image — `.dockerignore` excludes `tests/`.
import path from 'path';
import { PlaneSimPage } from '../../site_src/pages/games/plane-sim';
import { PlaneViewerPage } from '../../site_src/pages/games/plane-viewer';
import { WaveSimPage } from '../../site_src/pages/games/wave-sim';

const ASSETS = path.join(import.meta.dir, '..', '..', 'site_src', 'Assets');
const PORT = Number(process.env.HARNESS_PORT) || 7788;

const CT: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

// The page components are Hono `html` tags — async, resolving to the markup.
const render = async (page: unknown) => new Response(
  `<!doctype html>${await (page as Promise<string>)}`,
  { headers: { 'content-type': 'text/html; charset=utf-8' } },
);

const simProps = {
  nonce: 'testnonce', user: null, stats: null, csrf: null,
};
const viewProps = { nonce: 'testnonce', user: null };

const PAGES: Record<string, () => unknown> = {
  '/': () => PlaneSimPage(simProps),
  '/games/plane-sim': () => PlaneSimPage(simProps),
  '/games/plane-sim/inspect': () => PlaneViewerPage(viewProps),
  '/games/wave-sim': () => WaveSimPage(viewProps),
};

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const { pathname } = new URL(req.url);

    const page = PAGES[pathname];
    if (page) return render(page());

    if (pathname.startsWith('/static/')) {
      // Strip the `?v=<hash>` cache-buster the pages append to asset URLs.
      const rel = pathname.slice('/static/'.length).split('?')[0];
      // Keep reads inside the Assets dir — `..` in the URL must not escape it.
      const abs = path.resolve(ASSETS, rel);
      if (!abs.startsWith(ASSETS + path.sep)) return new Response('forbidden', { status: 403 });
      const file = Bun.file(abs);
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'content-type': CT[path.extname(rel).toLowerCase()] || 'application/octet-stream' },
        });
      }
    }

    return new Response('not found', { status: 404 });
  },
});

console.log(`plane-sim harness on http://127.0.0.1:${PORT}/games/plane-sim`);
console.log(`  inspector  http://127.0.0.1:${PORT}/games/plane-sim/inspect`);
console.log(`  wave sim   http://127.0.0.1:${PORT}/games/wave-sim`);
