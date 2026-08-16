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
free classifier must never be able to take down every conversation on the bot. Budgets are tight for
the same reason (15s per attempt, 20s overall): the screen runs twice per turn and sits on the
critical path, so a degraded classifier must fail open fast rather than stall the reply.

### Attached images

The classifier is `text+image`, so the mention handler's **pre-screen** sends the user's attached
images alongside their caption (`moderateExchange(text, undefined, imageParts)`), reusing the
buffers `aiMedia` already downloaded — no second fetch, no extra Discord traffic. Everything the
chat model could see is screened: both the vision parts and the images collected only as
`generate_image` edit sources. `selectModerationImages` drops video/audio (the classifier takes
neither) and caps the count at `aiMedia`'s `MAX_IMAGES` — **never cap it lower**, or an extra
attachment becomes an unscreened gap.

Images ride the **inbound pass only**: they are a multi-MB base64 upload on the critical path under
a 15s timeout, and `Response Safety` turns on the assistant's text, not on a picture the inbound
pass already ruled on. Images from the *replied-to* message are excluded for the same reason
`ownTurnText` excludes quoted text. If the model rejects the images (400/413/415/422 or an
image/vision error), the screen retries once text-only before failing open — a vision regression
degrades to the old caption-only screen, not to no screen.

Only the mention handler collects media today; `/ask`, web chat, RP and `/summary` are text-only, so
their screens are unchanged.

### Generated images

The output pass screens the *prompts* the model passed to `generate_image`/`generate_music` as part
of the reply text — a tool-driven turn can return files with empty `text`, which would otherwise
sail through. That is not the same as screening the picture: an edit over an attached source can
turn a benign instruction into an unsafe image. So `moderateGeneratedImages` screens the returned
bytes too, after the text pass and only on turns that actually generated an image (≤
`IMAGE_GEN_DAILY_LIMIT` per user per day, so the extra call stays off the critical path of ordinary
chat). `generatedImagePart` derives the MIME from the filename `runImageGeneration` built out of the
provider's own data URL, and returns null for anything that isn't an image — `generate_music`'s WAV
rides the same attachment list.

The bytes go in as the **user** turn, not the assistant turn: that is the only position the
classifier accepts images in, and providers routinely reject `image_url` parts inside an assistant
message. The reply therefore says `User Safety`, and `moderateGeneratedImages` re-attributes it to
`flaggedSide: 'response'` — it is our output whatever the label says. **Don't "fix" that to
`'user'`**; it would report the wrong side to the user and to the log.

### Known limits

- **Video and audio are not screened.** The classifier takes text and images only, so an attached
  video or voice message reaches a media-capable persona unscreened, and the WAV from
  `generate_music` goes out unscreened (only its prompt and title are).
- **A post-screen trip still costs credits** on every surface — generation has already happened by
  then. The pre-screen exists to make that the uncommon case.
- **Only the user's own text and images are screened for the pause decision** on the mention handler
  (`ownTurnText`), not the quoted reply context or attached PDF bodies. Screening those would let
  someone permanently pause a third party's session just by being quoted at. Content induced *by*
  quoted context is still caught by the output screen.
- **`/summary` is output-screened only.** Its input is a transcript of other people's channel
  messages, so pre-screening would block summarising any channel where someone said something spicy
  — a false-positive surface with no session to protect.

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

`ai_moderation` is a **master switch**: turning it off must restore normal behaviour everywhere at
once, so every pause check is gated on it — including `undoLastTurn`'s, via its
`honorModerationPause` argument. Without that, a flagged session would chat normally while still
refusing amnesia.

### Concurrency

The pause is a read-check-write spanning a multi-second generation, so it is enforced twice over:

1. **`withAiSessionLock(sessionId, …)`** (`utils/aiSessionLock.ts`) wraps the whole
   check → generate → persist → deliver sequence on all three session surfaces. Two turns in one
   conversation queue instead of racing. It uses a **separate registry** from `userLocks` — sharing
   it would stall a user's `/claim` behind their own multi-minute AI reply.
2. **`ADD_HISTORY` is conditional** on `moderation_flagged = 0` in the INSERT itself, so the check
   and the write are one statement. This holds even where no lock is taken, and `addHistory` returns
   whether the row landed.

**Never test `moderationFlagged` on the session row resolved *before* the lock** — a turn queued
behind one that paused the session would not see the flag on that stale snapshot. Every surface has
an `isPausedNow()` that re-reads inside the lock; use it both before generating (saves a paid call)
and again before delivery (the conditional INSERT stops persistence, but nothing else stops a
webhook send).

`flagSessionModeration` returns whether the write landed. `Database.executeQuery` swallows errors
and reports `changes: 0` rather than throwing, so callers **must** check: a caller that assumed
success would tell the user the chat was paused while leaving the row unflagged, and the next
message would generate normally. Callers refuse the current turn either way and log loudly.

## Retry

All OpenRouter chat calls go through `createChatCompletionWithRetry` (`utils/llmRetry.ts`):
per-attempt timeout (180s default, 480s music-compose, 60s titlegen), a 600s overall budget across
attempts, and 2s/4s/8s/16s backoff on 408/409/429/5xx/network **only**. The shared client sets
`maxRetries: 0` so SDK retries don't stack — don't raise it.
