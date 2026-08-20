// Backrooms — building the Poolrooms out of a terrain grid.
//
// Same merging discipline as backrooms-world.js: everything static collapses
// into one mesh per material, because a tiled level is if anything worse than a
// carpeted one for draw calls (every cell needs a floor, a ceiling, and up to
// four vertical skirts where its floor height changes).
//
// The three things this builder has to get right that Level 0 never had to:
//
//  1. SKIRTS. A cell's floor sits at one of three heights. Wherever two open
//     neighbours disagree, the gap between them has to be closed with a
//     vertical band of tile, or you can see out through the side of the world
//     from in the water. Every height change in the level gets one.
//  2. CAUSTICS. Anything below the waterline is drawn with a second, scrolling
//     caustic layer added on top of its lighting. Two layers moving against
//     each other at different scales is what makes it shimmer rather than
//     pulse. It fades out with depth and stops dead at the waterline.
//  3. LADDERS. They are the level's only affordance, so they are modelled
//     rather than decalled: stainless stiles standing proud of the tile, rungs
//     down into the water, and the top rail curling over onto the deck so you
//     can see one from IN the pool, where the deck itself is above your eyeline.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL, hash2, DIRS } from './backrooms-maze.js';
import {
  DECK, DECK_Y, WATER_Y, POOL_CEIL, FLOOR_Y, LINK_STAIRS,
} from './backrooms-pools.js';
import { MeshBuilder } from './backrooms-world.js';
import {
  poolTintAt, exitSignTexture, UV_TILE, POOL_TILE_VARIANTS,
} from './backrooms-materials.js';

const EXIT_DEPTH = 3;
const RAMP_STEPS = 10; // treads in a flight, giving 25 cm risers
const LADDER_DROP = 1.5; // how far a ladder reaches below the water surface

// ---------------------------------------------------------- primitives ----

/** Vertex tint for pool surfaces, with a slight darkening under the water. */
function tintAt(x, y, z, tint) {
  const wet = y < WATER_Y ? 0.86 + (y - WATER_Y) * 0.012 : 1;
  return poolTintAt(x, z, tint) * Math.max(0.62, wet);
}

/** A horizontal quad at height `y`, UV-mapped in world space. */
function addTile(b, x0, z0, sx, sz, y, up, tint) {
  const x1 = x0 + sx;
  const z1 = z0 + sz;
  const n = up ? [0, 1, 0] : [0, -1, 0];
  const verts = up
    ? [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]]
    : [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  // World-space UVs, never rotated. Ceramic tile is a real grid: if the grout
  // lines of two neighbouring cells do not line up, the level looks broken.
  b.quad(
    verts[0], verts[1], verts[2], verts[3], n,
    verts.map((v) => [v[0] / UV_TILE, v[2] / UV_TILE]),
    verts.map((v) => tintAt(v[0], y, v[2], tint)),
  );
}

/**
 * A vertical quad spanning y0..y1 along a horizontal edge, facing `n`.
 *
 * The endpoints may be given in EITHER order: this works out which way round
 * they have to go from the normal it was asked for, and swaps them if they
 * disagree. That is not defensiveness, it is the fix for a real bug — the
 * first version of this left winding to a hand-written table of which
 * directions to flip at the call site, the table was inverted, and every skirt
 * in the level came out back-facing. Every 1.35 m pool wall was invisible from
 * the water, which is the one side you ever look at one from.
 *
 * A quad wound (a, y0) (b, y0) (b, y1) (a, y1) has geometric normal
 * (b - a) x up, which for a horizontal edge (ux, 0, uz) and up (0, h, 0) comes
 * out as (-uz, 0, ux). Compare that with what the caller wants and flip once.
 */
function addSkirt(b, ax, az, bx, bz, y0, y1, n, tint) {
  let x0 = ax;
  let z0 = az;
  let x1 = bx;
  let z1 = bz;
  if ((-(z1 - z0)) * n[0] + (x1 - x0) * n[2] < 0) {
    x0 = bx;
    z0 = bz;
    x1 = ax;
    z1 = az;
  }
  // U runs along the edge, V runs up it — so tile courses stay level and the
  // grout on a pool wall lines up with the grout on the floor beside it.
  const u0 = (x0 + z0) / UV_TILE;
  const u1 = (x1 + z1) / UV_TILE;
  b.quad(
    [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], n,
    [[u0, y0 / UV_TILE], [u1, y0 / UV_TILE], [u1, y1 / UV_TILE], [u0, y1 / UV_TILE]],
    [tintAt(x0, y0, z0, tint), tintAt(x1, y0, z1, tint),
      tintAt(x1, y1, z1, tint), tintAt(x0, y1, z0, tint)],
  );
}

/** A box with world-scaled UVs (walls, pillars, exit slabs). */
function addBox(b, cx, cy, cz, sx, sy, sz, tint = 1, skip = []) {
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const z0 = cz - sz / 2;
  const z1 = cz + sz / 2;
  const face = (verts, n, uvFn) => b.quad(
    verts[0], verts[1], verts[2], verts[3], n,
    verts.map(uvFn),
    verts.map((v) => tintAt(v[0], v[1], v[2], tint)),
  );
  const u = (v) => v / UV_TILE;
  if (!skip.includes('px')) face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], (v) => [u(v[2]), u(v[1])]);
  if (!skip.includes('nx')) face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], (v) => [u(v[2]), u(v[1])]);
  if (!skip.includes('pz')) face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], (v) => [u(v[0]), u(v[1])]);
  if (!skip.includes('nz')) face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], (v) => [u(v[0]), u(v[1])]);
  if (!skip.includes('py')) face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], (v) => [u(v[0]), u(v[2])]);
  if (!skip.includes('ny')) face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], (v) => [u(v[0]), u(v[2])]);
}

// ------------------------------------------------------------ caustics ----

/**
 * Clone a tile material and add moving caustics to it.
 *
 * The two lookups are at different scales AND move in different directions;
 * multiplied together they interfere, which is what produces the travelling
 * bright filaments. One layer on its own just breathes in and out.
 *
 * The whole effect is gated on world height, so a single material can be used
 * for a wall that starts underwater and finishes above it and the caustics
 * still stop exactly at the waterline.
 */
function causticVariant(base, causticTex, clock, strength = 0.9, wall = false) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    // Which plane the pattern is projected from. A floor is projected from XZ,
    // which is what caustics actually are. A WALL cannot be: its XZ barely
    // changes over its whole height, so an XZ projection smears the filaments
    // into fixed vertical stripes. Walls are projected from (along, up)
    // instead, which is what light rippling down tile looks like.
    const plane = wall
      ? 'vec2(vPoolWPos.x + vPoolWPos.z, vPoolWPos.y * 1.6)'
      : 'vPoolWPos.xz';
    sh.uniforms.uCaustic = { value: causticTex };
    sh.uniforms.uCausticTime = clock;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPoolWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoolWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uCaustic;
        uniform float uCausticTime;
        varying vec3 vPoolWPos;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float t = uCausticTime;
        vec2 cu = ${plane} * 0.115;
        float c1 = texture2D(uCaustic, cu + vec2(t * 0.017, t * 0.011)).r;
        float c2 = texture2D(uCaustic, cu * 1.43 - vec2(t * 0.013, t * 0.019)).r;
        // Depth fade: brightest just under the surface, gone by the pit floor.
        float depth = clamp((vPoolWPos.y + 4.2) / 4.2, 0.0, 1.0);
        // Caustics ADD light, so they blow a white tile out to pure white with
        // very little provocation. Everything here is a fraction of what it
        // reads like it should be on paper.
        // Hard stop at the waterline — caustics are refracted light, and above
        // the surface there is nothing doing the refracting.
        float above = 1.0 - smoothstep(-0.02, 0.14, vPoolWPos.y);
        gl_FragColor.rgb += vec3(0.42, 0.86, 0.82) * (c1 * c2 * ${strength.toFixed(2)}) * depth * above;
      `);
  };
  // Three.js keys the compiled program on onBeforeCompile.toString(), and that
  // string is IDENTICAL for every variant here — `wall` and `strength` are
  // captured, not written into the source. Without an explicit key the renderer
  // is free to hand a wall the floor's program, which is the XZ projection the
  // comment above exists to avoid.
  m.customProgramCacheKey = () => `caustic:${wall ? 'wall' : 'floor'}:${strength.toFixed(2)}`;
  m.needsUpdate = true;
  return m;
}

// ---------------------------------------------------------- the ladder ----

/**
 * One ladder, as a small group of steel primitives. Built at the origin facing
 * +Z and then rotated into place, which keeps the maths readable.
 */
function buildLadderGeometry(ladder) {
  const parts = [];
  const stileR = 0.035;
  const half = 0.24; // half the distance between the stiles
  const top = DECK_Y + 0.62; // the grab rail stands above the deck
  const bottom = WATER_Y - LADDER_DROP;
  const len = top - bottom;

  const place = (geo, px, py, pz, rot) => {
    if (rot) geo.applyMatrix4(rot);
    geo.translate(px, py, pz);
    parts.push(geo);
  };
  const rotX = (a) => new THREE.Matrix4().makeRotationX(a);
  const rotZ = (a) => new THREE.Matrix4().makeRotationZ(a);

  // The bend over the deck lip. TorusGeometry lies in XY and sweeps its arc
  // from +X to +Y, so ONE rotation about Y by a quarter turn maps that arc to
  // run from -Z up to +Y — which, with the torus centred at (·, top, R), puts
  // its start exactly on the stile top at (·, top, 0) and its end at
  // (·, top + R, R) where the horizontal grab bar begins.
  //
  // This was previously an Euler(0, PI/2, PI/2), which lands the arc start at
  // (·, top + R, R) instead: the hook and the bar floated a fifth of a metre
  // above and in front of the stiles, joined to each other and to nothing
  // else. Any transform here is worth checking against the joint it is
  // supposed to meet rather than eyeballing.
  const CURL_R = 0.2;
  for (const s of [-1, 1]) {
    place(new THREE.CylinderGeometry(stileR, stileR, len, 8), s * half, (top + bottom) / 2, 0);
    const curl = new THREE.TorusGeometry(CURL_R, stileR, 6, 12, Math.PI / 2);
    curl.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    place(curl, s * half, top, CURL_R);
    // The grab bar, running from the end of the bend back over the tile.
    const BAR = 0.4;
    place(
      new THREE.CylinderGeometry(stileR, stileR, BAR, 8),
      s * half, top + CURL_R, CURL_R + BAR / 2, rotX(Math.PI / 2),
    );
  }
  // Rungs from a little above the deck down to the bottom of the stiles.
  for (let y = DECK_Y - 0.28; y > bottom + 0.1; y -= 0.32) {
    place(new THREE.CylinderGeometry(0.026, 0.026, half * 2, 6), 0, y, 0, rotZ(Math.PI / 2));
  }

  // Face the ladder out of the pool wall: DIRS[dir] points deck -> water, and
  // the ladder is mounted on the wall looking back at the deck. Baked into the
  // geometry rather than carried on a transform, so every ladder in the level
  // can be merged into ONE mesh — thirty-odd ladders as groups of fourteen
  // primitives each is five hundred draw calls for a handrail.
  const d = DIRS[ladder.dir];
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  merged.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(-d.dx, -d.dy)));
  // Set back a few centimetres into the water so the stiles clear the tile.
  merged.translate(ladder.x + d.dx * 0.16, 0, ladder.z + d.dy * 0.16);
  // Deliberately NOT a collider. A ladder sits exactly on the boundary between
  // the water cell and the deck cell, so any standoff radius at all pins the
  // player 0.5 m short of the one crossing the ladder exists to provide —
  // you climb to the top rung and then cannot get over the lip. Swimming
  // through a 3 cm stile is not something anyone will notice; being unable to
  // get out of a pool is.
  return merged;
}

/**
 * A flight of steps between the deck and the water.
 *
 * TREADS AND RISERS OVER A RAMP COLLIDER. level.groundAt() interpolates
 * linearly across a stair cell, so what you WALK on is a plain slope, while
 * what you SEE is RAMP_STEPS discrete steps sitting on that slope. That is the
 * ordinary way to build stairs in a first-person game and it is the right one
 * here: there is no player body, so nobody ever sees their feet failing to
 * touch a tread, and a smooth ramp feels far better under a camera than a
 * staircase that jolts it 25 cm at a time. Each tread takes its height from
 * the middle of its own span, so the collider is never more than half a riser
 * from the tile you can see.
 *
 * A flight is watertight, which the first version of this was not: it drew the
 * treads and nothing else — no risers between them and no walls down either
 * flank — so a staircase was six floating slabs with daylight between them and
 * an open black void underneath.
 *
 *   treads   RAMP_STEPS horizontal quads, descending
 *   risers   RAMP_STEPS + 1 vertical quads facing DOWN the flight, including a
 *            half-height lip against the deck at the top and another against
 *            the pool floor at the bottom
 *   flanks   a staircase-profile wall down each side, drawn only where the
 *            neighbour is level with or below the cell — a higher neighbour
 *            already draws a skirt across the whole height, and a second
 *            surface coplanar with it would z-fight
 */
function buildSteps(level, cx, cy, floorY, variant, B) {
  const sd = level.stairDir[cy][cx];
  const d = DIRS[sd]; // this cell -> the deck cell
  const alongX = d.dx !== 0;
  const drop = floorY - DECK_Y; // negative: the flight descends

  // The cell edge the deck is on, and the axis running away from it.
  const deckEdge = alongX
    ? (cx + (d.dx > 0 ? 1 : 0)) * CELL
    : (cy + (d.dy > 0 ? 1 : 0)) * CELL;
  const span = alongX ? -d.dx * CELL : -d.dy * CELL; // signed length per unit t
  const at = (t) => deckEdge + span * t;
  // The cross-axis extent, constant the whole way down.
  const c0 = alongX ? cy * CELL : cx * CELL;
  const c1 = c0 + CELL;
  const treadY = (i) => DECK_Y + drop * ((i + 0.5) / RAMP_STEPS);

  const flat = (yy) => (yy < WATER_Y ? B.wetB[variant] : B.deckB[variant]);
  const upright = (yy) => (yy < WATER_Y ? B.wetWallB : B.wallB[B.variantAt(cx, cy, 305)]);

  // Which neighbours the flanks have to be closed against.
  const sides = alongX ? [0, 2] : [3, 1]; // north/south, or west/east
  const flanks = sides.map((dirIndex, k) => {
    const nx = cx + DIRS[dirIndex].dx;
    const ny = cy + DIRS[dirIndex].dy;
    if (!level.inBounds(nx, ny) || level.wallAt(cx, cy, dirIndex)) return null;
    if (FLOOR_Y[level.terrain[ny][nx]] > floorY + 0.01) return null;
    return {
      cross: k === 0 ? c0 : c1,
      n: [DIRS[dirIndex].dx, 0, DIRS[dirIndex].dy],
    };
  });

  for (let i = 0; i < RAMP_STEPS; i += 1) {
    const a = at(i / RAMP_STEPS);
    const b = at((i + 1) / RAMP_STEPS);
    const lo = Math.min(a, b);
    const depth = Math.abs(b - a);
    const yy = treadY(i);

    // The tread.
    if (alongX) addTile(flat(yy), lo, c0, depth, CELL, yy, true, 1);
    else addTile(flat(yy), c0, lo, CELL, depth, yy, true, 1);

    // The riser under its leading edge, facing down the flight.
    const below = i + 1 < RAMP_STEPS ? treadY(i + 1) : floorY;
    const nDown = [-d.dx, 0, -d.dy];
    const riser = upright((yy + below) / 2);
    if (alongX) addSkirt(riser, b, c0, b, c1, below, yy, nDown, 1);
    else addSkirt(riser, c0, b, c1, b, below, yy, nDown, 1);

    // The two flanks, as a rectangle per step: together they cut the exact
    // staircase silhouette the treads make.
    for (const f of flanks) {
      if (!f) continue;
      const wall = upright((floorY + yy) / 2);
      if (alongX) addSkirt(wall, a, f.cross, b, f.cross, floorY, yy, f.n, 1);
      else addSkirt(wall, f.cross, a, f.cross, b, floorY, yy, f.n, 1);
    }
  }

  // The lip against the deck: half a riser, closing the top of the flight.
  const lipTop = DECK_Y;
  const lipBottom = treadY(0);
  const edge = at(0);
  const nDown = [-d.dx, 0, -d.dy];
  const lip = upright((lipTop + lipBottom) / 2);
  if (alongX) addSkirt(lip, edge, c0, edge, c1, lipBottom, lipTop, nDown, 1);
  else addSkirt(lip, c0, edge, c1, edge, lipBottom, lipTop, nDown, 1);
}

// --------------------------------------------------------------- build ----

/**
 * Build the whole Poolrooms level.
 * @returns {{group, fixtures, exit, water:null, causticClock, dispose}}
 */
export function buildPoolWorld(level, materials, collider) {
  const group = new THREE.Group();
  // One shared clock object drives every caustic material, so the two sides of
  // a waterline never shimmer out of step with each other.
  const causticClock = { value: 0 };

  const wallB = Array.from({ length: POOL_TILE_VARIANTS }, () => new MeshBuilder());
  const deckB = Array.from({ length: POOL_TILE_VARIANTS }, () => new MeshBuilder());
  // Everything below the waterline goes into its own builder so it can be
  // drawn with the caustic materials.
  const wetB = Array.from({ length: POOL_TILE_VARIANTS }, () => new MeshBuilder());
  const wetWallB = new MeshBuilder();
  const ceilB = new MeshBuilder();

  const floorOf = (cx, cy) => (level.inBounds(cx, cy) ? FLOOR_Y[level.terrain[cy][cx]] : DECK_Y);
  const variantAt = (cx, cy, salt) => Math.floor(hash2(cx, cy, salt) * POOL_TILE_VARIANTS)
    % POOL_TILE_VARIANTS;

  // ---- walls -------------------------------------------------------------
  // A wall only needs to start at the lower of the two floors it divides;
  // running every wall down to the deepest pit in the level would be tens of
  // thousands of triangles buried in solid tile.
  for (const box of level.wallBoxes()) {
    let base = DECK_Y;
    if (box.vertical) {
      base = Math.min(floorOf(box.gx - 1, box.gy), floorOf(box.gx, box.gy));
    } else {
      base = Math.min(floorOf(box.gx, box.gy - 1), floorOf(box.gx, box.gy));
    }
    const height = POOL_CEIL - base;
    const target = base < WATER_Y ? wetWallB : wallB[variantAt(box.gx, box.gy, 105)];
    addBox(
      target,
      (box.minX + box.maxX) / 2, base + height / 2, (box.minZ + box.maxZ) / 2,
      box.maxX - box.minX, height, box.maxZ - box.minZ,
      1, ['py', 'ny'],
    );
  }

  // ---- floors, ceilings, skirts -----------------------------------------
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      const terrain = level.terrain[y][x];
      const fy = FLOOR_Y[terrain];
      const wet = terrain !== DECK;
      const v = variantAt(x, y, 201);
      const stairDir = level.stairDir[y][x];

      if (stairDir === 255) {
        addTile(wet ? wetB[v] : deckB[v], x * CELL, y * CELL, CELL, CELL, fy, true, 1);
      } else {
        buildSteps(level, x, y, fy, v, {
          deckB, wetB, wallB, wetWallB, variantAt,
        });
      }

      addTile(ceilB, x * CELL, y * CELL, CELL, CELL, POOL_CEIL, false, 0.88);

      // Skirts: close every open boundary where the floor steps down.
      for (let d = 0; d < 4; d += 1) {
        const nx = x + DIRS[d].dx;
        const ny = y + DIRS[d].dy;
        if (!level.inBounds(nx, ny) || level.wallAt(x, y, d)) continue;
        const nfy = FLOOR_Y[level.terrain[ny][nx]];
        // Only the higher side draws the band, so it is drawn exactly once.
        if (nfy >= fy - 0.01) continue;
        // A flight of steps IS the transition — a wall across it would seal
        // off the only way down.
        if (level.linkAt(x, y, nx, ny) === LINK_STAIRS) continue;
        const dir = DIRS[d];
        // The shared edge, as two endpoints.
        let ax; let az; let bx; let bz;
        if (dir.dx !== 0) {
          const ex = (x + (dir.dx > 0 ? 1 : 0)) * CELL;
          ax = ex;
          az = y * CELL;
          bx = ex;
          bz = (y + 1) * CELL;
        } else {
          ax = x * CELL;
          az = (y + (dir.dy > 0 ? 1 : 0)) * CELL;
          bx = (x + 1) * CELL;
          bz = az;
        }
        // Face into the LOWER cell, which is the only side it can be seen
        // from. addSkirt sorts its own winding out from this.
        const n = [dir.dx, 0, dir.dy];
        // The band spans nfy (bottom) up to fy (top), so whether any of it is
        // underwater is decided by its LOWER extent. Testing fy classified a
        // skirt that starts under the surface and finishes above it as dry, and
        // lost the caustics on the submerged part — the wet material is built
        // to span the waterline, gating the effect on world height in the
        // shader, so handing it the whole band is exactly right.
        const target = nfy < WATER_Y ? wetWallB : wallB[variantAt(x, y, 305)];
        addSkirt(target, ax, az, bx, bz, nfy, fy, n, 1);
      }
    }
  }

  // ---- pillars -----------------------------------------------------------
  // The Poolrooms are described as having far more pillars than the space
  // needs, so Level 0's pillar halls become square tiled columns here — and
  // in the water they are the only cover there is.
  const pillarB = new MeshBuilder();
  for (const p of level.pillars) {
    const c = level.cellAt(p.x, p.z);
    const base = Math.min(
      floorOf(c.x, c.y), floorOf(c.x - 1, c.y), floorOf(c.x, c.y - 1), floorOf(c.x - 1, c.y - 1),
    );
    addBox(pillarB, p.x, (base + POOL_CEIL) / 2, p.z, 0.52, POOL_CEIL - base, 0.52);
    if (collider) collider.addProp(p.x, p.z, 0.38);
  }

  // ---- assemble ----------------------------------------------------------
  const owned = []; // materials this world made and must therefore release
  const causticFor = (base, strength, wall) => {
    const m = causticVariant(base, materials.caustic, causticClock, strength, wall);
    owned.push(m);
    return m;
  };

  const addMesh = (builder, material) => {
    if (builder.empty) return;
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  };
  deckB.forEach((b, i) => addMesh(b, materials.deck[i]));
  wallB.forEach((b, i) => addMesh(b, materials.wall[i]));
  wetB.forEach((b, i) => addMesh(b, causticFor(materials.basin[i], 0.85, false)));
  addMesh(wetWallB, causticFor(materials.wall[0], 0.4, true));
  addMesh(ceilB, materials.ceiling);
  addMesh(pillarB, materials.wall[1] || materials.wall[0]);

  // ---- ladders -----------------------------------------------------------
  if (level.ladders.length) {
    const geos = level.ladders.map((l) => buildLadderGeometry(l));
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, materials.steel);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }

  const exitParts = buildPoolExit(level, materials, group, collider);
  const fixtures = buildPoolFixtures(level, group);

  return {
    group,
    fixtures,
    exit: exitParts,
    causticClock,
    dispose() {
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      // Shared tile materials outlive the level; the caustic clones and the
      // two this module generates for itself do not.
      for (const m of owned) m.dispose();
      exitParts.sign.material.map?.dispose();
      exitParts.sign.material.dispose();
      fixtures.mesh.material.dispose();
    },
  };
}

/**
 * The way out: the same short passage through the perimeter Level 0 uses, in
 * tile, always dry, with the EXIT sign over its mouth.
 */
function buildPoolExit(level, materials, group, collider) {
  const b = new MeshBuilder();
  const { x, y, dir } = level.exit;
  const dx = [0, 1, 0, -1][dir];
  const dz = [-1, 0, 1, 0][dir];
  const start = level.centre(x, y);
  const mouth = { x: start.x + dx * (CELL / 2), z: start.z + dz * (CELL / 2) };

  for (let i = 0; i < EXIT_DEPTH; i += 1) {
    const cx = mouth.x + dx * CELL * (i + 0.5);
    const cz = mouth.z + dz * CELL * (i + 0.5);
    const side = { x: -dz, z: dx };
    const slab = (px, pz, sx, sz) => {
      addBox(b, px, DECK_Y + (POOL_CEIL - DECK_Y) / 2, pz, sx, POOL_CEIL - DECK_Y, sz, 1, ['py', 'ny']);
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
        cx + dx * (CELL / 2), cz + dz * (CELL / 2),
        Math.abs(dx) > 0.5 ? 0.24 : CELL,
        Math.abs(dz) > 0.5 ? 0.24 : CELL,
      );
    }
    addTile(b, cx - CELL / 2, cz - CELL / 2, CELL, CELL, DECK_Y, true, 0.95);
    addTile(b, cx - CELL / 2, cz - CELL / 2, CELL, CELL, POOL_CEIL, false, 0.88);
  }
  group.add(new THREE.Mesh(b.build(), materials.deck[0]));

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshBasicMaterial({
      map: exitSignTexture(), toneMapped: false, side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mouth.x - dx * 0.16, POOL_CEIL - 0.72, mouth.z - dz * 0.16);
  sign.rotation.y = Math.atan2(-dx, -dz);
  group.add(sign);

  const glow = new THREE.PointLight(0xff2a1a, 22, 16, 2);
  glow.position.set(mouth.x, POOL_CEIL - 0.9, mouth.z);
  group.add(glow);

  return {
    sign,
    glow,
    dir,
    mouth,
    trigger: {
      x: mouth.x + dx * CELL * (EXIT_DEPTH - 0.6),
      z: mouth.z + dz * CELL * (EXIT_DEPTH - 0.6),
      r: 1.6,
    },
  };
}

/**
 * Poolroom lighting: long recessed strips in the ceiling over the cells the
 * generator marked lit, and nothing whatsoever over the cells it marked dark.
 *
 * Shaped to be reusable by backrooms-world.updateFixtures(), which does the
 * flicker and hands out the light pool — the difference here is that hardly any
 * of these tubes flicker. Level 37's tiling is pristine and its lighting is
 * merely irregular, so the horror is the geometry of the dark patches, not a
 * failing ballast.
 */
function buildPoolFixtures(level, group) {
  const pos = [];
  const col = [];
  const idx = [];
  const list = [];

  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      if (!level.lit[y][x]) continue;
      const c = level.centre(x, y);
      const base = pos.length / 3;
      // Strips run along whichever axis the hash picks, so the ceiling reads as
      // a real (if senseless) lighting layout rather than a dot grid.
      const along = hash2(x, y, 141) < 0.5;
      const hw = along ? 1.5 : 0.16;
      const hd = along ? 0.16 : 1.5;
      const yy = POOL_CEIL - 0.03;
      pos.push(
        c.x - hw, yy, c.z + hd,
        c.x + hw, yy, c.z + hd,
        c.x + hw, yy, c.z - hd,
        c.x - hw, yy, c.z - hd,
      );
      for (let i = 0; i < 4; i += 1) col.push(0.92, 0.98, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      list.push({
        x: c.x,
        z: c.z,
        y: yy,
        cell: { x, y },
        vertexBase: base,
        // Cool white, not Level 0's dying warm tubes.
        tint: [0.92, 0.98, 1],
        flickers: hash2(x, y, 142) < 0.07,
        dead: false,
        phase: hash2(x, y, 143) * 100,
        rate: 4 + hash2(x, y, 144) * 7,
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
