import { Rarity } from '../../rarity';
import { Consumable } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

/** UTILITY CONSUMABLES
 * Misc consumables.
 * No specific rules to these.
 */

export const VACUUM_CLEANER = new Consumable(
  'vacuum_cleaner',
  'Vacuum Cleaner',
  'Removes all debuffs from the target.',
  new Rarity(3),
  itemImagePanel('vacuum_cleaner'),
  itemBackgroundForRarity(3),
  (target, battle) => {
    const removed = target.cleanseDebuffs();
    if (removed > 0) {
      battle.logEvent(`${target.character.name} was cleansed of ${removed} debuff${removed === 1 ? '' : 's'}`);
    }
  },
  'You sure this thing works like this?',
);

export const BATTERY = new Consumable(
  'battery',
  'Battery',
  'Grants the target 20 energy immediately.',
  new Rarity(2),
  itemImagePanel('battery'),
  itemBackgroundForRarity(2),
  (target, battle) => {
    const before = target.energy;
    target.gainEnergy(20);
    const gained = target.energy - before;
    battle.logEvent(`${target.character.name} gained ${gained} energy`);
  },
  'nom nom nom',
);

/* ------------------------------------------------------------ */

export const utilityItems: Item[] = [
  VACUUM_CLEANER,
  BATTERY,
];
