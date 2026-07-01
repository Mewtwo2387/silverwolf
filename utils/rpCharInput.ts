import { countTokensOpenRouter } from './tokenizer';
import {
  validateCharName, DETAILS_MAX_TOKENS, STARTING_MESSAGE_MAX_LENGTH, MAX_CHAR_JSON_BYTES,
} from './rpIdentity';
import { logError } from './log';

/**
 * Parsing + validation for the two ways to define a character: individual command
 * options, or an uploaded `.json` (which allows a much larger `details` than a 6000-char
 * Discord option). The JSON path is an attack surface, so we cap the size, parse in a
 * try/catch, and pull ONLY the three known string fields — the parsed object is never
 * spread or trusted structurally.
 */

export interface CharacterFields {
  name: string;
  details: string;
  startingMessage: string;
}

export const CHARACTER_JSON_TEMPLATE = `{
  "name": "aventurine",
  "details": "Personality, background and speaking style — this is the system prompt. Use {user} to address whoever is talking (self-mode spawns only).",
  "starting_message": "The line the character opens with when spawned. {user} works here too (self-mode)."
}`;

/** Fenced template block appended to feedback so creators can see the expected shape. */
export const JSON_HELP = `\`\`\`json\n${CHARACTER_JSON_TEMPLATE}\n\`\`\``;

export function validateName(name: string): string | null {
  return validateCharName(name);
}

export function validateDetails(details: string): string | null {
  if (!details || !details.trim()) return 'Details are required.';
  const tokens = countTokensOpenRouter(details);
  if (tokens > DETAILS_MAX_TOKENS) {
    return `Details are too long (~${tokens} tokens; the max is ${DETAILS_MAX_TOKENS}). Trim it down.`;
  }
  return null;
}

export function validateStartingMessage(sm: string): string | null {
  if (!sm || !sm.trim()) return 'Starting message is required.';
  if (sm.length > STARTING_MESSAGE_MAX_LENGTH) {
    return `Starting message is too long (max ${STARTING_MESSAGE_MAX_LENGTH} characters).`;
  }
  return null;
}

/** Validates a complete field set (used by the JSON path). Returns the first error or null. */
export function validateCharacterFields(fields: CharacterFields): string | null {
  return validateName(fields.name)
    || validateDetails(fields.details)
    || validateStartingMessage(fields.startingMessage);
}

type LoadResult = { ok: true; fields: CharacterFields } | { ok: false; error: string };

/**
 * Downloads and validates a character `.json` attachment. Enforces the byte cap up
 * front, tolerates missing fields with actionable feedback, and never trusts the
 * parsed object beyond three explicitly-read string properties.
 */
export async function loadCharacterJson(attachment: {
  url: string; size?: number;
}): Promise<LoadResult> {
  if (typeof attachment.size === 'number' && attachment.size > MAX_CHAR_JSON_BYTES) {
    return { ok: false, error: `That .json is too large (max ${MAX_CHAR_JSON_BYTES / 1024} KB).` };
  }

  let text: string;
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) return { ok: false, error: 'Could not download the .json file. Try re-uploading.' };
    text = await res.text();
  } catch (err) {
    logError('Rp: failed to download character json:', err);
    return { ok: false, error: 'Could not download the .json file. Try re-uploading.' };
  }
  if (text.length > MAX_CHAR_JSON_BYTES) {
    return { ok: false, error: `That .json is too large (max ${MAX_CHAR_JSON_BYTES / 1024} KB).` };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: `That file isn't valid JSON. Expected shape:\n${JSON_HELP}` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: `The .json must be a single object. Expected shape:\n${JSON_HELP}` };
  }

  // Read only the fields we know; ignore everything else.
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const details = typeof parsed.details === 'string' ? parsed.details : '';
  const startingMessage = typeof parsed.starting_message === 'string' ? parsed.starting_message : '';

  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!details.trim()) missing.push('details');
  if (!startingMessage.trim()) missing.push('starting_message');
  if (missing.length > 0) {
    return { ok: false, error: `Your .json is missing: **${missing.join(', ')}**. Expected shape:\n${JSON_HELP}` };
  }

  const fields: CharacterFields = { name, details, startingMessage };
  const fieldErr = validateCharacterFields(fields);
  if (fieldErr) return { ok: false, error: fieldErr };
  return { ok: true, fields };
}
