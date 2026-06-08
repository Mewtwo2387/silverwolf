import { BackgroundType, TopBarType, Background } from './background';
import type { Rarity } from './rarity';

/** Max star tier for item card backgrounds (no 6★ items in catalog). */
export const ITEM_RARITY_STARS_MAX = 5;

export interface ItemRarityTheme {
  gradientTop: string;
  gradientBottom: string;
  borderColor: string;
  topBarColor: string;
}

/** Item card gradient + border by star count (1★ gray … 5★ gold). */
export const ITEM_RARITY_THEME_BY_STAR: Record<number, ItemRarityTheme> = {
  1: {
    gradientTop: '#4b5563',
    gradientBottom: '#1f2937',
    borderColor: '#9ca3af',
    topBarColor: '#111827',
  },
  2: {
    gradientTop: '#15803d',
    gradientBottom: '#14532d',
    borderColor: '#4ade80',
    topBarColor: '#052e16',
  },
  3: {
    gradientTop: '#1d4ed8',
    gradientBottom: '#0f172a',
    borderColor: '#60a5fa',
    topBarColor: '#0c1929',
  },
  4: {
    gradientTop: '#6d28d9',
    gradientBottom: '#1e1033',
    borderColor: '#c084fc',
    topBarColor: '#1a0a2e',
  },
  5: {
    gradientTop: '#a16207',
    gradientBottom: '#1c1408',
    borderColor: '#fbbf24',
    topBarColor: '#1a1406',
  },
};

/** Clamp to 1–5 for item backgrounds; values above 5 use the 5★ palette. */
export function rarityStarsForTheme(rarity: number): number {
  const rounded = Math.round(rarity);
  if (rounded < 1) return 1;
  if (rounded > ITEM_RARITY_STARS_MAX) return ITEM_RARITY_STARS_MAX;
  return rounded;
}

export function itemRarityThemeForStars(rarity: number): ItemRarityTheme {
  return ITEM_RARITY_THEME_BY_STAR[rarityStarsForTheme(rarity)];
}

/** Gradient background tinted by item star tier (equipment and consumables). */
export function itemBackgroundForRarity(rarity: Rarity | number): Background {
  const stars = typeof rarity === 'number' ? rarityStarsForTheme(rarity) : rarityStarsForTheme(rarity.rarity);
  const theme = ITEM_RARITY_THEME_BY_STAR[stars];
  return new Background(
    BackgroundType.Gradient,
    { color1: theme.gradientTop, color2: theme.gradientBottom },
    theme.borderColor,
    TopBarType.Fade,
    { color: theme.topBarColor, opacity1: 0.85, opacity2: 0.5 },
  );
}
