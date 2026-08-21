// Backrooms — photoscanned PBR surface maps.
//
// backrooms-materials.js draws every surface from seeded noise, which is what
// makes a new seed redecorate the place. That stays: it is what the level is
// built with, and it is what you see on `low` quality and for the frame or two
// before the network answers. This module is the *upgrade path* on top of it —
// real scanned albedo / normal / roughness for the four surfaces you spend the
// whole game staring at.
//
// The procedural set and the scanned set are deliberately interchangeable. Both
// produce the same material objects with the same variant counts, so the world
// builder never knows which one it got, and the two anti-tiling tricks that
// live outside the texture — per-surface variant choice by positional hash, and
// world-space vertex grime at a period coprime with the texture repeat — keep
// working unchanged. All the scan replaces is the pixels.
//
// Everything here is CC0 from ambientCG (https://ambientcg.com). CC0 asks for
// no attribution at all; the credits page lists it anyway because knowing where
// a texture came from is worth more than the licence strictly demands.
//
// Ambient occlusion is multiplied into the albedo at bake time rather than
// shipped as an aoMap: three.js reads aoMap from a second UV set, and every
// geometry builder in the level emits exactly one. On flat wall/floor/ceiling
// quads the difference is invisible and it saves a texture fetch per surface.

import * as THREE from 'three';

// ------------------------------------------------------------ manifest ----

/**
 * One entry per scanned surface. `metres` is how much *world* a single texture
 * repeat should cover; the caller passes the UV scale its geometry was built
 * with (UV_WALL, UV_FLOOR, CELL, UV_TILE) and gets repeat = uvScale / metres,
 * so texel density is physically right no matter what the geometry does.
 *
 * `credit` is read by the credits page — see pages/games/backrooms-credits.ts.
 */
export const SURFACE_SETS = {
  'wall-a': { metres: 2.6, credit: 'Wallpaper001A' },
  'wall-b': { metres: 2.6, credit: 'Wallpaper001C' },
  'wall-c': { metres: 2.6, credit: 'Wallpaper002B' },
  'wall-d': { metres: 2.6, credit: 'Wallpaper002C' },
  // Carpet016 is scanned at 1.7 m. Pulling the repeat in to 1.55 m puts the
  // berber loop at the size your eye expects from standing height.
  'carpet-a': { metres: 1.55, credit: 'Carpet016' },
  'carpet-b': { metres: 1.55, credit: 'Carpet011' },
  'carpet-c': { metres: 1.55, credit: 'Carpet008' },
  // Six tiles across the sheet; 3.6 m per repeat lands them on the 60 cm grid
  // real suspended ceilings use.
  'ceiling-a': { metres: 3.6, credit: 'OfficeCeiling001' },
  'ceiling-b': { metres: 2.4, credit: 'OfficeCeiling006' },
  'pooltile-a': { metres: 1.2, credit: 'Tiles036' },
  'pooltile-b': { metres: 1.2, credit: 'Tiles107' },
};

// ------------------------------------------------------- URL versioning ----

// Same content-hash scheme as /static/planes/ (see plane-sim-assets.js): the
// server renders a { basename: hash } island and we append ?v=<hash>, so an
// edited texture busts the immutable cache with no manual bump. Falls back to
// ?v=dev when the island is absent (the standalone test harness), which still
// loads — it just isn't cache-busted.
let _ver = null;

function manifest() {
  if (_ver) return _ver;
  _ver = {};
  try {
    const el = typeof document !== 'undefined' && document.getElementById('br-asset-ver');
    if (el) _ver = JSON.parse(el.textContent || '{}') || {};
  } catch (_) { _ver = {}; }
  return _ver;
}

/**
 * backroomsUrl('wall-a_col')     -> '/static/backrooms/wall-a_col.webp?v=ab12cd34'
 * backroomsUrl('player', 'glb')  -> '/static/backrooms/player.glb?v=ab12cd34'
 *
 * The manifest is keyed by basename without extension, so the player model
 * cache-busts through exactly the same path as the surface maps.
 */
export function backroomsUrl(name, ext = 'webp') {
  const v = manifest()[name];
  return `/static/backrooms/${name}.${ext}?v=${v || 'dev'}`;
}

// --------------------------------------------------------------- loader ----

const loader = new THREE.TextureLoader();
const cache = new Map();

function loadOne(name, colorSpace, repeat, aniso) {
  const key = `${name}|${repeat}|${aniso}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Promise((resolve, reject) => {
    loader.load(backroomsUrl(name), resolve, undefined, reject);
  }).then((tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = aniso;
    tex.colorSpace = colorSpace;
    return tex;
  });
  cache.set(key, p);
  return p;
}

/**
 * Load one surface's three maps. Resolves to null (never rejects) if any map
 * fails — a missing texture must leave the procedural material standing, not
 * take the level down with it.
 *
 * Only the albedo is sRGB. Normal and roughness are data, not colour, and
 * gamma-decoding them is the classic way to get a subtly wrong-looking surface.
 */
export function loadSurfaceSet(slug, uvScale, aniso = 8) {
  const set = SURFACE_SETS[slug];
  if (!set) return Promise.resolve(null);
  const repeat = uvScale / set.metres;
  return Promise.all([
    loadOne(`${slug}_col`, THREE.SRGBColorSpace, repeat, aniso),
    loadOne(`${slug}_nrm`, THREE.NoColorSpace, repeat, aniso),
    loadOne(`${slug}_rgh`, THREE.NoColorSpace, repeat, aniso),
  ]).then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }))
    .catch(() => null);
}

/**
 * Upgrade an already-built MeshStandardMaterial in place.
 *
 * The level is standing and drawing with its procedural textures by the time
 * this lands, so the swap has to be non-destructive: keep vertexColors (that is
 * the world-space grime), keep the material's tint, and dispose the canvas
 * textures we are replacing so the seeded originals don't leak.
 *
 * A Lambert material (quality: 'low') has nowhere to put a normal or roughness
 * map, so it is left alone entirely — low quality means low quality.
 */
export function applySurfaceSet(material, maps, opts = {}) {
  if (!material || !maps || !material.isMeshStandardMaterial) return false;
  const old = { map: material.map, normalMap: material.normalMap };
  material.map = maps.map;
  material.normalMap = maps.normalMap;
  material.roughnessMap = maps.roughnessMap;
  // roughnessMap is *multiplied* by .roughness, so a material that was tuned to
  // 0.95 flat would come out uniformly darker-rougher than the scan intends.
  // Hand the scan full range and let it speak.
  material.roughness = opts.roughness ?? 1;
  if (opts.normalScale !== undefined) {
    material.normalScale.set(opts.normalScale, opts.normalScale);
  }
  if (opts.color !== undefined) material.color.setHex(opts.color);
  material.needsUpdate = true;
  // Only dispose textures this material owned exclusively. The procedural set
  // shares nothing between materials, so both are safe.
  if (old.map && old.map !== maps.map) old.map.dispose();
  if (old.normalMap && old.normalMap !== maps.normalMap) old.normalMap.dispose();
  return true;
}
