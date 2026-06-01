export enum EffectType {
  IncomingDamage, // Increases or decreases damage received
  OutgoingDamage, // Increases or decreases damage dealt
  FormChange, // Changes the form, such as from Doge to Kaitlin
  EnergyGain, // Increases or decreases energy gain per turn
  /** Adds `amount` to the team's maximum skill point pool (per character with the effect; sum on allies). */
  SkillPointsMaxBonus,
  /** Overrides the elemental type of all outgoing damage from this character. metadata.overrideElement carries the new element. */
  DamageElementOverride,
}