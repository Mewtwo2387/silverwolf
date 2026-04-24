/**
 * How a skill is classified for turn rules (main vs ultimate).
 * Resource numbers live on {@link Skill.battleCost}: `Normal(n)`, `Charged(n)`, `Ultimate(energy)`.
 */
export enum SkillCategory {
  Normal = 'normal',
  Charged = 'charged',
  Ultimate = 'ultimate',
}
