import { BackgroundType, TopBarType, Background } from './background';
import { ImagePanel, ImagePanelMode } from './imagePanel';
import { Rarity } from './rarity';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { Element } from './element';
import { Equipment, Consumable, Item } from './item';
import { DECK_SIZE } from './battle';
import { itemImagePath } from './assetPaths';

/**
 * Default visual treatment for items: a moody slate-to-amber gradient with a dark
 * top bar so the name stands out. We don't have per-item background art so this
 * keeps everything visually consistent.
 */
function defaultEquipmentBackground(): Background {
  return new Background(
    BackgroundType.Gradient,
    { color1: '#2a3a52', color2: '#0e1320' },
    '#3b6cf2',
    TopBarType.Fade,
    { color: '#08101e', opacity1: 0.85, opacity2: 0.5 },
  );
}

function defaultConsumableBackground(): Background {
  return new Background(
    BackgroundType.Gradient,
    { color1: '#2c4a32', color2: '#10211c' },
    '#23b378',
    TopBarType.Fade,
    { color: '#0a1815', opacity1: 0.85, opacity2: 0.5 },
  );
}

function itemImagePanel(itemId: string, backgroundColor: string): ImagePanel {
  return new ImagePanel(itemImagePath(itemId), {
    mode: ImagePanelMode.Crop,
    backgroundColor,
  });
}

/** 3★ equipment that boosts outgoing damage of a single element by 25% (stackable). */
function elementalDamageEquipment(
  id: string,
  name: string,
  element: Element,
  description?: string,
): Equipment {
  const typeLabel = Element[element].toLowerCase();
  return new Equipment(
    id,
    name,
    description ?? `The wearer deals 25% more ${typeLabel} damage.`,
    new Rarity(3),
    itemImagePanel(id, '#1a2536'),
    defaultEquipmentBackground(),
    [
      new Effect(
        name,
        `+25% ${typeLabel} damage.`,
        EffectType.OutgoingDamage,
        1.25,
        9999,
        true,
        { appliesToElement: element },
        true,
      ),
    ],
  );
}

// ---------------------------------------------------------------------------
// Equipment items
// ---------------------------------------------------------------------------

export const ANEMOCULUS = elementalDamageEquipment('anemoculus', 'Anemoculus', Element.Anemo);
export const CRYOCULUS = elementalDamageEquipment('cryoculus', 'Cryoculus', Element.Cryo);
export const DENDROCULUS = elementalDamageEquipment('dendroculus', 'Dendroculus', Element.Dendro);
export const ELECTROCULUS = elementalDamageEquipment('electroculus', 'Electroculus', Element.Electro);
export const GEOCULUS = elementalDamageEquipment('geoculus', 'Geoculus', Element.Geo);
export const HYDROCULUS = elementalDamageEquipment('hydroculus', 'Hydroculus', Element.Hydro);
export const PYROCULUS = elementalDamageEquipment('pyroculus', 'Pyroculus', Element.Pyro);
export const MAID_OUTFIT = elementalDamageEquipment('maid_outfit', 'Maid Outfit', Element.Fairy);
export const RUSTED_SWORD = elementalDamageEquipment('rusted_sword', 'Rusted Sword', Element.Physical);
export const QUANTUM_COMPRESSOR = elementalDamageEquipment(
  'quantum_compressor',
  'Quantum Compressor',
  Element.Quantum,
);

export const STRANGE_QUARK = new Equipment(
  'strange_quark',
  'Strange Quark',
  'Converts all outgoing damage from this character into quantum damage.',
  new Rarity(3),
  itemImagePanel('strange_quark', '#1a2536'),
  defaultEquipmentBackground(),
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
);

export const PLATE_ARMOR = new Equipment(
  'plate_armor',
  'Plate Armor',
  'Reduces incoming damage by 30%.',
  new Rarity(3),
  itemImagePanel('plate_armor', '#1a2536'),
  defaultEquipmentBackground(),
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

export const ESTROGEN = new Equipment(
  'estrogen',
  'Estrogen',
  'Converts all outgoing damage to Fairy type. Increases Fairy damage by 20%; if the holder is already Fairy, increases Fairy damage by an additional 20%. When held by Kaitlin, instantly transforms to Kaitlin form.',
  new Rarity(5),
  itemImagePanel('estrogen', '#1a2536'),
  defaultEquipmentBackground(),
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
  defaultConsumableBackground(),
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
  defaultConsumableBackground(),
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
  defaultConsumableBackground(),
  (target, battle) => {
    const before = target.energy;
    target.gainEnergy(20);
    const gained = target.energy - before;
    battle.logEvent(`${target.character.name} gained ${gained} energy`);
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
  ESTROGEN,
  HEALING_POTION,
  CLEANSER,
  BATTERY,
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

export type DeckComposition = Record<string, number>;

/** Default deck composition: balanced sampler across all catalog items. */
export function defaultDeckComposition(): DeckComposition {
  const each = Math.floor(DECK_SIZE / ALL_ITEMS.length);
  const remainder = DECK_SIZE - each * ALL_ITEMS.length;
  const composition: DeckComposition = {};
  ALL_ITEMS.forEach((it, idx) => {
    composition[it.id] = each + (idx < remainder ? 1 : 0);
  });
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

/** True when the composition forms a legal deck (== 25 known cards, each within cap). */
export function isLegalDeck(composition: DeckComposition): boolean {
  let total = 0;
  for (const [id, count] of Object.entries(composition)) {
    if (!ITEMS_BY_ID[id]) return false;
    if (!Number.isInteger(count) || count < 0 || count > PER_CARD_MAX) return false;
    total += count;
  }
  return total === DECK_SIZE;
}
