/**
 * Canonical paths under tcg/assets/. Source art lives in each type's `images/`
 * folder; canvas outputs from card:generate scripts go in `cards/`.
 */
const ROOT = './tcg/assets';

export const tcgAssetPaths = {
  common: `${ROOT}/common`,
  types: `${ROOT}/types`,
  characters: {
    images: `${ROOT}/characters/images`,
    cards: `${ROOT}/characters/cards`,
  },
  items: {
    images: `${ROOT}/items/images`,
    cards: `${ROOT}/items/cards`,
  },
} as const;

/** Slug from a display name (matches card:generate output). */
export function characterSlugFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function characterImagePath(basename: string, ext: 'png' | 'jpg' = 'png'): string {
  return `${tcgAssetPaths.characters.images}/${basename}.${ext}`;
}

export function characterCardPath(slug: string): string {
  return `${tcgAssetPaths.characters.cards}/${slug}.png`;
}

export function itemImagePath(itemId: string, ext: 'png' | 'jpg' = 'png'): string {
  return `${tcgAssetPaths.items.images}/${itemId}.${ext}`;
}

export function itemCardPath(itemId: string): string {
  return `${tcgAssetPaths.items.cards}/${itemId}.png`;
}
