// Pure, side-effect-free Battleships rules used by the multiplayer room
// manager. The server is fully authoritative: it owns both fleets and never
// trusts client-supplied geometry — every placement is re-validated here and
// shot resolution happens server-side. Keep this module free of any I/O or
// room/socket state so it stays trivially testable.

export type PlayerSymbol = 'X' | 'O';

export const SIZE = 10;
export const BOARD_CELLS = SIZE * SIZE;

export interface ShipDef {
  id: string;
  name: string;
  len: number;
}

// Classic fleet. Order is the canonical display/placement order.
export const FLEET: ShipDef[] = [
  { id: 'carrier', name: 'Carrier', len: 5 },
  { id: 'battleship', name: 'Battleship', len: 4 },
  { id: 'cruiser', name: 'Cruiser', len: 3 },
  { id: 'submarine', name: 'Submarine', len: 3 },
  { id: 'destroyer', name: 'Destroyer', len: 2 },
];

export const FLEET_IDS: readonly string[] = FLEET.map((s) => s.id);
export const FLEET_BY_ID: Readonly<Record<string, ShipDef>> = FLEET.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<string, ShipDef>,
);
// 17 occupied cells across the whole fleet — the win condition is "all hit".
export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, s) => sum + s.len, 0);

export interface ShipPlacement {
  id: string;
  cells: number[];
}

export type ValidateFleetResult =
  | { ok: true; fleet: ShipPlacement[] }
  | { ok: false; reason: string };

function isCellIndex(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < BOARD_CELLS;
}

// A ship is valid iff its cells are `len` distinct in-bounds indices forming a
// single straight (horizontal or vertical) contiguous run.
export function isStraightContiguous(cells: number[], len: number): boolean {
  if (cells.length !== len) return false;
  if (!cells.every(isCellIndex)) return false;
  const unique = new Set(cells);
  if (unique.size !== len) return false;

  const sorted = [...cells].sort((a, b) => a - b);
  const rows = sorted.map((c) => Math.floor(c / SIZE));
  const cols = sorted.map((c) => c % SIZE);
  const sameRow = rows.every((r) => r === rows[0]);
  const sameCol = cols.every((c) => c === cols[0]);

  if (len === 1) return true;
  if (sameRow) {
    // Consecutive columns within the one row.
    for (let i = 0; i < len; i += 1) {
      if (sorted[i] !== sorted[0] + i) return false;
    }
    return true;
  }
  if (sameCol) {
    for (let i = 0; i < len; i += 1) {
      if (sorted[i] !== sorted[0] + i * SIZE) return false;
    }
    return true;
  }
  return false;
}

// Validate a complete, untrusted fleet placement coming off the wire. Requires
// exactly the canonical fleet (each ship id once, correct length, valid
// geometry) with no two ships overlapping. Returns a freshly-built, normalized
// fleet on success so the caller never retains references into client data.
export function validateFleet(input: unknown): ValidateFleetResult {
  if (!Array.isArray(input)) return { ok: false, reason: 'not_an_array' };
  if (input.length !== FLEET.length) return { ok: false, reason: 'wrong_ship_count' };

  const seenIds = new Set<string>();
  const occupied = new Set<number>();
  const fleet: ShipPlacement[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'bad_ship' };
    const { id, cells } = raw as { id?: unknown; cells?: unknown };
    if (typeof id !== 'string' || !FLEET_BY_ID[id]) return { ok: false, reason: 'unknown_ship' };
    if (seenIds.has(id)) return { ok: false, reason: 'duplicate_ship' };
    if (!Array.isArray(cells)) return { ok: false, reason: 'bad_cells' };

    const def = FLEET_BY_ID[id];
    // Coerce defensively: reject anything that isn't already an integer cell.
    const intCells = cells.map((c) => (typeof c === 'number' ? c : NaN));
    if (!isStraightContiguous(intCells, def.len)) return { ok: false, reason: 'bad_geometry' };

    for (const c of intCells) {
      if (occupied.has(c)) return { ok: false, reason: 'overlap' };
      occupied.add(c);
    }
    seenIds.add(id);
    fleet.push({ id, cells: [...intCells] });
  }

  if (seenIds.size !== FLEET.length) return { ok: false, reason: 'missing_ship' };
  return { ok: true, fleet };
}

// Build a valid random fleet. Used to auto-place a player who runs out the
// placement clock so the match can still proceed (server-authoritative, never
// leaks to the opponent until reveal).
export function randomFleet(rng: () => number = Math.random): ShipPlacement[] {
  const occupied = new Set<number>();
  const fleet: ShipPlacement[] = [];
  for (const def of FLEET) {
    // Bounded attempts; the classic fleet always fits well within this.
    let placed = false;
    for (let attempt = 0; attempt < 1000 && !placed; attempt += 1) {
      const horizontal = rng() < 0.5;
      const maxRow = horizontal ? SIZE : SIZE - def.len;
      const maxCol = horizontal ? SIZE - def.len : SIZE;
      const row = Math.floor(rng() * maxRow);
      const col = Math.floor(rng() * maxCol);
      const cells: number[] = [];
      for (let i = 0; i < def.len; i += 1) {
        cells.push(horizontal ? row * SIZE + col + i : (row + i) * SIZE + col);
      }
      if (cells.some((c) => occupied.has(c))) continue;
      cells.forEach((c) => occupied.add(c));
      fleet.push({ id: def.id, cells });
      placed = true;
    }
    if (!placed) {
      // Should be unreachable for the standard fleet on a 10×10 board, but never
      // hand back a partial fleet — restart the whole layout deterministically.
      return randomFleet(rng);
    }
  }
  return fleet;
}
