import type { Character } from '../character';
import { KAITLIN } from './kaitlin';
import { VENFEI } from './venfei';
import { EI } from './ei';
import { SILVERWOLF } from './silverwolf';
import { SPARKLE } from './sparkle';
import { ELECTRO } from './electro';
import { MYSTIC } from './mystic';
import { MISSING_EI } from './missingEi';

/** Roster entries aggregated for the catalog. Add new character modules here only. */
const ROSTER_ENTRIES: readonly Character[] = [
  KAITLIN,
  VENFEI,
  EI,
  SILVERWOLF,
  SPARKLE,
  ELECTRO,
  MYSTIC,
  MISSING_EI,
];

/** All playable characters; derived from per-character modules (no per-character listing). */
export const CHARACTERS: Character[] = [...ROSTER_ENTRIES];
