import type { Context, Hono } from 'hono';
import { logError, logWarning } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import { canUseAiSlop } from '../guild-access';
import {
  generateContent,
  generateTitleForHistory,
  getPersonaByName,
  type Persona,
  DAILY_LIMIT,
} from '../../utils/ai';
import { trimHistoryToFit } from '../../utils/tokenizer';
import { type AppEnv, authedGameRequest, readGameBody } from '../shared';
import { isAllowedPersona } from './ai-slop-personas';

const MAX_MESSAGE_CHARS = 8000;
const MAX_TITLE_CHARS = 80;
const HISTORY_FETCH_LIMIT = 100;

// Per-user send quota. The global IP-bucketed limiter catches bursts, but
// every accepted /send fires a paid AI call (plus title-gen on first turn),
// so a single authenticated user — or a stolen session — could otherwise
// burn ~120 calls/min from one IP. Window is sliding so it self-clears.
const AI_SLOP_RATE_WINDOW_MS = 10 * 60_000;
const AI_SLOP_RATE_MAX = 60;
const aiSlopHits = new Map<string, number[]>();

function aiSlopRateLimitCheck(userId: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const fresh = aiSlopHits.get(userId)?.filter((t) => now - t < AI_SLOP_RATE_WINDOW_MS) ?? [];
  if (fresh.length >= AI_SLOP_RATE_MAX) {
    const oldest = fresh[0];
    const retryAfter = Math.max(1, Math.ceil((AI_SLOP_RATE_WINDOW_MS - (now - oldest)) / 1000));
    aiSlopHits.set(userId, fresh);
    return { ok: false, retryAfter };
  }
  fresh.push(now);
  aiSlopHits.set(userId, fresh);
  return { ok: true };
}

// .unref() so the interval doesn't keep the process alive on its own.
setInterval(() => {
  const now = Date.now();
  for (const [id, hits] of aiSlopHits.entries()) {
    const fresh = hits.filter((t) => now - t < AI_SLOP_RATE_WINDOW_MS);
    if (fresh.length === 0) aiSlopHits.delete(id);
    else aiSlopHits.set(id, fresh);
  }
}, 5 * 60_000).unref();

function isValidSessionId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

async function resolveSessionForUser(
  silverwolf: Silverwolf,
  sessionId: number,
  userId: string,
): Promise<{ session: any } | { error: 'not_found' | 'forbidden' | 'not_web' }> {
  const session = await silverwolf.db.aiChat.getSessionById(sessionId);
  if (!session) return { error: 'not_found' };
  if (session.userId !== userId) return { error: 'forbidden' };
  if (session.source !== 'web') return { error: 'not_web' };
  return { session };
}

async function requireAiSlopGuildAccess(
  c: Context<AppEnv>,
  silverwolf: Silverwolf,
  discordId: string,
): Promise<Response | null> {
  if (await canUseAiSlop(silverwolf, discordId)) return null;
  return c.json({ ok: false, error: 'guild_required' }, 403);
}

export function registerAiSlopApiRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  // Sends a user message and returns the assistant reply. Creates the session
  // on first send (deferred-row pattern) so empty drafts don't clutter the
  // sidebar.
  app.post('/games/ai-slop/send', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const guildGate = await requireAiSlopGuildAccess(c, silverwolf, auth.discordId);
    if (guildGate) return guildGate;

    const messageRaw = typeof body!.message === 'string' ? body!.message.trim() : '';
    if (!messageRaw) return c.json({ ok: false, error: 'empty_message' }, 400);
    if (messageRaw.length > MAX_MESSAGE_CHARS) {
      return c.json({ ok: false, error: 'message_too_long' }, 400);
    }

    // Quota-check after cheap input validation but before any DB work or AI
    // call. Empty/oversize bodies don't hit the model, so they shouldn't burn
    // a slot.
    const quota = aiSlopRateLimitCheck(auth.discordId);
    if (!quota.ok) {
      return c.json(
        { ok: false, error: 'rate_limited' as const, retryAfter: quota.retryAfter },
        429,
        { 'retry-after': String(quota.retryAfter) },
      );
    }

    const sessionIdRaw = body!.sessionId;
    const personaNameRaw = body!.personaName;

    let session: any;
    let persona: Persona | undefined;
    let isFirstTurn = false;

    if (sessionIdRaw == null) {
      // New chat path. personaName must be in the allowlist.
      if (!isAllowedPersona(personaNameRaw)) {
        return c.json({ ok: false, error: 'invalid_persona' }, 400);
      }
      persona = await getPersonaByName(personaNameRaw);
      if (!persona) return c.json({ ok: false, error: 'persona_not_found' }, 400);
      session = await silverwolf.db.aiChat.createWebSession(auth.discordId, persona.name);
      if (!session) return c.json({ ok: false, error: 'server' }, 500);
      isFirstTurn = true;
    } else {
      if (!isValidSessionId(sessionIdRaw)) {
        return c.json({ ok: false, error: 'invalid_session' }, 400);
      }
      const r = await resolveSessionForUser(silverwolf, sessionIdRaw, auth.discordId);
      if ('error' in r) {
        const status = r.error === 'forbidden' || r.error === 'not_web' ? 403 : 404;
        return c.json({ ok: false, error: r.error }, status);
      }
      session = r.session;
      // Persona is fixed once the session exists — ignore any personaName from the body.
      persona = await getPersonaByName(session.personaName);
      if (!persona) return c.json({ ok: false, error: 'persona_not_found' }, 400);
    }

    let assistantText = '';
    let title: string | undefined;
    try {
      // Load history, filter tool rows (audit-only), then trim to fit context.
      const rawHistory = isFirstTurn
        ? []
        : await silverwolf.db.aiChat.getHistory(session.sessionId, HISTORY_FETCH_LIMIT);
      const filtered = rawHistory.filter((h: { role: string }) => h.role !== 'tool');

      let historyForAi: { role: string; message: string }[] = filtered as any;
      try {
        const { trimmedHistory } = await trimHistoryToFit(
          persona.provider,
          persona.model,
          persona.systemPrompt ?? '',
          filtered as any,
          messageRaw,
          persona.webSearchEnabled,
        );
        historyForAi = trimmedHistory;
      } catch (trimErr) {
        // System+prompt alone exceeds budget — surface a clean error.
        logWarning(`[ai-slop] history trim failed: ${(trimErr as Error).message}`);
        return c.json({ ok: false, error: 'message_too_long' }, 400);
      }

      const result = await generateContent({
        db: silverwolf.db,
        userId: auth.discordId,
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt ?? '',
        prompt: messageRaw,
        history: historyForAi,
        webSearchEnabled: persona.webSearchEnabled,
      });
      assistantText = (result.text || '').toString();

      // Persist: user → tool audit rows (if any) → assistant. Match the bot's order.
      await silverwolf.db.aiChat.addHistory(session.sessionId, 'user', messageRaw);
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const tc of result.toolCalls) {
          // eslint-disable-next-line no-await-in-loop
          await silverwolf.db.aiChat.addHistory(
            session.sessionId,
            'tool',
            JSON.stringify(tc),
          );
        }
      }
      const aiRole = persona.provider === 'openrouter' ? 'assistant' : 'model';
      if (assistantText) {
        await silverwolf.db.aiChat.addHistory(session.sessionId, aiRole, assistantText);
      }

      if (isFirstTurn && assistantText) {
        try {
          const history = await silverwolf.db.aiChat.getHistory(session.sessionId, 100);
          title = (await generateTitleForHistory(history)) ?? undefined;
          if (title) await silverwolf.db.aiChat.updateTitle(session.sessionId, title);
        } catch (titleErr) {
          logError('[ai-slop] title generation failed:', titleErr);
          const fallback = messageRaw.slice(0, 50).trim().slice(0, MAX_TITLE_CHARS).trim();
          if (fallback) {
            title = fallback;
            await silverwolf.db.aiChat.updateTitle(session.sessionId, fallback);
          }
        }
      }

      return c.json({
        ok: true,
        data: {
          sessionId: session.sessionId,
          personaName: session.personaName,
          assistant: assistantText,
          toolCallCount: result.toolCalls?.length ?? 0,
          title,
        },
      });
    } catch (err: any) {
      if (err?.message === 'RATE_LIMIT_EXCEEDED') {
        const dailyUsage = await silverwolf.db.aiUsage.getDailyUsage(auth.discordId);
        const weeklyUsage = await silverwolf.db.aiUsage.getWeeklyUsage(auth.discordId);
        const reachedDaily = dailyUsage >= DAILY_LIMIT;
        return c.json({
          ok: false,
          error: 'rate_limited' as const,
          reason: reachedDaily ? ('daily' as const) : ('weekly' as const),
          dailyUsage,
          weeklyUsage,
        }, 429);
      }
      logError('[ai-slop] send failed:', err);
      // If this was a brand-new session and the AI call failed without producing
      // any history, leave the empty session in place rather than rolling back —
      // the user can retry the same chat. They can also delete it from the
      // sidebar.
      return c.json({ ok: false, error: 'server' }, 500);
    }
  });

  app.post('/games/ai-slop/session/rename', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const guildGate = await requireAiSlopGuildAccess(c, silverwolf, auth.discordId);
    if (guildGate) return guildGate;

    const sessionIdRaw = body!.sessionId;
    if (!isValidSessionId(sessionIdRaw)) {
      return c.json({ ok: false, error: 'invalid_session' }, 400);
    }
    const titleRaw = typeof body!.title === 'string' ? body!.title.trim() : '';
    if (!titleRaw) return c.json({ ok: false, error: 'empty_title' }, 400);
    const title = titleRaw.slice(0, MAX_TITLE_CHARS);

    try {
      const resolved = await resolveSessionForUser(silverwolf, sessionIdRaw, auth.discordId);
      if ('error' in resolved) {
        const status = resolved.error === 'forbidden' || resolved.error === 'not_web' ? 403 : 404;
        return c.json({ ok: false, error: resolved.error }, status);
      }
      const ok = await silverwolf.db.aiChat.renameSession(auth.discordId, sessionIdRaw, title);
      if (!ok) return c.json({ ok: false, error: 'forbidden' }, 403);
      return c.json({ ok: true, data: { sessionId: sessionIdRaw, title } });
    } catch (err) {
      logError('[ai-slop] rename failed:', err);
      return c.json({ ok: false, error: 'server' }, 500);
    }
  });

  app.post('/games/ai-slop/session/delete', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const guildGate = await requireAiSlopGuildAccess(c, silverwolf, auth.discordId);
    if (guildGate) return guildGate;

    const sessionIdRaw = body!.sessionId;
    if (!isValidSessionId(sessionIdRaw)) {
      return c.json({ ok: false, error: 'invalid_session' }, 400);
    }

    try {
      const resolved = await resolveSessionForUser(silverwolf, sessionIdRaw, auth.discordId);
      if ('error' in resolved) {
        const status = resolved.error === 'forbidden' || resolved.error === 'not_web' ? 403 : 404;
        return c.json({ ok: false, error: resolved.error }, status);
      }
      const ok = await silverwolf.db.aiChat.deleteSession(auth.discordId, sessionIdRaw);
      if (!ok) return c.json({ ok: false, error: 'forbidden' }, 403);
      return c.json({ ok: true, data: { sessionId: sessionIdRaw } });
    } catch (err) {
      logError('[ai-slop] delete failed:', err);
      return c.json({ ok: false, error: 'server' }, 500);
    }
  });

  // Returns the message history for one session. Used by the sidebar's
  // click-to-switch to populate the chat panel.
  app.get('/games/ai-slop/session/:id/messages', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ ok: false, error: 'unauthenticated' }, 401);

    const guildGate = await requireAiSlopGuildAccess(c, silverwolf, user.discordId);
    if (guildGate) return guildGate;

    const idParam = parseInt(c.req.param('id'), 10);
    if (!Number.isInteger(idParam) || idParam <= 0) {
      return c.json({ ok: false, error: 'invalid_session' }, 400);
    }

    try {
      const r = await resolveSessionForUser(silverwolf, idParam, user.discordId);
      if ('error' in r) {
        const status = r.error === 'forbidden' || r.error === 'not_web' ? 403 : 404;
        return c.json({ ok: false, error: r.error }, status);
      }
      const rows = await silverwolf.db.aiChat.getHistory(idParam, HISTORY_FETCH_LIMIT);
      // Strip tool rows from the client view — they're an internal audit trail.
      const visible = rows
        .filter((h: { role: string }) => h.role !== 'tool')
        .map((h: any) => ({ role: h.role, message: h.message }));
      return c.json({
        ok: true,
        data: {
          sessionId: r.session.sessionId,
          personaName: r.session.personaName,
          title: r.session.title,
          messages: visible,
        },
      });
    } catch (err) {
      logError('[ai-slop] messages fetch failed:', err);
      return c.json({ ok: false, error: 'server' }, 500);
    }
  });
}
