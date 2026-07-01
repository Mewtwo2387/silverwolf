import { getOpenRouterClient } from './ai';
import { countTokensOpenRouterMessages } from './tokenizer';
import { applyUserVar } from './rpIdentity';
import { logError, log } from './log';

/**
 * Roleplay generation + auto-compaction on DeepSeek. Each spawned character has its
 * own private history; when the assembled prompt nears the context window we fold the
 * oldest ~80% of the un-compacted tail into a first-person "memory" and keep the
 * newest ~20% verbatim. The character's starting message lives in the system prompt,
 * so it always survives compaction.
 */

export const RP_MODEL = 'deepseek/deepseek-v3.2';
const RP_MAX_OUTPUT = 8192;
const RP_CONTEXT_LIMIT = 128_000;
// Reduce context once the assembled prompt would exceed ~85% of the window.
const COMPACTION_TRIGGER_TOKENS = Math.floor(RP_CONTEXT_LIMIT * 0.85);
// Leave room for the reply + system prompt when hard-truncating.
const TRUNCATE_TARGET_TOKENS = Math.floor(RP_CONTEXT_LIMIT * 0.7);
// Don't bother compacting a handful of rows — there's nothing to gain.
const MIN_ROWS_TO_COMPACT = 8;
// Fraction of the tail (by tokens) folded into memory; the rest is kept verbatim.
const COMPACT_FRACTION = 0.8;

// The format the compaction model MUST obey so we can trust the output.
const MEMORY_OPEN = '<MEMORY>';
const MEMORY_CLOSE = '</MEMORY>';

export interface RpCharacterDef {
  charId: string;
  name: string;
  details: string;
  startingMessage: string;
}

export interface RpSpawnState {
  spawnId: number;
  compactionEnabled: boolean;
  compactedMemory: string | null;
  compactedUptoId: number | null;
  compactionFailed: boolean;
}

export interface RpHistoryTurn {
  id: number;
  role: 'user' | 'model';
  speakerName: string | null;
  message: string;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function buildSystemPrompt(character: RpCharacterDef, memory: string | null, userVar: string | null): string {
  const details = applyUserVar(character.details, userVar);
  const startingMessage = applyUserVar(character.startingMessage, userVar);
  let prompt = `You are roleplaying as ${character.name}, a character in a Discord channel. Stay fully in character at all times. Never break character, never mention being an AI, and never describe the actions or speech of the people you are talking to. Respond only as ${character.name}.

Character details:
${details}

You may be talking with one or more people at once. Each incoming line is prefixed with the speaker's name as "Name: message". Address people naturally by name when it fits. Do not prefix your own reply with your name or a timestamp. Keep replies reasonably concise for a chat.`;

  if (startingMessage) {
    prompt += `\n\nThe conversation opened with you saying:\n"${startingMessage}"`;
  }
  if (memory) {
    prompt += `\n\nThis is your memory of everything that has happened so far, experienced from your own perspective. Treat it as established history and stay consistent with it:\n${memory}`;
  }
  return prompt;
}

function turnToMessage(turn: RpHistoryTurn): ChatMessage {
  if (turn.role === 'user') {
    const name = turn.speakerName || 'Someone';
    return { role: 'user', content: `${name}: ${turn.message}` };
  }
  return { role: 'assistant', content: turn.message };
}

function estimateTokens(systemPrompt: string, tail: RpHistoryTurn[]): number {
  const msgs: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...tail.map(turnToMessage)];
  return countTokensOpenRouterMessages(msgs);
}

async function callDeepseek(messages: ChatMessage[], maxTokens: number): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  const openrouter = getOpenRouterClient();
  const completion = await openrouter.chat.completions.create({
    model: RP_MODEL,
    messages,
    max_tokens: maxTokens,
    reasoning: { enabled: false },
  } as any);
  return completion.choices?.[0]?.message?.content ?? '';
}

/** Drops oldest rows until the tail fits the truncation target, keeping the newest. */
function truncateToFit(tail: RpHistoryTurn[], systemPrompt: string): RpHistoryTurn[] {
  let kept = [...tail];
  while (kept.length > 1 && estimateTokens(systemPrompt, kept) > TRUNCATE_TARGET_TOKENS) {
    kept = kept.slice(1);
  }
  return kept;
}

function parseMemory(raw: string): string | null {
  const open = raw.indexOf(MEMORY_OPEN);
  const close = raw.indexOf(MEMORY_CLOSE);
  if (open === -1 || close === -1 || close <= open) return null;
  const inner = raw.slice(open + MEMORY_OPEN.length, close).trim();
  return inner.length > 0 ? inner : null;
}

/**
 * Folds the oldest portion of the tail into a fresh `compacted_memory`. Returns the
 * new memory + the id it covers up to on success; `{ ok: false }` when the model
 * breaks the required format (caller decides whether to halt or hard-truncate).
 * `memory` is absent when there was nothing worth folding.
 */
async function compact(
  db: any,
  spawnId: number,
  character: RpCharacterDef,
  tail: RpHistoryTurn[],
  priorMemory: string | null,
): Promise<{ ok: boolean; memory?: string; uptoId?: number }> {
  if (tail.length < MIN_ROWS_TO_COMPACT) return { ok: true };

  // Find the split so ~COMPACT_FRACTION of the tail's tokens are folded.
  const totalTokens = tail.reduce((sum, t) => sum + countTokensOpenRouterMessages([turnToMessage(t)]), 0);
  const budget = totalTokens * COMPACT_FRACTION;
  let acc = 0;
  let splitIdx = 0;
  for (let i = 0; i < tail.length; i += 1) {
    acc += countTokensOpenRouterMessages([turnToMessage(tail[i])]);
    if (acc >= budget) { splitIdx = i + 1; break; }
  }
  // Always keep at least one recent row intact.
  splitIdx = Math.min(splitIdx, tail.length - 1);
  const toFold = tail.slice(0, splitIdx);
  if (toFold.length === 0) return { ok: true };
  const newUptoId = toFold[toFold.length - 1].id;

  const transcript = toFold
    .map((t) => (t.role === 'user' ? `${t.speakerName || 'Someone'}: ${t.message}` : `${character.name}: ${t.message}`))
    .join('\n');

  const systemPrompt = `You maintain the long-term memory of a roleplay character named ${character.name} so the roleplay can continue past the model's context limit. Here is who they are, so the memory stays in-character:
${character.details}

You are given the character's existing memory (if any) and a transcript of recent events. Rewrite the memory so it ABSORBS the new events. Requirements:
- Write in ${character.name}'s own first-person perspective, as lived memory.
- Preserve key facts, relationships, names, the other people's stated preferences and details, unresolved threads, promises, and the emotional progression.
- Keep the natural arc of how things have developed. Be concise but lose nothing important.
- Never invent events that are not in the transcript or prior memory.
Output ONLY the updated memory wrapped exactly as ${MEMORY_OPEN}...${MEMORY_CLOSE} with nothing before or after.`;

  const userPrompt = `${priorMemory ? `Existing memory:\n${priorMemory}\n\n` : ''}Recent events to absorb:\n${transcript}\n\nProduce the updated memory now, wrapped in ${MEMORY_OPEN} and ${MEMORY_CLOSE}.`;

  let raw = '';
  try {
    raw = await callDeepseek(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      4096,
    );
  } catch (err) {
    logError(`Rp: compaction request failed for spawn ${spawnId}:`, err);
    return { ok: false };
  }

  const memory = parseMemory(raw);
  if (!memory) {
    logError(`Rp: compaction returned malformed output for spawn ${spawnId}`);
    return { ok: false };
  }

  await db.rp.setCompactionState(spawnId, memory, newUptoId);
  log(`Rp: compacted spawn ${spawnId} (folded ${toFold.length} rows up to id ${newUptoId})`);
  return { ok: true, memory, uptoId: newUptoId };
}

export type RpReplyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'compaction_failed' }
  | { ok: false; reason: 'error' };

async function loadTail(db: any, spawnId: number, afterId: number): Promise<RpHistoryTurn[]> {
  const rows = await db.rp.getHistoryAfter(spawnId, afterId);
  return rows.map((r: any) => ({
    id: r.id, role: r.role, speakerName: r.speakerName ?? null, message: r.message,
  }));
}

/**
 * Generates the character's next reply from its private history. Assumes the new
 * incoming user turn(s) are already persisted. Handles auto-compaction, the
 * compaction-failure halt, and recovery-on-retry (never permanently bricks).
 */
export async function generateRpReply(
  db: any,
  spawn: RpSpawnState,
  character: RpCharacterDef,
  userVar: string | null = null,
): Promise<RpReplyResult> {
  try {
    const wasFailed = spawn.compactionFailed;
    let memory = spawn.compactedMemory;
    let uptoId = spawn.compactedUptoId ?? 0;
    let tail = await loadTail(db, spawn.spawnId, uptoId);
    let systemPrompt = buildSystemPrompt(character, memory, userVar);

    if (estimateTokens(systemPrompt, tail) > COMPACTION_TRIGGER_TOKENS) {
      if (spawn.compactionEnabled) {
        const res = await compact(db, spawn.spawnId, character, tail, memory);
        if (res.ok && res.memory) {
          memory = res.memory;
          uptoId = res.uptoId ?? uptoId;
          tail = await loadTail(db, spawn.spawnId, uptoId);
          systemPrompt = buildSystemPrompt(character, memory, userVar);
          // Compaction can still leave us over budget (a huge memory or character bio),
          // so re-check and hard-truncate rather than firing an over-limit request.
          if (estimateTokens(systemPrompt, tail) > COMPACTION_TRIGGER_TOKENS) {
            tail = truncateToFit(tail, systemPrompt);
          }
        } else if (!res.ok) {
          if (wasFailed) {
            // It failed before and is failing again — don't dead-end the character.
            await db.rp.setCompactionFailed(spawn.spawnId, false);
            tail = truncateToFit(tail, systemPrompt);
          } else {
            await db.rp.setCompactionFailed(spawn.spawnId, true);
            return { ok: false, reason: 'compaction_failed' };
          }
        } else {
          // Over budget but too little to fold (giant messages) — hard-truncate.
          tail = truncateToFit(tail, systemPrompt);
        }
      } else {
        tail = truncateToFit(tail, systemPrompt);
      }
    } else if (wasFailed) {
      await db.rp.setCompactionFailed(spawn.spawnId, false);
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...tail.map(turnToMessage),
    ];
    const text = (await callDeepseek(messages, RP_MAX_OUTPUT)).trim();
    if (!text) return { ok: false, reason: 'error' };
    return { ok: true, text };
  } catch (err) {
    logError(`Rp: generation failed for spawn ${spawn.spawnId}:`, err);
    return { ok: false, reason: 'error' };
  }
}
