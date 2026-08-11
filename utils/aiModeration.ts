import type Database from '../database/Database';
import { getOpenRouterClient, getPersonaByName } from './ai';
import { createChatCompletionWithRetry } from './llmRetry';
import { GLOBAL_CONFIG_KEYS } from './globalConfig';
import { log, logError, logWarning } from './log';

/**
 * Content-safety screening for AI chats (`ai_moderation` in GlobalConfig).
 *
 * When enabled, every AI turn on a session-backed surface is screened by the
 * "Moderation" persona — an NVIDIA Nemotron content-safety classifier, which
 * takes no system prompt: you hand it the raw exchange and it emits plain-text
 * labels, e.g.
 *
 *   User Safety: unsafe
 *   Response Safety: safe
 *   Safety Categories: Violence, Threat
 *
 * `Response Safety` is only emitted when an assistant turn was supplied, and a
 * reasoning-mode model may wrap a `<think>` block around it all, so both are
 * treated as optional.
 *
 * Screening runs twice per turn: on the user message alone before generating
 * (so an unsafe prompt never reaches — or bills — the chat model), then on the
 * user+assistant pair before the reply is delivered.
 */

/**
 * Shown on session-backed surfaces, in the voice of the persona they were
 * talking to. The session is paused for good — hence "start a new chat".
 */
export const MODERATION_PAUSED_MESSAGE = 'safety filters have paused this chat, please start a new chat';

/**
 * Shown on one-shot surfaces (`/summary`) that have no session to pause: the
 * output is dropped and the next invocation starts clean, so telling the user
 * to "start a new chat" would be nonsense.
 */
export const MODERATION_BLOCKED_MESSAGE = 'safety filters blocked this response.';

/** Persona in data/aiPersonas.json holding the classifier's provider + model. */
const MODERATION_PERSONA = 'Moderation';

/** The classifier only needs enough text to judge; long PDFs/transcripts are cut. */
const MAX_SCREENED_CHARS = 8000;

/** Labels are a handful of lines — plus an optional reasoning trace. */
const MODERATION_MAX_TOKENS = 512;

/** Classification is on the critical path of every message; don't wait long. */
const MODERATION_TIMEOUT_MS = 30_000;

export interface ModerationVerdict {
  /** False when the exchange must not continue — the only field callers must act on. */
  safe: boolean;
  /** Which side tripped the filter (undefined when `safe`). */
  flaggedSide?: 'user' | 'response';
  /** Comma-separated categories the classifier reported, when it reported any. */
  categories?: string;
}

const SAFE_VERDICT: ModerationVerdict = { safe: true };

/** True when the `ai_moderation` global switch is on. Defaults to off. */
export async function isModerationEnabled(db: Database | undefined | null): Promise<boolean> {
  if (!db) return false;
  try {
    const value = await db.globalConfig.getGlobalConfig(GLOBAL_CONFIG_KEYS.AI_MODERATION);
    return value === '1';
  } catch (err) {
    logError('[moderation] failed to read ai_moderation config; treating as off:', err);
    return false;
  }
}

function truncate(text: string): string {
  const trimmed = (text ?? '').toString().trim();
  return trimmed.length > MAX_SCREENED_CHARS ? trimmed.slice(0, MAX_SCREENED_CHARS) : trimmed;
}

/** Strips a reasoning-mode `<think>…</think>` preamble from the classifier output. */
function stripThinking(raw: string): string {
  return raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
}

function readLabel(raw: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`^\\s*${escaped}\\s*:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : null;
}

/**
 * Parses the classifier's plain-text labels. Anything that isn't a recognisable
 * "unsafe" is treated as safe — an unparseable response is a broken classifier,
 * not a verdict, and must not silently pause every chat on the bot.
 */
export function parseModerationOutput(rawOutput: string): ModerationVerdict {
  const raw = stripThinking(rawOutput || '');
  if (!raw) return SAFE_VERDICT;

  const userSafety = readLabel(raw, 'User Safety')?.toLowerCase();
  const responseSafety = readLabel(raw, 'Response Safety')?.toLowerCase();
  const categories = readLabel(raw, 'Safety Categories') ?? undefined;

  if (userSafety?.startsWith('unsafe')) {
    return { safe: false, flaggedSide: 'user', categories };
  }
  if (responseSafety?.startsWith('unsafe')) {
    return { safe: false, flaggedSide: 'response', categories };
  }
  return SAFE_VERDICT;
}

/**
 * Screens one exchange. `assistantText` is omitted for the pre-generation pass.
 *
 * Fails open: a classifier outage, timeout, or garbled reply logs a warning and
 * returns safe. Blocking every AI conversation on the availability of a free
 * model would be a far worse failure than missing a screen.
 */
export async function moderateExchange(
  userText: string,
  assistantText?: string,
): Promise<ModerationVerdict> {
  const userContent = truncate(userText);
  const assistantContent = truncate(assistantText ?? '');
  if (!userContent && !assistantContent) return SAFE_VERDICT;

  const persona = await getPersonaByName(MODERATION_PERSONA);
  if (!persona) {
    logWarning(`[moderation] no "${MODERATION_PERSONA}" persona configured; skipping screen`);
    return SAFE_VERDICT;
  }
  if (persona.provider !== 'openrouter') {
    logWarning(`[moderation] persona provider "${persona.provider}" unsupported; skipping screen`);
    return SAFE_VERDICT;
  }
  if (!process.env.OPENROUTER_API_KEY) {
    logWarning('[moderation] OPENROUTER_API_KEY not set; skipping screen');
    return SAFE_VERDICT;
  }

  // No system prompt — the classifier's chat template supplies its own.
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: userContent },
  ];
  if (assistantContent) {
    messages.push({ role: 'assistant', content: assistantContent });
  }

  try {
    const completion = await createChatCompletionWithRetry(getOpenRouterClient(), {
      model: persona.model,
      messages,
      max_tokens: MODERATION_MAX_TOKENS,
    }, { timeoutMs: MODERATION_TIMEOUT_MS, overallTimeoutMs: MODERATION_TIMEOUT_MS * 2 });

    const verdict = parseModerationOutput(completion.choices?.[0]?.message?.content ?? '');
    if (!verdict.safe) {
      log(`[moderation] flagged ${verdict.flaggedSide} turn${verdict.categories ? ` (${verdict.categories})` : ''}`);
    }
    return verdict;
  } catch (err) {
    logError('[moderation] screen failed; allowing the turn through:', err);
    return SAFE_VERDICT;
  }
}
