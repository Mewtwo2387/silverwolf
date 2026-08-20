// Backrooms — Level 37, "Sublimity" (the Poolrooms): terrain generation.
//
// This module does NOT replace backrooms-maze.js. It calls generate() to get a
// verified-solvable floor plan and then gives that plan a THIRD dimension:
// every cell is assigned a terrain (dry deck, waist-deep shallow, or a deep
// pit), and the 1.35 m pool wall between deck and water is only climbable
// where a ladder or a flight of steps was placed. So the level you get is the
// same connected graph the maze module guarantees, re-verified under the much
// stricter rule that you cannot haul yourself out of a pool just anywhere.
//
// Height convention (metres, Y up). The WATER SURFACE is the datum at y = 0,
// because everything the player cares about is measured against it: how deep
// they are standing, whether their eyes are under it, how far they must climb.
//
//        +4.90  ceiling
//        +1.35  deck floor          — dry, walkable
//         0.00  water surface       — the datum
//        -1.15  shallow pool floor  — waist deep, wadeable
//        -3.70  deep pit floor      — over your head, swim only
//
// Sources for the level are listed on the game's References tab; the shape of
// the place (pristine white tile, waist-deep water with deeper pits scattered
// through it, pillars, staircases descending into the pits, no ledges where
// you want one) is from the Backrooms Wiki's Level 37.
//
// Dependency-free, like the maze module: no three, no DOM.

import {
  generate, CELL, DIRS, mulberry32, hashSeed, hash2,
} from './backrooms-maze.js';

// ------------------------------------------------------------ heights ----

export const WATER_Y = 0; // the datum: mean water surface
export const DECK_Y = 1.35; // dry tile, one pool wall above the water
export const SHALLOW_Y = -1.15; // waist deep on a 1.66 m player
export const DEEP_Y = -3.7; // well over your head
export const POOL_CEIL = 4.9; // ceiling height above the datum
/** The tallest lip a player or entity can walk up unaided. */
export const STEP_UP = 0.42;

// Terrain codes, stored one byte per cell.
export const DECK = 0;
export const SHALLOW = 1;
export const DEEP = 2;

export const FLOOR_Y = [DECK_Y, SHALLOW_Y, DEEP_Y];

// How a deck cell connects down to the water beside it.
export const LINK_NONE = 0;
export const LINK_LADDER = 1;
export const LINK_STAIRS = 2;

const grid8 = (w, h, fill) => Array.from({ length: h }, () => new Uint8Array(w).fill(fill));

/**
 * Grow a connected blob of cells outward from a seed, following the floor plan
 * (it only spreads through openings, never through walls). Pools that respect
 * the architecture read as rooms that happen to be flooded; pools stamped as
 * raw rectangles read as a heightmap someone forgot to align.
 */
function growBlob(level, sx, sy, size, rnd, taken) {
  const out = [];
  const frontier = [{ x: sx, y: sy }];
  const seen = new Set([`${sx},${sy}`]);
  while (frontier.length && out.length < size) {
    // Pull from a random point in the frontier rather than the end, so blobs
    // spread roundish instead of snaking off down one corridor.
    const i = Math.floor(rnd() * frontier.length);
    const cur = frontier.splice(i, 1)[0];
    const key = `${cur.x},${cur.y}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(cur);
    for (const n of level.neighbours(cur.x, cur.y)) {
      const nk = `${n.x},${n.y}`;
      if (seen.has(nk) || taken.has(nk)) continue;
      seen.add(nk);
      frontier.push({ x: n.x, y: n.y });
    }
  }
  return out;
}

/**
 * Attach the terrain queries the game and the entities ask of a pool level.
 * They are instance methods rather than free functions so the rest of the code
 * can treat a pool level as a Level that simply knows about water.
 */
function attachQueries(level) {
  const self = level;

  /** Terrain code at a cell, DECK outside the grid (the exit passage is dry). */
  self.terrainAt = function terrainAt(cx, cy) {
    if (!self.inBounds(cx, cy)) return DECK;
    return self.terrain[cy][cx];
  };

  self.isWater = function isWater(cx, cy) { return self.terrainAt(cx, cy) !== DECK; };

  self.isDark = function isDark(cx, cy) {
    if (!self.inBounds(cx, cy)) return false;
    return self.dark[cy][cx] === 1;
  };

  /**
   * Floor height under a world point.
   *
   * Steps are the only place this is not simply a per-cell constant: a stair
   * cell ramps from the deck lip on one edge down to its own floor at the far
   * edge, so walking down one is continuous rather than a 2.5 m drop.
   */
  self.groundAt = function groundAt(wx, wz) {
    const cx = Math.floor(wx / CELL);
    const cy = Math.floor(wz / CELL);
    if (!self.inBounds(cx, cy)) return DECK_Y;
    const base = FLOOR_Y[self.terrain[cy][cx]];
    const sd = self.stairDir[cy][cx];
    if (sd === 255) return base;
    // Distance across the cell measured FROM the deck edge, 0..1.
    const fx = wx / CELL - cx;
    const fz = wz / CELL - cy;
    const d = DIRS[sd];
    let t;
    if (d.dx === 1) t = 1 - fx;
    else if (d.dx === -1) t = fx;
    else if (d.dy === 1) t = 1 - fz;
    else t = fz;
    t = Math.max(0, Math.min(1, t));
    // Ease the two ends so the ramp meets the deck and the pool floor flush
    // instead of with a crease you can feel through the camera.
    const e = t * t * (3 - 2 * t);
    return DECK_Y + (base - DECK_Y) * e;
  };

  /** Depth of water over a world point (0 on dry deck). */
  self.depthAt = function depthAt(wx, wz) {
    return Math.max(0, WATER_Y - self.groundAt(wx, wz));
  };

  /**
   * Can something standing at feet height `fromY` enter cell (cx, cy)?
   *
   * This is the rule that makes a pool a pool. Nothing may step up more than
   * STEP_UP, so the 1.35 m wall out of the water is impassable and the ladders
   * and steps are the only way back onto the deck. Dropping DOWN is always
   * allowed — you can always fall in.
   */
  self.canStepTo = function canStepTo(fromY, wx, wz) {
    return self.groundAt(wx, wz) - fromY <= STEP_UP;
  };

  /**
   * The pathfinding counterpart of canStepTo, as a distanceField edge filter:
   * a deck/water boundary is only crossable where it was given a ladder or a
   * flight of steps.
   */
  self.climbFilter = function climbFilter(x, y, nx, ny) {
    const a = self.terrain[y][x];
    const b = self.terrain[ny][nx];
    if ((a === DECK) === (b === DECK)) return true;
    return self.linkAt(x, y, nx, ny) !== LINK_NONE;
  };

  /** What kind of connection, if any, joins two orthogonally adjacent cells. */
  self.linkAt = function linkAt(x, y, nx, ny) {
    return self.links.get(`${x},${y}|${nx},${ny}`) ?? LINK_NONE;
  };

  /** The nearest ladder within `r` metres of a world point, or null. */
  self.ladderNear = function ladderNear(wx, wz, r) {
    let best = null;
    let bestD = r * r;
    for (const l of self.ladders) {
      const d = (l.x - wx) ** 2 + (l.z - wz) ** 2;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  };
}

/** Record a two-way deck/water connection. */
function addLink(level, ax, ay, bx, by, kind) {
  level.links.set(`${ax},${ay}|${bx},${by}`, kind);
  level.links.set(`${bx},${by}|${ax},${ay}`, kind);
}

/**
 * A ladder hangs on the pool wall at the boundary between a deck cell and the
 * water cell beside it, its stiles standing proud of the tile and its top rail
 * curling over onto the deck — which is what makes it findable from in the
 * water, where you are at eye level with the wall and cannot see over it.
 */
function placeLadder(level, deck, water, d) {
  const c = level.centre(deck.x, deck.y);
  const dir = DIRS[d];
  addLink(level, deck.x, deck.y, water.x, water.y, LINK_LADDER);
  level.ladders.push({
    // The mouth of the ladder: the midpoint of the shared cell boundary.
    x: c.x + dir.dx * (CELL / 2),
    z: c.z + dir.dy * (CELL / 2),
    dir: d,
    deck: { x: deck.x, y: deck.y },
    water: { x: water.x, y: water.y },
  });
}

function placeStairs(level, deck, water, d) {
  addLink(level, deck.x, deck.y, water.x, water.y, LINK_STAIRS);
  // The ramp lives in the WATER cell and rises toward the deck cell, so
  // stairDir points back the way it came.
  level.stairDir[water.y][water.x] = (d + 2) % 4;
  level.stairs.push({ deck: { x: deck.x, y: deck.y }, water: { x: water.x, y: water.y }, dir: d });
}

/**
 * Generate the Poolrooms.
 *
 * @param {object} [opts]
 * @param {string|number} [opts.seed]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @returns {import('./backrooms-maze.js').Level} with pool terrain attached
 */
export function generatePools(opts = {}) {
  const seed = opts.seed ?? 'pools';
  const width = Math.max(8, Math.min(64, Math.floor(opts.width ?? 26)));
  const height = Math.max(8, Math.min(64, Math.floor(opts.height ?? 26)));

  // The Poolrooms are open and interconnected rather than corridor-like, so
  // the plan is braided almost to exhaustion and carved with far more halls
  // than Level 0 gets. What is left of the maze is the sense that every room
  // leads to three more.
  const level = generate({
    seed: `${seed}:pools`,
    width,
    height,
    braidChance: 0.93,
    rooms: Math.max(5, Math.round((width * height) / 46)),
  });
  level.seed = String(seed);
  level.theme = 'pools';

  const rnd = mulberry32(hashSeed(`${seed}:terrain`));

  level.terrain = grid8(width, height, DECK);
  level.stairDir = grid8(width, height, 255);
  level.dark = grid8(width, height, 0);
  level.lit = grid8(width, height, 0);
  level.links = new Map();
  level.ladders = [];
  level.stairs = [];
  // Attached before generation finishes, not after: the repair pass below asks
  // the level to path through itself with climbFilter on.
  attachQueries(level);

  // ---- flood the place ---------------------------------------------------
  // Roughly half the floor ends up under water: enough that crossing the level
  // is mostly swimming and wading, not enough that the deck stops being the
  // thing you are trying to get back to.
  const taken = new Set();
  const target = Math.round(width * height * 0.52);
  let flooded = 0;
  let guard = 0;
  while (flooded < target && guard < 400) {
    guard += 1;
    const sx = Math.floor(rnd() * width);
    const sy = Math.floor(rnd() * height);
    if (taken.has(`${sx},${sy}`)) continue;
    const blob = growBlob(level, sx, sy, 6 + Math.floor(rnd() * 26), rnd, taken);
    for (const c of blob) {
      level.terrain[c.y][c.x] = SHALLOW;
      flooded += 1;
    }
  }

  // Spawn and exit are dry: you start on the tile, and the way out is not a
  // hole you have to guess is under the water.
  const dry = (cx, cy) => {
    if (!level.inBounds(cx, cy)) return;
    level.terrain[cy][cx] = DECK;
  };
  dry(level.spawn.x, level.spawn.y);
  for (const n of level.neighbours(level.spawn.x, level.spawn.y)) dry(n.x, n.y);
  dry(level.exit.x, level.exit.y);

  // ---- sink the middles into pits ---------------------------------------
  // A cell goes deep only if all four of its GRID neighbours are also flooded,
  // which puts every pit in the middle of an open flooded hall with a wadeable
  // shelf all round it — you always get a stride of warning before the floor
  // stops being there.
  const isFlooded = (cx, cy) => level.inBounds(cx, cy) && level.terrain[cy][cx] !== DECK;
  const deepMask = grid8(width, height, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (level.terrain[y][x] !== SHALLOW) continue;
      let interior = true;
      for (let d = 0; d < 4 && interior; d += 1) {
        if (!isFlooded(x + DIRS[d].dx, y + DIRS[d].dy)) interior = false;
      }
      // Not every candidate: a level where every pool centre is a pit reads as
      // a rule, and the ones that stay shallow are what make the pits count.
      if (interior && hash2(x, y, 611) < 0.72) deepMask[y][x] = 1;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (deepMask[y][x]) level.terrain[y][x] = DEEP;
  }

  // ---- ladders and steps -------------------------------------------------
  // Every deck/water boundary is a candidate. Most get nothing (the Level 37
  // write-up is explicit that the place has no ledges where you would want
  // one), a few get a ladder, and fewer still get a flight of steps.
  const boundaries = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (level.terrain[y][x] !== DECK) continue;
      for (let d = 0; d < 4; d += 1) {
        const nx = x + DIRS[d].dx;
        const ny = y + DIRS[d].dy;
        if (!level.inBounds(nx, ny)) continue;
        if (level.wallAt(x, y, d)) continue;
        if (level.terrain[ny][nx] === DECK) continue;
        boundaries.push({
          deck: { x, y }, water: { x: nx, y: ny }, d, shallow: level.terrain[ny][nx] === SHALLOW,
        });
      }
    }
  }
  for (const b of boundaries) {
    const roll = hash2(b.deck.x * 31 + b.d, b.deck.y, 733);
    // Steps only ever descend into shallow water, and only one cell may hold a
    // ramp — two ramps in one cell is two ground heights in one place.
    if (b.shallow && roll < 0.1 && level.stairDir[b.water.y][b.water.x] === 255) {
      placeStairs(level, b.deck, b.water, b.d);
    } else if (roll < 0.34) {
      placeLadder(level, b.deck, b.water, b.d);
    }
  }

  // ---- guarantee you can finish -----------------------------------------
  // The maze module already proved the exit is reachable when a wall is the
  // only obstacle. Under the climb rule it may not be, so re-verify and repair
  // rather than trusting: walk out from spawn with the filter on and, whenever
  // the exit is cut off, hang a ladder on the first boundary between what is
  // reachable and what is not. Each repair strictly grows the reachable set,
  // so this terminates.
  const exitIndex = level.cellIndex(level.exit.x, level.exit.y);
  let repairs = 0;
  for (;;) {
    const field = level.distanceField([level.spawn], level.climbFilter);
    if (field[exitIndex] >= 0) {
      level.solveSteps = field[exitIndex];
      break;
    }
    let fixed = false;
    for (let y = 0; y < height && !fixed; y += 1) {
      for (let x = 0; x < width && !fixed; x += 1) {
        if (field[level.cellIndex(x, y)] < 0) continue;
        for (let d = 0; d < 4; d += 1) {
          const nx = x + DIRS[d].dx;
          const ny = y + DIRS[d].dy;
          if (!level.inBounds(nx, ny) || level.wallAt(x, y, d)) continue;
          if (field[level.cellIndex(nx, ny)] >= 0) continue;
          // A frontier edge the filter rejected can only be a deck/water pair
          // with no link on it, because same-terrain edges always pass.
          const deck = level.terrain[y][x] === DECK ? { x, y } : { x: nx, y: ny };
          const water = level.terrain[y][x] === DECK ? { x: nx, y: ny } : { x, y };
          const dd = level.terrain[y][x] === DECK ? d : (d + 2) % 4;
          placeLadder(level, deck, water, dd);
          fixed = true;
          break;
        }
      }
    }
    repairs += 1;
    if (!fixed || repairs > width * height) {
      throw new Error(`unreachable Poolrooms exit for seed "${seed}"`);
    }
  }
  level.repairedLadders = repairs;

  // ---- light, and the absence of it -------------------------------------
  // Lighting in Level 37 is described as irregular, and the dark stretches are
  // where the Smilers live — so darkness here is generated as deliberate
  // regions rather than as cells that happened to miss a fixture.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      level.lit[y][x] = hash2(x, y, 411) < 0.42 ? 1 : 0;
    }
  }
  const darkTaken = new Set();
  const darkBlobs = Math.max(1, Math.round((width * height) / 190));
  for (let i = 0; i < darkBlobs; i += 1) {
    const sx = Math.floor(rnd() * width);
    const sy = Math.floor(rnd() * height);
    // Never black out the room you wake up in.
    if (Math.abs(sx - level.spawn.x) + Math.abs(sy - level.spawn.y) < 5) continue;
    const blob = growBlob(level, sx, sy, 4 + Math.floor(rnd() * 7), rnd, darkTaken);
    for (const c of blob) {
      level.dark[c.y][c.x] = 1;
      level.lit[c.y][c.x] = 0;
    }
  }
  // A lit cell is only lit if something is actually over it, and pillars in
  // Level 0 sit on grid corners — reuse that, since the Poolrooms are famous
  // for having far more pillars than the space needs.
  level.darkCells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (level.dark[y][x]) level.darkCells.push({ x, y });
  }

  return level;
}

/**
 * Handy for the debug map and the entity spawner: every cell of a given
 * terrain, as a flat list.
 */
export function cellsOfTerrain(level, kind) {
  const out = [];
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) if (level.terrain[y][x] === kind) out.push({ x, y });
  }
  return out;
}
