import { EffectType } from './effectType.ts';

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
