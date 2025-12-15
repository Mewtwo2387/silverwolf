import { EffectType } from './effectType';

/**
 * An effect acting on a character in battle
 * @param name - The name of the effect
 * @param description - The description of the effect
 * @param type - The thing this effect modifies
 * @param amount - The amplitude it modifies
 * @param duration - The number of turns remaining until the effect wears off
 * @param metadata - Optional metadata for the effect (e.g., activeSkillIndices for FormChange effects)
 */
export class Effect {
  name: string;
  description: string;
  type: EffectType;
  amount: number;
  duration: number;
  metadata?: {
    activeSkillIndices?: number[]; // For FormChange: which skill indices should be active in this form
  };

  constructor(name: string, description: string, type: EffectType, amount: number, duration: number, metadata?: { activeSkillIndices?: number[] }) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.amount = amount;
    this.duration = duration;
    this.metadata = metadata;
  }

  toString(): string {
    const parts: string[] = [this.name];
    
    if (this.description) {
      parts.push(`- ${this.description}`);
    }
    
    if (this.duration < 999) {
      parts.push(`[${this.duration} turns left]`);
    } else {
      parts.push('[permanent]');
    }
    
    return parts.join(' ');
  }
}
