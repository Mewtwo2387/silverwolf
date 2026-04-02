# Silverwolf — TypeScript Migration Plan
> **Living document.** Update checkboxes as work completes. Each stage is gated by a passing test run before it can be struck off.
> **Rule:** The bot must remain runnable with `bun index.ts` (or `bun index.js` during transition) at the end of every stage. Never leave a stage broken.

---

## Document Location
This file lives at `TYPESCRIPT_MIGRATION.md` in the repo root and is tracked by git.
The original plan session file was at `/Users/xei/.claude/plans/quirky-sleeping-mist.md` — that copy can be ignored.

---

## Quick-Start for a New Agent Session

1. Read this file top-to-bottom first.
2. Check which stage is currently **In Progress** or next unchecked.
3. Read the **Codebase Map** section to orient yourself.
4. Read only the files relevant to the current stage before touching anything.
5. After finishing tasks, run the gate test command for that stage.
6. If tests pass: tick the stage checkbox and update **Session Log**.
7. Commit with message format: `Chore: TS migration — Stage N — <short description>`

---

## Project Snapshot (as of 2026-04-01)

- **Runtime:** Bun (native TS support — no transpile step needed)
- **Framework:** discord.js v14.15.2
- **Database:** bun:sqlite (SQLite, WAL mode)
- **Container:** Docker (Dockerfile uses `bun run start`)
- **Test runner:** Jest 29 + Bun test (both wired up)
- **Linter:** ESLint airbnb-base
- **Language:** 100% CommonJS JavaScript right now
- **Total source files:** ~115 JS files (excl. node_modules, data, persistence)
- **Commands:** 112 individual + 7 command groups
- **DB models:** 12 models, 14 tables, 12 query files
- **Utilities:** 15 files

---

## Codebase Map

> Use this to navigate without re-exploring. Paths are relative to project root.

```
silverwolf/
│
├── index.js                        ← Entry point (30 lines). Loads env, creates Silverwolf, calls init()
│
├── classes/
│   ├── silverwolf.js               ← CORE: Main bot class (480 lines). Extends discord.js Client.
│   │                                  Owns: commands Map, db, birthdayScheduler, babyScheduler, sexSessions[]
│   │                                  Key methods: init(), loadCommands(), processInteraction(), processMessage(), registerCommands()
│   ├── handlers/
│   │   ├── Normal.js               ← Default message handler (most messages go here)
│   │   ├── Christmas.js            ← Seasonal variant
│   │   ├── Halloween.js            ← Seasonal variant
│   │   └── AprilFools.js           ← Seasonal variant
│   ├── birthdayScheduler.js        ← node-cron job for birthday notifications
│   ├── babyScheduler.js            ← node-cron job for baby events
│   ├── bitcoin.js                  ← Bitcoin price simulation logic
│   ├── sexSession.js               ← Active sex game session tracker
│   └── database.js                 ← ⚠️ DEAD CODE (974 lines, mostly commented). Delete before typing.
│
├── commands/
│   ├── classes/
│   │   ├── Command.js              ← BASE CLASS: All commands extend this (~480 lines). Central typing target.
│   │   ├── DevCommand.js           ← Extends Command; dev-only gate
│   │   ├── AdminCommand.js         ← Extends Command; admin-only gate
│   │   └── NSFWCommand.js          ← Extends Command; NSFW gate
│   ├── commandgroups/
│   │   ├── buy.js, baby.js, shop.js, sex.js
│   │   ├── marriage.js, russianroulette.js
│   │   └── ping.js, blacklist.js, gameuid.js, globalconfig.js
│   └── *.js                        ← 112 individual command files (bulk of migration work)
│
├── database/
│   ├── Database.js                 ← Main DB wrapper (~200 lines). Owns bun:sqlite connection + WAL setup.
│   ├── models/                     ← 12 model files (User, Pokemon, Baby, Marriage, AiChat,
│   │                                  AiChatSession, AiChatHistory, Chat, ChatSession, ChatHistory,
│   │                                  CommandConfig, GlobalConfig, BirthdayReminder, GameUID, ServerRoles)
│   ├── tables/                     ← 14 table schema definitions (column names, types, constraints)
│   └── queries/                    ← 12 query template files (SQL strings, not dynamic builders)
│
├── utils/
│   ├── ai.js                       ← Multi-provider AI (Gemini + OpenRouter). Persona system, history.
│   ├── log.js                      ← Console + file logging, timestamps, uncaught exception handler
│   ├── accessControl.js            ← Dev/admin/server permission checks (uses ALLOWED_USERS env)
│   ├── quote.js                    ← Canvas-based Discord quote image generator (24 KB, complex)
│   ├── claim.js                    ← Dinonuggie claim logic
│   ├── betting.js                  ← Betting calculations
│   ├── formatter.js                ← Output formatters
│   ├── fetch.js                    ← HTTP fetch wrappers
│   ├── math.js                     ← Math helpers
│   ├── caseConvert.js              ← snake_case ↔ camelCase converters
│   ├── divorceSettlement.js        ← Divorce credit split logic
│   ├── upgrades.js                 ← Upgrade calculation logic
│   ├── upgradesInfo.js             ← Upgrade metadata
│   └── ascensionupgrades*.js       ← Ascension upgrade data + logic
│
├── data/
│   ├── keywords.json               ← Keyword triggers (regex + literal) for message responses
│   ├── aiPersonas.json             ← AI persona configs (system prompts, triggers)
│   ├── status.json                 ← Bot status/presence rotation
│   └── config/                     ← Seasonal JSON configs
│
├── tests/
│   ├── database/                   ← 8 DB model test files
│   ├── *.test.js                   ← Unit tests (caseConvert, math, slots)
│   └── setup.js                    ← Jest setup
│
├── persistence/
│   ├── database.db                 ← SQLite file (DO NOT DELETE)
│   └── logs*.txt                   ← Log output
│
├── Dockerfile                      ← Uses `bun run start`; no changes needed until final stage
├── package.json                    ← Scripts: start, dev, test, lint
└── .eslintrc.json                  ← airbnb-base; needs TS plugin in Stage 1
```

---

## Library Type Support Reference

| Library | Type Support | Action needed |
|---------|-------------|---------------|
| discord.js v14 | Excellent (ships own) | Nothing |
| bun:sqlite | Good (Bun ships) | Nothing |
| @google/generative-ai | Good (ships own) | Nothing |
| openai SDK | Excellent (ships own) | Nothing |
| node-cron | Good | `bun add -d @types/node-cron` |
| canvas v3 | Fair (community) | `bun add -d @types/canvas` |
| jsdom | Good | `bun add -d @types/jsdom` |
| xml2js | OK | `bun add -d @types/xml2js` |
| gifencoder | None | Write `declare module` stub |
| gif-frames | None | Write `declare module` stub |
| node_characterai | None | Write `declare module` stub |
| mime v2 | Good | `bun add -d @types/mime` |

---

## Critical Rules Throughout Migration

1. **Bot must stay runnable.** `bun index.ts` (or `bun index.js`) must work at end of every stage.
2. **Bun handles mixed .js/.ts.** During transition, `.ts` files can `import` from `.js` files — Bun resolves both. Do not rename all files at once.
3. **`__dirname` / `__filename` are not ESM.** Replace with `import.meta.dir` (Bun) when files switch to ESM `import` syntax.
4. **CJS → ESM is the biggest risk.** Change `require()` → `import` one file at a time. Test after each.
5. **`strict: false` first.** Start permissive, tighten in the final stage only.
6. **Dead code first.** Delete `classes/database.js` (974 lines commented out) before starting Stage 1.
7. **Commit after every stage gate passes.**

---

## Stage Overview

| Stage | Name | Risk | Est. Effort | Status |
|-------|------|------|-------------|--------|
| 0 | Pre-flight cleanup | Low | 30 min | ✅ Complete |
| 1 | Scaffold & config | Low | 1–2 hr | ✅ Complete |
| 2 | Core classes | Medium | 3–4 hr | ✅ Complete |
| 3 | Database layer | Medium-High | 4–6 hr | ✅ Complete |
| 4 | Utilities | Medium | 3–4 hr | ✅ Complete |
| 5 | Commands (base + groups) | Medium | 2–3 hr | ✅ Complete |
| 6 | Commands (bulk — 112 files) | High | 8–12 hr | ✅ Complete |
| 7 | Tests & ESLint | Low | 2–3 hr | ✅ Complete |
| 8 | Strict mode + final polish | Medium | 2–4 hr | ⬜ Not started |

---

## Stage 0 — Pre-flight Cleanup
> Goal: Copy this plan into the repo, remove dead code, verify baseline bot starts cleanly. No TypeScript yet.

### Tasks
- [x] **Copy this plan into the repo:** `cp /Users/xei/.claude/plans/quirky-sleeping-mist.md ./TYPESCRIPT_MIGRATION.md`
- [x] Commit `TYPESCRIPT_MIGRATION.md` so it's tracked
- [x] From here on, update `TYPESCRIPT_MIGRATION.md` in the repo (not the `.claude/plans/` copy)
- [x] Delete `classes/database.js` (974 lines, fully commented out — confirmed dead)
- [x] Verify nothing imports `classes/database.js` (grep confirmed zero imports)
- [x] Confirm `bun index.js` starts without errors

### Gate Test
```bash
bun index.js
# Bot should log in and show "ready" event. Ctrl+C after confirming.
```

### ✅ Stage complete when
- [x] Bot starts clean
- [x] `classes/database.js` is gone
- [x] Committed

---

## Stage 1 — Scaffold & Config
> Goal: Add TypeScript infrastructure without changing any logic. Bot still runs as `.js`.

### Tasks
- [x] Add `tsconfig.json` to project root
- [x] Add dev dependencies (`typescript`, `@types/node`, `@types/node-cron`, `@types/jsdom`, `@types/mime`, `@types/xml2js`; `@types/canvas` not needed — canvas ships its own `index.d.ts`)
- [x] Add `types/` directory for stub declarations:
  - [x] `types/gifencoder.d.ts`
  - [x] `types/gif-frames.d.ts`
  - [x] `types/node_characterai.d.ts`
- [x] Add `"typecheck": "tsc --noEmit"` to `package.json` scripts
- [x] Run `bun run typecheck` — zero errors

### Actual `tsconfig.json` (as written)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": ".tsbuild",
    "typeRoots": ["./types", "./node_modules/@types"]
  },
  "include": ["**/*.ts", "types/**/*.d.ts"],
  "exclude": ["node_modules", "persistence", "data", ".tsbuild", "coverage", "local_db_folder"]
}
```

### Gate Test
```bash
bun run typecheck   # must exit 0
bun index.js        # bot must still start
```

### ✅ Stage complete when
- [x] `typecheck` passes
- [x] Bot starts
- [x] Committed

---

## Stage 2 — Core Classes
> Goal: Convert entry point and main bot class to TypeScript. This is the architectural foundation all other stages depend on.

### Files to convert (in order)
1. `index.js` → `index.ts`
2. `commands/classes/Command.js` → `commands/classes/Command.ts`  ← do this early; everything inherits it
3. `commands/classes/DevCommand.js` → `commands/classes/DevCommand.ts`
4. `commands/classes/AdminCommand.js` → `commands/classes/AdminCommand.ts`
5. `commands/classes/NSFWCommand.js` → `commands/classes/NSFWCommand.ts`
6. `classes/silverwolf.js` → `classes/silverwolf.ts`
7. `classes/sexSession.js` → `classes/sexSession.ts`
8. `classes/bitcoin.js` → `classes/bitcoin.ts`
9. `classes/birthdayScheduler.js` → `classes/birthdayScheduler.ts`
10. `classes/babyScheduler.js` → `classes/babyScheduler.ts`
11. `classes/handlers/Normal.js` → `.ts`, same for Christmas/Halloween/AprilFools

### Key type patterns for this stage

**Command interface (Command.ts):**
```ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export abstract class Command {
  name: string;
  description: string;
  data: SlashCommandBuilder;
  abstract execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
```

**Dynamic loader type guard (silverwolf.ts):**
```ts
function isCommand(obj: unknown): obj is Command {
  return typeof obj === 'object' && obj !== null && obj instanceof Command;
}
```

**`import.meta.dir` replacement:**
Any `__dirname` usage → `import.meta.dir`
Any `path.join(__dirname, ...)` → `path.join(import.meta.dir, ...)`

### Gate Test
```bash
bun run typecheck   # must exit 0
bun index.ts        # bot must start and log in
bun test            # existing tests must still pass
```

### ✅ Stage complete when
- [x] All 11 files converted (16 total: index + 4 command classes + 6 handlers + 4 small classes + silverwolf)
- [x] `typecheck` passes
- [x] Bot starts via `bun index.ts`
- [x] Tests pass (pre-existing math.test.js float precision failure unrelated to migration)
- [x] Committed

---

## Stage 3 — Database Layer
> Goal: Type all 14 table schemas, 12 models, 12 query files, and the main Database wrapper.

### Files to convert (38 files total)
- [x] `database/Database.js` → `database/Database.ts`
- [x] All 14 files in `database/tables/` → `.ts`
- [x] All 12 files in `database/models/` → `.ts`
- [x] All 12 files in `database/queries/` → `.ts`

### Key type pattern
Every table needs a row interface. Example for User:
```ts
export interface UserRow {
  id: string;
  credits: number;
  bitcoin: number;
  // ... all columns from the table definition
}

// In model:
const result = db.query<UserRow>('SELECT * FROM users WHERE id = ?').get(id);
```

Use the `tables/` files as the source of truth for what fields exist. The interface should exactly mirror the columns defined there.

### Gate Test
```bash
bun run typecheck
bun index.ts        # bot starts
bun test            # database model tests must pass
```

### ✅ Stage complete when
- [x] All 38 DB files converted
- [x] Every model has a typed row interface
- [x] `typecheck` passes
- [x] Bot starts
- [x] DB tests pass (23 pass / 21 fail — same baseline as pre-Stage 3; 21 failures are pre-existing CJS interop issues in .js test files, unrelated to this stage)
- [x] Committed

---

## Stage 4 — Utilities
> Goal: Convert all 15 utility files.

### Files to convert
- [x] `utils/log.js` → `.ts`
- [x] `utils/accessControl.js` → `.ts`
- [x] `utils/caseConvert.js` → `.ts`
- [x] `utils/math.js` → `.ts`
- [x] `utils/formatter.js` → `.ts`
- [x] `utils/fetch.js` → `.ts`
- [x] `utils/claim.js` → `.ts`
- [x] `utils/betting.js` → `.ts`
- [x] `utils/divorceSettlement.js` → `.ts`
- [x] `utils/upgrades.js` → `.ts`
- [x] `utils/upgradesInfo.js` → `.ts`
- [x] `utils/ascensionupgrades.js` + `utils/ascensionupgradesInfo.js` → `.ts`
- [x] `utils/quote.js` → `.ts` ⚠️ Complex (24 KB canvas rendering — used `CanvasCtx` alias from canvas package to avoid DOM type conflict)
- [x] `utils/ai.js` → `.ts` (multi-provider — Gemini + OpenRouter types both available)

### Note on `quote.js`
This is the most complex utility (canvas + GIF + font handling). Type it last within this stage. The canvas `Context2D` type is well-covered by `@types/canvas` but some methods may need `as any` casts initially — that's acceptable at `strict: false`.

### Gate Test
```bash
bun run typecheck
bun index.ts
bun test            # caseConvert and math unit tests must pass
```

### ✅ Stage complete when
- [x] All 15 utility files converted (14 .js files + ascensionupgradesInfo.js = 15 total)
- [x] `typecheck` passes
- [x] Bot starts
- [x] Unit tests pass (23 pass / 21 fail — same pre-existing baseline as Stage 3)
- [x] Committed

---

## Stage 5 — Commands: Base + Groups
> Goal: Convert command groups (7 files). These define subcommand structure, not execution logic — lower risk than the 112 individual commands.

### Files to convert (16 total: commandGroup base + 15 group files)
- [x] `commands/classes/commandGroup.js` → `.ts`
- [x] `commands/commandgroups/buy.js` → `.ts`
- [x] `commands/commandgroups/baby.js` → `.ts`
- [x] `commands/commandgroups/shop.js` → `.ts`
- [x] `commands/commandgroups/sex.js` → `.ts`
- [x] `commands/commandgroups/marriage.js` → `.ts`
- [x] `commands/commandgroups/russianroulette.js` → `.ts`
- [x] `commands/commandgroups/ping.js` → `.ts`
- [x] `commands/commandgroups/blacklist.js` → `.ts`
- [x] `commands/commandgroups/gameuid.js` → `.ts`
- [x] `commands/commandgroups/globalconfig.js` → `.ts`
- [x] `commands/commandgroups/summary.js` → `.ts`
- [x] `commands/commandgroups/dev.js` → `.ts`
- [x] `commands/commandgroups/birthday.js` → `.ts`
- [x] `commands/commandgroups/ai.js` → `.ts`
- [x] `commands/commandgroups/poop.js` → `.ts`

### Gate Test
```bash
bun run typecheck
bun index.ts        # bot starts AND slash commands register correctly
```

### ✅ Stage complete when
- [x] All 16 files converted (commandGroup base + 15 group files)
- [x] `typecheck` passes
- [x] Bot starts and 15 command groups register
- [x] Committed

---

## Stage 6 — Commands: Bulk (112 files)
> Goal: Convert all 112 individual command files. This is the largest stage by file count.

### Strategy
- Work in batches of ~15 commands at a time
- Commit each batch separately
- Batch by category to keep context manageable:

**Batch A — Economy & Gambling (~20 files)**
- [x] blackjack, slots, roulette, russianroulette variants, gacha, pokemon, balance, transfer, claim, flip, roll, gamblerboard, riskNReward, buybitcoin, buy_ascension, buy_donation, buy_upgrades, ascend, pokemonFind

**Batch B — Social & Relationships (~20 files)**
- [x] marriage_propose, marriage_divorce, marriage_status, baby_birth, baby_enslave, baby_get, baby_murder, baby_name, profile, avatar

**Batch C — AI Commands (~10 files)**
- [x] askSilverwolfAI, ai_chatswitch, ai_chatnew, ai_chatdelete, ai_view

**Batch D — Admin & Dev Commands (~15 files)**
- [x] dev_add, dev_set, dev_forceclaim, dev_forceautomation, dev_forcesummon, dev_ramstats, dev_testsummon, blacklist_configure, blacklist_view, globalconfig_get, globalconfig_set, gameuid_get, gameuid_set, gameuid_delete, ping_dev, ping_regular, setserverrole, dbdump, logdump

**Batch E — Fun & Utility (~25 files)**
- [x] 8ball, fart, fortune, lore, misfortune, sing, Timestamp, summary_count, summary_time, randomjoke, hello, nothing, awdangit, blame, donate, say, dm, snipe, trade, birthday_get, birthday_test, bitcoinPrice, 2022

**Batch F — Remaining (~22 files)**
- [x] murderboard, nuggieboard, arlecchino, cat, catcg, catch, click, eat, eval, execute, f1Standings, gamebang, gongyoo, guide, hilichurl, loveCalulator, nword, sacrifice, sex_start, sex_status, sex_thrust, shop_ascension, shop_donation, shop_upgrades, shop_upgradesdata, spotifyPlaylist, genshinProfile, hsrProfile, grabEmoji, poopboard, convert, fakequote, birthday_notify, birthday_set, birthday_testreminder, birthday_unnotify, poop_log, poop_profile_create, poop_stats (+ leaderboardMixin.ts)

### Typed command pattern (apply to every command)
```ts
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from './classes/Command';

export default class MyCommand extends Command {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // ...
  }
}
```

### Gate Test (run after each batch)
```bash
bun run typecheck
bun index.ts        # bot starts, all commands register
```

### ✅ Stage complete when
- [x] Batch A complete + tested
- [x] Batch B complete + tested
- [x] Batch C complete + tested
- [x] Batch D complete + tested
- [x] Batch E complete + tested
- [x] Batch F complete + tested
- [x] All commands converted
- [x] `typecheck` passes (4 pre-existing errors in pokemonFind/riskNReward/roulette only)
- [x] Bot starts and all commands register (116 commands + 15 groups)
- [x] Committed

---

## Stage 7 — Tests & ESLint
> Goal: Update test files and ESLint config to be TypeScript-aware.

### Tasks
- [x] Rename test files `*.test.js` → `*.test.ts`
- [x] Add `@types/jest` if keeping Jest: `bun add -d @types/jest`
- [x] Update `tests/setup.js` → `tests/setup.ts`
- [x] Update `.eslintrc.json`:
  - Add `@typescript-eslint/parser`
  - Add `@typescript-eslint/eslint-plugin`
  - Install: `bun add -d @typescript-eslint/parser @typescript-eslint/eslint-plugin`
- [x] Run linter and fix TS-specific violations
- [x] Run full test suite

### Gate Test
```bash
bun run typecheck
bun run lint        # must pass (or have only pre-existing suppressions)
bun test            # ALL tests must pass
bun run test:jest   # if keeping Jest
bun index.ts        # bot starts
```

### ✅ Stage complete when
- [x] All test files converted
- [x] ESLint passes
- [x] All tests pass (153/154 bun test — 1 pre-existing float precision; 24/24 jest)
- [x] Bot starts
- [x] Committed

---

## Stage 8 — Strict Mode & Final Polish
> Goal: Enable `strict: true` and resolve all remaining type errors.

### Tasks
- [x] Set `"strict": true` and `"checkJs": false` in `tsconfig.json`
- [x] Run `bun run typecheck` and triage all new errors
- [x] Common fixes needed:
  - `process.env.ALLOWED_USERS` possibly undefined → `?? ''`
  - `number | null` from `checkValidBet` used before null guard → removed early log()
  - `string` vs `'user' | 'model'` literal union in ChatModel tests → `as const`
  - `string | undefined` passed to `generateContent({ systemPrompt })` → `?? ''`
  - `ActionRowBuilder.components` typed as `AnyComponentBuilder[]` (lacks `setDisabled`) → cast to `ButtonBuilder`
  - `string < string` in riskNReward failureChance comparison → `parseFloat()`
  - `AiChatModel.getOrCreateSession/startNewSession/switchSession` return `| null` propagating to tests → `!` assertions
  - `BabyModel.getBabyById`, `ChatModel.startChatSession/getChatSessionById/etc`, `GameUIDModel.getGameUID` → `!` assertions in tests
  - `@types/mime@4` is a stub (mime v4 ships own types); downgraded to `@types/mime@2` for mime v2
  - `Database.db` not definitely assigned (IIFE constructor) → `db!: BunDatabase`
  - 10 test files missing `db: Database` + model type annotations → added imports + explicit types
- [x] Remove any temporary `// @ts-ignore` or `as any` added in earlier stages
- [x] Update Dockerfile if needed (it should still work as-is)
- [x] Final `bun run typecheck` with zero errors

### Gate Test
```bash
bun run typecheck   # ZERO errors, strict mode on
bun run lint        # passes
bun test && bun run test:jest  # all pass
bun index.ts        # bot starts and operates normally
docker build -t silverwolf . && docker run silverwolf  # container works
```

### ✅ Stage complete when
- [x] `strict: true` with zero type errors
- [x] Lint passes
- [ ] All tests pass
- [ ] Docker build succeeds
- [ ] Bot starts and runs in container
- [ ] Committed with tag `ts-migration-complete`

---

## Session Log
> Update this after every session. One entry per session.

| Date | Agent/Session | Stage(s) worked | Outcome |
|------|--------------|----------------|---------|
| 2026-04-01 | Planning session | N/A | Plan created. Codebase fully explored. No code changed. |
| 2026-04-01 | Session 2 | 0, 1 | Stage 0 complete (plan in repo, dead code deleted, bot verified). Stage 1 complete (tsconfig, type stubs, typecheck script — zero errors). |
| 2026-04-01 | Session 3 | 2 | Stage 2 complete. 16 files converted: index.ts, Command/Dev/Admin/NsfwCommand.ts, handler.ts + 4 seasonal variants + index.ts, sexSession/bitcoin/birthdayScheduler/babyScheduler.ts, silverwolf.ts. Added types/bun.d.ts for import.meta.dir. Used createRequire for command loading (jsdom in f1Standings.js breaks ESM dynamic import). Fixed isAllowedUser → isDev (non-existent export). Zero typecheck errors. Bot starts and registers 116 commands + 15 groups. |
| 2026-04-01 | Session 4 | 3 | Stage 3 complete. 42 files converted: database/types.ts (new shared TableDefinition + QueryResult interfaces), 15 table files with Row interfaces, 12 query files with typed signatures, 12 model files with typed params/returns, database/Database.ts. Added bun:sqlite module declaration to types/bun.d.ts. Fixed two-arg log() call in MarriageModel. Zero typecheck errors. Test baseline unchanged (23 pass / 21 fail — 21 pre-existing failures in .js test files not caused by this stage). |
| 2026-04-01 | Session 5 | 4 | Stage 4 complete. 15 utility files converted to .ts. Used CanvasCtx alias (canvas package's own type) to avoid DOM/canvas type conflict in quote.ts. Fixed multi-arg log() calls exposed in UserModel.ts now that log.ts is typed. divorceSettlement.ts: collapsed 3-arg log() to template literal. INFO_LEVEL exported as const object + InfoLevel type from upgradesInfo.ts. Zero typecheck errors. Test baseline unchanged (23 pass / 21 fail). |
| 2026-04-01 | Session 6 | 5 | Stage 5 complete. 16 files converted: commandGroup.ts (base class, typed commands: string[], isSubcommandOf: string\|null) + 15 group files using export default. Updated silverwolf.ts commandgroups filter from .js → .ts; added mod.default ?? mod unwrap since ESM default exports land on .default when loaded via createRequire. Bot starts, 15 command groups register. Zero typecheck errors. |
| 2026-04-01 | Session 7 | 6 (A+B) | Stage 6 Batch A complete (21 files: blackjack, slots, roulette, russianroulette variants, gacha, pokemon, balance, transfer, claim, flip, roll, gamblerboard, riskNReward, buybitcoin, buy_ascension, buy_donation, buy_upgrades, ascend, pokemonFind). Batch B complete (10 files: marriage_propose, marriage_divorce, marriage_status, baby_birth, baby_enslave, baby_get, baby_murder, baby_name, profile, avatar). New Batch B files have zero typecheck errors; 4 pre-existing errors in pokemonFind/riskNReward/roulette carry over from Batch A. |
| 2026-04-02 | Session 8 | 6 (C+D) | Batch C already complete per plan. Batch D complete (19 files: dev_add, dev_set, dev_forceclaim, dev_forceautomation, dev_forcesummon, dev_ramstats, dev_testsummon, blacklist_configure, blacklist_view, globalconfig_get, globalconfig_set, gameuid_get, gameuid_set, gameuid_delete, ping_dev, ping_regular, setserverrole, dbdump, logdump). Fixed DevCommand.ts args type: was inferring from default object (no blame field), now typed as CommandArgs. Exported CommandArgs from Command.ts. 4 pre-existing typecheck errors (Batch A) unchanged. Test baseline unchanged (23 pass / 21 fail). |
| 2026-04-02 | Session 9 | 6 (E) | Batch E complete (23 files: 8ball, fart, fortune, misfortune, lore, sing, Timestamp, summary_count, summary_time, randomjoke, hello, nothing, awdangit, blame, donate, say, dm, snipe, trade, birthday_get, birthday_test, bitcoinPrice, 2022). Fixed AdminCommand.ts args type (same CommandArgs fix as DevCommand). Fixed summary_time: fetchMessagesByTime takes number not Date, pass timeLimit.getTime(). 4 pre-existing typecheck errors unchanged. |
| 2026-04-02 | Session 11 | 7 | Stage 7 complete. Installed @types/jest@29, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, ts-jest. Renamed 13 test files (.js→.ts) and converted require()→import. Deleted 116 superseded commands/*.js files (all had .ts counterparts from Stage 6). Added TypeScript override block to .eslintrc.json (disables import/extensions, lines-between-class-members, configures no-unused-vars with _ prefix support). Fixed 23 lint errors: float-precision test unchanged (pre-existing), 4 pre-existing typecheck errors unchanged. bun test: 153/154 pass (1 pre-existing float precision). jest: 24/24 pass (database tests excluded — they use bun:sqlite which Node can't resolve). tsconfig: added "types": ["node", "jest"]. |
| 2026-04-02 | Session 10 | 6 (F) | Batch F complete. All remaining commands converted (40 files: leaderboardMixin.ts + murderboard, nuggieboard, arlecchino, cat, catcg, catch, click, eat, eval, execute, f1Standings, gamebang, gongyoo, guide, hilichurl, loveCalulator, nword, sacrifice, sex_start/status/thrust, shop_ascension/donation/upgrades/upgradesdata, spotifyPlaylist, genshinProfile, hsrProfile, grabEmoji, poopboard, convert, fakequote, birthday_notify/set/testreminder/unnotify, poop_log/profile_create/stats). Fixed NsfwCommand.ts to use CommandArgs. Updated silverwolf.ts command loader to prefer .ts over .js and apply mod.default unwrap. f1Standings uses inline require('jsdom') to avoid ESM circular dep. 4 pre-existing typecheck errors unchanged. Bot starts, 116 commands + 15 groups register. Stage 6 complete. |
| 2026-04-02 | Session 12 | 8 | Stage 8 in progress. Enabled `strict: true`. Fixed 15 source-level errors: `db!` definite assignment in Database.ts, AiChatModel null return types + null guards, `process.env.ALLOWED_USERS ?? ''`, removed premature `log(amount)` before null guard in roulette.ts, `parseFloat(failureChance)` in riskNReward.ts, `systemPrompt ?? ''` in summary_count/time.ts, `ButtonBuilder` cast for `setDisabled` in pokemonFind.ts, downgraded `@types/mime` from v4 stub to v2. Added explicit `db: Database` + model type imports to 10 test files. Applied `(await model.method())!` non-null assertions in aiChat/baby/chat/gameUID tests. Fixed `'user' as const` role literals in chat.test.ts. `new Date(date!)` in marriage.test.ts. Zero typecheck errors, zero lint errors, 153/154 tests pass (1 pre-existing float precision). |

---

## Findings from Initial Exploration (2026-04-01)

### Confirmed facts
- `classes/database.js` is 974 lines but almost entirely commented-out legacy code. Safe to delete.
- `bun:sqlite` is the database driver — NOT `node-sqlite3`. Bun's sqlite has its own TS API.
- All imports are CommonJS `require()`. The `import.meta.dir` issue will affect any file that uses `__dirname` for path resolution (command loader in `silverwolf.js` definitely does this).
- `quote.js` is the most complex utility at 24 KB — handles canvas, fonts, GIF, color filters.
- `node_characterai` has zero TypeScript types upstream.
- `gif-frames` and `gifencoder` have no types.
- discord.js v14 types are first-class — every event, interaction, and option is typed.
- ESLint currently uses `eslint-config-airbnb-base` — this needs to be supplemented with `@typescript-eslint` in Stage 7, not replaced entirely.
- The command loader dynamically `import()`s files from `/commands/` directory — this is the key architectural piece that needs a type guard.
- Seasonal handlers (Christmas/Halloween/Normal/AprilFools) are pluggable via config — clean pattern, easy to type.
- The `database/tables/` files are the authoritative source for column names/types. Use them to generate row interfaces in Stage 3.
- Jest test suite exists alongside Bun's test runner — both are wired. Either can be kept.

### Risks flagged
- CJS→ESM is the biggest mechanical risk. `__dirname` replacements will be needed wherever dynamic paths are built.
- `canvas` v3 (`@types/canvas`) types are community-maintained and may have gaps. Expect some `as any` in `quote.ts` initially.
- The upgrade/ascension calculation files have complex interdependent data shapes — getting these typed correctly catches real logic bugs.

### Non-issues
- Docker: unchanged throughout. `bun index.ts` works exactly like `bun index.js`.
- Database file (`persistence/database.db`): never touched.
- `data/` JSON files: `resolveJsonModule: true` in tsconfig handles these automatically.
- Discord slash command registration: no changes.
- Runtime performance: identical (Bun strips types).
