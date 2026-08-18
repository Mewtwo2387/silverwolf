// Backrooms — procedurally generated surfaces.
//
// Nothing here loads an image file: every texture is drawn into a canvas at
// boot from seeded noise, so the level ships as a few KB of code and a new seed
// really does redecorate the place.
//
// Killing the tiling tell. A single repeating texture on 700 m² of wall reads as
// wallpaper-pattern wallpaper within seconds. Three independent tricks stack up
// so no one period dominates:
//   1. VARIANTS — four wallpapers / three carpets, chosen per surface by a
//      positional hash. The visible repeat becomes variant-count × texture size.
//   2. TILEABLE NOISE — the grunge is periodic value-noise (the lattice wraps),
//      so a texture meets itself seamlessly and there is no visible grid.
//   3. WORLD-SPACE VERTEX GRIME — a very low frequency fbm sampled per vertex
//      and baked into vertex colours. Its period (~28 m) is coprime with the
//      texture repeat (~8 m), so damp patches and sun-bleaching drift across
//      the tiling and the eye never locks onto either rhythm.
//
// Palette follows the original Level 0 description: sickly yellow "mono-yellow"
// wallpaper, damp brownish-beige berber carpet, water-stained ceiling tiles.

import * as THREE from 'three';
import { hash2 } from './backrooms-maze.js';

// ------------------------------------------------------------- noise ----

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (v, p) => ((v % p) + p) % p;

/** Value noise on an integer lattice that wraps every `period` cells. */
function valueNoise(x, y, period, salt) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const px0 = wrap(x0, period);
  const py0 = wrap(y0, period);
  const px1 = wrap(x0 + 1, period);
  const py1 = wrap(y0 + 1, period);
  const v00 = hash2(px0, py0, salt);
  const v10 = hash2(px1, py0, salt);
  const v01 = hash2(px0, py1, salt);
  const v11 = hash2(px1, py1, salt);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

/** Tileable fractal noise: each octave doubles frequency *and* lattice period. */
export function fbm(x, y, period, octaves, salt) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x * freq, y * freq, period * freq, salt + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Non-tiling fbm for world-space use (grime), sampled on a huge lattice. */
export function worldFbm(x, y, scale, octaves = 3, salt = 7) {
  return fbm(x / scale, y / scale, 8192, octaves, salt);
}

// ------------------------------------------------------ canvas helpers ----

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finishTexture(canvas, repeat = 1, aniso = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Height map -> normal map, by central differences on the canvas' luminance.
 * Cheaper and better-behaved than a bump map at grazing angles, which is most
 * of what you see in a corridor.
 */
function normalFromHeight(srcCanvas, strength = 2.0) {
  const size = srcCanvas.width;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = makeCanvas(size);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(size, size);
  const lum = (x, y) => {
    const i = ((wrap(y, size) * size) + wrap(x, size)) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      // Normalise (-dx, -dy, 1) into 0..255 tangent-space RGB.
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = ((y * size) + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Paint per-pixel from a callback returning [r, g, b] in 0..255. */
function paint(canvas, fn) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = ((y * size) + x) * 4;
      const c = fn(x, y, size);
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// A soft elliptical stain, drawn after the noise pass. Damp patches are the
// single most recognisable Level 0 detail and they need hard-ish edges that
// noise alone won't give.
function drawStains(canvas, rnd, count, colour, maxR) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = maxR * (0.35 + rnd() * 0.65);
    // Draw the stain nine times on a 3x3 offset grid so anything crossing an
    // edge reappears on the far side — the texture stays tileable.
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const g = ctx.createRadialGradient(
          cx + ox * size, cy + oy * size, 0,
          cx + ox * size, cy + oy * size, r,
        );
        g.addColorStop(0, `rgba(${colour}, ${0.16 + rnd() * 0.14})`);
        g.addColorStop(0.62, `rgba(${colour}, 0.09)`);
        g.addColorStop(1, `rgba(${colour}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(
          cx + ox * size, cy + oy * size, r, r * (0.6 + rnd() * 0.7),
          rnd() * Math.PI, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.restore();
  return canvas;
}

// ---------------------------------------------------------- surfaces ----

const TEX = 512;

/**
 * Mono-yellow wallpaper. Vertical damask-ish striping whose period divides the
 * texture width, so neighbouring wall segments line up rather than showing a
 * stripe seam at every doorway.
 */
function wallpaperCanvas(variant) {
  const salt = 1000 + variant * 37;
  const stripes = [14, 11, 18, 16][variant % 4]; // whole number of stripes per tile
  const base = [
    [198, 178, 96], [204, 186, 108], [190, 170, 86], [200, 180, 100],
  ][variant % 4];

  const canvas = paint(makeCanvas(TEX), (x, y, size) => {
    const u = x / size;
    const v = y / size;
    // Fine paper tooth + medium blotching + a slow vertical gradient (walls
    // are grimier at the skirting and bleached at the top).
    const tooth = fbm(u * 96, v * 96, 96, 2, salt);
    const blotch = fbm(u * 7, v * 7, 7, 4, salt + 11);
    const stripe = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * stripes);
    const stripeMix = 0.022 * stripe + 0.014 * Math.cos(u * Math.PI * 2 * stripes * 3);
    const vert = 0.93 + 0.14 * v; // brighter toward the tile's bottom edge
    const shade = (0.86 + blotch * 0.26) * vert * (1 + stripeMix) * (0.95 + tooth * 0.1);
    return [
      Math.min(255, base[0] * shade),
      Math.min(255, base[1] * shade * (0.99 + blotch * 0.03)),
      Math.min(255, base[2] * shade * (0.9 + blotch * 0.2)),
    ];
  });

  // Seeded per variant so stains are stable but different on each wallpaper.
  let s = variant * 7919 + 13;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  drawStains(canvas, rnd, 3 + variant, '86, 66, 24', TEX * 0.3);
  return canvas;
}

/** Damp berber carpet — dense fibre speckle under broad moisture staining. */
function carpetCanvas(variant) {
  const salt = 3000 + variant * 53;
  const base = [[104, 92, 64], [96, 86, 58], [112, 98, 70]][variant % 3];
  const canvas = paint(makeCanvas(TEX), (x, y, size) => {
    const u = x / size;
    const v = y / size;
    // Berber loops: high-frequency speckle with no direction, which is why the
    // carpet can be randomly rotated per cell without any seam showing.
    const fibre = fbm(u * 180, v * 180, 180, 2, salt);
    const loop = fbm(u * 64, v * 64, 64, 1, salt + 5);
    const broad = fbm(u * 5, v * 5, 5, 4, salt + 9);
    const shade = (0.72 + broad * 0.4) * (0.82 + fibre * 0.36) * (0.94 + loop * 0.12);
    return [
      Math.min(255, base[0] * shade),
      Math.min(255, base[1] * shade),
      Math.min(255, base[2] * shade * (0.94 + broad * 0.12)),
    ];
  });
  let s = variant * 104729 + 7;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  drawStains(canvas, rnd, 5, '48, 38, 20', TEX * 0.4);
  return canvas;
}

/** Suspended ceiling: a 2x2 grid of mineral-fibre tiles with grid runners. */
function ceilingCanvas(variant) {
  const salt = 5000 + variant * 71;
  const canvas = paint(makeCanvas(TEX), (x, y, size) => {
    const u = x / size;
    const v = y / size;
    const speck = fbm(u * 150, v * 150, 150, 2, salt);
    const broad = fbm(u * 6, v * 6, 6, 3, salt + 3);
    const shade = (0.78 + broad * 0.3) * (0.86 + speck * 0.3);
    const c = 172 * shade;
    return [c, c * 0.985, c * 0.9];
  });
  const ctx = canvas.getContext('2d');
  // Grid runners: two tiles across, so a 4.2 m cell reads as 60 cm tiles.
  ctx.strokeStyle = 'rgba(120, 116, 96, 0.85)';
  ctx.lineWidth = Math.max(2, TEX / 160);
  for (let i = 0; i <= 2; i += 1) {
    const p = (i / 2) * TEX;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, TEX);
    ctx.moveTo(0, p);
    ctx.lineTo(TEX, p);
    ctx.stroke();
  }
  let s = variant * 15485863 + 3;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  drawStains(canvas, rnd, 4, '96, 74, 34', TEX * 0.35);
  return canvas;
}

/** Skirting / wall base — a darker scuffed band, drawn as its own strip. */
function skirtingCanvas() {
  return paint(makeCanvas(128), (x, y, size) => {
    const n = fbm((x / size) * 40, (y / size) * 40, 40, 3, 909);
    const c = 96 * (0.7 + n * 0.5);
    return [c, c * 0.92, c * 0.72];
  });
}

// ------------------------------------------------------------ signage ----

/** The red EXIT sign over the winning passage — emissive, so it glows in fog. */
export function exitSignTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#120303';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1c0505';
  ctx.fillRect(8, 68, 240, 120);
  ctx.font = 'bold 92px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2a2a';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ff4646';
  ctx.fillText('EXIT', 128, 130);
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffd2d2';
  ctx.fillText('EXIT', 128, 130);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Default PNG-chaser skin. The player can upload their own in the menu; until
 * they do, the entity is a blank white ceramic tile — which, in a corridor lit
 * by one flickering tube, is quite enough.
 */
export function defaultChaserTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(226,226,220,0.35)');
  g.addColorStop(1, 'rgba(198,198,192,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(150,150,144,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 250);
  ctx.fillStyle = 'rgba(120,120,116,0.5)';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NO SKIN', 128, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Entity 96's iris — a ring of fibres around a black pupil. */
export function irisTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(0, 0, 256, 256);
  // Sclera veining.
  ctx.strokeStyle = 'rgba(170, 44, 44, 0.5)';
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128);
    ctx.quadraticCurveTo(
      128 + Math.cos(a + 0.4) * 90, 128 + Math.sin(a + 0.4) * 90,
      128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62,
    );
    ctx.stroke();
  }
  const iris = ctx.createRadialGradient(128, 128, 8, 128, 128, 62);
  iris.addColorStop(0, '#050505');
  iris.addColorStop(0.34, '#0b0b0b');
  iris.addColorStop(0.4, '#7d5a1e');
  iris.addColorStop(0.85, '#c99a35');
  iris.addColorStop(1, '#2a1c06');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(128, 128, 62, 0, Math.PI * 2);
  ctx.fill();
  // Radial iris fibres.
  ctx.strokeStyle = 'rgba(40, 26, 6, 0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 26, 128 + Math.sin(a) * 26);
    ctx.lineTo(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round sprite, reused for dust motes and the entity-96 beam glow. */
export function glowTexture() {
  const c = makeCanvas(64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ----------------------------------------------------------- library ----

export const WALLPAPER_VARIANTS = 4;
export const CARPET_VARIANTS = 3;
export const CEILING_VARIANTS = 2;

/**
 * Build every surface material once. `quality` picks Lambert (cheap, no
 * specular — which suits matt wallpaper anyway) vs Standard with normal maps.
 */
export function buildMaterials(quality = 'high') {
  const detailed = quality !== 'low';
  const mk = (canvas, repeat, opts = {}) => {
    const map = finishTexture(canvas, repeat);
    const common = { map, vertexColors: true, ...opts.extra };
    if (!detailed) return new THREE.MeshLambertMaterial(common);
    const normalMap = normalFromHeight(canvas, opts.bump ?? 1.6);
    normalMap.repeat.copy(map.repeat);
    return new THREE.MeshStandardMaterial({
      ...common,
      normalMap,
      normalScale: new THREE.Vector2(opts.normalScale ?? 0.6, opts.normalScale ?? 0.6),
      roughness: opts.roughness ?? 0.95,
      metalness: 0,
    });
  };

  const wall = [];
  for (let i = 0; i < WALLPAPER_VARIANTS; i += 1) {
    wall.push(mk(wallpaperCanvas(i), 1, { bump: 1.1, normalScale: 0.35 }));
  }
  const carpet = [];
  for (let i = 0; i < CARPET_VARIANTS; i += 1) {
    carpet.push(mk(carpetCanvas(i), 1, { bump: 2.6, normalScale: 0.9, roughness: 1 }));
  }
  const ceiling = [];
  for (let i = 0; i < CEILING_VARIANTS; i += 1) {
    ceiling.push(mk(ceilingCanvas(i), 1, { bump: 1.4, normalScale: 0.5 }));
  }
  const skirting = mk(skirtingCanvas(), 1, { bump: 1.2, normalScale: 0.4 });

  return {
    wall, carpet, ceiling, skirting, detailed,
    /**
     * Release every texture in the set. Only safe once no world is drawing
     * with it — this set is deliberately shared across level rebuilds (the
     * wallpaper does not change when the floor plan does), so it outlives any
     * one world and only the quality tier changing should ever tear it down.
     */
    dispose() {
      for (const m of [...wall, ...carpet, ...ceiling, skirting]) {
        m.map?.dispose();
        m.normalMap?.dispose();
        m.dispose();
      }
    },
  };
}

/**
 * World-space grime for vertex colours. Two octaves at very different scales:
 * a ~28 m damp/bleach drift plus a ~6 m mottle. Both are coprime with the ~8 m
 * texture repeat, so neither rhythm ever lines up with the other.
 */
export function grimeAt(x, z, tint = 1) {
  const broad = worldFbm(x, z, 28, 3, 17);
  const mid = worldFbm(x + 91, z - 47, 6.3, 2, 29);
  const v = 0.72 + broad * 0.42 + (mid - 0.5) * 0.16;
  return Math.max(0.42, Math.min(1.12, v * tint));
}
