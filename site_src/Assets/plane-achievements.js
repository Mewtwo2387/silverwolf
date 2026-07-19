// Plane Sim — achievement catalog + progress computation (client display).
//
// This module is DISPLAY ONLY and is bundled into plane-sim.js. It never runs
// server-side: the server (database/models/PlaneStatsModel.ts) owns the trusted
// mutation of the stat counters and is the single source of truth for the stat
// keys below. Keep the two in sync — this file reads stats, that file writes
// them.
//
// A "stat" is a raw recorded value on the player's row: an integer counter
// (kills, bullseyes, stuntBest) or a boolean objective flag (tutTakeoff,
// clearOceanHard, …). An achievement is either NUMERIC (a target on one counter,
// with Bronze/Silver/Gold/Platinum medals as rungs on the same counter) or an
// OBJECTIVE (a one-off predicate over the flags). Medals: bronze < silver < gold
// < platinum.

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
export const TIER_META = {
  bronze: { label: 'Bronze' },
  silver: { label: 'Silver' },
  gold: { label: 'Gold' },
  platinum: { label: 'Platinum' },
};

export const CATEGORIES = [
  { id: 'tutorial', label: 'Flight School' },
  { id: 'kills', label: 'Kill Count' },
  { id: 'difficulty', label: 'Difficulty Clears' },
  { id: 'stunt', label: 'Stunt Circuit' },
];

// The full stat shape, all zero/false. The server returns the same shape.
export function emptyStats() {
  return {
    // counters
    kills: 0, // qualifying sortie kills (Regular/Ace only, never tutorials)
    bullseyes: 0, // lifetime stunt-ring bullseyes
    stuntBest: 0, // best score in a single stunt run
    // Flight School lessons
    tutTakeoff: false,
    tutControls: false,
    tutGuns: false,
    tutBombs: false,
    // milestones
    firstKill: false, // first kill in ANY mode (the gunnery lesson counts)
    firstStunt: false, // completed one stunt run
    // sortie clears (Rookie is deliberately not tracked)
    clearCoastalNormal: false,
    clearCoastalHard: false,
    clearOceanNormal: false,
    clearOceanHard: false,
    // sortie feats
    ironHull: false, // won a sortie (Regular+) at 100% hull
    noDamageAce: false, // won a sortie on Ace without taking a hit
    aceInFlight: false, // downed all five bandits in one sortie (Regular+)
    outnumberedAce: false, // …and did it on Ace
    // stunt feats
    flawlessCourse: false, // flew every ring of a course
    flawlessCanyon: false, // …on The Canyon specifically
  };
}

// Objective predicates read the (possibly partial) stat blob defensively.
const b = (s, k) => !!(s && s[k]);

// The catalog. `target` => numeric achievement on stat `stat`. `objective` =>
// a predicate; unlocked is binary. Order within a category is the display order.
export const ACHIEVEMENTS = [
  // ---- Flight School (tutorials — mostly bronze) ----
  {
    id: 'first-flight', cat: 'tutorial', tier: 'bronze', name: 'First Flight',
    desc: 'Take off, climb out and clean up the gear in the takeoff lesson.',
    objective: (s) => b(s, 'tutTakeoff'),
  },
  {
    id: 'stick-rudder', cat: 'tutorial', tier: 'bronze', name: 'Stick & Rudder',
    desc: 'Bank, climb, dive and rudder through the manoeuvring lesson.',
    objective: (s) => b(s, 'tutControls'),
  },
  {
    id: 'guns-hot', cat: 'tutorial', tier: 'bronze', name: 'Guns Hot',
    desc: 'Track a bandit and finish the gunnery lesson.',
    objective: (s) => b(s, 'tutGuns'),
  },
  {
    id: 'bombs-away', cat: 'tutorial', tier: 'bronze', name: 'Bombs Away',
    desc: 'Put a bomb on the flat-top in the bombing lesson.',
    objective: (s) => b(s, 'tutBombs'),
  },
  {
    id: 'first-blood', cat: 'tutorial', tier: 'bronze', name: 'First Blood',
    desc: 'Score your very first kill — the gunnery lesson counts.',
    objective: (s) => b(s, 'firstKill'),
  },
  {
    id: 'wings', cat: 'tutorial', tier: 'silver', name: 'Wings',
    desc: 'Graduate Flight School: pass all four lessons.',
    objective: (s) => b(s, 'tutTakeoff') && b(s, 'tutControls') && b(s, 'tutGuns') && b(s, 'tutBombs'),
  },

  // ---- Kill Count (one counter, four medals; named for real aces) ----
  {
    id: 'ace', cat: 'kills', tier: 'bronze', name: 'Ace',
    desc: 'Down 5 bandits — the tally that makes you an ace.',
    stat: 'kills', target: 5,
  },
  {
    id: 'red-baron', cat: 'kills', tier: 'silver', name: 'Red Baron',
    desc: '80 confirmed kills — Manfred von Richthofen’s final score.',
    stat: 'kills', target: 80,
  },
  {
    id: 'star-of-africa', cat: 'kills', tier: 'gold', name: 'Star of Africa',
    desc: '158 kills — the tally of Hans-Joachim Marseille.',
    stat: 'kills', target: 158,
  },
  {
    id: 'black-devil', cat: 'kills', tier: 'platinum', name: 'The Black Devil',
    desc: '352 kills — Erich Hartmann’s all-time record.',
    stat: 'kills', target: 352,
  },
  {
    id: 'ace-in-a-flight', cat: 'kills', tier: 'silver', name: 'Ace in a Flight',
    desc: 'Down all five bandits in a single sortie (Regular+).',
    objective: (s) => b(s, 'aceInFlight'),
  },

  // ---- Difficulty Clears (objectives; Rookie is never counted) ----
  {
    id: 'blooded', cat: 'difficulty', tier: 'bronze', name: 'Blooded',
    desc: 'Win your first sortie on Regular or Ace.',
    objective: (s) => b(s, 'clearCoastalNormal') || b(s, 'clearCoastalHard')
      || b(s, 'clearOceanNormal') || b(s, 'clearOceanHard'),
  },
  {
    id: 'combat-ready', cat: 'difficulty', tier: 'silver', name: 'Combat Ready',
    desc: 'Clear the Coastal sortie on Regular.',
    objective: (s) => b(s, 'clearCoastalNormal') || b(s, 'clearCoastalHard'),
  },
  {
    id: 'carrier-qualified', cat: 'difficulty', tier: 'silver', name: 'Carrier Qualified',
    desc: 'Sink the enemy flat-top on Regular.',
    objective: (s) => b(s, 'clearOceanNormal') || b(s, 'clearOceanHard'),
  },
  {
    id: 'iron-hull', cat: 'difficulty', tier: 'gold', name: 'Iron Hull',
    desc: 'Win a sortie (Regular+) without losing a scratch of hull.',
    objective: (s) => b(s, 'ironHull'),
  },
  {
    id: 'top-gun', cat: 'difficulty', tier: 'gold', name: 'Top Gun',
    desc: 'Clear the Coastal sortie on Ace.',
    objective: (s) => b(s, 'clearCoastalHard'),
  },
  {
    id: 'flat-top-killer', cat: 'difficulty', tier: 'gold', name: 'Flat-Top Killer',
    desc: 'Sink the enemy flat-top on Ace.',
    objective: (s) => b(s, 'clearOceanHard'),
  },
  {
    id: 'outnumbered', cat: 'difficulty', tier: 'platinum', name: 'Outnumbered',
    desc: 'Clear a five-bandit sortie on Ace.',
    objective: (s) => b(s, 'outnumberedAce'),
  },
  {
    id: 'untouchable', cat: 'difficulty', tier: 'platinum', name: 'Untouchable',
    desc: 'Win a sortie on Ace without taking a single hit.',
    objective: (s) => b(s, 'noDamageAce'),
  },
  {
    id: 'ace-of-aces', cat: 'difficulty', tier: 'platinum', name: 'Ace of Aces',
    desc: 'Clear BOTH sorties — Coastal and Ocean — on Ace.',
    objective: (s) => b(s, 'clearCoastalHard') && b(s, 'clearOceanHard'),
  },

  // ---- Stunt Circuit (best-run score ladder + feats) ----
  {
    id: 'threading-needle', cat: 'stunt', tier: 'bronze', name: 'Threading the Needle',
    desc: 'Complete your first stunt course.',
    objective: (s) => b(s, 'firstStunt'),
  },
  {
    id: 'ring-chaser', cat: 'stunt', tier: 'bronze', name: 'Ring Chaser',
    desc: 'Score 800 in a single stunt run.',
    stat: 'stuntBest', target: 800,
  },
  {
    id: 'barnstormer', cat: 'stunt', tier: 'silver', name: 'Barnstormer',
    desc: 'Score 2,000 in a single stunt run.',
    stat: 'stuntBest', target: 2000,
  },
  {
    id: 'bullseye', cat: 'stunt', tier: 'silver', name: 'Bullseye',
    desc: 'Fly 50 ring bullseyes across your stunt runs.',
    stat: 'bullseyes', target: 50,
  },
  {
    id: 'airshow-star', cat: 'stunt', tier: 'gold', name: 'Airshow Star',
    desc: 'Score 3,500 in a single stunt run.',
    stat: 'stuntBest', target: 3500,
  },
  {
    id: 'perfect-pass', cat: 'stunt', tier: 'gold', name: 'Perfect Pass',
    desc: 'Fly a whole course hitting every ring — no misses.',
    objective: (s) => b(s, 'flawlessCourse'),
  },
  {
    id: 'red-arrow', cat: 'stunt', tier: 'platinum', name: 'Red Arrow',
    desc: 'Score 4,500 in a single run — near-perfect flying.',
    stat: 'stuntBest', target: 4500,
  },
  {
    id: 'canyon-king', cat: 'stunt', tier: 'platinum', name: 'Canyon King',
    desc: 'Fly The Canyon flawless — every ring, no misses.',
    objective: (s) => b(s, 'flawlessCanyon'),
  },
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

// Resolve one achievement against a stats blob into a render-ready record.
export function evalAchievement(a, stats) {
  if (a.objective) {
    const unlocked = !!a.objective(stats);
    return {
      ...a, objective: true, unlocked, pct: unlocked ? 1 : 0, value: unlocked ? 1 : 0, target: 1,
    };
  }
  const value = Math.max(0, Math.floor((stats && stats[a.stat]) || 0));
  const target = a.target;
  const unlocked = value >= target;
  return {
    ...a, objective: false, unlocked, value, target, pct: target > 0 ? Math.min(1, value / target) : 0,
  };
}

// Compute the whole board: per-achievement records + a summary (earned count,
// per-tier breakdown). Pure — safe to call on every stats refresh.
export function computeAchievements(stats) {
  const s = stats || emptyStats();
  const items = ACHIEVEMENTS.map((a) => evalAchievement(a, s));
  const earned = items.filter((i) => i.unlocked).length;
  const byTier = {};
  for (const t of TIERS) byTier[t] = { earned: 0, total: 0 };
  for (const i of items) {
    byTier[i.tier].total += 1;
    if (i.unlocked) byTier[i.tier].earned += 1;
  }
  return {
    items, earned, total: items.length, byTier,
  };
}

// The set of currently-unlocked ids — used to diff before/after a stats update
// so the game can toast only the achievements that just unlocked.
export function unlockedIds(stats) {
  const s = stats || emptyStats();
  const out = new Set();
  for (const a of ACHIEVEMENTS) {
    const r = evalAchievement(a, s);
    if (r.unlocked) out.add(a.id);
  }
  return out;
}
