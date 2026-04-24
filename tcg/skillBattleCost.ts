/**
 * Battle resource rules for a skill (replaces a flat energy `cost` + category enum).
 *
 * - Normal(n): main action; grants n team skill points when used (energy from combat is separate).
 * - Charged(n): main action; consumes n team skill points.
 * - Ultimate(e, opts?): costs e character energy; optional team SP restore, etc.
 */
export type SkillBattleCost =
  | { kind: 'normal'; skillPointsGranted: number }
  | { kind: 'charged'; skillPointsCost: number }
  | {
      kind: 'ultimate';
      energyCost: number;
      /** Restores this many points to the caster's team pool (capped by current max). */
      grantTeamSkillPoints?: number;
    };

/** Normal attack; default grants 1 team skill point. */
export function Normal(skillPointsGranted = 1): SkillBattleCost {
  return { kind: 'normal', skillPointsGranted };
}

/** Charged attack; default consumes 1 team skill point. */
export function Charged(skillPointsCost = 1): SkillBattleCost {
  return { kind: 'charged', skillPointsCost };
}

export type UltimateOptions = {
  grantTeamSkillPoints?: number;
};

/** Ultimate; spends energy from the caster. Optional team skill point restore, etc. */
export function Ultimate(energyCost: number, options?: UltimateOptions): SkillBattleCost {
  return {
    kind: 'ultimate',
    energyCost,
    ...(options?.grantTeamSkillPoints !== undefined
      ? { grantTeamSkillPoints: options.grantTeamSkillPoints }
      : {}),
  };
}
