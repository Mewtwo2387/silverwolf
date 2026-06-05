import { Rarity } from '../../rarity';
import { Consumable } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

export const CLEANSER = new Consumable(
  'cleanser',
  'Cleanser',
  'Removes all debuffs from the target.',
  new Rarity(3),
  itemImagePanel('cleanser'),
  itemBackgroundForRarity(3),
  (target, battle) => {
    const removed = target.cleanseDebuffs();
    if (removed > 0) {
      battle.logEvent(`${target.character.name} was cleansed of ${removed} debuff${removed === 1 ? '' : 's'}`);
    }
  },
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
);

/** Consumables that cleanse or grant resources (non-HP). */
export const utilityItems: Item[] = [
  CLEANSER,
  BATTERY,
];
