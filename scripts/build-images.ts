import path from 'path';
import fs from 'fs/promises';
import { ALL_STICKER_STEMS } from '../site_src/stickers';

const ROOT = path.resolve(import.meta.dir, '..');
const IMAGES_DIR = path.join(ROOT, 'site_src/Assets/Images');

const HERO_LV1 = path.join(ROOT, 'silverwolf.webp');
const HERO_LV999 = path.join(ROOT, 'silverwolfLv.999.webp');

const EIDOLONS: string[] = [];
for (let i = 1; i <= 6; i += 1) {
  EIDOLONS.push(path.join(IMAGES_DIR, `Character_Silver_Wolf_Eidolon_${i}.webp`));
  EIDOLONS.push(path.join(IMAGES_DIR, `Character_Silver_Wolf_LV.999_Eidolon_${i}.webp`));
}

const AVIF_TARGETS = [HERO_LV1, HERO_LV999, ...EIDOLONS];

// Favicon stickers ship as WebP, but a few link-preview scrapers (older
// WhatsApp/Telegram, some SEO tools) won't fetch WebP — so the social embed
// points at a PNG fallback derived from each sticker. The stem list is the
// shared source of truth in site_src/stickers.ts.
const STICKER_PNG_TARGETS = ALL_STICKER_STEMS.map((stem) => path.join(IMAGES_DIR, `${stem}.webp`));

// LV999 is the only file we recompress in place. Threshold guards against
// re-encoding an already-optimized copy on subsequent runs.
const LV999_RECOMPRESS_THRESHOLD = 2_500_000; // 2.5 MB
const LV999_QUALITY = 80;
const AVIF_QUALITY = 63;

const checkOnly = process.argv.includes('--check');

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function mtime(p: string): Promise<number> {
  return (await fs.stat(p)).mtimeMs;
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: 'inherit', stderr: 'inherit' });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(' ')}`);
}

// Returns true if HERO_LV999 needs (or just got) recompression — i.e. its
// mtime will change, so any derived AVIF must be treated as stale.
async function recompressLv999(): Promise<boolean> {
  const stat = await fs.stat(HERO_LV999);
  if (stat.size <= LV999_RECOMPRESS_THRESHOLD) {
    console.log(`[skip] ${path.basename(HERO_LV999)} already small (${(stat.size / 1024).toFixed(0)} KB)`);
    return false;
  }
  if (checkOnly) {
    console.error(`[stale] ${path.basename(HERO_LV999)} is ${(stat.size / 1024 / 1024).toFixed(2)} MB — needs recompression`);
    process.exitCode = 1;
    return true;
  }
  console.log(`[recompress] ${path.basename(HERO_LV999)} (${(stat.size / 1024 / 1024).toFixed(2)} MB → q${LV999_QUALITY})`);
  const tmp = `${HERO_LV999}.tmp.webp`;
  let renamed = false;
  try {
    await run([
      'magick', HERO_LV999,
      '-quality', String(LV999_QUALITY),
      '-define', 'webp:method=6',
      tmp,
    ]);
    await fs.rename(tmp, HERO_LV999);
    renamed = true;
  } finally {
    if (!renamed && await fileExists(tmp)) {
      try { await fs.unlink(tmp); } catch { /* best-effort cleanup */ }
    }
  }
  const after = await fs.stat(HERO_LV999);
  console.log(`           → ${(after.size / 1024 / 1024).toFixed(2)} MB`);
  return true;
}

async function encodeAvif(src: string): Promise<void> {
  const dst = src.replace(/\.webp$/i, '.avif');
  if (await fileExists(dst)) {
    const [srcM, dstM] = await Promise.all([mtime(src), mtime(dst)]);
    if (dstM >= srcM) {
      console.log(`[skip] ${path.basename(dst)} up to date`);
      return;
    }
  }
  if (checkOnly) {
    console.error(`[stale] ${path.basename(dst)} missing or older than source`);
    process.exitCode = 1;
    return;
  }
  console.log(`[encode] ${path.basename(dst)}`);
  await run([
    'magick', src,
    '-quality', String(AVIF_QUALITY),
    dst,
  ]);
  const [srcStat, dstStat] = await Promise.all([fs.stat(src), fs.stat(dst)]);
  const pct = ((1 - dstStat.size / srcStat.size) * 100).toFixed(0);
  console.log(`         ${(srcStat.size / 1024).toFixed(0)} KB → ${(dstStat.size / 1024).toFixed(0)} KB (-${pct}%)`);
}

async function encodePng(src: string): Promise<void> {
  const dst = src.replace(/\.webp$/i, '.png');
  if (await fileExists(dst)) {
    const [srcM, dstM] = await Promise.all([mtime(src), mtime(dst)]);
    if (dstM >= srcM) {
      console.log(`[skip] ${path.basename(dst)} up to date`);
      return;
    }
  }
  if (checkOnly) {
    console.error(`[stale] ${path.basename(dst)} missing or older than source`);
    process.exitCode = 1;
    return;
  }
  console.log(`[encode] ${path.basename(dst)}`);
  await run(['magick', src, dst]);
}

async function main(): Promise<void> {
  const lv999Pending = await recompressLv999();
  for (const src of AVIF_TARGETS) {
    if (src === HERO_LV999 && lv999Pending && checkOnly) {
      // Source webp is about to change; the existing avif's mtime comparison
      // would be misleading, so flag it stale outright.
      const dst = src.replace(/\.webp$/i, '.avif');
      console.error(`[stale] ${path.basename(dst)} pending: source will be recompressed`);
      process.exitCode = 1;
      continue;
    }
    await encodeAvif(src);
  }
  for (const src of STICKER_PNG_TARGETS) {
    await encodePng(src);
  }
  if (checkOnly && process.exitCode === 1) {
    console.error('\nbuild:images --check failed: run `bun run build:images` and commit the result');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
