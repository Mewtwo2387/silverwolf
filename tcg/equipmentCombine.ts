import type { CharacterInBattle } from './characterInBattle';
import type { Equipment } from './item';

/** Default copies consumed when combining equipment tiers. */
export const DEFAULT_EQUIPMENT_COMBINE_COUNT = 3;

/**
 * When {@link Equipment.combinesWhenEquipped} is set, equipping enough copies of the
 * source item replaces them with a single `into` equipment.
 */
export interface EquipmentCombineConfig {
  /** Equipment granted after the combine succeeds. */
  into: Equipment;
  /** Copies required (default {@link DEFAULT_EQUIPMENT_COMBINE_COUNT}). */
  requiredCount?: number;
  /**
   * Item id to count and remove. Defaults to the equipping item's id when run from
   * {@link runEquipmentCombineIfReady}.
   */
  fromItemId?: string;
}

export interface EquipmentCombineRule extends EquipmentCombineConfig {
  fromItemId: string;
}

/**
 * If `target` holds at least `requiredCount` copies of `fromItemId`, remove them all
 * and equip one `into`. Logs success or failure on the battle.
 * @returns true when a combine occurred.
 */
export function tryCombineEquipment(target: CharacterInBattle, rule: EquipmentCombineRule): boolean {
  const required = rule.requiredCount ?? DEFAULT_EQUIPMENT_COMBINE_COUNT;
  const held = target.equipments.filter((e) => e.id === rule.fromItemId).length;
  if (held < required) return false;

  const fromName = target.equipments.find((e) => e.id === rule.fromItemId)?.name ?? rule.fromItemId;
  const removed = target.removeEquipmentsById(rule.fromItemId);
  if (!target.equip(rule.into)) {
    target.battle.logEvent(`${target.character.name} could not combine into [${rule.into.name}]`);
    return false;
  }
  target.battle.logEvent(
    `${target.character.name}'s ${removed}× [${fromName}] combined into [${rule.into.name}]`,
  );
  return true;
}

/** Run {@link tryCombineEquipment} using an equipment's {@link Equipment.combinesWhenEquipped} config. */
export function runEquipmentCombineIfReady(target: CharacterInBattle, source: Equipment): boolean {
  const config = source.combinesWhenEquipped;
  if (!config) return false;
  return tryCombineEquipment(target, {
    fromItemId: config.fromItemId ?? source.id,
    into: config.into,
    requiredCount: config.requiredCount,
  });
}

/** `onEquipped` hook for ad-hoc combine rules without setting {@link Equipment.combinesWhenEquipped}. */
export function combineWhenEquipped(rule: EquipmentCombineRule): (target: CharacterInBattle) => void {
  return (target) => {
    tryCombineEquipment(target, rule);
  };
}
