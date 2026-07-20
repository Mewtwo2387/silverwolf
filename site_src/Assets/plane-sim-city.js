// The "City" map for Plane Sim: a compressed 1940s-Manhattan island you defend
// from bomber waves, with the airfield on a separate island a short flight
// away. Built once at load and toggled with the other worlds (see the game's
// applyWorld). Everything here is STATIC scenery — the gameplay (bombers, city
// health, waves) lives in the main sim; this module just makes the world and
// hands back the footprints/obstacles/drop-zones it needs.
//
// Fidelity vs. frame rate: the skyline is hundreds of individually-shaped
// buildings, but every wall/roof/water-tank of a given material is merged into
// ONE geometry (a few draw calls for the whole city), and the building count
// scales with GFX.cityBuildings so weaker GPUs get a sparser town. The CSP is
// script-src 'self' with no external images, so facades are procedural canvas
// textures like the rest of the game's scenery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GFX, loadSceneryTexture } from './plane-sim-quality.js';
import {
  makeControlTower, makeHangar, makeWindsock, makeFuelTank,
} from './plane-sim-models.js';

// ---- Layout (metres, world space). The city is a long N–S island on the east
//      side of the box; the airfield a smaller island to the south-west. Both
//      platforms top out at GROUND_Y; the shared water plane laps the seawalls.
export const CITY = {
  GROUND_Y: 0, // island platform top (water sits ~12 m below at TERRAIN.WATER_Y)
  SEA_FLOOR: -80, // "ground" off the islands — deep enough to read as open sea
  ISLAND: {
    x: 1500, z: 0, hx: 520, hz: 2150, // centre + half-extents (1040 × 4300 m)
  },
  FIELD: {
    x: -2600, z: 1350, hx: 650, hz: 470, // airfield island (1300 × 940 m)
    rwLen: 700, rwW: 38,
  },
  // Two high-rise "cores" the skyline peaks around — Midtown (north-centre) and
  // Downtown/Financial (south tip), tapering to mid-rise + tenements between.
  CORES: [
    { z: 380, r: 950, h: 250 }, // Midtown
    { z: -1500, r: 780, h: 205 }, // Downtown
  ],
};

// ---- Small seeded PRNG so the skyline is identical every load (stable shots,
//      and neighbours don't shuffle between sessions). ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Procedural facade texture: a seamlessly-tiling grid of punched windows
//      on a stone/brick ground, drawn once per style and repeated at a fixed
//      WORLD scale (see FACADE_TILE) so windows are the same real size on a
//      5-storey tenement and a 50-storey tower. `deco` adds pale vertical
//      pilaster strips for the Art-Deco towers. ----
const FACADE_TILE = 12; // metres of wall per texture repeat (≈3 floors × 3 bays)
function facadeTexture(style) {
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cfg = {
    stone: { base: '#c7ba9d', trim: '#d8ccb2', win: '#39424b', glow: '#5b6b78' },
    deco: { base: '#b9a582', trim: '#d8c7a4', win: '#33404a', glow: '#5a6d7c' },
    brick: { base: '#7c4a3b', trim: '#8f5a49', win: '#2f363d', glow: '#556069' },
  }[style];
  ctx.fillStyle = cfg.base;
  ctx.fillRect(0, 0, S, S);
  // faint mortar/soot mottling so flat walls aren't dead-flat
  for (let i = 0; i < 900; i++) {
    const v = Math.random() * 0.10;
    ctx.fillStyle = `rgba(0,0,0,${v.toFixed(3)})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  const cols = 3; const rows = 3;
  const cw = S / cols; const rh = S / rows;
  const wpad = style === 'brick' ? cw * 0.30 : cw * 0.22;
  const hpadTop = rh * 0.16; const hpadBot = rh * 0.30;
  if (style === 'deco') {
    // pale pilasters straddling the column gaps
    ctx.fillStyle = cfg.trim;
    for (let i = 0; i <= cols; i++) {
      ctx.fillRect(i * cw - 2.5, 0, 5, S);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cw + wpad; const x1 = (col + 1) * cw - wpad;
      const y0 = r * rh + hpadTop; const y1 = (r + 1) * rh - hpadBot;
      // sill/lintel
      ctx.fillStyle = cfg.trim;
      ctx.fillRect(x0 - 2, y0 - 2, (x1 - x0) + 4, (y1 - y0) + 4);
      // glass with a soft top-to-bottom sky reflection
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, cfg.glow);
      g.addColorStop(0.5, cfg.win);
      g.addColorStop(1, cfg.win);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      // mullion
      ctx.strokeStyle = 'rgba(20,24,28,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((x0 + x1) / 2, y0); ctx.lineTo((x0 + x1) / 2, y1);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = GFX.aniso;
  return tex;
}

// ---- One box's four vertical walls as a bare quad soup (no top/bottom faces),
//      with UVs at world scale so a single tiled facade texture reads correctly
//      once merged. Local space: base on y=0, centred on x/z. ----
function pushWalls(bucket, x, z, baseY, w, d, h) {
  const hw = w / 2; const hd = d / 2;
  const pos = bucket.pos; const nor = bucket.nor; const uv = bucket.uv; const idx = bucket.idx;
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, uW, uH) => {
    const base = pos.length / 3;
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 4; k++) nor.push(nx, ny, nz);
    uv.push(0, 0, uW, 0, uW, uH, 0, uH);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const uH = h / FACADE_TILE;
  const uWx = w / FACADE_TILE; const uWz = d / FACADE_TILE;
  const y0 = baseY; const y1 = baseY + h;
  // +Z (front) / -Z (back)
  quad(x - hw, y0, z + hd, x + hw, y0, z + hd, x + hw, y1, z + hd, x - hw, y1, z + hd, 0, 0, 1, uWx, uH);
  quad(x + hw, y0, z - hd, x - hw, y0, z - hd, x - hw, y1, z - hd, x + hw, y1, z - hd, 0, 0, -1, uWx, uH);
  // +X (right) / -X (left)
  quad(x + hw, y0, z + hd, x + hw, y0, z - hd, x + hw, y1, z - hd, x + hw, y1, z + hd, 1, 0, 0, uWz, uH);
  quad(x - hw, y0, z - hd, x - hw, y0, z + hd, x - hw, y1, z + hd, x - hw, y1, z - hd, -1, 0, 0, uWz, uH);
}
function newBucket() { return { pos: [], nor: [], uv: [], idx: [] }; }
function bucketToGeo(b) {
  if (!b.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex(b.idx);
  return g;
}

// Flat roof slab (a thin box top) added to the roof bucket — a plain quad at
// the segment top, plus a shallow parapet lip so roofs read as roofs from above.
function pushRoof(roof, x, z, y, w, d) {
  const b = roof;
  const hw = w / 2; const hd = d / 2;
  const base = b.pos.length / 3;
  b.pos.push(x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd);
  for (let k = 0; k < 4; k++) b.nor.push(0, 1, 0);
  b.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

// The iconic rooftop wooden water tank (barrel + conic cap on stilts), appended
// to a shared bucket of plain geometry (no UV grid — a wood-brown material).
function pushWaterTank(geos, x, z, y, rng) {
  const r = 1.5 + rng() * 0.6; const bh = 3.2 + rng() * 1.2; const legs = 2.4;
  const parts = [];
  const barrel = new THREE.CylinderGeometry(r, r * 1.05, bh, 9);
  barrel.translate(x, y + legs + bh / 2, z); parts.push(barrel);
  const cap = new THREE.ConeGeometry(r * 1.15, r * 0.9, 9);
  cap.translate(x, y + legs + bh + r * 0.4, z); parts.push(cap);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.BoxGeometry(0.22, legs + 0.4, 0.22);
    leg.translate(x + lx * r * 0.7, y + (legs + 0.4) / 2, z + lz * r * 0.7);
    parts.push(leg);
  }
  geos.push(mergeGeometries(parts));
}

// ---- Building archetypes. Each stacks 1–N boxes (setbacks) into the right
//      bucket and registers a crash AABB. Returns the total height. ----
function addBuilding(ctx, kind, x, z, footW, footD, h, rng) {
  const wallBucket = ctx.walls[kind === 'brick' ? 'brick' : (kind === 'deco' ? 'deco' : 'stone')];
  const g = CITY.GROUND_Y;
  let baseY = g; let w = footW; let d = footD;
  const segH = []; // [y, w, d, h] per tier, to place cornices/roofs
  if (kind === 'deco' || kind === 'tower') {
    // Wedding-cake setbacks: 2–4 tiers shrinking as they rise.
    const tiers = 2 + Math.floor(rng() * 3);
    let remaining = h;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? remaining : remaining * (0.34 + rng() * 0.18);
      pushWalls(wallBucket, x, z, baseY, w, d, th);
      pushRoof(ctx.roofs, x, z, baseY + th, w, d);
      segH.push([baseY + th, w, d]);
      baseY += th; remaining -= th;
      w *= 0.66 + rng() * 0.12; d *= 0.66 + rng() * 0.12;
      if (remaining < 8) break;
    }
    // Deco crown: a slender mast or stepped pinnacle on the top tier.
    const topY = baseY; const tw = w;
    if (kind === 'deco') {
      const mast = new THREE.CylinderGeometry(0.5, 1.4, 14 + rng() * 10, 8);
      mast.translate(x, topY + (14 + rng() * 10) / 2, z);
      ctx.trim.push(mast);
    } else {
      const pin = new THREE.ConeGeometry(tw * 0.5, 10 + rng() * 8, 6);
      pin.translate(x, topY + (10 + rng() * 8) / 2, z);
      ctx.trim.push(pin);
    }
  } else {
    // Slab / block / tenement: a single box, maybe one small penthouse.
    pushWalls(wallBucket, x, z, baseY, w, d, h);
    pushRoof(ctx.roofs, x, z, baseY + h, w, d);
    segH.push([baseY + h, w, d]);
    if (h > 24 && rng() < 0.5) {
      const ph = 3 + rng() * 3;
      pushWalls(wallBucket, x, z, baseY + h, w * 0.5, d * 0.5, ph);
      pushRoof(ctx.roofs, x, z, baseY + h + ph, w * 0.5, d * 0.5);
    }
  }
  // Rooftop water tanks on lower/mid buildings (not the deco spires).
  const [ry, rw, rd] = segH[segH.length - 1];
  if (kind !== 'deco' && kind !== 'tower' && h < 90 && rng() < 0.55) {
    pushWaterTank(ctx.tanks, x + (rng() - 0.5) * rw * 0.4, z + (rng() - 0.5) * rd * 0.4, ry, rng);
  }
  ctx.obstacles.push({
    x0: x - footW / 2, x1: x + footW / 2, z0: z - footD / 2, z1: z + footD / 2,
    top: g + h, reason: 'Flew into a building',
  });
  return h;
}

// Height/kind zoning: how "downtown" a point is (0 fringe → 1 core), the peak
// height there, and which archetype suits it.
function zoneAt(x, z, rng) {
  let core = 0; let peak = 60;
  for (const cptr of CITY.CORES) {
    const d = Math.hypot(x - CITY.ISLAND.x, z - cptr.z);
    const k = Math.max(0, 1 - d / cptr.r);
    if (k > core) { core = k; peak = cptr.h; }
  }
  core = core * core * (3 - 2 * core); // smootherstep-ish
  if (core > 0.62) {
    const h = peak * (0.55 + core * 0.5) * (0.8 + rng() * 0.4);
    return { kind: rng() < 0.6 ? 'deco' : 'tower', h: Math.min(h, peak * 1.15) };
  }
  if (core > 0.3) {
    return { kind: rng() < 0.5 ? 'tower' : 'slab', h: 40 + core * 90 * (0.7 + rng() * 0.6) };
  }
  // Fringe: low commercial slabs + red-brick tenements.
  return { kind: rng() < 0.55 ? 'brick' : 'slab', h: 16 + rng() * 26 };
}

// ---- The airfield island: a flat grass platform with a runway and a handful
//      of reused airfield structures. Registers its own crash obstacles. ----
function buildField(group, obstacles) {
  const F = CITY.FIELD; const g = CITY.GROUND_Y;
  const asphalt = loadSceneryTexture('/static/planes/asphalt.jpg');
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.anisotropy = GFX.aniso;
  const rw = asphalt.clone(); rw.repeat.set(3, 56);
  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(F.rwW, F.rwLen),
    new THREE.MeshStandardMaterial({ map: rw, color: 0x8b8f95, roughness: 0.9 }),
  );
  tarmac.rotation.x = -Math.PI / 2; tarmac.position.set(F.x, g + 0.12, F.z);
  tarmac.receiveShadow = true; group.add(tarmac);
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.8 });
  const stripe = (w, l, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), paint);
    m.rotation.x = -Math.PI / 2; m.position.set(x, g + 0.18, z); m.receiveShadow = true; group.add(m);
  };
  for (let z = -F.rwLen / 2 + 26; z < F.rwLen / 2 - 26; z += 26) stripe(1.1, 11, F.x, F.z + z);
  for (const end of [-1, 1]) for (let i = -4; i <= 4; i++) stripe(2.2, 9, F.x + i * 3.2, F.z + end * (F.rwLen / 2 - 9));

  const tower = makeControlTower();
  tower.position.set(F.x + 46, g, F.z + 130); group.add(tower);
  obstacles.push({ x0: F.x + 41, x1: F.x + 51, z0: F.z + 125, z1: F.z + 135, top: g + 30, reason: 'Flew into the control tower' });
  for (let i = 0; i < 2; i++) {
    const hut = makeHangar();
    const hz = F.z + 40 - i * 74;
    hut.position.set(F.x - 56, g, hz); group.add(hut);
    obstacles.push({ x0: F.x - 75, x1: F.x - 37, z0: hz - 9, z1: hz + 9, top: g + 9, reason: 'Flew into a hangar' });
  }
  for (const [fx, fz] of [[86, -60], [98, -60], [92, -74]]) {
    const tank = makeFuelTank();
    tank.position.set(F.x + fx, g, F.z + fz); group.add(tank);
    obstacles.push({ x0: F.x + fx - 3.4, x1: F.x + fx + 3.4, z0: F.z + fz - 3.4, z1: F.z + fz + 3.4, top: g + 6, reason: 'Flew into a fuel tank' });
  }
  const socks = [];
  for (const wz of [F.rwLen / 2 - 30, -(F.rwLen / 2 - 30)]) {
    const sock = makeWindsock();
    sock.position.set(F.x + 34, g, F.z + wz); sock.rotation.y = Math.PI * 0.15;
    group.add(sock); socks.push(sock);
  }
  return socks;
}

// A rectangular island platform: a concrete/rock seawall block up to GROUND_Y,
// capped by a ground surface (asphalt streets for the city, grass for the field).
function buildIsland(group, cx, cz, hx, hz, topMat) {
  const g = CITY.GROUND_Y; const depth = g - CITY.SEA_FLOOR + 4;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, depth, hz * 2),
    new THREE.MeshStandardMaterial({ color: 0x6b6b66, roughness: 0.95 }),
  );
  wall.position.set(cx, g - depth / 2, cz); wall.receiveShadow = true; group.add(wall);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), topMat);
  top.rotation.x = -Math.PI / 2; top.position.set(cx, g + 0.04, cz); top.receiveShadow = true;
  group.add(top);
}

// ---- Assemble the whole world. Returns everything the sim needs. ----
export function buildCity() {
  const group = new THREE.Group();
  const rng = mulberry32(0x5170c1);
  const I = CITY.ISLAND;

  // City ground: dark asphalt street surface.
  const streetTex = loadSceneryTexture('/static/planes/asphalt.jpg');
  streetTex.wrapS = streetTex.wrapT = THREE.RepeatWrapping;
  streetTex.repeat.set(I.hx / 12, I.hz / 12); streetTex.anisotropy = GFX.aniso;
  buildIsland(group, I.x, I.z, I.hx, I.hz,
    new THREE.MeshStandardMaterial({ map: streetTex, color: 0x51555c, roughness: 0.95 }));
  // Field ground: grass.
  buildIsland(group, CITY.FIELD.x, CITY.FIELD.z, CITY.FIELD.hx, CITY.FIELD.hz,
    new THREE.MeshStandardMaterial({ color: 0x51632f, roughness: 0.95 }));

  const ctx = {
    walls: { stone: newBucket(), deco: newBucket(), brick: newBucket() },
    roofs: newBucket(),
    tanks: [],
    trim: [],
    obstacles: [],
  };
  const dropZones = [];

  // Street grid → block centres. Avenues run N–S (columns across the width),
  // streets run E–W (rows down the length). Density scales with the GFX tier.
  const dens = GFX.cityBuildings || 1;
  const cols = Math.max(3, Math.round(5 * Math.min(1, dens + 0.15)));
  const blockW = (I.hx * 2 - 60) / cols; // includes the avenue gaps
  const rowStep = 150 + 70 * (1 - Math.min(1, dens)); // sparser rows on low tiers
  const margin = 90;
  for (let z = -I.hz + margin; z <= I.hz - margin; z += rowStep) {
    for (let c = 0; c < cols; c++) {
      const bx = I.x - I.hx + 40 + blockW * (c + 0.5);
      const bz = z;
      // Per-block buildings: 1–2, sized to sit inside the block with street gaps.
      const perBlock = rng() < 0.35 * dens + 0.25 ? 2 : 1;
      for (let b = 0; b < perBlock; b++) {
        if (rng() > 0.5 + 0.5 * dens && perBlock === 1) continue; // occasional empty lot
        const zoff = perBlock === 2 ? (b === 0 ? -rowStep * 0.22 : rowStep * 0.22) : 0;
        const { kind, h } = zoneAt(bx, bz + zoff, rng);
        const footW = Math.min(blockW * (0.5 + rng() * 0.28), 62);
        const footD = Math.min((rowStep - 26) * (0.42 + rng() * 0.3), 70);
        addBuilding(ctx, kind, bx + (rng() - 0.5) * 6, bz + zoff, footW, footD, h, rng);
      }
      // Drop zones scattered over the blocks so bombers have targets to aim at.
      if (rng() < 0.5) dropZones.push({ x: bx, z: bz });
    }
  }
  // Ensure a solid spread of drop zones across the whole island.
  for (let z = -I.hz + 200; z <= I.hz - 200; z += 260) {
    dropZones.push({ x: I.x + (rng() - 0.5) * I.hx, z });
  }

  // Merge each material's geometry into a single mesh (a few draw calls total).
  const facades = {
    stone: new THREE.MeshStandardMaterial({ map: facadeTexture('stone'), roughness: 0.9 }),
    deco: new THREE.MeshStandardMaterial({ map: facadeTexture('deco'), roughness: 0.9 }),
    brick: new THREE.MeshStandardMaterial({ map: facadeTexture('brick'), roughness: 0.95 }),
  };
  for (const style of ['stone', 'deco', 'brick']) {
    const geo = bucketToGeo(ctx.walls[style]);
    if (geo) {
      const m = new THREE.Mesh(geo, facades[style]);
      m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
  }
  const roofGeo = bucketToGeo(ctx.roofs);
  if (roofGeo) {
    const m = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x45413b, roughness: 0.95 }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  if (ctx.tanks.length) {
    const m = new THREE.Mesh(mergeGeometries(ctx.tanks),
      new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.9 }));
    m.castShadow = true; group.add(m);
  }
  if (ctx.trim.length) {
    const m = new THREE.Mesh(mergeGeometries(ctx.trim),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.3 }));
    m.castShadow = true; group.add(m);
  }

  const socks = buildField(group, ctx.obstacles);

  // ---- The APIs the sim queries ----
  const inFieldXZ = (x, z) => Math.abs(x - CITY.FIELD.x) < CITY.FIELD.hx && Math.abs(z - CITY.FIELD.z) < CITY.FIELD.hz;
  const inCityXZ = (x, z) => Math.abs(x - I.x) < I.hx && Math.abs(z - I.z) < I.hz;
  const groundAt = (x, z) => ((inCityXZ(x, z) || inFieldXZ(x, z)) ? CITY.GROUND_Y : CITY.SEA_FLOOR);

  return {
    group,
    socks,
    obstacles: ctx.obstacles,
    dropZones,
    field: { x: CITY.FIELD.x, z: CITY.FIELD.z, rwLen: CITY.FIELD.rwLen },
    groundAt,
    inCity: inCityXZ,
  };
}
