import type { Character } from './character';
import type { CharacterInBattle } from './characterInBattle';

/** All known character tags (internal; not shown in UI). */
export const TAGS = {
  QUANTUM_GIRL: 'quantum_girl',
  TGP: 'tgp',
  HSR: 'hsr',
  BASEMENT: 'basement',
  /** Roster / referenced characters — each must appear in that character's `tags` array. */
  KAITLIN: 'Kaitlin',
  VENFEI: 'Venfei',
  EI: 'Ei',
  SILVERWOLF: 'Silverwolf',
  SPARKLE: 'Sparkle',
  ELECTRO: 'Electro',
  MYSTIC: 'Mystic',
  MISSING_EI: 'missingEi',
  FURINA: 'Furina',
  KEQISLAW_KEQOWSKI: 'KeqislawKeqowski',
} as const;

export type CharacterTag = typeof TAGS[keyof typeof TAGS];

export function characterHasTag(character: Character, tag: CharacterTag): boolean {
  return character.tags.includes(tag);
}

export function countTaggedAllies(allies: CharacterInBattle[], tag: CharacterTag): number {
  return allies.filter((ally) => characterHasTag(ally.character, tag)).length;
}

export function allyHasTag(allies: CharacterInBattle[], tag: CharacterTag): boolean {
  return allies.some((ally) => characterHasTag(ally.character, tag));
}
