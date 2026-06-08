import type { Character } from './character';
import type { CharacterInBattle } from './characterInBattle';

/** All known character tags (internal; not shown in UI). */
export const TAGS = {
  QUANTUM_GIRL: 'quantum_girl',
  TGP: 'tgp',
  HSR: 'hsr',
  BASEMENT: 'basement',
} as const;

export type CharacterTag = typeof TAGS[keyof typeof TAGS];

export function characterHasTag(character: Character, tag: CharacterTag): boolean {
  return character.tags.includes(tag);
}

export function countTaggedAllies(allies: CharacterInBattle[], tag: CharacterTag): number {
  return allies.filter((ally) => characterHasTag(ally.character, tag)).length;
}
