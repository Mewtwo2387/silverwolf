// Single source of truth for the Silver Wolf sticker set. The bare stems name
// the files in site_src/Assets/Images; each ships as a WebP (favicon + navbar
// art, served from /static/stickers/) with a PNG twin built by
// scripts/build-images.ts as a fallback for link-preview scrapers that won't
// decode WebP (see site_src/embed-meta.ts). Add a sticker here and every
// consumer — static routes, build script, layout, navbar, embed — picks it up.
export const STICKER_STEMS = [
  'Sticker_PPG_04_Silver_Wolf_01',
  'Sticker_PPG_19_Silver_Wolf_01',
  'Sticker_PPG_02_Silver_Wolf_01',
  'Sticker_PPG_04_Silver_Wolf_02',
];

export const STICKER_STEMS_LV999 = [
  'Sticker_PPG_27_Silver_Wolf_LV.999_01',
  'Sticker_PPG_27_Silver_Wolf_LV.999_02',
  'Sticker_PPG_27_Silver_Wolf_LV.999_03',
  'Sticker_PPG_27_Silver_Wolf_LV.999_04',
];

// Every sticker, both tiers — for code that serves or builds the whole set.
export const ALL_STICKER_STEMS = [...STICKER_STEMS, ...STICKER_STEMS_LV999];

export const stickerWebpUrl = (stem: string): string => `/static/stickers/${stem}.webp`;
