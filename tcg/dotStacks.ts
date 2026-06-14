import { Effect } from './effect';
import { EffectType } from './effectType';
import { Element } from './element';
import type { CharacterInBattle } from './characterInBattle';
import { round2 } from '../utils/math';

/** Per-stack DoT damage when inflicted, using only the applier's current DoT modifiers. */
export function dotDamagePerStackAtApply(
  caster: CharacterInBattle,
  basePerStack: number,
  element: Element,
): number {
  let base = basePerStack;
  caster.effects
    .filter((effect) => effect.type === EffectType.DotStackBaseBonus)
    .filter((effect) => !effect.metadata?.appliesToElement
      || effect.metadata.appliesToElement === element)
    .forEach((effect) => {
      base += effect.amount;
    });

  let multiplier = 1;
  caster.effects
    .filter((effect) => effect.type === EffectType.DotDamageBonus)
    .forEach((effect) => {
      multiplier *= effect.amount;
    });

  return round2(Math.max(0, base * multiplier));
}

/** Inflict stackable DoT; each stack's {@link Effect.amount} is fixed at application time. */
export function applyDotStacks(
  target: CharacterInBattle,
  caster: CharacterInBattle,
  options: {
    name: string;
    element: Element;
    basePerStack: number;
    stacks: number;
    duration: number;
  },
): void {
  const perStack = dotDamagePerStackAtApply(caster, options.basePerStack, options.element);
  const typeLabel = Element[options.element].toLowerCase();
  for (let i = 0; i < options.stacks; i += 1) {
    target.addEffect(
      new Effect(
        options.name,
        `Takes ${perStack} ${typeLabel} damage per turn.`,
        EffectType.Dot,
        perStack,
        options.duration,
        false,
        { appliesToElement: options.element },
        true,
      ),
    );
  }
}
