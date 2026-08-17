import planeStatsQueries from '../queries/planeStatsQueries';
import { logError } from '../../utils/log';
import type Database from '../Database';

// Plane Sim achievement stats. This model is the TRUSTED writer: the browser
// only ever posts semantic gameplay events (a kill, a lesson passed, a sortie
// cleared, a stunt run) and this code decides what — if anything — that does to
// the stored counters. It never trusts a client-supplied absolute total. The
// stat SHAPE here is the contract mirrored, read-only, by
// site_src/Assets/plane-achievements.js.

export type PlaneStats = {
  kills: number;
  bullseyes: number;
  stuntBest: number;
  tutTakeoff: boolean;
  tutControls: boolean;
  tutGuns: boolean;
  tutBombs: boolean;
  firstKill: boolean;
  firstStunt: boolean;
  clearCoastalNormal: boolean;
  clearCoastalHard: boolean;
  clearOceanNormal: boolean;
  clearOceanHard: boolean;
  ironHull: boolean;
  noDamageAce: boolean;
  aceInFlight: boolean;
  outnumberedAce: boolean;
  flawlessCourse: boolean;
  flawlessCanyon: boolean;
};

const COUNTER_KEYS = ['kills', 'bullseyes', 'stuntBest'] as const;
const FLAG_KEYS = [
  'tutTakeoff', 'tutControls', 'tutGuns', 'tutBombs',
  'firstKill', 'firstStunt',
  'clearCoastalNormal', 'clearCoastalHard', 'clearOceanNormal', 'clearOceanHard',
  'ironHull', 'noDamageAce', 'aceInFlight', 'outnumberedAce',
  'flawlessCourse', 'flawlessCanyon',
] as const;

// Hard ceilings so a forged event can't push absurd counters (achievements are
// cosmetic and per-user, but we still keep the numbers sane).
const KILL_CAP = 1_000_000;
const BULLSEYE_CAP = 1_000_000;
const STUNT_SCORE_CAP = 100_000;
const MAX_EVENTS = 64;

function freshStats(): PlaneStats {
  const s: any = {};
  for (const k of COUNTER_KEYS) s[k] = 0;
  for (const k of FLAG_KEYS) s[k] = false;
  return s as PlaneStats;
}

// Coerce a persisted (or missing) blob into the exact known shape — drop unknown
// keys, clamp counters to non-negative integers, coerce flags to booleans.
function sanitize(raw: unknown): PlaneStats {
  const src = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const s = freshStats();
  for (const k of COUNTER_KEYS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) s[k] = Math.max(0, Math.floor(v));
  }
  for (const k of FLAG_KEYS) s[k] = !!src[k];
  return s;
}

const TUT_IDS: Record<string, keyof PlaneStats> = {
  takeoff: 'tutTakeoff', controls: 'tutControls', guns: 'tutGuns', bombs: 'tutBombs',
};
const isMap = (v: unknown): v is 'coastal' | 'ocean' => v === 'coastal' || v === 'ocean';
const isMode = (v: unknown) => v === 'sortie' || v === 'tutorial' || v === 'stunt';
const isDiff = (v: unknown) => v === 'easy' || v === 'normal' || v === 'hard';
const isCourse = (v: unknown) => v === 'valley' || v === 'canyon' || v === 'wavetop' || v === 'skyline';
// Reject, never clamp: clamping turns a forged out-of-range value into valid
// achievement evidence (hullPct 101 -> 100 would grant Iron Hull, bandits 99 ->
// 5 would grant Ace in a Flight). Only an in-range integer counts.
const intIn = (v: unknown, lo: number, hi: number): number | null => (
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null
);

// Apply a single validated event in place. Unknown/malformed events are ignored.
// `s` is the caller's accumulator — mutating it is the whole point.
/* eslint-disable no-param-reassign */
function applyEvent(s: PlaneStats, ev: any): void {
  if (!ev || typeof ev !== 'object') return;
  switch (ev.t) {
    case 'tutorial': {
      const key = TUT_IDS[ev.id as string];
      if (key) (s as Record<string, unknown>)[key] = true;
      break;
    }
    case 'kill': {
      if (!isMode(ev.mode) || !isDiff(ev.diff)) return;
      s.firstKill = true; // first blood counts in any mode (the gunnery lesson too)
      if (ev.mode === 'sortie' && ev.diff !== 'easy') s.kills = Math.min(KILL_CAP, s.kills + 1);
      break;
    }
    case 'sortieClear': {
      if (!isMap(ev.map) || !isDiff(ev.diff)) return;
      if (ev.diff === 'easy') return; // Rookie clears are never tracked
      const hard = ev.diff === 'hard';
      const hullPct = intIn(ev.hullPct, 0, 100);
      const bandits = intIn(ev.bandits, 1, 5);
      const tookDamage = !!ev.tookDamage;
      if (ev.map === 'coastal') s[hard ? 'clearCoastalHard' : 'clearCoastalNormal'] = true;
      else s[hard ? 'clearOceanHard' : 'clearOceanNormal'] = true;
      if (hullPct === 100) s.ironHull = true;
      if (hard && !tookDamage) s.noDamageAce = true;
      if (bandits !== null && bandits >= 5) {
        s.aceInFlight = true;
        if (hard) s.outnumberedAce = true;
      }
      break;
    }
    case 'stuntRun': {
      if (!isCourse(ev.course)) return;
      s.firstStunt = true;
      const score = intIn(ev.score, 0, STUNT_SCORE_CAP);
      if (score !== null && score > s.stuntBest) s.stuntBest = score;
      const total = intIn(ev.ringsTotal, 0, 200);
      const hit = intIn(ev.ringsHit, 0, 200);
      const bulls = intIn(ev.bullseyes, 0, 200);
      if (bulls !== null) s.bullseyes = Math.min(BULLSEYE_CAP, s.bullseyes + bulls);
      if (total !== null && total > 0 && hit !== null && hit >= total) {
        s.flawlessCourse = true;
        if (ev.course === 'canyon') s.flawlessCanyon = true;
      }
      break;
    }
    default:
      break;
  }
}
/* eslint-enable no-param-reassign */

// A PlaneStats row (or nothing) -> the full sanitized shape. Shared by the
// async read and the in-transaction one.
function rowToStats(row: any): PlaneStats {
  if (!row || typeof row.stats !== 'string') return freshStats();
  try {
    return sanitize(JSON.parse(row.stats));
  } catch (err) {
    logError('PlaneStats: corrupt stats blob, resetting:', err);
    return freshStats();
  }
}

class PlaneStatsModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  // Read the stored stats (always a full, sanitized shape; fresh if none).
  async getStats(userId: string): Promise<PlaneStats> {
    const row = await this.db.executeSelectQuery(planeStatsQueries.GET, [userId]);
    return rowToStats(row);
  }

  // Apply a batch of gameplay events and persist. Returns the new full stats.
  // The read-modify-write runs inside one transaction: two sorties landing at
  // once would otherwise both read the old blob and the later UPSERT would
  // silently drop the earlier one's medals. A failed write throws rather than
  // returning stats that were never persisted.
  async applyEvents(userId: string, events: unknown): Promise<PlaneStats> {
    const list = Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [];
    if (list.length === 0) return this.getStats(userId);
    // Ensure the User row exists before the FK insert (mirrors GameUIDModel).
    // Outside the transaction — getUser is its own read/insert pair.
    await this.db.user.getUser(userId);
    return this.db.executeTransaction((rawDb) => {
      const stats = rowToStats(rawDb.query(planeStatsQueries.GET).get(userId));
      for (const ev of list) applyEvent(stats, ev);
      rawDb.query(planeStatsQueries.UPSERT).run(userId, JSON.stringify(stats));
      return stats;
    });
  }
}

export default PlaneStatsModel;
