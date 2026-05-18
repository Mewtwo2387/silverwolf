// Single source of truth for the personas the AI Slop website surface exposes.
// Both the page (sidebar grouping + model selector) and the API (allowlist
// validation) import from here so they can't drift.
export const AI_SLOP_PERSONAS = [
  { name: 'Grok', blurb: 'Snark with web search' },
  { name: 'Jarvis', blurb: 'Tony Stark butler vibes' },
  { name: 'GPT', blurb: 'Concise + neutral' },
  { name: 'Silverwolf', blurb: 'The mascot herself' },
] as const;

export type AllowedPersona = typeof AI_SLOP_PERSONAS[number]['name'];

export const ALLOWED_PERSONAS: readonly AllowedPersona[] = AI_SLOP_PERSONAS.map((p) => p.name);

export function isAllowedPersona(name: unknown): name is AllowedPersona {
  return typeof name === 'string'
    && (ALLOWED_PERSONAS as readonly string[]).includes(name);
}
