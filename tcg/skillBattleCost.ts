/**
 * Battle resource rules for a skill (replaces a flat energy `cost` + category enum).
 *
 * - Normal(n): main action; grants n team skill points when used (energy from combat is separate).
 * - Charged(n): main action; consumes n team skill points.
 * - Ultimate(e): costs e character energy; usable any number of times per phase.
 */
export type SkillBattleCost =
  | { kind: 'normal'; skillPointsGranted: number }
  | { kind: 'charged'; skillPointsCost: number }
  | { kind: 'ultimate'; energyCost: number };

/** Normal attack; default grants 1 team skill point. */
export function Normal(skillPointsGranted = 1): SkillBattleCost {
  return { kind: 'normal', skillPointsGranted };
}

/** Charged attack; default consumes 1 team skill point. */
export function Charged(skillPointsCost = 1): SkillBattleCost {
  return { kind: 'charged', skillPointsCost };
}

/** Ultimate; spends energy from the caster. */
export function Ultimate(energyCost: number): SkillBattleCost {
  return { kind: 'ultimate', energyCost };
}
