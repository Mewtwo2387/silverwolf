// Single source of truth for poop-log option lists. Used by the Discord `/poop
// log` command (as slash-command choices), the web POST /games/poop/log
// validator, and the web /games/poop page (as <select> options).

export interface PoopOption { value: string; label: string }

export const POOP_COLOURS: PoopOption[] = [
  { value: 'brown', label: 'Brown' },
  { value: 'dark-brown', label: 'Dark Brown' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'black', label: 'Black' },
  { value: 'red', label: 'Red' },
  { value: 'holy', label: 'Holy' },
];

export const POOP_SIZES: PoopOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'omnipresent', label: 'Omnipresent' },
];

export const POOP_TYPES: PoopOption[] = [
  { value: 'liquid', label: 'Liquid' },
  { value: 'soft', label: 'Soft' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
  { value: 'pellet', label: 'Pellet' },
  { value: 'divine', label: 'Divine' },
];

export const POOP_DURATION_MIN = 1;
export const POOP_DURATION_MAX = 120;

const valuesOf = (opts: PoopOption[]): string[] => opts.map((o) => o.value);

export const POOP_COLOUR_VALUES = valuesOf(POOP_COLOURS);
export const POOP_SIZE_VALUES = valuesOf(POOP_SIZES);
export const POOP_TYPE_VALUES = valuesOf(POOP_TYPES);

// Build Discord slash-command `choices` arrays in the shape discord.js expects.
export const poopChoices = (
  opts: PoopOption[],
): { name: string; value: string }[] => opts.map(({ label, value }) => ({ name: label, value }));
