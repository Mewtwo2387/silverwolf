import type { Character } from './character';
import { CHARACTERS } from './characters';

/** Slash-command value for a character (lowercase, no spaces). */
export function rosterValueForCharacter(c: Character): string {
  return c.name.toLowerCase().replace(/\s+/g, '');
}

/** Stable slash-command values → Character (duplicate refs allowed in a team array). */
const BY_VALUE: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [rosterValueForCharacter(c), c]),
);

/** Discord slash `choices` for each team slot (max 25 options each). */
export const CHARACTER_ROSTER_DISCORD_CHOICES = CHARACTERS.map((c) => ({
  name: c.name,
  value: rosterValueForCharacter(c),
}));

export function characterFromRosterValue(value: string): Character | null {
  const v = value.trim().toLowerCase();
  return BY_VALUE[v] ?? null;
}

export function buildTeamOfThree(c1: string, c2: string, c3: string): Character[] | null {
  const a = characterFromRosterValue(c1);
  const b = characterFromRosterValue(c2);
  const c = characterFromRosterValue(c3);
  if (!a || !b || !c) return null;
  return [a, b, c];
}

export function formatTeamNames(team: Character[]): string {
  return team.map((ch) => ch.name).join(', ');
}
