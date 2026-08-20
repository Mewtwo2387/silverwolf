// Backrooms — seeded level generation, navigation and visibility.
//
// Deliberately dependency-free (no three, no DOM): the same module powers the
// game, the debug harness and tests/backrooms-maze.test.ts, which regenerates
// hundreds of seeds and asserts every one is solvable.
//
// Grid convention: cell (x, y) with x = column (world +X), y = row (world +Z).
// Walls live on cell boundaries and are stored as two bit-grids:
//   vWall[y][x] — the wall between cell (x-1, y) and (x, y), x in 0..W
//   hWall[y][x] — the wall between cell (x, y-1) and (x, y), y in 0..H
// so the outer border is just x = 0 / x = W and y = 0 / y = H being set.
//
// Generation is three passes, and the last two only ever REMOVE walls, so the
// perfect maze produced by pass 1 stays fully connected by construction:
//   1. recursive backtracker  -> a perfect (spanning-tree) maze, every cell
//      reachable from every other cell, exactly one path between any two
//   2. braiding                -> knock out dead ends so it reads as a rambling
//      floor plan rather than a puzzle-box maze
//   3. room carving            -> clear rectangular blocks into open halls
// A final BFS re-verifies reachability of the exit anyway; generate() throws if
// it ever fails rather than handing the game an unwinnable level.

export const CELL = 4.2; // metres per grid cell
export const WALL_T = 0.24; // wall thickness (metres)
export const WALL_H = 3.15; // floor-to-ceiling height (metres)

// ---------------------------------------------------------------- rng ----
// mulberry32 — small, fast, and stable across engines, so a seed string always
// produces the same level for everyone (seeds are shareable).
export function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the seed string, so "carpet" and "Carpet" are different levels.
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A deterministic 0..1 value for a (x, y, salt) triple. Used for per-cell and
// per-wall cosmetic choices (which wallpaper variant, which UV offset) so the
// dressing is as reproducible as the layout without storing anything.
export function hash2(x, y, salt) {
  let h = Math.imul((x | 0) + 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((y | 0) + 0xc2b2ae35, 0x27d4eb2f);
  h ^= Math.imul((salt | 0) + 0x165667b1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export const DIRS = [
  { dx: 0, dy: -1, wall: 'h', wx: 0, wy: 0 }, // north: hWall[y][x]
  { dx: 1, dy: 0, wall: 'v', wx: 1, wy: 0 }, // east:  vWall[y][x+1]
  { dx: 0, dy: 1, wall: 'h', wx: 0, wy: 1 }, // south: hWall[y+1][x]
  { dx: -1, dy: 0, wall: 'v', wx: 0, wy: 0 }, // west:  vWall[y][x]
];

const grid = (w, h, fill) => Array.from({ length: h }, () => new Uint8Array(w).fill(fill));

/** Level: the generated floor plan plus the queries the game asks of it. */
export class Level {
  constructor(w, h, seedStr) {
    this.w = w;
    this.h = h;
    this.seed = seedStr;
    this.vWall = grid(w + 1, h, 1);
    this.hWall = grid(w, h + 1, 1);
    this.rooms = [];
    this.pillars = [];
    this.spawn = { x: 0, y: 0 };
    this.exit = { x: 0, y: 0, dir: 1 };
    // Path length from spawn to exit, filled in by generate() once the exit is
    // placed and verified reachable.
    this.solveSteps = 0;
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Is the wall between (x, y) and its neighbour in direction `d` solid? */
  wallAt(x, y, d) {
    const dir = DIRS[d];
    return dir.wall === 'v'
      ? this.vWall[y][x + dir.wx] === 1
      : this.hWall[y + dir.wy][x] === 1;
  }

  setWall(x, y, d, solid) {
    const dir = DIRS[d];
    if (dir.wall === 'v') this.vWall[y][x + dir.wx] = solid ? 1 : 0;
    else this.hWall[y + dir.wy][x] = solid ? 1 : 0;
  }

  /** Open neighbours of a cell — the entity navigation graph. */
  neighbours(x, y) {
    const out = [];
    for (let d = 0; d < 4; d += 1) {
      const nx = x + DIRS[d].dx;
      const ny = y + DIRS[d].dy;
      if (this.inBounds(nx, ny) && !this.wallAt(x, y, d)) out.push({ x: nx, y: ny, d });
    }
    return out;
  }

  cellIndex(x, y) { return y * this.w + x; }

  /** Cell centre in world space. */
  centre(x, y) { return { x: (x + 0.5) * CELL, z: (y + 0.5) * CELL }; }

  /** World point -> cell, clamped to the grid. */
  cellAt(wx, wz) {
    const x = Math.min(this.w - 1, Math.max(0, Math.floor(wx / CELL)));
    const y = Math.min(this.h - 1, Math.max(0, Math.floor(wz / CELL)));
    return { x, y };
  }

  /**
   * BFS distance field over the open-cell graph from `sources`.
   * Returns an Int32Array of step counts, -1 where unreachable. This is the one
   * primitive behind both solvability checks and every entity's pathfinding:
   * a flow field is cheaper than per-entity A* at this grid size (<1500 cells)
   * and lets several entities share one field when they chase the same cell.
   */
  distanceField(sources, canPass) {
    const n = this.w * this.h;
    const dist = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    for (const s of sources) {
      if (!this.inBounds(s.x, s.y)) continue;
      const i = this.cellIndex(s.x, s.y);
      if (dist[i] !== -1) continue;
      dist[i] = 0;
      queue[tail] = i;
      tail += 1;
    }
    while (head < tail) {
      const i = queue[head];
      head += 1;
      const x = i % this.w;
      const y = (i / this.w) | 0;
      for (let d = 0; d < 4; d += 1) {
        if (this.wallAt(x, y, d)) continue;
        const nx = x + DIRS[d].dx;
        const ny = y + DIRS[d].dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.cellIndex(nx, ny);
        if (dist[ni] !== -1) continue;
        // Optional edge filter. The Poolrooms use it twice over: to check that
        // the exit is reachable when a 1.35 m pool wall can only be climbed
        // where a ladder was placed, and to keep an entity inside the terrain
        // it belongs to (a Drowner in the water, a Smiler in the dark).
        if (canPass && !canPass(x, y, nx, ny)) continue;
        dist[ni] = dist[i] + 1;
        queue[tail] = ni;
        tail += 1;
      }
    }
    return dist;
  }

  /**
   * One downhill step on a distance field — the next cell toward its source.
   *
   * `canPass` must be the SAME filter the field was built with. Two cells can
   * sit one step apart in a filtered field and still not have a legal edge
   * between them (a deck cell beside a pool with no ladder on that side), and
   * an agent that takes the shortcut walks through a pool wall.
   */
  stepDownhill(x, y, dist, canPass) {
    const here = dist[this.cellIndex(x, y)];
    if (here <= 0) return null;
    for (let d = 0; d < 4; d += 1) {
      if (this.wallAt(x, y, d)) continue;
      const nx = x + DIRS[d].dx;
      const ny = y + DIRS[d].dy;
      if (!this.inBounds(nx, ny)) continue;
      if (canPass && !canPass(x, y, nx, ny)) continue;
      if (dist[this.cellIndex(nx, ny)] === here - 1) return { x: nx, y: ny };
    }
    return null;
  }

  /** Full cell path from (sx, sy) to the field's source, or null. */
  pathFrom(sx, sy, dist, limit = 4096) {
    if (!this.inBounds(sx, sy)) return null;
    if (dist[this.cellIndex(sx, sy)] < 0) return null;
    const path = [];
    let cur = { x: sx, y: sy };
    for (let i = 0; i < limit; i += 1) {
      const next = this.stepDownhill(cur.x, cur.y, dist);
      if (!next) break;
      path.push(next);
      cur = next;
    }
    return path;
  }

  /**
   * Grid DDA line of sight between two world points. Walks the segment cell by
   * cell and fails the moment it crosses a solid boundary, so sight is blocked
   * by exactly the walls the player collides with — no seeing through corners.
   */
  lineOfSight(ax, az, bx, bz) {
    let cx = Math.floor(ax / CELL);
    let cy = Math.floor(az / CELL);
    const ex = Math.floor(bx / CELL);
    const ey = Math.floor(bz / CELL);
    if (!this.inBounds(cx, cy) || !this.inBounds(ex, ey)) return false;

    const dx = bx - ax;
    const dz = bz - az;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dz > 0 ? 1 : -1;
    // Distance (in t, where the segment is t = 0..1) to the next boundary.
    const invDx = dx !== 0 ? 1 / dx : Infinity;
    const invDz = dz !== 0 ? 1 / dz : Infinity;
    let tMaxX = dx !== 0
      ? (((dx > 0 ? cx + 1 : cx) * CELL) - ax) * invDx : Infinity;
    let tMaxY = dz !== 0
      ? (((dz > 0 ? cy + 1 : cy) * CELL) - az) * invDz : Infinity;
    const tDeltaX = dx !== 0 ? Math.abs(CELL * invDx) : Infinity;
    const tDeltaY = dz !== 0 ? Math.abs(CELL * invDz) : Infinity;

    for (let guard = 0; guard < 4096; guard += 1) {
      if (cx === ex && cy === ey) return true;
      if (tMaxX < tMaxY) {
        if (tMaxX > 1) return cx === ex && cy === ey;
        // Crossing a vertical boundary: the wall is west or east of this cell.
        if (this.wallAt(cx, cy, stepX > 0 ? 1 : 3)) return false;
        cx += stepX;
        tMaxX += tDeltaX;
      } else {
        if (tMaxY > 1) return cx === ex && cy === ey;
        if (this.wallAt(cx, cy, stepY > 0 ? 2 : 0)) return false;
        cy += stepY;
        tMaxY += tDeltaY;
      }
      if (!this.inBounds(cx, cy)) return false;
    }
    return false;
  }

  /**
   * Every solid wall as a world-space AABB (thin box). Ends are extended by
   * half a thickness so corner posts seal — without that, a fast mover can
   * squeeze through the pinhole where two walls meet.
   */
  wallBoxes() {
    const boxes = [];
    const t = WALL_T / 2;
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x <= this.w; x += 1) {
        if (!this.vWall[y][x]) continue;
        boxes.push({
          minX: x * CELL - t,
          maxX: x * CELL + t,
          minZ: y * CELL - t,
          maxZ: (y + 1) * CELL + t,
          vertical: true,
          gx: x,
          gy: y,
        });
      }
    }
    for (let y = 0; y <= this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (!this.hWall[y][x]) continue;
        boxes.push({
          minX: x * CELL - t,
          maxX: (x + 1) * CELL + t,
          minZ: y * CELL - t,
          maxZ: y * CELL + t,
          vertical: false,
          gx: x,
          gy: y,
        });
      }
    }
    return boxes;
  }
}

/**
 * Circle-vs-wall collision, bucketed per cell.
 *
 * Everything that moves — the player and every entity alike — goes through
 * this. That is the whole reason entities cannot phase through walls: there is
 * no second, more permissive movement path for them to take. Walls are thin
 * AABBs, so resolution is the standard "push out along the shallowest axis",
 * applied twice so a corner (two boxes at once) settles instead of jittering.
 */
export class Collider {
  constructor(level) {
    this.level = level;
    this.buckets = new Map();
    for (const box of level.wallBoxes()) {
      // A box overhangs its cell by half a wall thickness, so register it with
      // every cell it can possibly touch.
      const x0 = Math.floor(box.minX / CELL);
      const x1 = Math.floor(box.maxX / CELL);
      const y0 = Math.floor(box.minZ / CELL);
      const y1 = Math.floor(box.maxZ / CELL);
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const key = `${x},${y}`;
          let list = this.buckets.get(key);
          if (!list) {
            list = [];
            this.buckets.set(key, list);
          }
          list.push(box);
        }
      }
    }
    this.props = []; // pillars and other free-standing round obstacles
  }

  /** Register a circular obstacle (pillar, doorpost) at world (x, z). */
  addProp(x, z, radius) {
    this.props.push({ x, z, r: radius });
  }

  /**
   * Register an extra wall AABB outside the grid — the exit passage is built
   * beyond the perimeter, so its walls aren't in the level's wall grid and
   * would otherwise be scenery you could walk straight through.
   */
  addBox(minX, minZ, maxX, maxZ) {
    const box = {
      minX, minZ, maxX, maxZ, vertical: (maxZ - minZ) > (maxX - minX), gx: -1, gy: -1,
    };
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const y0 = Math.floor(minZ / CELL);
    const y1 = Math.floor(maxZ / CELL);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const key = `${x},${y}`;
        let list = this.buckets.get(key);
        if (!list) {
          list = [];
          this.buckets.set(key, list);
        }
        list.push(box);
      }
    }
    return box;
  }

  nearbyBoxes(wx, wz) {
    const cx = Math.floor(wx / CELL);
    const cy = Math.floor(wz / CELL);
    const out = [];
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        const list = this.buckets.get(`${x},${y}`);
        if (list) for (const b of list) if (!out.includes(b)) out.push(b);
      }
    }
    return out;
  }

  /**
   * Push a circle at (x, z) out of anything it overlaps.
   * @returns {{x:number, z:number, hit:boolean}}
   */
  resolve(x, z, radius) {
    let px = x;
    let pz = z;
    let hit = false;
    for (let pass = 0; pass < 2; pass += 1) {
      for (const b of this.nearbyBoxes(px, pz)) {
        // Closest point on the AABB to the circle centre.
        const nx = Math.max(b.minX, Math.min(px, b.maxX));
        const nz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        const dx = px - nx;
        const dz = pz - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius) continue;
        hit = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * radius;
          pz = nz + (dz / d) * radius;
        } else {
          // Dead centre inside the box: escape along the shallowest axis.
          const toL = px - b.minX;
          const toR = b.maxX - px;
          const toT = pz - b.minZ;
          const toB = b.maxZ - pz;
          const m = Math.min(toL, toR, toT, toB);
          if (m === toL) px = b.minX - radius;
          else if (m === toR) px = b.maxX + radius;
          else if (m === toT) pz = b.minZ - radius;
          else pz = b.maxZ + radius;
        }
      }
      for (const p of this.props) {
        const dx = px - p.x;
        const dz = pz - p.z;
        const rr = p.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-9) continue;
        hit = true;
        const d = Math.sqrt(d2);
        px = p.x + (dx / d) * rr;
        pz = p.z + (dz / d) * rr;
      }
    }
    return { x: px, z: pz, hit };
  }
}

// ------------------------------------------------------------ passes ----

// Pass 1 — iterative recursive backtracker. Iterative rather than recursive
// because a 40x40 grid would blow the JS stack on the deepest corridors.
function carvePerfect(level, rnd) {
  const { w, h } = level;
  const seen = grid(w, h, 0);
  const stack = [{ x: (rnd() * w) | 0, y: (rnd() * h) | 0 }];
  seen[stack[0].y][stack[0].x] = 1;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = [];
    for (let d = 0; d < 4; d += 1) {
      const nx = cur.x + DIRS[d].dx;
      const ny = cur.y + DIRS[d].dy;
      if (level.inBounds(nx, ny) && !seen[ny][nx]) options.push({ d, nx, ny });
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[(rnd() * options.length) | 0];
    level.setWall(cur.x, cur.y, pick.d, false);
    seen[pick.ny][pick.nx] = 1;
    stack.push({ x: pick.nx, y: pick.ny });
  }
}

// Pass 2 — braiding. A perfect maze is all dead ends and reads as a puzzle;
// the Backrooms should read as a floor plan you can wander. Opening one more
// wall at a dead end can only merge regions, never split them.
function braid(level, rnd, chance) {
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      if (level.neighbours(x, y).length !== 1) continue;
      if (rnd() > chance) continue;
      const closed = [];
      for (let d = 0; d < 4; d += 1) {
        const nx = x + DIRS[d].dx;
        const ny = y + DIRS[d].dy;
        if (level.inBounds(nx, ny) && level.wallAt(x, y, d)) closed.push(d);
      }
      if (closed.length) level.setWall(x, y, closed[(rnd() * closed.length) | 0], false);
    }
  }
}

// Pass 3 — rooms. Clearing a rectangle's interior walls opens a hall; because
// the rectangle is fully connected internally and each of its cells was already
// connected to the maze, this cannot disconnect anything.
function carveRooms(level, rnd, count) {
  for (let i = 0; i < count; i += 1) {
    const rw = 3 + ((rnd() * 3) | 0);
    const rh = 3 + ((rnd() * 3) | 0);
    const rx = 1 + ((rnd() * Math.max(1, level.w - rw - 2)) | 0);
    const ry = 1 + ((rnd() * Math.max(1, level.h - rh - 2)) | 0);
    for (let y = ry; y < ry + rh; y += 1) {
      for (let x = rx; x < rx + rw; x += 1) {
        if (!level.inBounds(x, y)) continue;
        if (x + 1 < rx + rw && level.inBounds(x + 1, y)) level.setWall(x, y, 1, false);
        if (y + 1 < ry + rh && level.inBounds(x, y + 1)) level.setWall(x, y, 2, false);
      }
    }
    const room = {
      x: rx, y: ry, w: rw, h: rh,
    };
    level.rooms.push(room);
    // Pillar halls: posts sit on interior grid *corners*, never on a cell
    // centre, so they decorate the space without touching the nav graph.
    if (rw >= 4 && rh >= 4 && rnd() < 0.55) {
      for (let y = ry + 1; y < ry + rh; y += 2) {
        for (let x = rx + 1; x < rx + rw; x += 2) {
          level.pillars.push({ x: x * CELL, z: y * CELL });
        }
      }
    }
  }
}

/**
 * Generate a level.
 *
 * @param {object} [opts]
 * @param {string|number} [opts.seed]  shareable seed (any string)
 * @param {number} [opts.width]  grid columns
 * @param {number} [opts.height] grid rows
 * @param {number} [opts.braidChance] 0..1 — how many dead ends get opened
 * @param {number} [opts.rooms] number of open halls to carve
 * @returns {Level}
 */
export function generate(opts = {}) {
  const width = Math.max(6, Math.min(64, Math.floor(opts.width ?? 26)));
  const height = Math.max(6, Math.min(64, Math.floor(opts.height ?? 26)));
  const seed = opts.seed ?? 'level-0';
  const rnd = mulberry32(hashSeed(seed));
  const level = new Level(width, height, String(seed));

  carvePerfect(level, rnd);
  braid(level, rnd, opts.braidChance ?? 0.72);
  carveRooms(level, rnd, opts.rooms ?? Math.max(3, Math.round((width * height) / 90)));

  // Spawn somewhere central-ish: being dropped in a corner gives away which way
  // the level runs. A ring of jitter keeps it from always being dead centre.
  level.spawn = {
    x: Math.min(width - 1, Math.max(0, Math.round(width / 2 + (rnd() - 0.5) * width * 0.4))),
    y: Math.min(height - 1, Math.max(0, Math.round(height / 2 + (rnd() - 0.5) * height * 0.4))),
  };

  // Exit: a perimeter cell that is genuinely far from spawn in *path* steps
  // (not straight-line distance, which a wall can make a lie). Ranked among
  // perimeter cells only — an interior "exit" could not be punched through the
  // outer border — then one of the farthest quarter at random, for variety.
  const dist = level.distanceField([level.spawn]);
  const edge = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      const d = dist[level.cellIndex(x, y)];
      if (d >= 0) edge.push({ x, y, d });
    }
  }
  edge.sort((a, b) => b.d - a.d);
  const candidates = edge.slice(0, Math.max(1, Math.round(edge.length * 0.25)));
  const pick = candidates[(rnd() * candidates.length) | 0];
  // Which way does the exit face? Whichever border this cell sits on.
  let dir = 2;
  if (pick.y === 0) dir = 0;
  else if (pick.x === width - 1) dir = 1;
  else if (pick.y === height - 1) dir = 2;
  else if (pick.x === 0) dir = 3;
  level.exit = { x: pick.x, y: pick.y, dir };
  // Punch the perimeter wall so the exit passage actually connects.
  level.setWall(pick.x, pick.y, dir, false);

  // Belt and braces: the passes above are connectivity-preserving by
  // construction, but a level that cannot be finished is the one bug the player
  // can never work around, so verify rather than trust.
  const verify = level.distanceField([level.spawn]);
  if (verify[level.cellIndex(pick.x, pick.y)] < 0) {
    throw new Error(`unsolvable level for seed "${seed}"`);
  }
  level.solveSteps = verify[level.cellIndex(pick.x, pick.y)];

  return level;
}
