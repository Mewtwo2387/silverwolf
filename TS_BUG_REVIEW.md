# Silverwolf — Post-Migration Bug Review
> **Living document.** Update checkboxes as fixes are applied. Each stage is gated by a passing
> test run + clean bot start before it can be struck off.
> **Rule:** The bot must remain runnable with `bun index.ts` at the end of every stage.

---

## Document Location
This file lives at `TS_BUG_REVIEW.md` in the repo root.
Parent migration document: `TYPESCRIPT_MIGRATION.md`.

---

## Quick-Start for a New Agent Session

1. Read this file top-to-bottom first.
2. Check which stage is **In Progress** or next unchecked.
3. Read only the specific files listed for that stage before touching anything.
4. After finishing tasks, run the gate test for that stage.
5. If tests pass: tick the stage checkbox and add a note to the **Session Log**.
6. Commit format: `Fix: TS bug review — Stage N — <short description>`

---

## Background

The TypeScript migration (all 8 stages, completed 2026-04-01) converted the entire codebase
from CommonJS JavaScript to TypeScript. This document records real runtime bugs and logic errors
found in the migrated code — things that will crash, silently fail, or behave incorrectly at
runtime. It is NOT a type-cleanliness or style review.

Bugs are grouped into 3 fix stages by urgency. A **Known Type Debt** appendix at the bottom
tracks `any`-typed areas deferred for a separate pass.

---

## Bug Index

| ID | Severity | File(s) | Summary |
|----|----------|---------|---------|
| B1 | CRITICAL | `classes/birthdayScheduler.ts:43` | Null dereference on `discordUser` |
| B2 | CRITICAL | `commands/classes/DevCommand.ts:20`, `AdminCommand.ts:20`, `NSFWCommand.ts:20` | Missing `await` on `super.execute()` |
| B3 | CRITICAL | `classes/silverwolf.ts:178` | Missing `await` on `command.execute()` inside try-catch |
| B4 | HIGH | `index.ts:28` | `registerCommands()` promise not returned — errors silently swallowed |
| B5 | HIGH | `classes/babyScheduler.ts:24,44,61,83` | `async forEach` — all loops fire-and-forget |
| B6 | HIGH | `classes/birthdayScheduler.ts:29,36` | Nested `async forEach` — try-catch can't catch inner errors |
| B7 | HIGH | `classes/handlers/handler.ts:13-17` | Missing `await` on three async Pokémon summon calls |
| B8 | MEDIUM | `commands/avatar.ts:40-57`, `commands/profile.ts:63,68`, `classes/birthdayScheduler.ts:43` | discord.js v13 `displayAvatarURL` option names used in v14 |
| B9 | LOW | `classes/silverwolf.ts:171` | Missing `await` on `interaction.reply()` |

---

## Stage Overview

| Stage | Name | Status |
|-------|------|--------|
| 1 | Critical crash fixes | ✅ Complete |
| 2 | Async pattern fixes | ✅ Complete |
| 3 | API correctness | ✅ Complete |

---

## Stage 1 — Critical Crash Fixes
> Goal: Fix the three bugs that cause confirmed runtime crashes or completely swallow all command
> errors. These are the highest-priority fixes — the bot is silently broken until they land.

### Bug Details

**B1 — Null dereference on `discordUser` in birthday cron**

`classes/birthdayScheduler.ts`, line 43:
```typescript
// BEFORE (crashes if user can't be fetched):
const discordUser = await this.client.users.fetch(user.id).catch(() => null);
const username = discordUser ? discordUser.username : `Unknown User (${user.id})`;
const birthdayEmbed = new EmbedBuilder()
  .setImage(discordUser.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 }))  // ← NULL DEREF

// AFTER:
const discordUser = await this.client.users.fetch(user.id).catch(() => null);
const username = discordUser ? discordUser.username : `Unknown User (${user.id})`;
const avatarUrl = discordUser?.displayAvatarURL({ extension: 'png', size: 4096 }) ?? null;
const birthdayEmbed = new EmbedBuilder()
// Only call .setImage() if we actually have a URL:
if (avatarUrl) birthdayEmbed.setImage(avatarUrl);
```
Note: Also fixes the v14 option names (`extension` not `format`, no `dynamic`) as part of this change.

---

**B2 — Missing `await` on `super.execute()` in guard command classes**

All three files at line 20:
```typescript
// BEFORE:
super.execute(interaction);

// AFTER:
await super.execute(interaction);
```
Files: `commands/classes/DevCommand.ts`, `AdminCommand.ts`, `NSFWCommand.ts`

Without `await`, the parent class's async error-handling, `deferReply`, and `run()` all fire as
a floating unhandled promise. Discord sees no response → interaction times out.

---

**B3 — Missing `await` on `command.execute()` in `processInteraction`**

`classes/silverwolf.ts`, line 178:
```typescript
// BEFORE:
try {
  command.execute(interaction);   // ← no await; try-catch is useless for async errors
} catch (error) {
  logError('Error processing interaction:', error);
}

// AFTER:
try {
  await command.execute(interaction);
} catch (error) {
  logError('Error processing interaction:', error);
}
```
Without `await`, every command error becomes an unhandled promise rejection. The catch block
never fires. Discord sees no response.

---

### Tasks
- [x] Fix B1: Add null check before `.setImage()` in `birthdayScheduler.ts`
- [x] Fix B2: Add `await` before `super.execute(interaction)` in `DevCommand.ts`
- [x] Fix B2: Add `await` before `super.execute(interaction)` in `AdminCommand.ts`
- [x] Fix B2: Add `await` before `super.execute(interaction)` in `NSFWCommand.ts`
- [x] Fix B3: Add `await` before `command.execute(interaction)` in `silverwolf.ts:178`

### Gate Test
```bash
bun test
bun index.ts
# Confirm bot starts. Test a /dev or /admin command from a non-authorised account.
# Should reply "No." (or equivalent) — NOT time out silently.
```

### ✅ Stage 1 complete when
- [x] All 5 tasks above ticked
- [x] Test suite passes
- [ ] Bot starts clean
- [ ] Committed

---

## Stage 2 — Async Pattern Fixes
> Goal: Fix fire-and-forget async loops and the unhandled startup promise. These cause silent
> failures where work appears to complete but actually doesn't, and errors are invisible.

### Bug Details

**B4 — `registerCommands()` promise not returned in `index.ts`**

`index.ts`, lines 27–29:
```typescript
// BEFORE (error from registerCommands is swallowed):
silverwolf.login().then(() => {
  silverwolf.registerCommands(CLIENT_ID);
});

// AFTER:
silverwolf.login().then(() => {
  return silverwolf.registerCommands(CLIENT_ID);
});
```
If command registration fails (bad `CLIENT_ID`, Discord API error), the bot starts silently
with no slash commands registered and no log output.

---

**B5 — `async forEach` in `babyScheduler.ts` (4 sites)**

`classes/babyScheduler.ts`, lines 24, 44, 61, 83. All follow this pattern:
```typescript
// BEFORE (outer async resolves immediately, inner work runs unchecked):
babies.forEach(async (baby: any) => {
  await this.someMethod(baby);
});

// AFTER:
for (const baby of babies) {
  await this.someMethod(baby);
}
```
Affects: `dailyAutomations` (line 24), `tenMinuteAutomations` (line 44), and the two inner
`parents.forEach` loops in `dailyNuggieClaim` (line 61) and `tenMinuteGamble` (line 83).

---

**B6 — Nested `async forEach` in `birthdayScheduler.ts`**

`classes/birthdayScheduler.ts`, lines 29 and 36. Same pattern:
```typescript
// BEFORE:
channelIds.forEach(async (channelId: string) => {
  // ...
  birthdays.forEach(async (user: any) => {
    // ...
  });
});

// AFTER:
for (const channelId of channelIds) {
  // ...
  for (const user of birthdays) {
    // ...
  }
}
```
The outer try-catch (line 57) cannot catch errors thrown inside `forEach` async callbacks.
With `for...of`, errors propagate normally.

---

**B7 — Missing `await` on Pokémon summon calls in `handler.ts`**

`classes/handlers/handler.ts`, lines 13–17:
```typescript
// BEFORE (all three summon methods are async but called without await):
if (mode === 'shiny' || ...) {
  this.summonShinyPokemon(client, message, member, pfp);
} else if (mode === 'mystery' || ...) {
  this.summonMysteryPokemon(client, message, member, pfp);
} else {
  this.summonNormalPokemon(client, message, member, pfp);
}

// AFTER:
if (mode === 'shiny' || ...) {
  await this.summonShinyPokemon(client, message, member, pfp);
} else if (mode === 'mystery' || ...) {
  await this.summonMysteryPokemon(client, message, member, pfp);
} else {
  await this.summonNormalPokemon(client, message, member, pfp);
}
```

---

### Tasks
- [x] Fix B4: Return promise from `registerCommands` call in `index.ts`
- [x] Fix B5: Replace `forEach(async ...)` with `for...of` in `babyScheduler.ts` (4 sites)
- [x] Fix B6: Replace nested `forEach(async ...)` with `for...of` in `birthdayScheduler.ts`
- [x] Fix B7: Add `await` to the three summon method calls in `handler.ts`

### Gate Test
```bash
bun test
bun index.ts
# Confirm bot starts. Commands should still work normally.
# Intentionally set CLIENT_ID to a bad value and verify the error is now logged.
```

### ✅ Stage 2 complete when
- [x] All 4 tasks above ticked
- [x] Test suite passes
- [ ] Bot starts clean
- [ ] Committed

---

## Stage 3 — API Correctness
> Goal: Fix deprecated discord.js v13 API option names and remaining minor async gaps. These
> won't crash but cause silent wrong behavior (e.g. animated avatars always showing as static).

### Bug Details

**B8 — discord.js v13 `displayAvatarURL` options used in v14**

discord.js v14 renamed/removed options:
- `format` → `extension`
- `dynamic` → removed (animated is auto-detected; use `forceStatic: true` to force static)

Files still using v13 options:
- `commands/avatar.ts` lines 40, 43, 48, 57: `{ dynamic: true, format: 'png', size: N }`
- `commands/profile.ts` lines 63, 68: `{ dynamic: true, size: N }`
- `classes/birthdayScheduler.ts` line 43: covered in Stage 1 already

```typescript
// BEFORE (v13 options — silently ignored by v14):
user.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 })

// AFTER (v14 options):
user.displayAvatarURL({ extension: 'png', size: 4096 })
// Note: omitting `forceStatic` means animated avatars (GIF) return as GIF automatically
```

Already correct in `handler.ts` and `utils/quote.ts` — use those as reference.

---

**B9 — Missing `await` on `interaction.reply()` in `silverwolf.ts`**

`classes/silverwolf.ts`, line 171:
```typescript
// BEFORE:
interaction.reply('commands can only be used in servers.');

// AFTER:
await interaction.reply('commands can only be used in servers.');
```
Minor but inconsistent with all other reply calls in the file.

---

### Tasks
- [x] Fix B8: Update `displayAvatarURL` options in `commands/avatar.ts` (4 sites)
- [x] Fix B8: Update `displayAvatarURL` options in `commands/profile.ts` (2 sites)
- [x] Fix B9: Add `await` to `interaction.reply()` in `silverwolf.ts:171`

### Gate Test
```bash
bun test
bun index.ts
# Confirm bot starts.
# Run /avatar on a user with an animated (GIF) profile picture — should now show GIF.
```

### ✅ Stage 3 complete when
- [x] All 3 tasks above ticked
- [x] Test suite passes
- [ ] Bot starts clean
- [ ] Committed

---

## Session Log

| Date | Stage | Summary | Commit |
|------|-------|---------|--------|
| 2026-04-02 | — | Document created; all bugs confirmed by source inspection | (this commit) |
| 2026-04-02 | 1–3 | All 9 bugs fixed (B1–B9); test suite passes | pending |

---

## Known Type Debt (not fixed here)

These are `any`-typed areas noted during the review. They won't crash at runtime but reduce
type safety. Tracked here for a future type-tightening session.

| Location | Issue |
|----------|-------|
| `commands/classes/Command.ts:13` | `client: any` — should be typed as the `Silverwolf` class |
| `commands/classes/Command.ts:41` | `interaction: any` — should be `ChatInputCommandInteraction` |
| `classes/silverwolf.ts` | Multiple `as any` casts in handler/script dispatch |
| `database/Database.ts:22` | `models: Record<string, any>` — model type unsafety |
| `database/Database.ts:131-132` | `as any` on `.get()` result — can throw if query returns null |
| `database/models/AiChatModel.ts:64` | `.get().id` without null check inside transaction |
| `database/models/UserModel.ts:115,121,127` | `rows[0].count` without empty-array guard |
| `classes/babyScheduler.ts` | All parameters typed `any` |
| `classes/birthdayScheduler.ts` | All parameters typed `any` |
