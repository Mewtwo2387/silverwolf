/**
 * Single source of truth for the client-side JS bundles.
 *
 *   bun scripts/build-js.ts            → build all bundles once   (used by `build:js`)
 *   bun scripts/build-js.ts --watch    → rebuild on source change (used by `build:js:watch`)
 *
 * Keeping the entry list here (instead of two hand-maintained `bun build … && …`
 * chains in package.json) stops the watch task from drifting out of sync with the
 * one-shot build — which is exactly how a stale bundle sneaks into local dev.
 */
import path from 'path';
import { watch } from 'fs';

const ROOT = path.join(import.meta.dir, '..');

/** entry `*.src.js` → served `*.js`. Mirror any change here in the Dockerfile's build step. */
const BUNDLES: { entry: string; outfile: string }[] = [
  { entry: 'site_src/Assets/app.src.js', outfile: 'site_src/Assets/app.js' },
  { entry: 'site_src/tcg/assets/tcg-detail.src.js', outfile: 'site_src/tcg/assets/tcg-detail.js' },
  { entry: 'site_src/tcg/assets/tcg-landing.src.js', outfile: 'site_src/tcg/assets/tcg-landing.js' },
  { entry: 'site_src/tcg/assets/tcg-join.src.js', outfile: 'site_src/tcg/assets/tcg-join.js' },
  { entry: 'site_src/tcg/assets/tcg-deck-builder.src.js', outfile: 'site_src/tcg/assets/tcg-deck-builder.js' },
  { entry: 'site_src/tcg/assets/tcg-battle-room.src.js', outfile: 'site_src/tcg/assets/tcg-battle-room.js' },
];

async function buildOne(b: { entry: string; outfile: string }): Promise<void> {
  const res = await Bun.build({
    entrypoints: [path.join(ROOT, b.entry)],
    minify: true,
    target: 'browser',
  });
  if (!res.success) {
    for (const m of res.logs) console.error(m);
    throw new Error(`Failed to build ${b.entry}`);
  }
  await Bun.write(path.join(ROOT, b.outfile), res.outputs[0]);
}

async function buildAll(): Promise<void> {
  await Promise.all(BUNDLES.map(buildOne));
}

await buildAll();
console.log(`Built ${BUNDLES.length} JS bundles.`);

if (process.argv.includes('--watch')) {
  const dirs = [...new Set(BUNDLES.map((b) => path.dirname(path.join(ROOT, b.entry))))];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const rebuild = async (): Promise<void> => {
    try {
      await buildAll();
      console.log(`[${new Date().toLocaleTimeString()}] rebuilt ${BUNDLES.length} bundles`);
    } catch (e) {
      console.error(e);
    }
  };

  // Defined once (not inside the loop) so it doesn't capture loop-scoped state — debounces
  // bursts of file events into a single rebuild, ignoring generated `.js` to avoid a loop.
  const onChange = (_evt: string, file: string | null): void => {
    if (!file || !(file.endsWith('.src.js') || file.endsWith('.lib.js'))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(rebuild, 80); // rebuild() swallows its own errors
  };

  for (const dir of dirs) watch(dir, onChange);
  console.log(`Watching ${dirs.length} dirs for *.src.js / *.lib.js changes…`);
}
