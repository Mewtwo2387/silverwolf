// The "City" map for Plane Sim: a compressed 1940s-Manhattan island you defend
// from bomber waves, with the airfield on a separate island a short flight
// away. Built once at load and toggled with the other worlds (see the game's
// applyWorld). Everything here is STATIC scenery — the gameplay (bombers, city
// health, waves) lives in the main sim; this module just makes the world and
// hands back the footprints/obstacles/drop-zones it needs.
//
// Layout mirrors the real island: a grid of N–S avenues and E–W cross streets
// whose blocks are packed EDGE-TO-EDGE with party-wall buildings (no gaps —
// the streets are the gaps), zoned like the real thing — a Financial District
// spike at the south tip, low Village/SoHo blocks between, the Midtown
// skyline, Central Park (with UES/UWS flanks), and low Harlem tenements at the
// north end — plus Broadway slicing its diagonal through Midtown, piers down
// the Hudson shore, and hand-built landmark supertowers.
//
// Fidelity vs. frame rate: ~1000 individually-shaped buildings, but every
// wall/roof/tank of a given material is merged into ONE geometry (a handful of
// draw calls for the whole city) with per-building tints as vertex colours;
// building count scales with GFX.cityBuildings so weaker GPUs get a sparser
// town. The CSP is script-src 'self' with no external images, so facades are
// procedural canvas textures like the rest of the game's scenery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GFX, loadSceneryTexture } from './plane-sim-quality.js';
import {
  makeControlTower, makeHangar, makeWindsock, makeFuelTank, makeJetty,
  makeNissenHut, makeBowser, buildAircraft,
  makeBroadleafCanopyGeo, makeBroadleafTrunkGeo,
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
  // Central Park: middle of the island's northern half, avenues run past it on
  // both sides (the UES/UWS). Coordinates are world-space.
  PARK: {
    x0: 1500 - 230, x1: 1500 + 230, z0: 620, z1: 1460,
  },
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

// ---- Procedural facade textures: a seamlessly-tiling grid of punched windows
//      on a stone/brick ground, drawn once per style and repeated at a fixed
//      WORLD scale (FACADE_TILE) so windows are the same real size on a
//      5-storey tenement and an 80-storey tower. Four period styles; each
//      building also multiplies a per-vertex tint over these, so two brick
//      tenements never read as clones. ----
const FACADE_TILE = 12; // metres of wall per texture repeat (≈3 floors × 3 bays)
function facadeTexture(style) {
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cfg = {
    stone: { base: '#c7ba9d', trim: '#d8ccb2', win: '#39424b', glow: '#5b6b78' }, // limestone office
    deco: { base: '#b9a582', trim: '#d8c7a4', win: '#33404a', glow: '#5a6d7c' }, // art-deco, pilasters
    brick: { base: '#8a5140', trim: '#9c6250', win: '#2f363d', glow: '#556069' }, // red-brick tenement
    brownstone: { base: '#6e5245', trim: '#82655a', win: '#2c3238', glow: '#4e5860' }, // dark rowhouse
  }[style];
  ctx.fillStyle = cfg.base;
  ctx.fillRect(0, 0, S, S);
  // faint mortar/soot mottling so flat walls aren't dead-flat
  for (let i = 0; i < 900; i++) {
    const v = Math.random() * 0.10;
    ctx.fillStyle = `rgba(0,0,0,${v.toFixed(3)})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  if (style === 'brick' || style === 'brownstone') {
    // brick courses
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < S; y += 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
  }
  const cols = 3; const rows = 3;
  const cw = S / cols; const rh = S / rows;
  const wpad = (style === 'brick' || style === 'brownstone') ? cw * 0.30 : cw * 0.22;
  const hpadTop = rh * 0.16; const hpadBot = rh * 0.30;
  if (style === 'deco') {
    ctx.fillStyle = cfg.trim; // pale pilasters straddling the column gaps
    for (let i = 0; i <= cols; i++) ctx.fillRect(i * cw - 2.5, 0, 5, S);
  }
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cw + wpad; const x1 = (col + 1) * cw - wpad;
      const y0 = r * rh + hpadTop; const y1 = (r + 1) * rh - hpadBot;
      ctx.fillStyle = cfg.trim; // sill/lintel
      ctx.fillRect(x0 - 2, y0 - 2, (x1 - x0) + 4, (y1 - y0) + 4);
      const g = ctx.createLinearGradient(0, y0, 0, y1); // glass, sky-lit at the top
      g.addColorStop(0, cfg.glow);
      g.addColorStop(0.5, cfg.win);
      g.addColorStop(1, cfg.win);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(20,24,28,0.55)'; // mullion
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
//      UVs at world scale, a flat tint colour per call (vertex colours — the
//      per-building variance on top of the shared facade texture). ----
function pushWalls(bucket, x, z, baseY, w, d, h, tint) {
  const hw = w / 2; const hd = d / 2;
  const {
    pos, nor, uv, col, idx,
  } = bucket;
  const quad = (ax, ay, az, bx, by, bz, cx2, cy, cz2, dx, dy, dz, nx, ny, nz, uW, uH) => {
    const base = pos.length / 3;
    pos.push(ax, ay, az, bx, by, bz, cx2, cy, cz2, dx, dy, dz);
    for (let k = 0; k < 4; k++) { nor.push(nx, ny, nz); col.push(tint[0], tint[1], tint[2]); }
    uv.push(0, 0, uW, 0, uW, uH, 0, uH);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const uH = h / FACADE_TILE;
  const uWx = w / FACADE_TILE; const uWz = d / FACADE_TILE;
  const y0 = baseY; const y1 = baseY + h;
  quad(x - hw, y0, z + hd, x + hw, y0, z + hd, x + hw, y1, z + hd, x - hw, y1, z + hd, 0, 0, 1, uWx, uH);
  quad(x + hw, y0, z - hd, x - hw, y0, z - hd, x - hw, y1, z - hd, x + hw, y1, z - hd, 0, 0, -1, uWx, uH);
  quad(x + hw, y0, z + hd, x + hw, y0, z - hd, x + hw, y1, z - hd, x + hw, y1, z + hd, 1, 0, 0, uWz, uH);
  quad(x - hw, y0, z - hd, x - hw, y0, z + hd, x - hw, y1, z + hd, x - hw, y1, z - hd, -1, 0, 0, uWz, uH);
}
function newBucket() {
  return {
    pos: [], nor: [], uv: [], col: [], idx: [],
  };
}
function bucketToGeo(b) {
  if (!b.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  if (b.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  return g;
}

// Flat roof cap (tinted, in the shared roof bucket).
function pushRoof(roof, x, z, y, w, d, tint) {
  const b = roof;
  const hw = w / 2; const hd = d / 2;
  const base = b.pos.length / 3;
  b.pos.push(x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd);
  for (let k = 0; k < 4; k++) { b.nor.push(0, 1, 0); b.col.push(tint[0], tint[1], tint[2]); }
  b.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

// The iconic rooftop wooden water tank (barrel + conic cap on stilts).
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

// ---- Districts along the island (south tip -> north end), zoned like the map:
//      FiDi spike, low Village/SoHo saddle, the Midtown peak, the park belt
//      (UES/UWS flanks), Harlem. peak = tallest typical building there. ----
const DISTRICTS = [
  { z0: -2150, z1: -1955, green: true }, // Battery Park at the tip
  {
    z0: -1955, z1: -1480, peak: 225, core: -1720, spread: 260,
  }, // Financial District
  {
    z0: -1480, z1: -520, peak: 55, core: -1000, spread: 700,
  }, // Tribeca/SoHo/Village
  {
    z0: -520, z1: 620, peak: 275, core: 60, spread: 420,
  }, // Midtown
  {
    z0: 620, z1: 1460, peak: 90, core: 1040, spread: 600,
  }, // UES/UWS beside the park
  {
    z0: 1460, z1: 2150, peak: 34, core: 1800, spread: 700,
  }, // Harlem
];
function districtAt(z) {
  for (const d of DISTRICTS) if (z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

// Broadway's diagonal, as a polyline in world space (local x offsets from the
// island centreline). Lots within half-width of it are cleared — the slash
// through the grid that gives Midtown its Times Square wedge.
const BROADWAY = [
  [1530, -2050], [1470, -550], [1240, 640],
];
function nearBroadway(x, z, half) {
  for (let i = 0; i < BROADWAY.length - 1; i++) {
    const ax = BROADWAY[i][0]; const az = BROADWAY[i][1];
    const bx = BROADWAY[i + 1][0] - ax; const bz = BROADWAY[i + 1][1] - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
    const dx = x - ax - bx * t; const dz = z - az - bz * t;
    if (dx * dx + dz * dz < half * half) return true;
  }
  return false;
}

// Hand-placed landmark supertowers (site rect reserves the lots underneath).
const LANDMARKS = [
  {
    x: 1445, z: -130, w: 58, d: 52, h: 288, mast: 30, tiers: 5, kind: 'deco',
  }, // an Empire State
  {
    x: 1620, z: 55, w: 42, d: 42, h: 246, mast: 22, tiers: 4, kind: 'crown',
  }, // a Chrysler
  {
    x: 1520, z: -1725, w: 46, d: 46, h: 214, mast: 12, tiers: 4, kind: 'deco',
  }, // a 40 Wall Street
];

// ---- The airfield island: a faithful copy of the Coastal map's home field —
//      runway with full markings, the west-side perimeter taxiway with hangar
//      spurs / threshold links / apron pad, control tower, two hangars with
//      parked fighters inside, the Nissen-hut row, dispersed fuel tanks, a
//      bowser on the apron, windsocks, and the chain-link compound fence.
//      All positions are the Coastal offsets, translated to the island. ----
function buildField(group, obstacles) {
  const F = CITY.FIELD; const g = CITY.GROUND_Y;
  const RL = F.rwLen; const RW = F.rwW;
  const asphalt = loadSceneryTexture('/static/planes/asphalt.jpg');
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.anisotropy = GFX.aniso;
  const rw = asphalt.clone(); rw.repeat.set(3, 56);
  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(RW, RL),
    new THREE.MeshStandardMaterial({ map: rw, color: 0x8b8f95, roughness: 0.9 }),
  );
  tarmac.rotation.x = -Math.PI / 2; tarmac.position.set(F.x, g + 0.12, F.z);
  tarmac.receiveShadow = true; group.add(tarmac);
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.8 });
  const stripe = (w, l, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), paint);
    m.rotation.x = -Math.PI / 2; m.position.set(F.x + x, g + 0.18, F.z + z); m.receiveShadow = true; group.add(m);
  };
  for (const sx of [-1, 1]) stripe(0.8, RL - 20, sx * (RW / 2 - 1.2), 0); // edge lines
  for (let z = -RL / 2 + 26; z < RL / 2 - 26; z += 26) stripe(1.1, 11, 0, z);
  for (const end of [-1, 1]) for (let i = -4; i <= 4; i++) stripe(2.2, 9, i * 3.2, end * (RL / 2 - 9));

  // Perimeter taxiway + spurs + threshold links + apron (the Coastal layout).
  const taxiTex = asphalt.clone();
  taxiTex.repeat.set(1.5, 30);
  const taxiMat = new THREE.MeshStandardMaterial({ map: taxiTex, color: 0x90949a, roughness: 0.88 });
  const taxi = (w, l, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), taxiMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(F.x + x, g + 0.13, F.z + z); m.receiveShadow = true;
    group.add(m);
  };
  const TAXI_X = -30;
  taxi(11, RL - 40, TAXI_X, 0); // main perimeter track (N-S)
  for (const z of [40, -34]) taxi(30, 10, (TAXI_X - 42) / 2, z); // spurs to the hangars
  for (const end of [-1, 1]) taxi(Math.abs(TAXI_X) + 4, 11, TAXI_X / 2 + 2, end * (RL / 2 - 30)); // threshold links
  taxi(50, 130, -60, 3); // hangar apron pad

  const tower = makeControlTower();
  tower.position.set(F.x + 46, g, F.z + 150); group.add(tower);
  obstacles.push({ x0: F.x + 41, x1: F.x + 51, z0: F.z + 145, z1: F.z + 155, top: g + 30, reason: 'Flew into the control tower' });
  for (let i = 0; i < 2; i++) {
    const hut = makeHangar();
    const hz = F.z + 40 - i * 74;
    hut.position.set(F.x - 56, g, hz); group.add(hut);
    obstacles.push({ x0: F.x - 75, x1: F.x - 37, z0: hz - 9, z1: hz + 9, top: g + 9, reason: 'Flew into a hangar' });
  }
  // The Nissen-hut accommodation row behind the hangars.
  for (let i = 0; i < 4; i++) {
    const len = 8 + (i % 2) * 3;
    const hut = makeNissenHut(len);
    const hz = F.z - 45 + i * 30;
    hut.position.set(F.x - 92, g, hz);
    hut.rotation.y = Math.PI / 2;
    group.add(hut);
    obstacles.push({ x0: F.x - 92 - len / 2, x1: F.x - 92 + len / 2, z0: hz - 2.6, z1: hz + 2.6, top: g + 2.6, reason: 'Clipped a hut' });
  }
  for (const [fx, fz] of [[86, -60], [98, -60], [92, -74]]) {
    const tank = makeFuelTank();
    tank.position.set(F.x + fx, g, F.z + fz); group.add(tank);
    obstacles.push({ x0: F.x + fx - 3.4, x1: F.x + fx + 3.4, z0: F.z + fz - 3.4, z1: F.z + fz + 3.4, top: g + 6, reason: 'Flew into a fuel tank' });
  }
  const bowser = makeBowser();
  bowser.position.set(F.x - 40, g, F.z + 70);
  bowser.rotation.y = 1.1;
  group.add(bowser);
  obstacles.push({ x0: F.x - 43.4, x1: F.x - 36.6, z0: F.z + 66.6, z1: F.z + 73.4, top: g + 2.6, reason: 'Flew into a bowser' });
  const socks = [];
  for (const wz of [RL / 2 - 30, -(RL / 2 - 30)]) {
    const sock = makeWindsock();
    sock.position.set(F.x + 34, g, F.z + wz); sock.rotation.y = Math.PI * 0.15;
    group.add(sock); socks.push(sock);
  }

  // Chain-link compound fence around the technical site, gate gap on the
  // runway side (a straight copy of the Coastal fence, island offsets).
  (function fenceCompound() {
    const lc = document.createElement('canvas');
    lc.width = lc.height = 64;
    const lx = lc.getContext('2d');
    lx.strokeStyle = 'rgba(196,201,206,0.85)';
    lx.lineWidth = 2;
    for (let o = -64; o < 64; o += 12) {
      lx.beginPath(); lx.moveTo(o, 0); lx.lineTo(o + 64, 64); lx.stroke();
      lx.beginPath(); lx.moveTo(o + 64, 0); lx.lineTo(o, 64); lx.stroke();
    }
    const linkTex = new THREE.CanvasTexture(lc);
    linkTex.colorSpace = THREE.SRGBColorSpace;
    linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping;
    const FH = 2.3;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b9095, roughness: 0.6, metalness: 0.4 });
    const posts = [];
    const runFence = (x1, z1, x2, z2) => {
      const dx = x2 - x1; const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const mat = new THREE.MeshStandardMaterial({
        map: linkTex.clone(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
        roughness: 0.8, metalness: 0.3, color: 0xd2d6da,
      });
      mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
      mat.map.repeat.set(len / 2, FH / 2);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, FH), mat);
      panel.position.set(F.x + (x1 + x2) / 2, g + FH / 2, F.z + (z1 + z2) / 2);
      panel.rotation.y = Math.atan2(-dz, dx);
      group.add(panel);
      const n = Math.max(2, Math.round(len / 4));
      for (let i = 0; i <= n; i++) posts.push([x1 + (dx * i) / n, z1 + (dz * i) / n]);
    };
    const W = -104; const E = -24; const N = 108; const S = -96;
    runFence(W, S, W, N); // west
    runFence(W, N, E, N); // north
    runFence(W, S, E, S); // south
    runFence(E, S, E, -18); // east (lower) — gate gap between -18 and 22
    runFence(E, 22, E, N); // east (upper)
    const postGeo = new THREE.CylinderGeometry(0.09, 0.09, FH + 0.3, 6);
    postGeo.translate(0, (FH + 0.3) / 2, 0);
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    const pm = new THREE.Matrix4();
    for (let i = 0; i < posts.length; i++) {
      pm.makeTranslation(F.x + posts[i][0], g, F.z + posts[i][1]);
      postMesh.setMatrixAt(i, pm);
    }
    postMesh.castShadow = true;
    group.add(postMesh);
  }());

  // Parked aircraft — a Spitfire and a P-51 in the hangars, a Zero by the apron.
  for (const [type, px, py, pz, ry] of [
    ['spitfire', -58, 1.49, 40, -Math.PI / 2],
    ['p51', -58, 1.49, -34, -Math.PI / 2],
    ['zero', -42, 1.35, 96, -2.1],
  ]) {
    const parked = buildAircraft({ type });
    parked.group.position.set(F.x + px, g + py, F.z + pz);
    parked.group.rotation.y = ry;
    group.add(parked.group);
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
  const g0 = CITY.GROUND_Y;

  // City ground: dark asphalt street surface (the buildings leave the streets
  // exposed); green overlays for the park and the Battery.
  const streetTex = loadSceneryTexture('/static/planes/asphalt.jpg');
  streetTex.wrapS = streetTex.wrapT = THREE.RepeatWrapping;
  streetTex.repeat.set(I.hx / 12, I.hz / 12); streetTex.anisotropy = GFX.aniso;
  buildIsland(group, I.x, I.z, I.hx, I.hz,
    new THREE.MeshStandardMaterial({ map: streetTex, color: 0x51555c, roughness: 0.95 }));
  // Field ground: grass.
  buildIsland(group, CITY.FIELD.x, CITY.FIELD.z, CITY.FIELD.hx, CITY.FIELD.hz,
    new THREE.MeshStandardMaterial({ color: 0x51632f, roughness: 0.95 }));

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4c6630, roughness: 0.95 });
  const flatPatch = (x0, x1, z0, z1, mat, lift) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, g0 + lift, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  // ---- Central Park. Not just a green rectangle: tree-lined edges and
  //      interior clumps (instanced broadleafs), the reservoir + pond + lake as
  //      soft ellipses, lighter lawn meadows with ball diamonds, a path loop
  //      with two transverse crossings, benches along the loop and a fountain
  //      where the paths meet. Battery Park greens the south tip. ----
  const P = CITY.PARK;
  const dens = GFX.cityBuildings || 1;
  flatPatch(P.x0, P.x1, P.z0, P.z1, grassMat, 0.08);
  flatPatch(I.x - I.hx, I.x + I.hx, -2150, -1955, grassMat, 0.08); // Battery green

  // Park water: the ocean's material recipe (ripple normal map, glossy,
  // translucent) but held still — sheltered water — and a touch greener.
  let pondNormals = null;
  if (GFX.sceneryNormals) {
    pondNormals = loadSceneryTexture('/static/planes/water-normal.jpg');
    pondNormals.wrapS = pondNormals.wrapT = THREE.RepeatWrapping;
    pondNormals.repeat.set(5, 5);
    pondNormals.anisotropy = GFX.aniso;
  }
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x1e6168, // the sea's blue, nudged toward park-water green
    roughness: 0.08,
    metalness: 0.15,
    normalMap: pondNormals,
    normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true,
    opacity: 0.92,
  });
  const ellipse = (cx, cz, rx, rz, mat, lift) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    m.scale.set(rx, rz, 1);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, g0 + lift, cz);
    m.receiveShadow = true;
    group.add(m);
  };
  // Park waters (used below to keep trees/paths off them).
  const WATERS = [
    { x: 1500, z: P.z0 + 560, rx: 150, rz: 220 }, // the reservoir
    { x: P.x0 + 120, z: P.z0 + 150, rx: 58, rz: 76 }, // the pond
    { x: P.x0 + 118, z: P.z0 + 350, rx: 74, rz: 56 }, // the lake
  ];
  for (const w of WATERS) ellipse(w.x, w.z, w.rx, w.rz, pondMat, 0.12);
  const inWater = (x, z, m) => WATERS.some((w) => {
    const dx = (x - w.x) / (w.rx + m); const dz = (z - w.z) / (w.rz + m);
    return dx * dx + dz * dz < 1;
  });

  // Meadows: the big lawns (lighter green), with sandy ball diamonds on the
  // Great Lawn like the reference photo.
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x5d7c38, roughness: 0.95 });
  flatPatch(P.x0 + 55, P.x1 - 130, P.z0 + 170, P.z0 + 330, lawnMat, 0.09); // Sheep Meadow
  flatPatch(P.x0 + 70, P.x1 - 70, P.z1 - 320, P.z1 - 120, lawnMat, 0.09); // Great Lawn
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xc2a26a, roughness: 0.95 });
  for (const [dx2, dz2] of [[110, -160], [280, -160], [110, -280], [280, -280]]) {
    ellipse(P.x0 + 70 + dx2, P.z1 + dz2 + 60, 17, 17, sandMat, 0.1);
  }

  // Paths: a perimeter loop, two transverse crossings, and a ring track around
  // the reservoir (strips, like the airfield markings).
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xb3ab93, roughness: 0.95 });
  const path = (x0, x1, z0, z1) => flatPatch(x0, x1, z0, z1, pathMat, 0.1);
  const inset = 16; const pw = 6;
  path(P.x0 + inset, P.x1 - inset, P.z0 + inset, P.z0 + inset + pw); // south
  path(P.x0 + inset, P.x1 - inset, P.z1 - inset - pw, P.z1 - inset); // north
  path(P.x0 + inset, P.x0 + inset + pw, P.z0 + inset, P.z1 - inset); // west
  path(P.x1 - inset - pw, P.x1 - inset, P.z0 + inset, P.z1 - inset); // east
  path(P.x0 + inset, P.x1 - inset, P.z0 + 395, P.z0 + 395 + pw); // south transverse
  path(P.x0 + inset, P.x1 - inset, P.z1 - 100, P.z1 - 100 + pw); // north transverse
  { // reservoir running track: an ellipse ring drawn as a thin flat ring mesh
    const w = WATERS[0];
    const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 48), pathMat);
    ring.scale.set(w.rx + 14, w.rz + 14, 1);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, g0 + 0.1, w.z);
    ring.receiveShadow = true;
    group.add(ring);
  }

  // The fountain at the south transverse crossing (basin, water, spray).
  {
    const fx = 1500; const fz = P.z0 + 398;
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.6, 1.3, 20),
      new THREE.MeshStandardMaterial({ color: 0x9a917d, roughness: 0.85 }),
    );
    basin.position.set(fx, g0 + 0.65, fz); basin.castShadow = true; group.add(basin);
    ellipse(fx, fz, 6.2, 6.2, pondMat, 1.34);
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 5.5, 10),
      new THREE.MeshStandardMaterial({
        color: 0xdcecf2, roughness: 0.3, transparent: true, opacity: 0.8,
      }),
    );
    jet.position.set(fx, g0 + 3.4, fz); group.add(jet);
  }

  // Benches along the perimeter loop (merged into one mesh — tiny but they
  // read on a low flypast, like the reference path edges).
  {
    const seats = [];
    const bench = (x, z, rot) => {
      const seat = new THREE.BoxGeometry(2.0, 0.35, 0.55);
      seat.rotateY(rot); seat.translate(x, g0 + 0.55, z);
      const back = new THREE.BoxGeometry(2.0, 0.55, 0.12);
      back.rotateY(rot);
      back.translate(x - Math.sin(rot) * 0.26, g0 + 1.0, z - Math.cos(rot) * 0.26);
      seats.push(seat, back);
    };
    const step = dens >= 1 ? 34 : 60;
    for (let z = P.z0 + 60; z < P.z1 - 60; z += step) {
      bench(P.x0 + inset + pw + 1.6, z, Math.PI / 2);
      bench(P.x1 - inset - pw - 1.6, z, -Math.PI / 2);
    }
    for (let x = P.x0 + 60; x < P.x1 - 60; x += step) {
      bench(x, P.z0 + inset + pw + 1.6, 0);
      bench(x, P.z1 - inset - pw - 1.6, Math.PI);
    }
    const m = new THREE.Mesh(mergeGeometries(seats),
      new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9 }));
    m.castShadow = true; group.add(m);
  }

  // Park trees: instanced broadleafs — double rows lining the perimeter, plus
  // natural interior clumps that keep off the waters, lawns and paths.
  {
    const spots = [];
    const edgeStep = 26 / Math.min(1, dens + 0.2);
    for (let z = P.z0 + 20; z < P.z1 - 20; z += edgeStep) {
      spots.push([P.x0 + 10 + (rng() - 0.5) * 5, z + (rng() - 0.5) * 8]);
      spots.push([P.x0 + 26 + (rng() - 0.5) * 6, z + 12 + (rng() - 0.5) * 8]);
      spots.push([P.x1 - 10 + (rng() - 0.5) * 5, z + (rng() - 0.5) * 8]);
      spots.push([P.x1 - 26 + (rng() - 0.5) * 6, z + 12 + (rng() - 0.5) * 8]);
    }
    for (let x = P.x0 + 20; x < P.x1 - 20; x += edgeStep) {
      spots.push([x + (rng() - 0.5) * 8, P.z0 + 10 + (rng() - 0.5) * 5]);
      spots.push([x + (rng() - 0.5) * 8, P.z1 - 10 + (rng() - 0.5) * 5]);
    }
    const inLawn = (x, z) => (x > P.x0 + 55 && x < P.x1 - 130 && z > P.z0 + 170 && z < P.z0 + 330)
      || (x > P.x0 + 70 && x < P.x1 - 70 && z > P.z1 - 320 && z < P.z1 - 120);
    let guard = 0;
    const want = Math.round(150 * dens);
    let placed = 0;
    while (placed < want && guard++ < 3000) {
      const x = P.x0 + 14 + rng() * (P.x1 - P.x0 - 28);
      const z = P.z0 + 14 + rng() * (P.z1 - P.z0 - 28);
      if (inWater(x, z, 10) || inLawn(x, z)) continue;
      spots.push([x, z]);
      placed++;
    }
    const trunkTex = loadSceneryTexture('/static/planes/tree-bark.jpg');
    trunkTex.colorSpace = THREE.SRGBColorSpace;
    trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
    const leafTex = loadSceneryTexture('/static/planes/tree-leaves.jpg');
    leafTex.colorSpace = THREE.SRGBColorSpace;
    leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
    leafTex.repeat.set(4, 4);
    const trunks = new THREE.InstancedMesh(
      makeBroadleafTrunkGeo(),
      new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.9 }),
      spots.length,
    );
    const canopies = new THREE.InstancedMesh(
      makeBroadleafCanopyGeo(),
      new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.85 }),
      spots.length,
    );
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const col = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const s = 0.85 + rng() * 0.75;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      sc.set(s, s * (0.9 + rng() * 0.25), s);
      p3.set(x, g0, z);
      m4.compose(p3, q, sc);
      trunks.setMatrixAt(i, m4);
      canopies.setMatrixAt(i, m4);
      col.setHSL(0.26 + rng() * 0.09, 0.42, 0.26 + rng() * 0.14);
      canopies.setColorAt(i, col);
    });
    trunks.castShadow = true; canopies.castShadow = true;
    group.add(trunks); group.add(canopies);
  }

  const ctx = {
    walls: {
      stone: newBucket(), deco: newBucket(), brick: newBucket(), brownstone: newBucket(),
    },
    roofs: newBucket(),
    tanks: [],
    trim: [],
    obstacles: [],
  };
  const dropZones = [];

  // One building: box (+ optional penthouse) or a tiered setback tower once it
  // gets tall. Registers the crash AABB and maybe a rooftop water tank.
  function building(style, x, z, w, d, h, tint) {
    const bucket = ctx.walls[style];
    if (h > 100) {
      // Wedding-cake setbacks (the 1916 zoning look): 3-4 shrinking tiers.
      const tiers = 3 + (rng() < 0.4 ? 1 : 0);
      let w2 = w; let d2 = d; let baseY = g0; let remaining = h;
      for (let t = 0; t < tiers; t++) {
        const th = t === tiers - 1 ? remaining : remaining * (0.38 + rng() * 0.16);
        pushWalls(bucket, x, z, baseY, w2, d2, th, tint);
        pushRoof(ctx.roofs, x, z, baseY + th, w2, d2, tint);
        baseY += th; remaining -= th;
        w2 *= 0.68 + rng() * 0.1; d2 *= 0.68 + rng() * 0.1;
        if (remaining < 10) break;
      }
      if (rng() < 0.5) { // slender mast on about half the towers
        const mast = new THREE.CylinderGeometry(0.4, 1.1, 10 + rng() * 10, 6);
        mast.translate(x, baseY + 5, z);
        ctx.trim.push(mast);
      }
    } else {
      pushWalls(bucket, x, z, g0, w, d, h, tint);
      pushRoof(ctx.roofs, x, z, g0 + h, w, d, tint);
      if (h > 26 && rng() < 0.45) { // rooftop penthouse/bulkhead
        const ph = 2.8 + rng() * 2.6;
        const pw = w * (0.3 + rng() * 0.2); const pd = d * (0.3 + rng() * 0.2);
        const px = x + (rng() - 0.5) * (w - pw) * 0.6; const pz = z + (rng() - 0.5) * (d - pd) * 0.6;
        pushWalls(bucket, px, pz, g0 + h, pw, pd, ph, tint);
        pushRoof(ctx.roofs, px, pz, g0 + h + ph, pw, pd, tint);
      }
      if (h > 16 && h < 85 && dens >= 0.75 && rng() < 0.5) {
        pushWaterTank(ctx.tanks, x + (rng() - 0.5) * w * 0.5, z + (rng() - 0.5) * d * 0.5, g0 + h, rng);
      }
    }
    ctx.obstacles.push({
      x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2,
      top: g0 + h, reason: 'Flew into a building',
    });
  }

  // ---- Landmarks first (their sites reserve the lots beneath them). ----
  for (const L of LANDMARKS) {
    const tint = [0.93, 0.89, 0.8];
    let w = L.w; let d = L.d; let baseY = g0; let remaining = L.h;
    for (let t = 0; t < L.tiers; t++) {
      const th = t === L.tiers - 1 ? remaining : remaining * (t === 0 ? 0.45 : 0.4);
      pushWalls(ctx.walls.deco, L.x, L.z, baseY, w, d, th, tint);
      pushRoof(ctx.roofs, L.x, L.z, baseY + th, w, d, tint);
      baseY += th; remaining -= th;
      w *= L.kind === 'crown' ? 0.8 : 0.7;
      d *= L.kind === 'crown' ? 0.8 : 0.7;
    }
    if (L.kind === 'crown') {
      // Chrysler-style terraced crown: shrinking arcs approximated by cylinders.
      let r = Math.min(w, d) * 0.62; let y = baseY;
      while (r > 2.5) {
        const seg = new THREE.CylinderGeometry(r * 0.82, r, 6, 10);
        seg.translate(L.x, y + 3, L.z);
        ctx.trim.push(seg);
        y += 5.4; r *= 0.74;
      }
      baseY = y;
    }
    const mast = new THREE.CylinderGeometry(0.5, 1.3, L.mast, 8);
    mast.translate(L.x, baseY + L.mast / 2, L.z);
    ctx.trim.push(mast);
    ctx.obstacles.push({
      x0: L.x - L.w / 2, x1: L.x + L.w / 2, z0: L.z - L.d / 2, z1: L.z + L.d / 2,
      top: g0 + L.h + L.mast, reason: 'Flew into a skyscraper',
    });
  }
  const onLandmark = (x, z, m) => LANDMARKS.some((L) => x > L.x - L.w / 2 - m && x < L.x + L.w / 2 + m
    && z > L.z - L.d / 2 - m && z < L.z + L.d / 2 + m);

  // ---- The grid: 5 avenues (N–S) make 4 block columns; cross streets every
  //      88 m. Each block face is packed with contiguous party-wall lots. ----
  const AVE_W = 22; const ST_W = 15; const MARGIN = 30;
  const usable = I.hx * 2 - MARGIN * 2;
  const COLS = 4;
  const blockW = (usable - (COLS + 1) * AVE_W) / COLS; // ~207 m between avenues
  const ROW = 88; // street-to-street spacing; block depth = ROW - ST_W
  const blockD = ROW - ST_W;
  const gauss = () => (rng() + rng() + rng()) / 1.5 - 1; // ~N(0, 0.47), [-1,1]

  for (let z = -I.hz + 70; z < I.hz - 70 - ROW; z += ROW) {
    const zc = z + blockD / 2;
    const D = districtAt(zc);
    if (D.green) continue;
    for (let cIdx = 0; cIdx < COLS; cIdx++) {
      const bx0 = I.x - I.hx + MARGIN + AVE_W + cIdx * (blockW + AVE_W);
      const bx1 = bx0 + blockW;
      // The park swallows whole blocks.
      if (zc > P.z0 - 20 && zc < P.z1 + 20 && bx1 > P.x0 - 20 && bx0 < P.x1 + 20) continue;
      dropZones.push({ x: (bx0 + bx1) / 2, z: zc });

      // Pack the block with lots, edge to edge. On lower tiers lots get wider
      // (fewer, chunkier buildings) instead of leaving gaps.
      let x = bx0;
      while (x < bx1 - 12) {
        const frontage = Math.min((16 + rng() * 26) / Math.min(1, dens + 0.25), bx1 - x);
        const cx = x + frontage / 2;
        x += frontage;
        if (nearBroadway(cx, zc, 15 + frontage / 2)) continue;
        if (onLandmark(cx, zc, 12)) continue;
        // Depth: most lots front both streets (full depth), some leave a
        // back-court notch; the street wall itself stays continuous.
        const depth = blockD * (rng() < 0.6 ? 1 : 0.62 + rng() * 0.3);
        const cz = zc + (depth < blockD ? (rng() < 0.5 ? 1 : -1) * (blockD - depth) * 0.5 : 0);

        // Height: the district's peak, falling off from its core, with a wide
        // per-lot spread and the odd out-of-place tower (the map's scattered
        // landmarks) so no two blocks read alike.
        const fall = 1 - Math.min(1, Math.abs(zc - D.core) / D.spread) * 0.75;
        let h = D.peak * fall * (0.42 + 0.58 * Math.exp(gauss() * 0.8));
        if (rng() < 0.018) h *= 2.2; // the stray campanile/insurance tower
        h = Math.max(12, Math.min(h, D.peak * 1.15));

        // Style follows height + district: towers deco/stone, mid-rise stone,
        // low blocks brick with brownstone rows uptown.
        let style;
        if (h > 90) style = rng() < 0.65 ? 'deco' : 'stone';
        else if (h > 40) style = rng() < 0.6 ? 'stone' : 'deco';
        else style = rng() < (zc > 600 ? 0.45 : 0.7) ? 'brick' : 'brownstone';
        // Per-building tint: subtle value/hue wobble multiplied over the facade.
        const v = 0.82 + rng() * 0.3;
        const tint = style === 'brick' || style === 'brownstone'
          ? [v * (0.95 + rng() * 0.1), v * 0.92, v * 0.9]
          : [v, v * (0.97 + rng() * 0.05), v * 0.95];

        building(style, cx, cz, frontage - 0.4, depth, h, tint);
      }
    }
  }

  // ---- Piers: the map's teeth down the Hudson shore (plus a few on the East
  //      River). Low wooden decks just above the water off the seawall. ----
  const pierGeos = [];
  const westX = I.x - I.hx;
  for (let z = -1900; z < 1950; z += 130 + rng() * 60) {
    const len = 55 + rng() * 40; const w = 10 + rng() * 4;
    const deck = new THREE.BoxGeometry(len, 2.6, w);
    deck.translate(westX - len / 2 + 4, -9.2, z);
    pierGeos.push(deck);
  }
  const eastX = I.x + I.hx;
  for (let i = 0; i < 7; i++) {
    const z = -1800 + rng() * 3400;
    const len = 45 + rng() * 30; const w = 10 + rng() * 4;
    const deck = new THREE.BoxGeometry(len, 2.6, w);
    deck.translate(eastX + len / 2 - 4, -9.2, z);
    pierGeos.push(deck);
  }
  if (pierGeos.length) {
    const piers = new THREE.Mesh(mergeGeometries(pierGeos),
      new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.9 }));
    piers.castShadow = true; piers.receiveShadow = true;
    group.add(piers);
  }

  // ---- Harbour life. Wooden jetties off the East River seawall, small
  //      launches moored at the piers and jetties, and a few barges anchored
  //      out in the roads. All decorative (no crash volumes — they sit at
  //      water level, where the sea already ends a flight). ----
  const WATER_Y = -12; // mirrors TERRAIN.WATER_Y without importing the module
  const jettyZs = [];
  for (let i = 0; i < 8; i++) {
    const z = -1750 + i * 460 + (rng() - 0.5) * 120;
    const jetty = makeJetty(14 + rng() * 8);
    jetty.position.set(eastX - 2, WATER_Y + 2.6, z);
    jetty.rotation.y = -Math.PI / 2; // extend out over the East River
    group.add(jetty);
    jettyZs.push(z);
  }

  // Boats: real hull shapes — a pointed bow sweeping back to a flat transom,
  // extruded with a bevel so the sides tumble home toward the keel — merged
  // into buckets by paint colour, plus a white bucket for deckhouses and a
  // dark one for barge funnels. `blunt` softens the bow for working craft.
  function makeHullGeo(len, beam, depth, blunt = 0) {
    const L = len / 2; const B = beam / 2;
    const s = new THREE.Shape();
    s.moveTo(L, 0); // bow (local +x)
    s.quadraticCurveTo(L * (0.45 + blunt * 0.3), B, -L * 0.2, B);
    s.lineTo(-L, B * 0.68); // quarter taper to the transom
    s.lineTo(-L, -B * 0.68);
    s.lineTo(-L * 0.2, -B);
    s.quadraticCurveTo(L * (0.45 + blunt * 0.3), -B, L, 0);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.55,
      bevelSize: Math.min(beam * 0.24, depth * 0.7),
      bevelSegments: 1,
      curveSegments: 4,
    });
    geo.rotateX(-Math.PI / 2); // extrusion axis -> vertical (shape plan stays x/z)
    return geo;
  }
  const hullBuckets = [[], [], [], []];
  const HULL_COLORS = [0x3a4148, 0x71332c, 0x2e4a63, 0x4d5442];
  const whiteGeos = [];
  const funnelGeos = [];
  const launch = (x, z, rot) => {
    const len = 5 + rng() * 2.5;
    const hull = makeHullGeo(len, 1.9, 0.55);
    hull.rotateY(rot);
    hull.translate(x, WATER_Y + 0.1, z); // ~0.3 m draught, ~0.9 m freeboard
    hullBuckets[Math.floor(rng() * 4)].push(hull);
    const cabin = new THREE.BoxGeometry(len * 0.28, 0.8, 1.25);
    cabin.rotateY(rot);
    cabin.translate(x - Math.cos(rot) * len * 0.18, WATER_Y + 1.25, z + Math.sin(rot) * len * 0.18);
    whiteGeos.push(cabin);
  };
  const barge = (x, z, rot) => {
    const len = 26 + rng() * 9;
    const hull = makeHullGeo(len, 7, 1.5, 1); // blunt working bow
    hull.rotateY(rot);
    hull.translate(x, WATER_Y - 0.35, z); // sits deep, ~1.7 m freeboard
    hullBuckets[0].push(hull);
    const house = new THREE.BoxGeometry(6, 2.6, 5);
    house.rotateY(rot);
    house.translate(x - Math.cos(rot) * (len / 2 - 5.5), WATER_Y + 2.9, z + Math.sin(rot) * (len / 2 - 5.5));
    whiteGeos.push(house);
    const funnel = new THREE.CylinderGeometry(0.7, 0.85, 3.2, 8);
    funnel.translate(x - Math.cos(rot) * (len / 2 - 5.5), WATER_Y + 5.4, z + Math.sin(rot) * (len / 2 - 5.5));
    funnelGeos.push(funnel);
  };
  // Moored alongside the Hudson piers...
  let pi = 0;
  for (let z = -1900; z < 1950; z += 470) {
    launch(westX - 40 - rng() * 30, z + 9 + rng() * 6, rng() * 0.3 - 0.15);
    if (pi++ % 2 === 0) launch(westX - 15 - rng() * 20, z - 9 - rng() * 5, Math.PI + rng() * 0.3);
  }
  // ...at the East River jetties...
  for (const z of jettyZs) if (rng() < 0.7) launch(eastX + 20 + rng() * 8, z + 5, rng() * 0.4 - 0.2);
  // ...and anchored out in the roads (the harbour between the two islands).
  for (let i = 0; i < 7; i++) {
    launch(-300 + rng() * 1200, -2450 + rng() * 700, rng() * Math.PI * 2);
  }
  barge(400, -2500, 0.35);
  barge(-150, -2280, -0.2);
  barge(750, 1900, 2.6);
  barge(2450, -900, 1.4);
  // The airfield island's own waterfront: jetties on the shore facing the
  // city, with a couple of launches alongside and one anchored off.
  const F = CITY.FIELD;
  for (const [jz, jl] of [[F.z - 160, 18], [F.z + 240, 15]]) {
    const jetty = makeJetty(jl);
    jetty.position.set(F.x + F.hx - 2, WATER_Y + 2.6, jz);
    jetty.rotation.y = -Math.PI / 2; // out over the water toward the city
    group.add(jetty);
    launch(F.x + F.hx + jl + 4, jz + 5, rng() * 0.4 - 0.2);
  }
  launch(F.x + F.hx + 90 + rng() * 40, F.z + 40, rng() * Math.PI * 2);
  hullBuckets.forEach((geos, i) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos),
      new THREE.MeshStandardMaterial({ color: HULL_COLORS[i], roughness: 0.75, metalness: 0.15 }));
    m.castShadow = true; group.add(m);
  });
  if (whiteGeos.length) {
    const m = new THREE.Mesh(mergeGeometries(whiteGeos),
      new THREE.MeshStandardMaterial({ color: 0xd8d5c8, roughness: 0.7 }));
    m.castShadow = true; group.add(m);
  }
  if (funnelGeos.length) {
    const m = new THREE.Mesh(mergeGeometries(funnelGeos),
      new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7 }));
    m.castShadow = true; group.add(m);
  }

  // ---- Merge the whole skyline into a handful of draw calls. ----
  const facadeMat = (style) => new THREE.MeshStandardMaterial({
    map: facadeTexture(style), roughness: 0.92, vertexColors: true,
  });
  for (const style of ['stone', 'deco', 'brick', 'brownstone']) {
    const geo = bucketToGeo(ctx.walls[style]);
    if (geo) {
      const m = new THREE.Mesh(geo, facadeMat(style));
      m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
  }
  const roofGeo = bucketToGeo(ctx.roofs);
  if (roofGeo) {
    const m = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({
      color: 0x4a463f, roughness: 0.95, vertexColors: true,
    }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  if (ctx.tanks.length) {
    const m = new THREE.Mesh(mergeGeometries(ctx.tanks),
      new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.9 }));
    m.castShadow = true; group.add(m);
  }
  if (ctx.trim.length) {
    const m = new THREE.Mesh(mergeGeometries(ctx.trim),
      new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.6, metalness: 0.35 }));
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
