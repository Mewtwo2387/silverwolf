import { countTokensOpenRouter } from './tokenizer';
import { MAX_CHAR_JSON_BYTES } from './rpIdentity';
import { logError } from './log';

/**
 * Roleplay lorebooks (issue #196) + user personas (issue #197).
 *
 * Two lorebook types, both attached to a character (≤5 per character, creator-only
 * editing) and both injected ephemerally — per generation, never persisted to
 * RpHistory, so nothing leaks into compaction memory:
 *
 * - `keywords`: a .json array of `{ triggers, context }` entries. Triggers are plain
 *   words/phrases (NO regex — deliberate, user regex is a ReDoS vector) matched
 *   case-insensitively on word boundaries against the un-replied human turns; a
 *   matched entry's context rides along in the system prompt for that reply only.
 * - `skill`: a .md reference note the model recalls on demand. The skill index
 *   (name + "use when" description) is always in the system prompt; the model asks
 *   for the content by starting its reply with `<recall:name>`, we regenerate once
 *   with the note injected. No function-calling dependency.
 *
 * Budgets: 200 tokens per keyword entry's context, 1k per skill, and a 4k cap on the
 * total injected per generation (mirrors DETAILS_MAX_TOKENS — a lorebook can at most
 * double the character-authored share of the system prompt). Personas add ≤1k more.
 */

export const MAX_LOREBOOKS_PER_CHAR = 5;
export const LOREBOOK_NAME_MAX_LENGTH = 32;
export const LOREBOOK_DESCRIPTION_MAX_LENGTH = 200;
/** Token cap on a single keyword entry's `context`. */
export const KEYWORD_CONTEXT_MAX_TOKENS = 200;
export const MAX_KEYWORD_ENTRIES = 50;
export const MAX_TRIGGERS_PER_ENTRY = 20;
export const TRIGGER_MAX_LENGTH = 64;
/** Token cap on a single skill .md file. */
export const SKILL_MAX_TOKENS = 1000;
/** Cap on the combined lorebook content injected into one generation. */
export const INJECTION_MAX_TOKENS = 4000;
/** Token cap on a user persona (permanent system-prompt weight in self-mode). */
export const PERSONA_MAX_TOKENS = 1000;
/** Reuse the character-json byte cap for lorebook uploads. */
export const MAX_LOREBOOK_FILE_BYTES = MAX_CHAR_JSON_BYTES;

export type LorebookType = 'keywords' | 'skill';

export interface KeywordEntry {
  triggers: string[];
  context: string;
}

export interface LorebookLike {
  name: string;
  type: string;
  description: string;
  content: string;
}

export const KEYWORD_JSON_TEMPLATE = `[
  {
    "triggers": ["golden ratio", "casino"],
    "context": "The Golden Ratio is a casino space station where the character grew up."
  },
  {
    "triggers": ["penacony"],
    "context": "Penacony is the planet of festivities, currently hosting the Charmony festival."
  }
]`;

/** Fenced template block appended to feedback so creators can see the expected shape. */
export const KEYWORD_JSON_HELP = `\`\`\`json\n${KEYWORD_JSON_TEMPLATE}\n\`\`\``;

// Same word grammar as character names: letters/numbers/underscores, single spaces.
// No dashes/colons so the name stays clean inside the <recall:name> marker.
const LOREBOOK_NAME_RE = /^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$/;

/** Returns a user-facing error string if the lorebook name is invalid, else null. */
export function validateLorebookName(name: string): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Lorebook name is required.';
  if (trimmed.length > LOREBOOK_NAME_MAX_LENGTH || !LOREBOOK_NAME_RE.test(trimmed)) {
    return `Lorebook name must be 1–${LOREBOOK_NAME_MAX_LENGTH} characters — letters, numbers, underscores and single spaces.`;
  }
  return null;
}

type ParseKeywordsResult = { ok: true; entries: KeywordEntry[] } | { ok: false; error: string };

/**
 * Parses + validates a keyword-lorebook .json. Like the character-json path, the
 * parsed object is an attack surface: entry/trigger/context are the only fields
 * read, everything is type-checked, and every dimension is capped.
 */
export function parseKeywordLorebook(text: string): ParseKeywordsResult {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: `That file isn't valid JSON. Expected shape:\n${KEYWORD_JSON_HELP}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: `The .json must be an array of entries. Expected shape:\n${KEYWORD_JSON_HELP}` };
  }
  if (parsed.length === 0) return { ok: false, error: 'The lorebook has no entries.' };
  if (parsed.length > MAX_KEYWORD_ENTRIES) {
    return { ok: false, error: `Too many entries (${parsed.length}; the max is ${MAX_KEYWORD_ENTRIES}).` };
  }

  const entries: KeywordEntry[] = [];
  for (let i = 0; i < parsed.length; i += 1) {
    const raw = parsed[i];
    const label = `Entry ${i + 1}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, error: `${label} must be an object with "triggers" and "context".` };
    }
    if (!Array.isArray(raw.triggers) || raw.triggers.length === 0) {
      return { ok: false, error: `${label}: "triggers" must be a non-empty array of strings.` };
    }
    if (raw.triggers.length > MAX_TRIGGERS_PER_ENTRY) {
      return { ok: false, error: `${label}: too many triggers (max ${MAX_TRIGGERS_PER_ENTRY}).` };
    }
    const triggers: string[] = [];
    for (const t of raw.triggers) {
      if (typeof t !== 'string' || !t.trim()) {
        return { ok: false, error: `${label}: every trigger must be a non-empty string.` };
      }
      const trimmed = t.trim();
      if (trimmed.length > TRIGGER_MAX_LENGTH) {
        return { ok: false, error: `${label}: trigger "${trimmed.slice(0, 30)}…" is too long (max ${TRIGGER_MAX_LENGTH} chars).` };
      }
      triggers.push(trimmed);
    }
    if (typeof raw.context !== 'string' || !raw.context.trim()) {
      return { ok: false, error: `${label}: "context" must be a non-empty string.` };
    }
    const context = raw.context.trim();
    const tokens = countTokensOpenRouter(context);
    if (tokens > KEYWORD_CONTEXT_MAX_TOKENS) {
      return {
        ok: false,
        error: `${label}: context is too long (~${tokens} tokens; the max is ${KEYWORD_CONTEXT_MAX_TOKENS} per entry).`,
      };
    }
    entries.push({ triggers, context });
  }
  return { ok: true, entries };
}

type ValidateSkillResult = { ok: true; content: string } | { ok: false; error: string };

/** Validates a skill .md's content against the token budget. */
export function validateSkillContent(text: string): ValidateSkillResult {
  const content = (text ?? '').trim();
  if (!content) return { ok: false, error: 'The skill file is empty.' };
  const tokens = countTokensOpenRouter(content);
  if (tokens > SKILL_MAX_TOKENS) {
    return { ok: false, error: `The skill is too long (~${tokens} tokens; the max is ${SKILL_MAX_TOKENS}).` };
  }
  return { ok: true, content };
}

type LoadFileResult = { ok: true; content: string } | { ok: false; error: string };

/**
 * Downloads a lorebook upload with the same hardening as the character .json path:
 * extension whitelist per type, byte cap enforced on the raw bytes (not the reported
 * size), and nothing about the payload trusted beyond being text.
 */
export async function loadLorebookFile(
  attachment: { url: string; name?: string; size?: number },
  type: LorebookType,
): Promise<LoadFileResult> {
  const expectedExt = type === 'keywords' ? '.json' : '.md';
  const filename = (attachment.name ?? '').toLowerCase();
  if (!filename.endsWith(expectedExt)) {
    return { ok: false, error: `A **${type}** lorebook must be a \`${expectedExt}\` file.` };
  }
  if (typeof attachment.size === 'number' && attachment.size > MAX_LOREBOOK_FILE_BYTES) {
    return { ok: false, error: `That file is too large (max ${MAX_LOREBOOK_FILE_BYTES / 1024} KB).` };
  }
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) return { ok: false, error: 'Could not download the file. Try re-uploading.' };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_LOREBOOK_FILE_BYTES) {
      return { ok: false, error: `That file is too large (max ${MAX_LOREBOOK_FILE_BYTES / 1024} KB).` };
    }
    return { ok: true, content: new TextDecoder().decode(bytes) };
  } catch (err) {
    logError('Rp: failed to download lorebook file:', err);
    return { ok: false, error: 'Could not download the file. Try re-uploading.' };
  }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive whole-word/phrase match (no user regex — see module docs). */
export function triggerMatches(trigger: string, text: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(trigger)}($|[^\\p{L}\\p{N}_])`, 'iu');
  return re.test(text);
}

/**
 * Collects the contexts of every keyword entry (across the character's keyword
 * lorebooks) triggered by `scanText`, in lorebook/entry order, stopping once
 * `budgetTokens` is spent. Malformed stored content is skipped, never thrown.
 */
export function collectTriggeredContexts(
  lorebooks: LorebookLike[],
  scanText: string,
  budgetTokens: number = INJECTION_MAX_TOKENS,
): string[] {
  if (!scanText.trim()) return [];
  const contexts: string[] = [];
  let spent = 0;
  for (const book of lorebooks) {
    if (book.type !== 'keywords') continue;
    let entries: KeywordEntry[];
    try {
      const parsed = JSON.parse(book.content);
      if (!Array.isArray(parsed)) continue;
      entries = parsed;
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.triggers) || typeof entry.context !== 'string') continue;
      const hit = entry.triggers.some((t) => typeof t === 'string' && t && triggerMatches(t, scanText));
      if (!hit) continue;
      const cost = countTokensOpenRouter(entry.context);
      if (spent + cost > budgetTokens) return contexts;
      contexts.push(entry.context);
      spent += cost;
    }
  }
  return contexts;
}

// The recall marker the model emits to consult a skill. Same charset as lorebook
// names (spaces allowed), matched case-insensitively.
const RECALL_MARKER_RE = /<recall:([A-Za-z0-9_ ]{1,64})>/gi;

/** Formats the marker the model must emit to consult a skill. */
export function formatRecallMarker(name: string): string {
  return `<recall:${name}>`;
}

/** Distinct skill names (lowercased) requested via `<recall:...>` markers. */
export function findRecallMarkers(text: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  RECALL_MARKER_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = RECALL_MARKER_RE.exec(text)) !== null) {
    names.add(m[1].trim().toLowerCase());
  }
  return [...names];
}

/** Strips any `<recall:...>` markers the model left in a final reply. */
export function stripRecallMarkers(text: string): string {
  return text.replace(RECALL_MARKER_RE, '').replace(/^[ \t]*\n/, '').trim();
}
