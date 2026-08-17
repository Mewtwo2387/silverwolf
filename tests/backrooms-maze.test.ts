// Backrooms level generation — the one invariant the player can never work
// around is an unwinnable level, so sweep a lot of seeds and prove each one is
// solvable, bounded, and identical when regenerated from the same seed.
import { describe, expect, test } from 'bun:test';
// Plain ESM asset module — types come from its JSDoc, not a .d.ts.
import {
  generate, hash2, hashSeed, mulberry32, CELL,
} from '../site_src/Assets/backrooms-maze.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

describe('backrooms maze generation', () => {
  test('every seed produces a level whose exit is reachable from spawn', () => {
    for (const seed of SEEDS) {
      const level = generate({ seed, width: 24, height: 24 });
      const dist = level.distanceField([level.spawn]);
      const d = dist[level.cellIndex(level.exit.x, level.exit.y)];
      expect(d).toBeGreaterThanOrEqual(0);
      expect(level.solveSteps).toBe(d);
    }
  });

  test('every cell is reachable — braiding and rooms never orphan a region', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const level = generate({ seed, width: 20, height: 20 });
      const dist = level.distanceField([level.spawn]);
      for (let i = 0; i < dist.length; i += 1) expect(dist[i]).toBeGreaterThanOrEqual(0);
    }
  });

  test('the exit is a real trek, not next door', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const level = generate({ seed, width: 26, height: 26 });
      // 0.75 * maxDistance over a 26x26 grid is comfortably double-digit steps.
      expect(level.solveSteps).toBeGreaterThan(10);
    }
  });

  test('a path can be walked from spawn to exit one cell at a time', () => {
    const level = generate({ seed: 'walkable', width: 22, height: 22 });
    const field = level.distanceField([level.exit]);
    const path = level.pathFrom(level.spawn.x, level.spawn.y, field);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    expect(last.x).toBe(level.exit.x);
    expect(last.y).toBe(level.exit.y);
    // Consecutive steps must be orthogonal neighbours with no wall between.
    let prev = level.spawn;
    for (const step of path!) {
      const md = Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y);
      expect(md).toBe(1);
      const open = level.neighbours(prev.x, prev.y).some((n: any) => n.x === step.x && n.y === step.y);
      expect(open).toBe(true);
      prev = step;
    }
  });

  test('the outer border stays sealed apart from the exit', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const level = generate({ seed, width: 18, height: 18 });
      let holes = 0;
      for (let y = 0; y < level.h; y += 1) {
        if (!level.vWall[y][0]) holes += 1;
        if (!level.vWall[y][level.w]) holes += 1;
      }
      for (let x = 0; x < level.w; x += 1) {
        if (!level.hWall[0][x]) holes += 1;
        if (!level.hWall[level.h][x]) holes += 1;
      }
      expect(holes).toBe(1); // exactly the exit passage
    }
  });

  test('the same seed regenerates an identical level', () => {
    const a = generate({ seed: 'almond-water', width: 24, height: 24 });
    const b = generate({ seed: 'almond-water', width: 24, height: 24 });
    expect(a.vWall.map((r: Uint8Array) => [...r])).toEqual(b.vWall.map((r: Uint8Array) => [...r]));
    expect(a.hWall.map((r: Uint8Array) => [...r])).toEqual(b.hWall.map((r: Uint8Array) => [...r]));
    expect(a.spawn).toEqual(b.spawn);
    expect(a.exit).toEqual(b.exit);
  });

  test('different seeds produce different levels', () => {
    const a = generate({ seed: 'one', width: 20, height: 20 });
    const b = generate({ seed: 'two', width: 20, height: 20 });
    expect(a.hWall.map((r: Uint8Array) => [...r])).not.toEqual(b.hWall.map((r: Uint8Array) => [...r]));
  });
});

describe('line of sight', () => {
  test('sight is blocked by exactly the walls that block movement', () => {
    const level = generate({ seed: 'los', width: 20, height: 20 });
    // A cell can always see itself, and can always see through an open edge.
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        const c = level.centre(x, y);
        expect(level.lineOfSight(c.x, c.z, c.x, c.z)).toBe(true);
        for (const n of level.neighbours(x, y)) {
          const nc = level.centre(n.x, n.y);
          expect(level.lineOfSight(c.x, c.z, nc.x, nc.z)).toBe(true);
        }
        // ...and never through a solid one.
        for (let d = 0; d < 4; d += 1) {
          if (!level.wallAt(x, y, d)) continue;
          const nx = x + [0, 1, 0, -1][d];
          const ny = y + [-1, 0, 1, 0][d];
          if (!level.inBounds(nx, ny)) continue;
          const nc = level.centre(nx, ny);
          expect(level.lineOfSight(c.x, c.z, nc.x, nc.z)).toBe(false);
        }
      }
    }
  });

  test('sight out of the grid fails rather than throwing', () => {
    const level = generate({ seed: 'oob', width: 12, height: 12 });
    expect(level.lineOfSight(2, 2, -50, -50)).toBe(false);
    expect(level.lineOfSight(2, 2, 9999, 9999)).toBe(false);
  });
});

describe('wall geometry', () => {
  test('wall boxes are non-degenerate and cover every solid edge', () => {
    const level = generate({ seed: 'boxes', width: 14, height: 14 });
    const boxes = level.wallBoxes();
    let solid = 0;
    for (let y = 0; y < level.h; y += 1) for (let x = 0; x <= level.w; x += 1) solid += level.vWall[y][x];
    for (let y = 0; y <= level.h; y += 1) for (let x = 0; x < level.w; x += 1) solid += level.hWall[y][x];
    expect(boxes.length).toBe(solid);
    for (const b of boxes) {
      expect(b.maxX).toBeGreaterThan(b.minX);
      expect(b.maxZ).toBeGreaterThan(b.minZ);
      // The long axis is a cell plus the corner-sealing overhang.
      const long = b.vertical ? b.maxZ - b.minZ : b.maxX - b.minX;
      expect(long).toBeGreaterThan(CELL);
    }
  });
});

describe('deterministic noise helpers', () => {
  test('mulberry32 is stable and in range', () => {
    const a = mulberry32(hashSeed('x'));
    const b = mulberry32(hashSeed('x'));
    for (let i = 0; i < 500; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('hash2 is stable per coordinate and varies with salt', () => {
    expect(hash2(3, 7, 1)).toBe(hash2(3, 7, 1));
    expect(hash2(3, 7, 1)).not.toBe(hash2(3, 7, 2));
    expect(hash2(3, 7, 1)).not.toBe(hash2(7, 3, 1));
    for (let i = 0; i < 200; i += 1) {
      const v = hash2(i, i * 3, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
