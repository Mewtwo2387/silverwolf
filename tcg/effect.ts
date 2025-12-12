import { EffectType } from './effectType';

/**
 * An effect acting on a character in battle
 * @param name - The name of the effect
 * @param description - The description of the effect
 * @param type - The thing this effect modifies
 * @param amount - The amplitude it modifies
 * @param duration - The number of turns remaining until the effect wears off
 */
export class Effect {
  name: string;
  description: string;
  type: EffectType;
  amount: number;
  duration: number;

  constructor(name: string, description: string, type: EffectType, amount: number, duration: number) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.amount = amount;
    this.duration = duration;
  }
}
