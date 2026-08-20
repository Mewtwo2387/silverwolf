// Backrooms — turning a Level into geometry, light and an exit.
//
// Everything static is merged into one mesh per material variant. A 26x26 grid
// is ~1400 wall segments and ~700 floor and ceiling tiles; as individual meshes
// that is 2800 draw calls and a slideshow, merged it is about a dozen.
//
// Per-vertex colour carries the grime (see backrooms-materials.grimeAt) plus
// the skirting darkening at the foot of every wall, so the damp patches are
// baked into the geometry rather than costing a second texture lookup.

import * as THREE from 'three';
import {
  CELL, WALL_H, hash2,
} from './backrooms-maze.js';
import {
  grimeAt, exitSignTexture, WALLPAPER_VARIANTS, CARPET_VARIANTS, CEILING_VARIANTS,
} from './backrooms-materials.js';

const UV_WALL = 2.6; // metres per texture repeat on walls
const UV_FLOOR = 3.1;
const EXIT_DEPTH = 3; // cells of passage beyond the border

// -------------------------------------------------------- mesh builder ----

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  get empty() { return this.pos.length === 0; }

  /** One quad, wound counter-clockwise as seen from the normal's side. */
  quad(a, b, c, d, n, uvs, colours) {
    const base = this.pos.length / 3;
    const verts = [a, b, c, d];
    for (let i = 0; i < 4; i += 1) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.norm.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const col = colours[i];
      this.col.push(col, col, col);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * A box with world-scaled UVs, so texel density is identical on a 0.24 m wall
 * end and a 4.2 m wall face — no stretching at doorways.
 */
function addBox(b, cx, cy, cz, sx, sy, sz, opts = {}) {
  const uvScale = opts.uvScale ?? UV_WALL;
  const uo = opts.uOffset ?? 0;
  const vo = opts.vOffset ?? 0;
  const tint = opts.tint ?? 1;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  const z0 = cz - hz;
  const z1 = cz + hz;

  // Vertex colour: world-space grime, darkened toward the floor so every wall
  // grows its own skirting band without extra geometry.
  const colAt = (x, y, z) => {
    const skirt = y < 0.42 ? 0.55 + (y / 0.42) * 0.45 : 1;
    const cap = y > WALL_H - 0.25 ? 0.86 : 1;
    return grimeAt(x, z, tint) * skirt * cap;
  };
  const face = (verts, n, uvFn) => {
    b.quad(
      verts[0], verts[1], verts[2], verts[3], n,
      verts.map(uvFn),
      verts.map((v) => colAt(v[0], v[1], v[2])),
    );
  };

  const u = (v) => (v + uo) / uvScale;
  const w = (v) => (v + vo) / uvScale;

  if (!opts.skip?.includes('px')) {
    face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0],
      (v) => [u(v[2]), w(v[1])]);
  }
  if (!opts.skip?.includes('nx')) {
    face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0],
      (v) => [u(v[2]), w(v[1])]);
  }
  if (!opts.skip?.includes('pz')) {
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1],
      (v) => [u(v[0]), w(v[1])]);
  }
  if (!opts.skip?.includes('nz')) {
    face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1],
      (v) => [u(v[0]), w(v[1])]);
  }
  if (!opts.skip?.includes('py')) {
    face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0],
      (v) => [u(v[0]), w(v[2])]);
  }
  if (!opts.skip?.includes('ny')) {
    face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0],
      (v) => [u(v[0]), w(v[2])]);
  }
}

/** A horizontal quad (floor or ceiling) with optional 90-degree UV rotation. */
function addTile(b, x0, z0, size, y, up, rot, uvScale, tint) {
  const x1 = x0 + size;
  const z1 = z0 + size;
  const n = up ? [0, 1, 0] : [0, -1, 0];
  const verts = up
    ? [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]]
    : [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  // Rotating the UVs a quarter-turn per tile hides the fact that four
  // neighbouring tiles share one texture — berber carpet has no grain, so the
  // rotation is invisible while the repeat is not.
  const uvBase = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const scale = size / uvScale;
  const uvs = verts.map((_, i) => {
    const p = uvBase[(i + rot) % 4];
    return [p[0] * scale + (x0 / uvScale), p[1] * scale + (z0 / uvScale)];
  });
  b.quad(verts[0], verts[1], verts[2], verts[3], n, uvs,
    verts.map((v) => grimeAt(v[0], v[2], tint)));
}

// -------------------------------------------------------------- build ----

/**
 * Build the whole static level.
 * @returns {{group, fixtures, exit, dispose}}
 */
export function buildWorld(level, materials, collider) {
  const group = new THREE.Group();
  const wallB = Array.from({ length: WALLPAPER_VARIANTS }, () => new MeshBuilder());
  const floorB = Array.from({ length: CARPET_VARIANTS }, () => new MeshBuilder());
  const ceilB = Array.from({ length: CEILING_VARIANTS }, () => new MeshBuilder());

  // ---- walls -----------------------------------------------------------
  for (const box of level.wallBoxes()) {
    const variant = Math.floor(hash2(box.gx, box.gy, box.vertical ? 5 : 6) * WALLPAPER_VARIANTS)
      % WALLPAPER_VARIANTS;
    // Offset in whole texture repeats so the wallpaper's vertical striping
    // still lines up across segments — a stripe that jumps at every doorway is
    // a worse tell than the tiling it was meant to hide.
    const uOffset = Math.floor(hash2(box.gx, box.gy, 8) * 4) * UV_WALL;
    addBox(
      wallB[variant],
      (box.minX + box.maxX) / 2, WALL_H / 2, (box.minZ + box.maxZ) / 2,
      box.maxX - box.minX, WALL_H, box.maxZ - box.minZ,
      { uvScale: UV_WALL, uOffset, skip: ['py', 'ny'] },
    );
  }

  // ---- floor and ceiling ------------------------------------------------
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      const fv = Math.floor(hash2(x, y, 21) * CARPET_VARIANTS) % CARPET_VARIANTS;
      const rot = Math.floor(hash2(x, y, 22) * 4);
      addTile(floorB[fv], x * CELL, y * CELL, CELL, 0, true, rot, UV_FLOOR, 1);
      const cv = Math.floor(hash2(x, y, 23) * CEILING_VARIANTS) % CEILING_VARIANTS;
      // Ceiling tiles are a real grid, so they are NOT rotated — a suspended
      // ceiling whose runners don't line up looks broken, not varied.
      addTile(ceilB[cv], x * CELL, y * CELL, CELL, WALL_H, false, 0, CELL, 0.82);
    }
  }

  // ---- pillars ----------------------------------------------------------
  const pillarB = new MeshBuilder();
  for (const p of level.pillars) {
    addBox(pillarB, p.x, WALL_H / 2, p.z, 0.44, WALL_H, 0.44, { uvScale: UV_WALL });
    if (collider) collider.addProp(p.x, p.z, 0.33);
  }

  const meshes = [];
  const addMesh = (builder, material) => {
    if (builder.empty) return;
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    meshes.push(mesh);
  };
  wallB.forEach((b, i) => addMesh(b, materials.wall[i]));
  floorB.forEach((b, i) => addMesh(b, materials.carpet[i]));
  ceilB.forEach((b, i) => addMesh(b, materials.ceiling[i]));
  addMesh(pillarB, materials.skirting);

  // ---- the exit passage -------------------------------------------------
  const exitParts = buildExit(level, materials, group, collider);

  // ---- ceiling fluorescents --------------------------------------------
  const fixtures = buildFixtures(level, group);

  return {
    group,
    fixtures,
    exit: exitParts,
    dispose() {
      // Geometry is all ours — every mesh under the group was built here, the
      // exit passage and sign included, and none of it survives the level.
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      // Materials mostly are NOT. The wall/carpet/ceiling/skirting set is
      // shared and outlives the level (see buildMaterials), so only the two
      // this module makes for itself are released, with the sign's canvas
      // texture, which is generated per level.
      exitParts.sign.material.map?.dispose();
      exitParts.sign.material.dispose();
      fixtures.mesh.material.dispose();
      exitParts.glow.dispose?.();
      exitParts.deep.dispose?.();
    },
  };
}

/**
 * The way out: a short walled corridor punched through the perimeter, an EXIT
 * sign over its mouth and a red glow at the far end. The trigger volume sits at
 * the very end, so you have to commit to the passage rather than clip its edge.
 */
function buildExit(level, materials, group, collider) {
  const b = new MeshBuilder();
  const floorB = new MeshBuilder();
  const ceilB = new MeshBuilder();
  const { x, y, dir } = level.exit;
  // Direction vector: 0 = -Z, 1 = +X, 2 = +Z, 3 = -X.
  const dx = [0, 1, 0, -1][dir];
  const dz = [-1, 0, 1, 0][dir];
  const start = level.centre(x, y);
  const mouth = {
    x: start.x + dx * (CELL / 2),
    z: start.z + dz * (CELL / 2),
  };

  for (let i = 0; i < EXIT_DEPTH; i += 1) {
    const cx = mouth.x + dx * CELL * (i + 0.5);
    const cz = mouth.z + dz * CELL * (i + 0.5);
    // Side walls run along the corridor; the far end is capped on the last cell.
    const along = { x: dx, z: dz };
    const side = { x: -dz, z: dx };
    // Wall slabs are placed by centre + size; the physics AABB has to match
    // them exactly, or the corridor becomes a place you can walk out of.
    const slab = (px, pz, sx, sz) => {
      addBox(b, px, WALL_H / 2, pz, sx, WALL_H, sz, { uvScale: UV_WALL, skip: ['py', 'ny'] });
      if (collider) collider.addBox(px - sx / 2, pz - sz / 2, px + sx / 2, pz + sz / 2);
    };
    for (const s of [-1, 1]) {
      slab(
        cx + side.x * (CELL / 2) * s, cz + side.z * (CELL / 2) * s,
        Math.abs(side.x) > 0.5 ? 0.24 : CELL,
        Math.abs(side.z) > 0.5 ? 0.24 : CELL,
      );
    }
    if (i === EXIT_DEPTH - 1) {
      slab(
        cx + along.x * (CELL / 2), cz + along.z * (CELL / 2),
        Math.abs(along.x) > 0.5 ? 0.24 : CELL,
        Math.abs(along.z) > 0.5 ? 0.24 : CELL,
      );
    }
    addTile(floorB, cx - CELL / 2, cz - CELL / 2, CELL, 0, true, i % 4, UV_FLOOR, 0.9);
    addTile(ceilB, cx - CELL / 2, cz - CELL / 2, CELL, WALL_H, false, 0, CELL, 0.75);
  }

  group.add(new THREE.Mesh(b.build(), materials.wall[0]));
  group.add(new THREE.Mesh(floorB.build(), materials.carpet[0]));
  group.add(new THREE.Mesh(ceilB.build(), materials.ceiling[0]));

  // Sign over the mouth, facing back into the maze.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshBasicMaterial({
      map: exitSignTexture(), transparent: false, toneMapped: false, side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mouth.x - dx * 0.16, WALL_H - 0.62, mouth.z - dz * 0.16);
  sign.rotation.y = Math.atan2(-dx, -dz);
  group.add(sign);

  const glow = new THREE.PointLight(0xff2a1a, 26, 16, 2);
  glow.position.set(mouth.x, WALL_H - 0.8, mouth.z);
  group.add(glow);

  const deep = new THREE.PointLight(0xff3a20, 20, 14, 2);
  deep.position.set(
    mouth.x + dx * CELL * (EXIT_DEPTH - 0.5),
    1.6,
    mouth.z + dz * CELL * (EXIT_DEPTH - 0.5),
  );
  group.add(deep);

  return {
    sign,
    glow,
    deep,
    dir,
    mouth,
    // Win when you reach the far end of the passage.
    trigger: {
      x: mouth.x + dx * CELL * (EXIT_DEPTH - 0.6),
      z: mouth.z + dz * CELL * (EXIT_DEPTH - 0.6),
      r: 1.6,
    },
  };
}

/**
 * Ceiling fluorescents. All the emissive panels live in ONE mesh with vertex
 * colours; flicker rewrites the colours of the few fixtures near the player
 * each frame instead of touching hundreds of materials. Actual illumination
 * comes from a small pool of PointLights reassigned to the nearest fixtures —
 * a real light per tube would be hundreds of lights and no frame rate.
 */
function buildFixtures(level, group) {
  const pos = [];
  const col = [];
  const idx = [];
  const list = [];

  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      const roll = hash2(x, y, 31);
      if (roll > 0.34) continue; // roughly one lit cell in three
      const c = level.centre(x, y);
      const base = pos.length / 3;
      const hw = 0.62;
      const hd = 0.3;
      const yy = WALL_H - 0.035;
      pos.push(
        c.x - hw, yy, c.z + hd,
        c.x + hw, yy, c.z + hd,
        c.x + hw, yy, c.z - hd,
        c.x - hw, yy, c.z - hd,
      );
      for (let i = 0; i < 4; i += 1) col.push(1, 0.96, 0.84);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      list.push({
        x: c.x,
        z: c.z,
        y: yy,
        cell: { x, y },
        vertexBase: base,
        // A third of the tubes are dying. `phase` and `rate` are hashed, so a
        // seed's flicker pattern is as reproducible as its floor plan.
        flickers: hash2(x, y, 32) < 0.34,
        dead: hash2(x, y, 33) < 0.08,
        phase: hash2(x, y, 34) * 100,
        rate: 5 + hash2(x, y, 35) * 9,
        level: 1,
      });
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, toneMapped: false, fog: true, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  group.add(mesh);

  return { mesh, list, colours: geo.getAttribute('color') };
}

/**
 * Per-frame fluorescent behaviour. Only fixtures within `radius` are animated
 * or lit — everything else is fog anyway.
 *
 * The flicker model is deliberately not a sine wave: a failing tube strikes,
 * holds, and drops out, so this is a hard threshold on layered oscillators with
 * an occasional full dropout. Returns the strongest flicker near the player so
 * the audio can buzz in sympathy.
 */
const WARM_TUBE = [1, 0.96, 0.84];

export function updateFixtures(fixtures, lights, playerPos, time, radius = 26) {
  const near = [];
  let flickerPeak = 0;
  let nearestDist = Infinity;

  for (const f of fixtures.list) {
    const d = Math.hypot(f.x - playerPos.x, f.z - playerPos.z);
    if (d > radius) continue;
    let lvl = 1;
    if (f.dead) {
      lvl = 0;
    } else if (f.flickers) {
      const t = time * f.rate + f.phase;
      const a = Math.sin(t) * 0.5 + 0.5;
      const b = Math.sin(t * 2.37 + 1.1) * 0.5 + 0.5;
      const strike = a * 0.6 + b * 0.4;
      // Long dropouts: the tube goes out completely for a beat or two.
      const out = Math.sin(time * 0.53 + f.phase) > 0.86;
      lvl = out ? 0.02 : (strike > 0.42 ? 1 : 0.08 + strike * 0.35);
      flickerPeak = Math.max(flickerPeak, Math.abs(1 - lvl) * (1 - d / radius));
    }
    if (Math.abs(lvl - f.level) > 0.01) {
      f.level = lvl;
      // Level 0's tubes are warm and dying; the Poolrooms' are cool and merely
      // sparse, so a fixture may carry its own tint.
      const tint = f.tint || WARM_TUBE;
      const c = fixtures.colours;
      for (let i = 0; i < 4; i += 1) {
        c.setXYZ(f.vertexBase + i, lvl * tint[0], lvl * tint[1], lvl * tint[2]);
      }
      c.needsUpdate = true;
    }
    if (lvl > 0.2) nearestDist = Math.min(nearestDist, d);
    near.push({ f, d });
  }

  // Hand the light pool to the closest live fixtures.
  near.sort((a, b) => a.d - b.d);
  for (let i = 0; i < lights.length; i += 1) {
    const pick = near[i];
    const light = lights[i];
    if (!pick) {
      light.intensity = 0;
      continue;
    }
    light.position.set(pick.f.x, pick.f.y - 0.12, pick.f.z);
    light.intensity = pick.f.level * 34;
  }

  return { flicker: flickerPeak, nearestLight: nearestDist };
}
