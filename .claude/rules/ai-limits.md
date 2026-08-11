---
paths:
  - "utils/ai.ts"
  - "utils/aiPricing.ts"
  - "utils/aiModeration.ts"
  - "utils/llmRetry.ts"
  - "commands/ai*.ts"
  - "database/models/AiUsageModel.ts"
---

# AI usage limits, moderation & retry

`utils/ai.ts`, `utils/aiPricing.ts`, `AiUsageModel`.

Per-user fixed windows (`DAILY_LIMIT` / `WEEKLY_LIMIT` in `utils/ai.ts`) metered in **credits**, not
raw tokens:

```text
credits = tok_in × mult_in + tok_out × mult_out
```

where $0.28/M = 1x. **The per-model multiplier table lives in `utils/aiPricing.ts` — read it there,
it moves.** Two rules that don't move: unlisted models are 1x/1x, and listed promotional discounts
are ignored (multipliers track list price).

Models in `FREE_MODELS` (`openrouter/free`, the `@fr` persona) are 0x/0x **and** skip the
reservation entirely — free to run, so never metered or blocked.

The `AiUsage` audit log keeps raw tokens + derived USD `cost`; the `AiRateLimitWindow.tokens` column
stores **credits** (name kept, no rebuild).

Enforcement is `db.aiUsage.tryReserve(userId, estCredits)` → `release()` in `finally` — an
in-memory in-flight reservation held for the whole generation so concurrent spam can't all pass the
check before usage lands. **No dev bypass — everyone is metered.**

## Content-safety moderation

Off by default; `GlobalConfig.ai_moderation = 1` turns it on globally (`utils/aiModeration.ts`).
When on, **every** session-backed AI turn — every persona, every user, no exemptions — is screened
twice by the `Moderation` persona (`data/aiPersonas.json`, an NVIDIA Nemotron content-safety
classifier that takes **no system prompt**): once on the user message before generating, once on the
user+assistant pair before delivery. Its reply is plain-text labels (`User Safety:` /
`Response Safety:` / `Safety Categories:`), parsed by `parseModerationOutput`.

A trip sets `AiChatSession.moderation_flagged` (`flagSessionModeration`) — the session is paused
permanently, `active` deliberately untouched so `getOrCreateSession` keeps returning and refusing it.
The turn is neither delivered nor persisted; the user gets `MODERATION_PAUSED_MESSAGE` **in the voice
of the persona they were talking to** and must start a new chat.

**The screen never costs credits.** It calls `createChatCompletionWithRetry` directly, bypassing
`generateContent` — so no `tryReserve`, no `addUsage`, no entry in the credit ledger at all. It is
not in `FREE_MODELS` because it never reaches the code that consults it. **Don't route it through
`generateContent`** — that would start billing users for being moderated.

**The screen fails open** — an outage, timeout, or unparseable label logs and allows the turn. A
free classifier must never be able to take down every conversation on the bot.

### Per-surface behaviour

| Surface | Session? | On a trip |
| --- | --- | --- |
| mention handler (`keywordsBehaviorHandler.ts`) | yes | **pause** |
| `/ask` (`askSilverwolfAI.ts`) | yes — *shares* the `Silverwolf` session with `@sw` | **pause** |
| web chat (`site_src/routes/ai-slop-api.ts`) | yes | **pause** |
| `/summary count`/`time` | no | **reply-and-drop** (`MODERATION_BLOCKED_MESSAGE`) |
| roleplay (`utils/rpChat.ts` → `rpRuntime.ts`) | spawns, not sessions | **reply-and-drop** (`reason: 'moderation'`) |

`/ask` must stay on pause semantics: it resolves the same `AiChatSession` row as the `@sw` mention
persona, so reply-and-drop there would be a way to keep talking to a chat mentions had paused.

Roleplay drops the reply but leaves the spawn alive — the offending user turn stays in `RpHistory`,
so a re-trigger is screened and refused again rather than slipping through. A dropped RP reply still
records usage: the tokens were spent before the screen ran.

### Escaping a pause

`kys` (new session) is the **only** exit, by design. `amnesia` is refused on a paused session
(`undoLastTurn` → `reason: 'paused'`) — the tripping turn was never persisted, so it would only eat
an earlier legitimate turn while implying the pause had lifted. `/ai chatswitch` to a different,
unflagged session is allowed; that is equivalent to starting a new chat.

## Retry

All OpenRouter chat calls go through `createChatCompletionWithRetry` (`utils/llmRetry.ts`):
per-attempt timeout (180s default, 480s music-compose, 60s titlegen), a 600s overall budget across
attempts, and 2s/4s/8s/16s backoff on 408/409/429/5xx/network **only**. The shared client sets
`maxRetries: 0` so SDK retries don't stack — don't raise it.
