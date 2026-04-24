import type { CharacterInBattle } from './characterInBattle';

/**
 * Discriminated battle lifecycle events for passive abilities and hooks.
 *
 * To extend: add a variant here, emit it from `Battle` (or another central place), and subscribe
 * via `createAbility({ ..., onBattleEvent })` on `Ability`.
 */
export type BattleEvent =
  | {
      type: 'skill_points_consumed';
      side: 'p1' | 'p2';
      /** The ally character whose action spent team skill points (e.g. charged attack). */
      consumer: CharacterInBattle;
      pointsConsumed: number;
    }
  | {
      type: 'skill_points_gained';
      side: 'p1' | 'p2';
      pointsGained: number;
      /** Optional: ally most tied to the gain (e.g. caster of a normal or ultimate). */
      sourceCharacter: CharacterInBattle | null;
      reason: 'normal_attack' | 'ultimate' | 'other';
    };

/**
 * Optional hook on {@link import('./ability').Ability} — invoked for every subscribed event
 * for each alive card that owns the ability (owner is that card).
 */
export type AbilityBattleEventHandler = (event: BattleEvent, owner: CharacterInBattle) => void;
