import type { Item } from '../../item';
import { healingItems } from './healing';
import { utilityItems } from './utility';
import { timedBuffItems } from './timedBuffs';

export * from './healing';
export * from './utility';
export * from './timedBuffs';

/** All consumable items. */
export const consumableItems: Item[] = [
  ...healingItems,
  ...utilityItems,
  ...timedBuffItems,
];
