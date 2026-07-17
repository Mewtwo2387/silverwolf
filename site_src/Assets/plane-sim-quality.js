// Graphics quality tiers for Plane Sim. 'medium' is the original baseline;
// 'low' halves texture resolution, thins the geometry and drops shadows;
// 'high' raises shadow/texture/geometry detail; 'ultra' maxes everything and
// turns on the reflective water and the instanced grass field. Read once at
// boot — world geometry is baked at build time, so changing tiers reloads
// the sim (the settings UI handles that).
import * as THREE from 'three';

export const GFX_LEVELS = ['low', 'medium', 'high', 'ultra'];
export const GFX_LEVEL = (() => {
  try {
    const v = localStorage.getItem('ps-gfx');
    return (v === 'low' || v === 'high' || v === 'ultra') ? v : 'medium';
  } catch (_) { return 'medium'; }
})();

const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

export const GFX = {
  low: {
    pixelRatio: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 1024,
    shadowBox: 95, // half-extent of the sun's ortho shadow frustum (m)
    aniso: 2,
    texScale: 0.5, // scenery texture resolution multiplier
    segScale: 0.6, // terrain grid-segment multiplier
    treeScale: 0.65, // forest/rock population multiplier
    coneSegs: 5, // radial segments for tree-canopy cones
    sphereSegs: [6, 4], // broadleaf canopy sphere [width, height] segments
    canopyDetail: 0, // extra canopy lobes beyond the low silhouette
    sceneryNormals: false, // grass/water normal maps
    fogFar: 6800,
  },
  medium: {
    pixelRatio: Math.min(dpr, 2),
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    shadowBox: 95,
    aniso: 8,
    texScale: 1,
    segScale: 1,
    treeScale: 1,
    coneSegs: 7,
    sphereSegs: [8, 6],
    canopyDetail: 1,
    sceneryNormals: true,
    fogFar: 9000,
  },
  high: {
    pixelRatio: Math.min(dpr, 2.5),
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    shadowBox: 150, // crisper map affords a wider shadowed area
    aniso: 16,
    texScale: 1,
    segScale: 1.35,
    treeScale: 1.25,
    coneSegs: 10,
    sphereSegs: [10, 8],
    canopyDetail: 2,
    sceneryNormals: true,
    fogFar: 11000,
    reflectiveWater: false,
    grass: false,
  },
  ultra: {
    pixelRatio: Math.min(dpr, 3),
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    shadowBox: 170,
    aniso: 16,
    texScale: 2, // procedural (canvas) textures render at double resolution
    segScale: 1.8,
    treeScale: 1.6,
    coneSegs: 12,
    sphereSegs: [12, 10],
    canopyDetail: 3,
    sceneryNormals: true,
    fogFar: 13000,
    reflectiveWater: true, // planar-reflection water with animated waves
    grass: true, // instanced grass blades around the aircraft
  },
}[GFX_LEVEL];

// TextureLoader wrapper for tiling scenery textures: on the low tier the
// decoded image is redrawn onto a canvas at texScale before upload.
export function loadSceneryTexture(url) {
  return new THREE.TextureLoader().load(url, (t) => {
    if (GFX.texScale >= 1) return;
    const img = t.image;
    if (!img || !img.width) return;
    const w = Math.max(32, Math.round(img.width * GFX.texScale));
    const h = Math.max(32, Math.round(img.height * GFX.texScale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    t.image = c;
    t.needsUpdate = true;
  });
}
