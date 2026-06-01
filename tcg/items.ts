import { BackgroundType, TopBarType, Background } from './background';
import { ImagePanel, ImagePanelMode } from './imagePanel';
import { Rarity } from './rarity';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { Element } from './element';
import { Equipment, SignatureEquipment, Consumable, Item } from './item';
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

/** Warmer gradient + gold top bar for signature equipment cards. */
export function defaultSignatureEquipmentBackground(): Background {
  return new Background(
    BackgroundType.Gradient,
    { color1: '#3d2a4a', color2: '#1a1028' },
    '#c9a227',
    TopBarType.Fade,
    { color: '#2a1838', opacity1: 0.88, opacity2: 0.55 },
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
  footer?: string,
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
    undefined,
    footer,
  );
}

// ---------------------------------------------------------------------------
// Equipment items
// ---------------------------------------------------------------------------

export const ANEMOCULUS = elementalDamageEquipment(
  'anemoculus', 
  'Anemoculus', 
  Element.Anemo,
  undefined,
  'Mondstadt\'s oculus. Back when you can actually find them all by exploring, and not like, this area can only be unlocked during this questline which is a continuation of another questline triggered by entering this particular cave; or like, you need this funny tree to be level 10 before you can open this door.'
);
export const CRYOCULUS = elementalDamageEquipment('cryoculus', 'Cryoculus', Element.Cryo);
export const DENDROCULUS = elementalDamageEquipment('dendroculus', 'Dendroculus', Element.Dendro);
export const ELECTROCULUS = elementalDamageEquipment('electroculus', 'Electroculus', Element.Electro);
export const GEOCULUS = elementalDamageEquipment('geoculus', 'Geoculus', Element.Geo);
export const HYDROCULUS = elementalDamageEquipment('hydroculus', 'Hydroculus', Element.Hydro);
export const PYROCULUS = elementalDamageEquipment('pyroculus', 'Pyroculus', Element.Pyro);
export const MAID_OUTFIT = elementalDamageEquipment(
  'maid_outfit',
  'Maid Outfit',
  Element.Fairy,
  undefined,
  'uwu :3\nOnce worn by a certain someone that swears if Japan win against Germany in the 2022 World Cup.'
);
export const RUSTED_SWORD = elementalDamageEquipment(
  'rusted_sword',
  'Rusted Sword',
  Element.Physical,
  undefined,
  'I don\'t know how this broken shit can increase damage but it\'s not like I know much about swordfight. At least not the straight type of swordfight.'
);
export const QUANTUM_COMPRESSOR = elementalDamageEquipment(
  'quantum_compressor',
  'Quantum Compressor',
  Element.Quantum,
  undefined,
  'Anyone playing modded Minecraft knows everyone loves this slop when we see it in a tech modpack. Can\'t think of an endgame goal? Just make the player obtain 10000 of every item and squeeze them into a singularity. Instantly triples playtime.',
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
  undefined,
  'Something something decay into strange matter',
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

export const ESTROGEN = new SignatureEquipment(
  'estrogen',
  'Estrogen',
  'Kaitlin',
  'Converts all outgoing damage to Fairy type and increases Fairy damage by 20%. If the holder is already Fairy, increases Fairy damage by an additional 20%. When held by Kaitlin, instantly transforms to Kaitlin form.',
  new Rarity(5),
  itemImagePanel('estrogen', '#1a2536'),
  defaultSignatureEquipmentBackground(),
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
  defaultSignatureEquipmentBackground(),
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
  defaultSignatureEquipmentBackground(),
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
  SILVERWOLF_KEYCHAIN,
  CREDIT_CARD,
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
