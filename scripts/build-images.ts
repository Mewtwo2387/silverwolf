import path from 'path';
import fs from 'fs/promises';
import { ALL_STICKER_STEMS } from '../site_src/stickers';

const ROOT = path.resolve(import.meta.dir, '..');
const IMAGES_DIR = path.join(ROOT, 'site_src/Assets/Images');

// Hero LV1's WebP source still lives at the repo root (the canonical hero, kept
// top-level for visibility); every other hero file lives in IMAGES_DIR. LV999's
// source was moved to IMAGES_DIR too, so it's not special-cased here.
const HERO_LV1_SRC = path.join(ROOT, 'silverwolf.webp');
const HERO_LV1_AVIF = path.join(IMAGES_DIR, 'silverwolf.avif');
const HERO_LV999_SRC = path.join(IMAGES_DIR, 'silverwolfLv.999.webp');
const HERO_LV999_AVIF = path.join(IMAGES_DIR, 'silverwolfLv.999.avif');

// AVIF derivation: explicit (src, dst) pairs because the hero LV1 source isn't
// a sibling of its output. Eidolons follow the simpler "swap extension" rule.
type EncodeTarget = { src: string; dst: string };
const AVIF_TARGETS: EncodeTarget[] = [
  { src: HERO_LV1_SRC, dst: HERO_LV1_AVIF },
  { src: HERO_LV999_SRC, dst: HERO_LV999_AVIF },
];
for (let i = 1; i <= 6; i += 1) {
  for (const variant of ['', 'LV.999_']) {
    const stem = `Character_Silver_Wolf_${variant}Eidolon_${i}`;
    const src = path.join(IMAGES_DIR, `${stem}.webp`);
    AVIF_TARGETS.push({ src, dst: src.replace(/\.webp$/i, '.avif') });
  }
}

// Responsive-image variants: emit width-scaled copies so the browser can pick
// an appropriately-sized asset for the layout. The hero is shown at ~819px on
// desktop and full-width on mobile; eidolons at ~743px; sticker favicons at
// ~96px. Sources are 2000×2000 (hero) / 1000×1000 (eidolons) / 256×256
// (stickers) — too large for those slots without responsive variants.
//
// `dstDir` overrides where the output goes; defaults to the source's directory.
// The hero LV1 webp source is at the root, but its variants belong in
// IMAGES_DIR alongside the other hero files.
type ResizeTarget = { src: string; widths: number[]; dstDir?: string };
const RESIZE_TARGETS: ResizeTarget[] = [];
// Hero — both formats, both LV tiers. Larger CDN reach justifies 3 widths.
RESIZE_TARGETS.push({ src: HERO_LV1_SRC, widths: [512, 1024, 1600], dstDir: IMAGES_DIR });
RESIZE_TARGETS.push({ src: HERO_LV1_AVIF, widths: [512, 1024, 1600] });
RESIZE_TARGETS.push({ src: HERO_LV999_SRC, widths: [512, 1024, 1600] });
RESIZE_TARGETS.push({ src: HERO_LV999_AVIF, widths: [512, 1024, 1600] });
// Eidolons — single intermediate width covers the typical display size.
for (let i = 1; i <= 6; i += 1) {
  for (const variant of ['', 'LV.999_']) {
    const stem = `Character_Silver_Wolf_${variant}Eidolon_${i}`;
    RESIZE_TARGETS.push({ src: path.join(IMAGES_DIR, `${stem}.webp`), widths: [768] });
    RESIZE_TARGETS.push({ src: path.join(IMAGES_DIR, `${stem}.avif`), widths: [768] });
  }
}
// Stickers — favicon is rendered at ≤96px so a 128w variant covers 1.33× DPI.
for (const stem of ALL_STICKER_STEMS) {
  RESIZE_TARGETS.push({ src: path.join(IMAGES_DIR, `${stem}.webp`), widths: [128] });
}

// Favicon stickers ship as WebP, but a few link-preview scrapers (older
// WhatsApp/Telegram, some SEO tools) won't fetch WebP — so the social embed
// points at a PNG fallback derived from each sticker. The stem list is the
// shared source of truth in site_src/stickers.ts.
const STICKER_PNG_TARGETS = ALL_STICKER_STEMS.map((stem) => path.join(IMAGES_DIR, `${stem}.webp`));

const HERO_LV999 = HERO_LV999_SRC;
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

async function encodeAvif(src: string, dst: string): Promise<void> {
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

function resizedPath(src: string, width: number, dstDir?: string): string {
  const base = path.basename(src).replace(/\.(webp|avif|png)$/i, (_, ext) => `-${width}w.${ext}`);
  return path.join(dstDir ?? path.dirname(src), base);
}

async function encodeResize(src: string, width: number, dstDir?: string): Promise<void> {
  if (!(await fileExists(src))) {
    console.error(`[stale] resize source missing: ${path.basename(src)}`);
    process.exitCode = 1;
    return;
  }
  const dst = resizedPath(src, width, dstDir);
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
  console.log(`[resize] ${path.basename(dst)} (${width}w)`);
  // `${width}x` (no height) preserves aspect ratio; `>` so we never upscale.
  await run([
    'magick', src,
    '-resize', `${width}x${width}>`,
    '-quality', String(/\.avif$/i.test(dst) ? AVIF_QUALITY : 82),
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
  for (const { src, dst } of AVIF_TARGETS) {
    if (src === HERO_LV999 && lv999Pending && checkOnly) {
      // Source webp is about to change; the existing avif's mtime comparison
      // would be misleading, so flag it stale outright.
      console.error(`[stale] ${path.basename(dst)} pending: source will be recompressed`);
      process.exitCode = 1;
      continue;
    }
    await encodeAvif(src, dst);
  }
  for (const src of STICKER_PNG_TARGETS) {
    await encodePng(src);
  }
  for (const { src, widths, dstDir } of RESIZE_TARGETS) {
    for (const width of widths) {
      await encodeResize(src, width, dstDir);
    }
  }
  if (checkOnly && process.exitCode === 1) {
    console.error('\nbuild:images --check failed: run `bun run build:images` and commit the result');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
