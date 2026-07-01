/**
 * Identity helpers for roleplay characters: id allocation, name validation, and
 * the `@mention` grammar that routes channel messages to spawned characters.
 *
 * A character is identified by a 6-char lowercase-alphanumeric `char_id` plus its
 * `name`. Because names are restricted to `[A-Za-z0-9_]` (no `-`), the dash is a
 * safe separator for the disambiguated form `@name-idprefix`.
 */

export const MAX_SPAWNS_PER_CHANNEL = 5;
export const MAX_CHARS_PER_USER = 25;
export const CHAR_ID_LENGTH = 6;
export const NAME_MAX_LENGTH = 32;
/** Token budget for `details` (the system prompt); enforced via the char/4 estimator. */
export const DETAILS_MAX_TOKENS = 4000;
/** Discord caps a string option at 6000 chars — the large path is the .json upload. */
export const DETAILS_OPTION_MAX_LENGTH = 6000;
export const STARTING_MESSAGE_MAX_LENGTH = 6000;
/** Hard cap on an uploaded character .json before we even parse it. */
export const MAX_CHAR_JSON_BYTES = 128 * 1024;

/** Substituted with the spawner's name in self-mode; left literal in all-mode. */
export const USER_VAR = '{user}';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const NAME_RE = /^[A-Za-z0-9_]{1,32}$/;
// Discord rejects these substrings/values in webhook usernames.
const RESERVED_NAME_SUBSTRINGS = ['discord', 'clyde'];
const RESERVED_NAMES = ['everyone', 'here'];

/** Generates a random 6-char lowercase-alphanumeric character id. */
export function generateCharId(): string {
  let out = '';
  for (let i = 0; i < CHAR_ID_LENGTH; i += 1) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}

/** Returns a user-facing error string if the name is invalid, else null. */
export function validateCharName(name: string): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Name is required.';
  if (!NAME_RE.test(trimmed)) {
    return 'Name must be 1–32 characters, letters/numbers/underscores only (no spaces or dashes).';
  }
  const lower = trimmed.toLowerCase();
  if (RESERVED_NAMES.includes(lower)) return `"${trimmed}" is a reserved name.`;
  if (RESERVED_NAME_SUBSTRINGS.some((s) => lower.includes(s))) {
    return 'Name can\'t contain "discord" or "clyde" (Discord blocks those in webhooks).';
  }
  return null;
}

/** `@aventurine-a2e4se` — the always-unique disambiguated handle for a character. */
export function formatCharHandle(name: string, charId: string): string {
  return `@${name}-${charId}`;
}

/**
 * Substitutes the `{user}` variable. In self-mode `userName` is the spawner's name;
 * in all-mode `userName` is null and the token is left literal (there's no single user).
 */
export function applyUserVar(text: string, userName: string | null): string {
  if (!userName || !text.includes(USER_VAR)) return text;
  return text.split(USER_VAR).join(userName);
}

export interface SpawnLike {
  spawnId: number;
  charId: string;
  nameLower: string;
}

export interface MentionMatchResult {
  /** Distinct spawns the message unambiguously addresses. */
  matched: SpawnLike[];
  /** Tokens that matched more than one spawn, with the candidates to disambiguate. */
  ambiguous: { token: string; candidates: SpawnLike[] }[];
}

// `@` + (name|id) optionally followed by `-idprefix`. Names exclude `-`, so the
// dash unambiguously starts the id part. Leading char must not be part of a word
// (so emails like name@host don't trigger). The id prefix accepts either case and
// is lowercased before matching, so `@Aventurine-A2E` disambiguates too.
const MENTION_RE = /(?:^|[^\w])@([A-Za-z0-9_]+)(?:-([A-Za-z0-9]+))?/g;

/**
 * Routes a message to spawned characters by parsing its `@mentions`. A bare token
 * matches by name-prefix OR id-prefix; `name-idprefix` requires both. A token that
 * resolves to exactly one spawn is "matched"; >1 is "ambiguous"; 0 is ignored.
 */
export function matchMentions(content: string, spawns: SpawnLike[]): MentionMatchResult {
  const matchedById = new Map<number, SpawnLike>();
  const ambiguous: { token: string; candidates: SpawnLike[] }[] = [];
  const seenAmbiguousTokens = new Set<string>();

  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = MENTION_RE.exec(content)) !== null) {
    const main = m[1].toLowerCase();
    const idPart = m[2]?.toLowerCase();
    const token = idPart ? `${main}-${idPart}` : main;

    let candidates: SpawnLike[];
    if (idPart) {
      candidates = spawns.filter((s) => s.nameLower.startsWith(main) && s.charId.startsWith(idPart));
    } else {
      candidates = spawns.filter((s) => s.nameLower.startsWith(main) || s.charId.startsWith(main));
    }

    // Dedup candidates by char (a name and id prefix could hit the same spawn twice).
    const uniq = new Map<string, SpawnLike>();
    candidates.forEach((c) => uniq.set(c.charId, c));
    const list = [...uniq.values()];

    if (list.length === 1) {
      matchedById.set(list[0].spawnId, list[0]);
    } else if (list.length > 1 && !seenAmbiguousTokens.has(token)) {
      seenAmbiguousTokens.add(token);
      ambiguous.push({ token, candidates: list });
    }
  }

  return { matched: [...matchedById.values()], ambiguous };
}
