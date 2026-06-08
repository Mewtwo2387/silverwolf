export enum EffectType {
  IncomingDamage, // Increases or decreases damage received
  OutgoingDamage, // Increases or decreases damage dealt
  FormChange, // Changes the form, such as from Doge to Kaitlin
  EnergyGain, // Increases or decreases energy gain per turn
  /** Adds `amount` to the team's maximum skill point pool (per character with the effect; sum on allies). */
  SkillPointsMaxBonus,
  /** Overrides the elemental type of all outgoing damage from this character. metadata.overrideElement carries the new element. */
  DamageElementOverride,
  /** `amount` is dodge probability from 0 to 1 (e.g. 0.2 = 20% chance to avoid damage from an attack). */
  DodgeChance,
  /**
   * Multiplier on outgoing damage for charged attacks only. Resolved in
   * {@link CharacterInBattle.calculateDamage} when skill context is passed — not a timed buff.
   */
  ChargedOutgoingDamage,
  /**
   * Per team skill point spent on the charged attack, add `amount` to the damage multiplier
   * (e.g. 0.1 → +10% per SP: 3 SP ⇒ ×1.3 for that hit only). Only applied during damage calc.
   */
  ChargedSkillPointScaling,
}
