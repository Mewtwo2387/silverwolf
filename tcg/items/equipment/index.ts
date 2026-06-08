import type { Item } from '../../item';
import { elementalDamageItems } from './elementalDamage';
import { outgoingDamageItems } from './outgoingDamage';
import { incomingReductionItems } from './incomingReduction';
import { elementOverrideItems } from './elementOverride';
import { signatureEquipmentItems } from './signatureEquipment';

export * from './elementalDamage';
export * from './outgoingDamage';
export * from './incomingReduction';
export * from './elementOverride';
export * from './signatureEquipment';

/** All equipment items. */
export const equipmentItems: Item[] = [
  ...elementalDamageItems,
  ...outgoingDamageItems,
  ...incomingReductionItems,
  ...elementOverrideItems,
  ...signatureEquipmentItems,
];
