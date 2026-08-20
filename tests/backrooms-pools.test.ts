// Backrooms Level 37 — the Poolrooms terrain generator.
//
// The maze module's invariant is "the exit is reachable". This module makes
// that invariant much harder to hold: the deck sits 1.35 m above the water, a
// player can drop into a pool anywhere but can only climb out where a ladder
// or a flight of steps was placed, and the generator scatters those sparsely on
// purpose. So the thing worth sweeping hundreds of seeds for is that the exit
// is still reachable UNDER THE CLIMB RULE — and that the repair pass which
// guarantees it actually terminates rather than throwing.
import { describe, expect, test } from 'bun:test';
// Plain ESM asset modules — types come from their JSDoc, not a .d.ts.
import {
  generatePools, cellsOfTerrain, DECK, SHALLOW, DEEP,
  DECK_Y, SHALLOW_Y, DEEP_Y, WATER_Y, STEP_UP, LINK_NONE,
} from '../site_src/Assets/backrooms-pools.js';
import { CELL } from '../site_src/Assets/backrooms-maze.js';

// generatePools() decorates a plain Level with terrain grids and query methods
// at runtime (see attachQueries there), which TypeScript cannot infer from the
// JSDoc on a class it never sees assigned to. Spelling the contract out here
// keeps the checker honest AND doubles as the documentation of what a pool
// level is over and above a maze level.
type Cell = { x: number; y: number };
type PoolLevel = ReturnType<typeof generatePools> & {
  terrain: Uint8Array[];
  stairDir: Uint8Array[];
  dark: Uint8Array[];
  lit: Uint8Array[];
  darkCells: Cell[];
  ladders: { x: number; z: number; dir: number; deck: Cell; water: Cell }[];
  stairs: { deck: Cell; water: Cell; dir: number }[];
  repairedLadders: number;
  terrainAt(x: number, y: number): number;
  isWater(x: number, y: number): boolean;
  isDark(x: number, y: number): boolean;
  groundAt(wx: number, wz: number): number;
  depthAt(wx: number, wz: number): number;
  canStepTo(fromY: number, wx: number, wz: number): boolean;
  climbFilter(x: number, y: number, nx: number, ny: number): boolean;
  linkAt(x: number, y: number, nx: number, ny: number): number;
};
const pools = (opts: { seed: string; width: number; height: number }) => (
  generatePools(opts) as PoolLevel
);

const SEEDS = Array.from({ length: 160 }, (_, i) => `pool-${i}`);

describe('poolrooms terrain generation', () => {
  test('every seed produces a level whose exit is reachable under the climb rule', () => {
    for (const seed of SEEDS) {
      const level = pools({ seed, width: 24, height: 24 });
      const field = level.distanceField([level.spawn], level.climbFilter);
      const d = field[level.cellIndex(level.exit.x, level.exit.y)];
      expect(d).toBeGreaterThanOrEqual(0);
      expect(level.solveSteps).toBe(d);
    }
  });

  test('reachability is genuinely stricter than the maze it was built from', () => {
    // If the climb rule never bit, the repair pass would be dead code and this
    // whole module would be decoration. At least some seeds must need it.
    let repaired = 0;
    for (const seed of SEEDS) {
      const level = pools({ seed, width: 30, height: 30 });
      if (level.repairedLadders > 0) repaired += 1;
    }
    expect(repaired).toBeGreaterThan(0);
  });

  test('you always start and finish on dry tile', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const level = pools({ seed, width: 26, height: 26 });
      expect(level.terrainAt(level.spawn.x, level.spawn.y)).toBe(DECK);
      expect(level.terrainAt(level.exit.x, level.exit.y)).toBe(DECK);
    }
  });

  test('there is always water, always some of it deep, and always a way out of it', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const level = pools({ seed, width: 26, height: 26 });
      expect(cellsOfTerrain(level, SHALLOW).length).toBeGreaterThan(0);
      expect(cellsOfTerrain(level, DEEP).length).toBeGreaterThan(0);
      expect(cellsOfTerrain(level, DECK).length).toBeGreaterThan(0);
      expect(level.ladders.length + level.stairs.length).toBeGreaterThan(0);
    }
  });

  test('every pit has a wadeable shelf around it — no floor that just stops', () => {
    // A DEEP cell is only ever created where all four grid neighbours are also
    // flooded, so you can never step straight off dry tile into over your head.
    for (const seed of SEEDS.slice(0, 40)) {
      const level = pools({ seed, width: 22, height: 22 });
      for (const c of cellsOfTerrain(level, DEEP)) {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (!level.inBounds(nx, ny)) continue;
          expect(level.terrainAt(nx, ny)).not.toBe(DECK);
        }
      }
    }
  });

  test('the same seed is the same level, terrain and ladders included', () => {
    const a = pools({ seed: 'repeatable', width: 24, height: 24 });
    const b = pools({ seed: 'repeatable', width: 24, height: 24 });
    expect(b.solveSteps).toBe(a.solveSteps);
    expect(b.ladders.length).toBe(a.ladders.length);
    expect(b.stairs.length).toBe(a.stairs.length);
    for (let y = 0; y < a.h; y += 1) {
      for (let x = 0; x < a.w; x += 1) {
        expect(b.terrain[y][x]).toBe(a.terrain[y][x]);
        expect(b.dark[y][x]).toBe(a.dark[y][x]);
      }
    }
  });

  test('a different seed is a different level', () => {
    const a = pools({ seed: 'alpha', width: 24, height: 24 });
    const b = pools({ seed: 'beta', width: 24, height: 24 });
    let same = 0;
    let total = 0;
    for (let y = 0; y < a.h; y += 1) {
      for (let x = 0; x < a.w; x += 1) {
        total += 1;
        if (a.terrain[y][x] === b.terrain[y][x]) same += 1;
      }
    }
    expect(same / total).toBeLessThan(0.9);
  });

  test('ground heights match the terrain, and steps ramp between them', () => {
    const level = pools({ seed: 'heights', width: 26, height: 26 });
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        if (level.stairDir[y][x] !== 255) continue; // ramps are checked below
        const c = level.centre(x, y);
        const g = level.groundAt(c.x, c.z);
        const want = [DECK_Y, SHALLOW_Y, DEEP_Y][level.terrain[y][x]];
        expect(g).toBeCloseTo(want, 6);
      }
    }
    for (const st of level.stairs) {
      // Walk the ramp from the deck edge to the far edge: it must start at deck
      // height, finish at the cell's own floor, and never rise on the way.
      const c = level.centre(st.water.x, st.water.y);
      const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][st.dir]; // deck -> water
      const from = { x: c.x - d[0] * (CELL / 2 - 0.02), z: c.z - d[1] * (CELL / 2 - 0.02) };
      const to = { x: c.x + d[0] * (CELL / 2 - 0.02), z: c.z + d[1] * (CELL / 2 - 0.02) };
      let prev = Infinity;
      for (let t = 0; t <= 1; t += 0.05) {
        const g = level.groundAt(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
        expect(g).toBeLessThanOrEqual(prev + 1e-6);
        prev = g;
      }
      expect(level.groundAt(from.x, from.z)).toBeGreaterThan(DECK_Y - 0.1);
    }
  });

  test('depth reads zero on the deck and over a metre in every pool', () => {
    const level = pools({ seed: 'depths', width: 24, height: 24 });
    for (const c of cellsOfTerrain(level, DECK)) {
      const p = level.centre(c.x, c.y);
      if (level.stairDir[c.y][c.x] !== 255) continue;
      expect(level.depthAt(p.x, p.z)).toBe(0);
    }
    for (const c of cellsOfTerrain(level, SHALLOW)) {
      if (level.stairDir[c.y][c.x] !== 255) continue;
      const p = level.centre(c.x, c.y);
      expect(level.depthAt(p.x, p.z)).toBeCloseTo(WATER_Y - SHALLOW_Y, 6);
    }
  });

  test('the pool wall is unclimbable, which is the point of the whole level', () => {
    const level = pools({ seed: 'walls', width: 26, height: 26 });
    for (const c of cellsOfTerrain(level, SHALLOW).concat(cellsOfTerrain(level, DEEP))) {
      if (level.stairDir[c.y][c.x] !== 255) continue;
      const p = level.centre(c.x, c.y);
      const feet = level.groundAt(p.x, p.z);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (!level.inBounds(nx, ny) || level.terrainAt(nx, ny) !== DECK) continue;
        const q = level.centre(nx, ny);
        expect(level.canStepTo(feet, q.x, q.z)).toBe(false);
        expect(DECK_Y - feet).toBeGreaterThan(STEP_UP);
      }
    }
  });

  test('a deck/water boundary is only passable where it was given a link', () => {
    const level = pools({ seed: 'links', width: 24, height: 24 });
    let checked = 0;
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        for (let d = 0; d < 4; d += 1) {
          const nx = x + [0, 1, 0, -1][d];
          const ny = y + [-1, 0, 1, 0][d];
          if (!level.inBounds(nx, ny) || level.wallAt(x, y, d)) continue;
          const wetA = level.terrainAt(x, y) !== DECK;
          const wetB = level.terrainAt(nx, ny) !== DECK;
          if (wetA === wetB) {
            expect(level.climbFilter(x, y, nx, ny)).toBe(true);
          } else {
            checked += 1;
            const linked = level.linkAt(x, y, nx, ny) !== LINK_NONE;
            expect(level.climbFilter(x, y, nx, ny)).toBe(linked);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('the level never blacks out the room you wake up in', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const level = pools({ seed, width: 24, height: 24 });
      expect(level.isDark(level.spawn.x, level.spawn.y)).toBe(false);
    }
  });

  test('a dark cell is never also a lit cell', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const level = pools({ seed, width: 22, height: 22 });
      for (let y = 0; y < level.h; y += 1) {
        for (let x = 0; x < level.w; x += 1) {
          if (level.dark[y][x]) expect(level.lit[y][x]).toBe(0);
        }
      }
    }
  });

  test('extreme sizes still generate and still solve', () => {
    for (const size of [8, 9, 12, 48, 64]) {
      const level = pools({ seed: `size-${size}`, width: size, height: size });
      const field = level.distanceField([level.spawn], level.climbFilter);
      expect(field[level.cellIndex(level.exit.x, level.exit.y)]).toBeGreaterThanOrEqual(0);
    }
  });
});
