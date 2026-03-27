import { RangeType } from './rangeType';
import { Effect } from './effect';

/**
 * An effect to be applied and its target range.
 * Used to define skills and abilities.
 * @param range - The target range of the effect
 * @param effect - The effect to be applied
 */
export class RangeEffect {
  range: RangeType;
  effect: Effect;

  constructor(range: RangeType, effect: Effect) {
    this.range = range;
    this.effect = effect;
  }
}
