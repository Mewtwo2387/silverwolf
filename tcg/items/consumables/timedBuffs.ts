import { Rarity } from '../../rarity';
import { Effect } from '../../effect';
import { EffectType } from '../../effectType';
import { Consumable } from '../../item';
import type { Item } from '../../item';
import { itemBackgroundForRarity } from '../../rarityColors';
import { itemImagePanel } from '../shared';

export const YELLOW_PIXEL = new Consumable(
  'yellow_pixel',
  'Yellow Pixel',
  'Decreases incoming damage by 20% for the next 2 turns. Can only be used once every 5 turns.',
  new Rarity(1),
  itemImagePanel('yellow_pixel'),
  itemBackgroundForRarity(1),
  (target) => {
    target.addEffect(new Effect(
      'Yellow Pixel',
      '-20% incoming damage for 2 turns.',
      EffectType.IncomingDamage,
      0.8,
      2,
      true,
    ));
  },
  'A single yellow pixel on Lumine\'s head in the r/place \'23 canvas. Once fought over by thousands of people that sacrificed sleep to keep this yellow. There\'s also this dude named Ei that tried putting more of these to give Lumine cat ears.',
  5,
);

export const WHITE_PIXEL = new Consumable(
  'white_pixel',
  'White Pixel',
  'Increases outgoing damage by 20% for the next 2 turns. Can only be used once every 5 turns.',
  new Rarity(1),
  itemImagePanel('white_pixel'),
  itemBackgroundForRarity(1),
  (target) => {
    target.addEffect(new Effect(
      'White Pixel',
      '+20% outgoing damage for 2 turns.',
      EffectType.OutgoingDamage,
      1.2,
      2,
      true,
    ));
  },
  'A single white pixel in the TGP r/place \'23 mural that shouldn\'t be there. Placed by one of xQc\'s minions. The ultimate PTSD inducer.',
  5,
);

/** Consumables that apply timed buffs with per-target cooldowns. */
export const timedBuffItems: Item[] = [
  YELLOW_PIXEL,
  WHITE_PIXEL,
];
