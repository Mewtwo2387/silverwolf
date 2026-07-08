// Procedural terrain for Plane Sim. Deterministic (seeded hash noise, no
// Math.random in the height function) so the game and any tooling always agree
// on the landscape, and so collision checks can re-query heights analytically
// instead of raycasting the mesh. Y is up, units are metres, the airfield sits
// on a flattened disc at the origin.
//
// Layout: a ~13 km square of rolling valley floor around the airfield, rising
// into ridged mountains toward the world border (a natural "edge of the map"),
// with lakes wherever the ground dips below WATER_Y.
import * as THREE from 'three';

export const TERRAIN = {
  SIZE: 13600, // mesh extent (m) — a bit past the playable border
  SEGS: 250, // grid segments per side (~54 m/vertex)
  WATER_Y: -12, // lake surface level
  FLAT_R: 780, // fully-flat radius around the airfield
  BLEND_R: 1950, // ...blending up to full terrain by this radius
};

// ---- Seeded value noise + fBm --------------------------------------------
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const sstep = (t) => t * t * (3 - 2 * t);
export function smoothstep(a, b, v) {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return sstep(t);
}
function vnoise(x, z) {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = x - ix; const fz = z - iz;
  const a = hash2(ix, iz); const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1); const d = hash2(ix + 1, iz + 1);
  const u = sstep(fx); const v = sstep(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Fractal Brownian motion, normalised to [0, 1].
export function fbm(x, z, oct) {
  let amp = 0.5; let f = 1; let sum = 0; let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, z * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

// ---- The height field -----------------------------------------------------
// Rolling hills (can dip below water level -> lakes) + ridged mountains that
// grow toward the edge of the map. Flattened to exactly 0 near the airfield.
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(TERRAIN.FLAT_R, TERRAIN.BLEND_R, d);
  if (flat === 0) return 0;
  const nx = x * 0.00016; const nz = z * 0.00016;
  let h = (fbm(nx + 3.7, nz - 1.2, 5) - 0.46) * 400; // rolling floor, some below 0
  const r = 1 - Math.abs(2 * fbm(nx * 2.1 + 17.3, nz * 2.1 + 9.4, 4) - 1); // ridged [0,1]
  const edge = smoothstep(2500, 5600, d);
  h += r * r * (70 + 700 * edge);
  return h * flat;
}

// Forest density mask [0,1] — where trees like to cluster (mid-altitude,
// gentle terrain). The game thresholds this when scattering instanced trees.
export function forestMask(x, z) {
  return fbm(x * 0.0006 + 51.7, z * 0.0006 - 23.4, 3);
}

// ---- Terrain mesh with vertex colours -------------------------------------
const C_SAND = new THREE.Color(0x9f9066);
const C_GRASS_LO = new THREE.Color(0x4e6c2e);
const C_GRASS_HI = new THREE.Color(0x71893c);
const C_FOREST = new THREE.Color(0x39511f);
const C_ROCK = new THREE.Color(0x6e6656);
const C_ROCK_DK = new THREE.Color(0x4e4a40);
const C_SNOW = new THREE.Color(0xe9edf2);
const _c = new THREE.Color();
const _c2 = new THREE.Color();

export function buildTerrain(renderer) {
  const { SIZE, SEGS, WATER_Y } = TERRAIN;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);

    // Slope from finite differences (drives the rock band on steep faces).
    const e = 22;
    const dhx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
    const dhz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
    const slope = Math.hypot(dhx, dhz) / (2 * e);

    // Base grass, patchy via low-frequency noise; darker "forest floor" blotches.
    const patch = fbm(x * 0.0011 + 9.1, z * 0.0011 + 4.2, 3);
    _c.copy(C_GRASS_LO).lerp(C_GRASS_HI, patch);
    const forest = smoothstep(0.55, 0.72, forestMask(x, z));
    _c.lerp(C_FOREST, forest * 0.75);

    // Shoreline sand just above the waterline.
    const sand = 1 - smoothstep(WATER_Y + 1.5, WATER_Y + 9, h);
    _c.lerp(C_SAND, sand);

    // Rock on steep faces and at altitude, then snow-capped peaks.
    _c2.copy(C_ROCK).lerp(C_ROCK_DK, patch);
    _c.lerp(_c2, smoothstep(0.42, 0.75, slope));
    _c.lerp(_c2, smoothstep(300, 430, h));
    _c.lerp(C_SNOW, smoothstep(470, 560, h) * (1 - smoothstep(0.9, 1.3, slope)));

    colors[i * 3] = _c.r; colors[i * 3 + 1] = _c.g; colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Fine grain overlay so the ground has detail between the (54 m apart)
  // vertices — a tiling grayscale noise texture multiplied under the vertex
  // colours. 256px tiled every ~8.5 m (~30 texels/m near the ground) with
  // multi-scale speckle, so low passes read as turf instead of smeared blur.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { // broad soft mottling
    const v = 140 + Math.floor(Math.random() * 115);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 5, 5);
  }
  for (let i = 0; i < 11000; i++) { // fine speckle, both lighter and darker
    const v = 90 + Math.floor(Math.random() * 165);
    ctx.fillStyle = `rgba(${v},${v},${v},0.7)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let i = 0; i < 1200; i++) { // sparse dark tufts/pebbles for anchor detail
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const grain = new THREE.CanvasTexture(c);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(1600, 1600);
  if (renderer) grain.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: grain, vertexColors: true, roughness: 1, metalness: 0,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

// Lake surface: one big translucent plane at WATER_Y. Terrain dipping below it
// reads as lakes; the shoreline sand band sells the edge. depthWrite stays off
// (nothing renders under water) and polygonOffset biases the plane away from
// the near-coplanar shoreline triangles — paired with the renderer's
// logarithmic depth buffer this kills the shoreline z-fighting shimmer.
export function buildWater() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN.SIZE, TERRAIN.SIZE),
    new THREE.MeshStandardMaterial({
      color: 0x1f5f7d,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = TERRAIN.WATER_Y;
  return mesh;
}
