import { RangeType } from './rangeType';
import { Effect } from './effect';


export class RangeEffect {
  range: RangeType;
  effect: Effect;

  constructor(range: RangeType, effect: Effect) {
    this.range = range;
    this.effect = effect;
  }
}
