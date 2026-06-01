import { ImagePanel, ImagePanelMode } from './imagePanel';
import { Rarity } from './rarity';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { Element } from './element';
import { Equipment, SignatureEquipment, Consumable, Item } from './item';
import { DECK_SIZE } from './battle';
import { itemImagePath } from './assetPaths';
import { itemBackgroundForRarity } from './rarityColors';
import { round2 } from '../utils/math';
import type { CharacterInBattle } from './characterInBattle';

/** Heal `percent` of the target's max HP (0–1) plus a flat amount. */
function healPercentOfMaxPlusFlat(target: CharacterInBattle, percent: number, flat: number): void {
  target.heal(round2(target.character.hp * percent + flat));
}

function itemImagePanel(itemId: string, backgroundColor: string): ImagePanel {
  return new ImagePanel(itemImagePath(itemId), {
    mode: ImagePanelMode.Crop,
    backgroundColor,
  });
}

/** Equipment that boosts outgoing damage of a single element (stackable). */
function elementalDamageEquipment(
  id: string,
  name: string,
  element: Element,
  options: {
    rarity: Rarity;
    damageMultiplier: number;
    description?: string;
    footer?: string;
  },
): Equipment {
  const typeLabel = Element[element].toLowerCase();
  const bonusPct = Math.round((options.damageMultiplier - 1) * 100);
  return new Equipment(
    id,
    name,
    options.description ?? `The wearer deals ${bonusPct}% more ${typeLabel} damage.`,
    options.rarity,
    itemImagePanel(id, '#1a2536'),
    itemBackgroundForRarity(options.rarity),
    [
      new Effect(
        name,
        `+${bonusPct}% ${typeLabel} damage.`,
        EffectType.OutgoingDamage,
        options.damageMultiplier,
        9999,
        true,
        { appliesToElement: element },
        true,
      ),
    ],
    undefined,
    options.footer,
  );
}

const ELEMENTAL_25 = { rarity: new Rarity(3), damageMultiplier: 1.25 } as const;
const ELEMENTAL_50 = { rarity: new Rarity(5), damageMultiplier: 1.5 } as const;

// ---------------------------------------------------------------------------
// Equipment items
// ---------------------------------------------------------------------------

export const ANEMOCULUS = elementalDamageEquipment(
  'anemoculus',
  'Anemoculus',
  Element.Anemo,
  {
    ...ELEMENTAL_25,
    footer: 'Mondstadt\'s oculus. Back when you can actually find them all by exploring, and not like, this area can only be unlocked during this questline which is a continuation of another questline triggered by entering this particular cave; or like, you need this funny tree to be level 10 before you can open this door.',
  },
);
export const CRYOCULUS = elementalDamageEquipment('cryoculus', 'Cryoculus', Element.Cryo, ELEMENTAL_25);
export const DENDROCULUS = elementalDamageEquipment('dendroculus', 'Dendroculus', Element.Dendro, ELEMENTAL_25);
export const ELECTROCULUS = elementalDamageEquipment('electroculus', 'Electroculus', Element.Electro, ELEMENTAL_25);
export const GEOCULUS = elementalDamageEquipment('geoculus', 'Geoculus', Element.Geo, ELEMENTAL_25);
export const HYDROCULUS = elementalDamageEquipment('hydroculus', 'Hydroculus', Element.Hydro, ELEMENTAL_25);
export const PYROCULUS = elementalDamageEquipment('pyroculus', 'Pyroculus', Element.Pyro, ELEMENTAL_25);
export const MAID_OUTFIT = elementalDamageEquipment(
  'maid_outfit',
  'Maid Outfit',
  Element.Fairy,
  {
    ...ELEMENTAL_25,
    footer: 'uwu :3\nOnce worn by a certain someone that swears if Japan win against Germany in the 2022 World Cup.',
  },
);
export const RUSTED_SWORD = elementalDamageEquipment(
  'rusted_sword',
  'Rusted Sword',
  Element.Physical,
  {
    ...ELEMENTAL_25,
    footer: 'I don\'t know how this broken shit can increase damage but it\'s not like I know much about swordfight. At least not the straight type of swordfight.',
  },
);
export const QUANTUM_COMPRESSOR = elementalDamageEquipment(
  'quantum_compressor',
  'Quantum Compressor',
  Element.Quantum,
  {
    ...ELEMENTAL_25,
    footer: 'Anyone playing modded Minecraft knows everyone loves this slop when we see it in a tech modpack. Can\'t think of an endgame goal? Just make the player obtain 10000 of every item and squeeze them into a singularity. Instantly triples playtime.',
  },
);

// 5★ elemental damage equipment (+50% for one element)
export const ANEMO_GNOSIS = elementalDamageEquipment(
  'anemo_gnosis',
  'Anemo Gnosis',
  Element.Anemo,
  {
    ...ELEMENTAL_50,
    footer: 'Someone kicked Venti in the balls. Fortunately, his balls are so humongous that it\'s barely a tickle.',
  },
);
export const GEO_GNOSIS = elementalDamageEquipment('geo_gnosis', 'Geo Gnosis', Element.Geo, ELEMENTAL_50);
export const PYRO_GNOSIS = elementalDamageEquipment('pyro_gnosis', 'Pyro Gnosis', Element.Pyro, ELEMENTAL_50);
export const DENDRO_GNOSIS = elementalDamageEquipment('dendro_gnosis', 'Dendro Gnosis', Element.Dendro, ELEMENTAL_50);
export const ELECTRO_GNOSIS = elementalDamageEquipment('electro_gnosis', 'Electro Gnosis', Element.Electro, ELEMENTAL_50);
export const CRYO_GNOSIS = elementalDamageEquipment('cryo_gnosis', 'Cryo Gnosis', Element.Cryo, ELEMENTAL_50);
export const HYDRO_GNOSIS = elementalDamageEquipment('hydro_gnosis', 'Hydro Gnosis', Element.Hydro, ELEMENTAL_50);
export const PINK_FOR_SLUG = elementalDamageEquipment('pink_for_slug', 'Pink for Slug!', Element.Fairy, ELEMENTAL_50);
export const AK_47 = elementalDamageEquipment(
  'ak_47',
  'AK-47',
  Element.Physical,
  {
    ...ELEMENTAL_50,
    footer: 'Enemies die to a severe allergic reaction to metal',
  },
);
export const BLACK_HOLE = elementalDamageEquipment(
  'black_hole',
  'Black hole',
  Element.Quantum,
  {
    ...ELEMENTAL_50,
    footer: 'massive and dark like your mom\'s hole',
  },
);

export const STRANGE_QUARK = new Equipment(
  'strange_quark',
  'Strange Quark',
  'Converts all outgoing damage from this character into quantum damage.',
  new Rarity(3),
  itemImagePanel('strange_quark', '#1a2536'),
  itemBackgroundForRarity(3),
  [
    new Effect(
      'Strange Quark',
      'Outgoing damage is converted to quantum.',
      EffectType.DamageElementOverride,
      1,
      9999,
      true,
      { overrideElement: Element.Quantum },
      true,
    ),
  ],
  undefined,
  'Something something decay into strange matter',
);

export const PLATE_ARMOR = new Equipment(
  'plate_armor',
  'Plate Armor',
  'Reduces incoming damage by 30%.',
  new Rarity(3),
  itemImagePanel('plate_armor', '#1a2536'),
  itemBackgroundForRarity(3),
  [
    new Effect(
      'Plate Armor',
      '-30% incoming damage.',
      EffectType.IncomingDamage,
      0.7,
      9999,
      true,
      undefined,
      true,
    ),
  ],
);

/** Kaitlin form skill indices (Slay Queen + Estrogen ultimate), same as her transformation skill. */
const KAITLIN_FORM_SKILL_INDICES = [1, 2];

export const ESTROGEN = new SignatureEquipment(
  'estrogen',
  'Estrogen',
  'Kaitlin',
  'Converts all outgoing damage to Fairy type and increases Fairy damage by 20%. If the holder is already Fairy, increases Fairy damage by an additional 20%. When held by Kaitlin, instantly transforms to Kaitlin form.',
  new Rarity(5),
  itemImagePanel('estrogen', '#1a2536'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Estrogen',
      'Outgoing damage is converted to fairy.',
      EffectType.DamageElementOverride,
      1,
      9999,
      true,
      { overrideElement: Element.Fairy },
      true,
    ),
    new Effect(
      'Estrogen',
      '+20% fairy damage.',
      EffectType.OutgoingDamage,
      1.2,
      9999,
      true,
      { appliesToElement: Element.Fairy },
      true,
    ),
  ],
  (target) => {
    if (target.character.element === Element.Fairy) {
      target.addEffect(
        new Effect(
          'Estrogen (Innate Fairy)',
          '+20% additional fairy damage for Fairy-type holders.',
          EffectType.OutgoingDamage,
          1.2,
          9999,
          true,
          { appliesToElement: Element.Fairy },
          true,
        ),
      );
    }
    if (target.character.name === 'Kaitlin') {
      target.addEffect(
        new Effect(
          'Kaitlin Form',
          'Converted into Kaitlin Form.',
          EffectType.FormChange,
          1,
          9999,
          true,
          { activeSkillIndices: KAITLIN_FORM_SKILL_INDICES },
        ),
      );
      target.battle.logEvent(`${target.character.name} transformed into Kaitlin Form!`);
    }
  },
  'You want this too, don\'t you? uwu :3'
);

export const SILVERWOLF_KEYCHAIN = new SignatureEquipment(
  'silverwolf_keychain',
  'Silverwolf Keychain',
  'Ei',
  'Increases quantum damage by 20%. Additionally increases quantum damage by 10% for each quantum ally on your team. When held by Ei, reduces incoming damage by 20% and grants a 20% chance to dodge attacks.',
  new Rarity(5),
  itemImagePanel('silverwolf_keychain', '#1a2536'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Silverwolf Keychain',
      '+20% quantum damage.',
      EffectType.OutgoingDamage,
      1.2,
      9999,
      true,
      { appliesToElement: Element.Quantum },
      true,
    ),
  ],
  (target) => {
    const quantumCount = target.battle.ally(target.side)
      .filter((c) => c.character.element === Element.Quantum).length;
    if (quantumCount > 0) {
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Team)',
          `+${quantumCount * 10}% quantum damage (${quantumCount} quantum ally${quantumCount === 1 ? '' : 'ies'}).`,
          EffectType.OutgoingDamage,
          1 + 0.1 * quantumCount,
          9999,
          true,
          { appliesToElement: Element.Quantum },
        ),
      );
    }
    if (target.character.name === 'Ei') {
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Ei Guard)',
          '-20% incoming damage.',
          EffectType.IncomingDamage,
          0.8,
          9999,
          true,
          undefined,
          true,
        ),
      );
      target.addEffect(
        new Effect(
          'Silverwolf Keychain (Ei Dodge)',
          '20% chance to dodge attacks.',
          EffectType.DodgeChance,
          0.2,
          9999,
          true,
          undefined,
          true,
        ),
      );
    }
  },
  'The thing that Ei brings everywhere like it protects him or some shit'
);

export const CREDIT_CARD = new SignatureEquipment(
  'credit_card',
  'Credit Card',
  'Electro',
  'Increases charged attack damage by 20%. For each skill point spent on a charged attack, that attack deals 10% more damage.',
  new Rarity(5),
  itemImagePanel('credit_card', '#1a2536'),
  itemBackgroundForRarity(5),
  [
    new Effect(
      'Credit Card',
      '+20% charged attack damage.',
      EffectType.ChargedOutgoingDamage,
      1.2,
      9999,
      true,
      undefined,
      true,
    ),
    new Effect(
      'Credit Card',
      '+10% charged attack damage per skill point spent on the attack.',
      EffectType.ChargedSkillPointScaling,
      0.1,
      9999,
      true,
      undefined,
      true,
    ),
  ],
  undefined,
  'The best card in the game',
);

// ---------------------------------------------------------------------------
// Consumable items
// ---------------------------------------------------------------------------

export const HEALING_POTION = new Consumable(
  'healing_potion',
  'Healing Potion',
  'Immediately restores 20 HP to the target.',
  new Rarity(2),
  itemImagePanel('healing_potion', '#1c2a22'),
  itemBackgroundForRarity(2),
  (target) => {
    target.heal(20);
  },
);

export const CLEANSER = new Consumable(
  'cleanser',
  'Cleanser',
  'Removes all debuffs from the target.',
  new Rarity(3),
  itemImagePanel('cleanser', '#1c2a22'),
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
  itemImagePanel('battery', '#1c2a22'),
  itemBackgroundForRarity(2),
  (target, battle) => {
    const before = target.energy;
    target.gainEnergy(20);
    const gained = target.energy - before;
    battle.logEvent(`${target.character.name} gained ${gained} energy`);
  },
);

export const MYSTIC_CHICKEN = new Consumable(
  'mystic_chicken',
  'Mystic Chicken',
  'Restores 30% of max HP plus 30 HP.',
  new Rarity(5),
  itemImagePanel('mystic_chicken', '#1c2a22'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.3, 30);
  },
);

export const XEI_PIZZA = new Consumable(
  'xei_pizza',
  'Xei Pizza',
  'Restores 50% of max HP plus 10 HP.',
  new Rarity(5),
  itemImagePanel('xei_pizza', '#1c2a22'),
  itemBackgroundForRarity(5),
  (target) => {
    healPercentOfMaxPlusFlat(target, 0.5, 10);
  },
);

export const ALL_ITEMS: Item[] = [
  ANEMOCULUS,
  CRYOCULUS,
  DENDROCULUS,
  ELECTROCULUS,
  GEOCULUS,
  HYDROCULUS,
  PYROCULUS,
  MAID_OUTFIT,
  RUSTED_SWORD,
  QUANTUM_COMPRESSOR,
  STRANGE_QUARK,
  PLATE_ARMOR,
  ANEMO_GNOSIS,
  GEO_GNOSIS,
  PYRO_GNOSIS,
  DENDRO_GNOSIS,
  ELECTRO_GNOSIS,
  CRYO_GNOSIS,
  HYDRO_GNOSIS,
  PINK_FOR_SLUG,
  AK_47,
  BLACK_HOLE,
  ESTROGEN,
  SILVERWOLF_KEYCHAIN,
  CREDIT_CARD,
  HEALING_POTION,
  CLEANSER,
  BATTERY,
  MYSTIC_CHICKEN,
  XEI_PIZZA,
];

/** Map item id → Item, for hydrating decks loaded from the database. */
export const ITEMS_BY_ID: Record<string, Item> = ALL_ITEMS.reduce<Record<string, Item>>((acc, it) => {
  acc[it.id] = it;
  return acc;
}, {});

/** Discord choice list for any command that accepts an item id (e.g. deckset). */
export const ITEM_DISCORD_CHOICES = ALL_ITEMS.map((it) => ({
  name: it.name,
  value: it.id,
}));

/** Per-card cap to keep decks varied. */
export const PER_CARD_MAX = 10;

/** Max copies in a deck with rarity ≥ 5 (includes 6★ if added later). */
export const DECK_MAX_FIVE_STAR_OR_ABOVE = 5;
/** Max copies in a deck with rarity ≥ 4 (includes all 5★+ copies). */
export const DECK_MAX_FOUR_STAR_OR_ABOVE = 15;

export type DeckComposition = Record<string, number>;

export type DeckValidationResult = { ok: true } | { ok: false; reason: string };

/** Count cards in a composition whose catalog rarity is at least `minRarity`. */
export function countDeckCardsAtLeastRarity(composition: DeckComposition, minRarity: number): number {
  let total = 0;
  Object.entries(composition).forEach(([id, count]) => {
    const item = ITEMS_BY_ID[id];
    if (!item || count <= 0) return;
    if (item.rarity.rarity >= minRarity) {
      total += count;
    }
  });
  return total;
}

/** Default deck composition: 25 cards, respects rarity caps (mostly 3★ equipment + consumables). */
export function defaultDeckComposition(): DeckComposition {
  const composition: DeckComposition = {};
  ALL_ITEMS.forEach((it) => {
    composition[it.id] = 0;
  });

  const fillerIds = ALL_ITEMS.filter((it) => it.rarity.rarity < 5).map((it) => it.id);
  let remaining = DECK_SIZE;
  let idx = 0;
  while (remaining > 0 && fillerIds.length > 0) {
    const id = fillerIds[idx % fillerIds.length];
    if (composition[id] < PER_CARD_MAX) {
      composition[id] += 1;
      remaining -= 1;
    }
    idx += 1;
    if (idx > fillerIds.length * PER_CARD_MAX) break;
  }
  return composition;
}

/**
 * Expand a {itemId: count} composition into an array of Item references. Unknown ids
 * are dropped. If the result has fewer than {@link DECK_SIZE} cards, it's left short
 * (caller can decide to pad with the default).
 */
export function expandDeckComposition(composition: DeckComposition): Item[] {
  const cards: Item[] = [];
  Object.entries(composition).forEach(([id, count]) => {
    const item = ITEMS_BY_ID[id];
    if (!item || count <= 0) return;
    for (let i = 0; i < count; i += 1) {
      cards.push(item);
    }
  });
  return cards;
}

/**
 * Build a 25-card example deck by repeating the catalog. Used for the
 * CLI demo battle where there's no associated user.
 */
export function buildExampleDeck(): Item[] {
  return expandDeckComposition(defaultDeckComposition());
}

/** Validate deck size, per-card cap, and rarity band limits (5★+ / 4★+ caps include lower bands). */
export function validateDeckComposition(composition: DeckComposition): DeckValidationResult {
  let total = 0;
  for (const [id, count] of Object.entries(composition)) {
    if (!ITEMS_BY_ID[id]) {
      return { ok: false, reason: `Unknown item id: ${id}` };
    }
    if (!Number.isInteger(count) || count < 0 || count > PER_CARD_MAX) {
      return { ok: false, reason: `Each card must be 0–${PER_CARD_MAX} copies.` };
    }
    total += count;
  }
  if (total !== DECK_SIZE) {
    return {
      ok: false,
      reason: `Deck must have exactly ${DECK_SIZE} cards (currently ${total}).`,
    };
  }
  const fivePlus = countDeckCardsAtLeastRarity(composition, 5);
  if (fivePlus > DECK_MAX_FIVE_STAR_OR_ABOVE) {
    return {
      ok: false,
      reason: `At most ${DECK_MAX_FIVE_STAR_OR_ABOVE} cards may be 5★ or higher (currently ${fivePlus}).`,
    };
  }
  const fourPlus = countDeckCardsAtLeastRarity(composition, 4);
  if (fourPlus > DECK_MAX_FOUR_STAR_OR_ABOVE) {
    return {
      ok: false,
      reason: `At most ${DECK_MAX_FOUR_STAR_OR_ABOVE} cards may be 4★ or higher (currently ${fourPlus}, includes 5★+).`,
    };
  }
  return { ok: true };
}

/** True when the composition passes {@link validateDeckComposition}. */
export function isLegalDeck(composition: DeckComposition): boolean {
  return validateDeckComposition(composition).ok;
}
