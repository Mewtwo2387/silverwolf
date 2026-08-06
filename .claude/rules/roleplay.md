---
paths:
  - 'utils/rp*.ts'
  - 'commands/ai_rp_*.ts'
  - 'database/models/Rp*.ts'
  - 'database/tables/Rp*.ts'
---

# Roleplay subsystem

`utils/rp*.ts`, `commands/ai_rp_*.ts`, `db.rp` → `RpCharacter` / `RpSpawn` / `RpHistory` /
`RpLorebook` / `RpPersona`.

User-defined characters (`/ai rp-create-char`) spawned per-channel (`/ai rp-spawn`, ≤5/channel)
reply through the shared AI webhook as themselves — name + a 128×128 avatar re-hosted in a
per-server asset channel (ServerConfig key `rp_asset_channel`, set via `/ai rp-setasset`; signed CDN
URLs are refreshed from the stored message id). Model is `RP_MODEL` in `utils/rpChat.ts` (reasoning
on), no function-calling, **per-character private history** with auto-compaction (oldest ~80% folded
into a first-person memory) near the 128k window.

Spawns are **soft-deleted** so history survives removal/re-spawn. Names allow letters, numbers,
underscores and single spaces (no dashes); `@name` / `@id` / `@name-id` mentions route in
`messageCreate` and match the space-stripped name by prefix (`@SilverWolf` / `@Silver`).

`all`-mode characters also chime in via the scheduler (≤1 reply/channel/tick). Bot/webhook/app
messages **are** heard as context (`RpHistory.from_bot`) — including other characters, whose replies
are fed to the rest of the channel at generation time (`propagateReplyToChannel`) — but only an
**unanswered human turn** ever triggers a reply, so characters can react to each other without an
infinite bot-to-bot loop. An in-memory active-channel set keeps non-RP traffic off the DB.

## Input handling (the attack surface)

Characters are defined via command fields **or** an uploaded `.json` (`utils/rpCharInput.ts` —
size-capped, parsed in a try/catch, only the three known string fields read, **never spread**).
`details` is token-capped (~4k), `starting_message` char-capped (6k, split on delivery). `{user}` in
details/starting-message is substituted with the spawner's name in **self**-mode only (left literal
in `all`-mode).

## Lorebooks

`utils/rpLorebook.ts`, `RpLorebook`, `/ai rp-lorebook-add/-remove/-view`, ≤5/character,
creator/dev-only editing. Two kinds:

- `keywords` — `.json` of `{triggers, context}` entries; plain word-boundary triggers matched
  against the un-replied human turns. **No user regex — this is a deliberate ReDoS stance, don't
  "improve" it into pattern support.**
- `skill` — `.md` note recalled on demand via a `<recall:name>` marker → one regeneration; no
  function-calling dependency.

Both inject **ephemerally into the system prompt only** — never into `RpHistory`, so nothing leaks
into compaction (which uses the raw character details). Budgets: 200 tokens/keyword context,
1k/skill, 4k total injected per generation.

## Personas

`RpPersona`, `/ai rp-persona-add/-remove`, ≤1k tokens, one per user, add = overwrite. The spawner's
self-description injected in a `<userPersona>` block for **self-mode spawns only** (also visible to
the compaction prompt).

## Reply visibility

`/ai rp-*` command replies are non-ephemeral (public) **except** admin `rp-setasset`,
`rp-lorebook-view` (content dump is creator/dev-only) and the `rp-persona-*` pair.
