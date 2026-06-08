import type { Character } from '../character';
import { KAITLIN } from './kaitlin';
import { VENFEI } from './venfei';
import { EI } from './ei';
import { SILVERWOLF } from './silverwolf';
import { SPARKLE } from './sparkle';
import { ELECTRO } from './electro';
import { MYSTIC } from './mystic';

/** Roster entries aggregated for the catalog. Add new character modules here only. */
const ROSTER_ENTRIES: readonly Character[] = [
  KAITLIN,
  VENFEI,
  EI,
  SILVERWOLF,
  SPARKLE,
  ELECTRO,
  MYSTIC,
];

/** All playable characters; derived from per-character modules (no per-character listing). */
export const CHARACTERS: Character[] = [...ROSTER_ENTRIES];
