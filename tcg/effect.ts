import { EffectType } from './effectType';
import { Element } from './element';

/**
 * An effect acting on a character in battle
 * @param name - The name of the effect
 * @param description - The description of the effect
 * @param type - The thing this effect modifies
 * @param amount - The amplitude it modifies
 * @param duration - The number of turns remaining until the effect wears off
 * @param positive - True for buffs (applied to self/allies), false for debuffs (applied to enemies).
 *   Used for log phrasing ("gained" vs "was inflicted with") and future UI cues.
 * @param metadata - Optional metadata for the effect
 */
export class Effect {
  name: string;
  description: string;
  type: EffectType;
  amount: number;
  duration: number;
  positive: boolean;
  metadata?: {
    activeSkillIndices?: number[]; // For FormChange: which skill indices should be active in this form
    appliesToElement?: Element; // For damage effects: if specified, only applies to damage of this element type
  };

  constructor(
    name: string,
    description: string,
    type: EffectType,
    amount: number,
    duration: number,
    positive: boolean,
    metadata?: { activeSkillIndices?: number[]; appliesToElement?: Element }
  ) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.amount = amount;
    this.duration = duration;
    this.positive = positive;
    this.metadata = metadata;
  }

  /**
   * Check if this effect applies to the given element
   * If appliesToElement is not specified, applies to all elements
   */
  appliesToDamageElement(damageElement: Element): boolean {
    if (!this.metadata?.appliesToElement) {
      return true; // No element restriction, applies to all
    }
    return this.metadata.appliesToElement === damageElement;
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
