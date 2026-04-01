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
| 0 | Pre-flight cleanup | Low | 30 min | ⬜ Not started |
| 1 | Scaffold & config | Low | 1–2 hr | ⬜ Not started |
| 2 | Core classes | Medium | 3–4 hr | ⬜ Not started |
| 3 | Database layer | Medium-High | 4–6 hr | ⬜ Not started |
| 4 | Utilities | Medium | 3–4 hr | ⬜ Not started |
| 5 | Commands (base + groups) | Medium | 2–3 hr | ⬜ Not started |
| 6 | Commands (bulk — 112 files) | High | 8–12 hr | ⬜ Not started |
| 7 | Tests & ESLint | Low | 2–3 hr | ⬜ Not started |
| 8 | Strict mode + final polish | Medium | 2–4 hr | ⬜ Not started |

---

## Stage 0 — Pre-flight Cleanup
> Goal: Copy this plan into the repo, remove dead code, verify baseline bot starts cleanly. No TypeScript yet.

### Tasks
- [ ] **Copy this plan into the repo:** `cp /Users/xei/.claude/plans/quirky-sleeping-mist.md ./TYPESCRIPT_MIGRATION.md`
- [ ] Commit `TYPESCRIPT_MIGRATION.md` so it's tracked: `git add TYPESCRIPT_MIGRATION.md && git commit -m "Chore: add TS migration plan"`
- [ ] From here on, update `TYPESCRIPT_MIGRATION.md` in the repo (not the `.claude/plans/` copy)
- [ ] Delete `classes/database.js` (974 lines, fully commented out — confirmed dead)
- [ ] Verify nothing imports `classes/database.js` (grep for it first)
- [ ] Confirm `bun index.js` starts without errors

### Gate Test
```bash
bun index.js
# Bot should log in and show "ready" event. Ctrl+C after confirming.
```

### ✅ Stage complete when
- [ ] Bot starts clean
- [ ] `classes/database.js` is gone
- [ ] Committed

---

## Stage 1 — Scaffold & Config
> Goal: Add TypeScript infrastructure without changing any logic. Bot still runs as `.js`.

### Tasks
- [ ] Add `tsconfig.json` to project root (see config below)
- [ ] Add dev dependencies:
  ```bash
  bun add -d typescript @types/node @types/node-cron @types/canvas @types/jsdom @types/mime @types/xml2js
  ```
- [ ] Add `types/` directory for stub declarations:
  - [ ] `types/gifencoder.d.ts` — `declare module 'gifencoder'`
  - [ ] `types/gif-frames.d.ts` — `declare module 'gif-frames'`
  - [ ] `types/node_characterai.d.ts` — `declare module 'node_characterai'`
- [ ] Update `package.json` scripts:
  - `"start": "bun index.ts"` (will resolve to index.js until renamed)
  - `"typecheck": "tsc --noEmit"`
- [ ] Update `.eslintrc.json` to add TypeScript parser alongside existing rules (keep JS rules working for now)
- [ ] Run `bun run typecheck` — expect zero errors (no TS files yet)

### Recommended `tsconfig.json`
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
    "outDir": ".tsbuild",
    "baseUrl": ".",
    "typeRoots": ["./types", "./node_modules/@types"]
  },
  "include": ["**/*.ts", "**/*.js", "types/**/*.d.ts"],
  "exclude": ["node_modules", "persistence", "data", ".tsbuild", "coverage"]
}
```

### Gate Test
```bash
bun run typecheck   # must exit 0
bun index.js        # bot must still start
```

### ✅ Stage complete when
- [ ] `typecheck` passes
- [ ] Bot starts
- [ ] Committed

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
- [ ] All 11 files converted
- [ ] `typecheck` passes
- [ ] Bot starts via `bun index.ts`
- [ ] Tests pass
- [ ] Committed

---

## Stage 3 — Database Layer
> Goal: Type all 14 table schemas, 12 models, 12 query files, and the main Database wrapper.

### Files to convert (38 files total)
- [ ] `database/Database.js` → `database/Database.ts`
- [ ] All 14 files in `database/tables/` → `.ts`
- [ ] All 12 files in `database/models/` → `.ts`
- [ ] All 12 files in `database/queries/` → `.ts`

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
- [ ] All 38 DB files converted
- [ ] Every model has a typed row interface
- [ ] `typecheck` passes
- [ ] Bot starts
- [ ] DB tests pass
- [ ] Committed

---

## Stage 4 — Utilities
> Goal: Convert all 15 utility files.

### Files to convert
- [ ] `utils/log.js` → `.ts`
- [ ] `utils/accessControl.js` → `.ts`
- [ ] `utils/caseConvert.js` → `.ts`
- [ ] `utils/math.js` → `.ts`
- [ ] `utils/formatter.js` → `.ts`
- [ ] `utils/fetch.js` → `.ts`
- [ ] `utils/claim.js` → `.ts`
- [ ] `utils/betting.js` → `.ts`
- [ ] `utils/divorceSettlement.js` → `.ts`
- [ ] `utils/upgrades.js` → `.ts`
- [ ] `utils/upgradesInfo.js` → `.ts`
- [ ] `utils/ascensionupgrades*.js` → `.ts` (check exact filenames)
- [ ] `utils/quote.js` → `.ts` ⚠️ Complex (24 KB canvas rendering — `@types/canvas` required)
- [ ] `utils/ai.js` → `.ts` (multi-provider — Gemini + OpenRouter types both available)

### Note on `quote.js`
This is the most complex utility (canvas + GIF + font handling). Type it last within this stage. The canvas `Context2D` type is well-covered by `@types/canvas` but some methods may need `as any` casts initially — that's acceptable at `strict: false`.

### Gate Test
```bash
bun run typecheck
bun index.ts
bun test            # caseConvert and math unit tests must pass
```

### ✅ Stage complete when
- [ ] All 15 utility files converted
- [ ] `typecheck` passes
- [ ] Bot starts
- [ ] Unit tests pass
- [ ] Committed

---

## Stage 5 — Commands: Base + Groups
> Goal: Convert command groups (7 files). These define subcommand structure, not execution logic — lower risk than the 112 individual commands.

### Files to convert
- [ ] `commands/commandgroups/buy.js` → `.ts`
- [ ] `commands/commandgroups/baby.js` → `.ts`
- [ ] `commands/commandgroups/shop.js` → `.ts`
- [ ] `commands/commandgroups/sex.js` → `.ts`
- [ ] `commands/commandgroups/marriage.js` → `.ts`
- [ ] `commands/commandgroups/russianroulette.js` → `.ts`
- [ ] Remaining group files → `.ts`

### Gate Test
```bash
bun run typecheck
bun index.ts        # bot starts AND slash commands register correctly
```

### ✅ Stage complete when
- [ ] All 7 command group files converted
- [ ] `typecheck` passes
- [ ] Bot starts and commands register
- [ ] Committed

---

## Stage 6 — Commands: Bulk (112 files)
> Goal: Convert all 112 individual command files. This is the largest stage by file count.

### Strategy
- Work in batches of ~15 commands at a time
- Commit each batch separately
- Batch by category to keep context manageable:

**Batch A — Economy & Gambling (~20 files)**
- [ ] blackjack, slots, roulette, bet, russianroulette variants, gacha, pokemon, balance, transfer, claim

**Batch B — Social & Relationships (~20 files)**
- [ ] marriage, divorce, baby commands, profile, avatar

**Batch C — AI Commands (~10 files)**
- [ ] askSilverwolfAI, ai_chatswitch, ai_chatnew, ai_* variants

**Batch D — Admin & Dev Commands (~15 files)**
- [ ] dev_add, dev_set, dev_forceclaim, blacklist, globalconfig, gameuid

**Batch E — Fun & Utility (~25 files)**
- [ ] 8ball, fart, fortune, lore, misfortune, sing, convert, quote, timestamp, summary, etc.

**Batch F — Remaining (~22 files)**
- [ ] Any uncovered commands

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
- [ ] Batch A complete + tested
- [ ] Batch B complete + tested
- [ ] Batch C complete + tested
- [ ] Batch D complete + tested
- [ ] Batch E complete + tested
- [ ] Batch F complete + tested
- [ ] All 112 commands converted
- [ ] `typecheck` passes
- [ ] Bot starts and all commands register
- [ ] Committed

---

## Stage 7 — Tests & ESLint
> Goal: Update test files and ESLint config to be TypeScript-aware.

### Tasks
- [ ] Rename test files `*.test.js` → `*.test.ts`
- [ ] Add `@types/jest` if keeping Jest: `bun add -d @types/jest`
- [ ] Update `tests/setup.js` → `tests/setup.ts`
- [ ] Update `.eslintrc.json`:
  - Add `@typescript-eslint/parser`
  - Add `@typescript-eslint/eslint-plugin`
  - Install: `bun add -d @typescript-eslint/parser @typescript-eslint/eslint-plugin`
- [ ] Run linter and fix TS-specific violations
- [ ] Run full test suite

### Gate Test
```bash
bun run typecheck
bun run lint        # must pass (or have only pre-existing suppressions)
bun test            # ALL tests must pass
bun run test:jest   # if keeping Jest
bun index.ts        # bot starts
```

### ✅ Stage complete when
- [ ] All test files converted
- [ ] ESLint passes
- [ ] All tests pass
- [ ] Bot starts
- [ ] Committed

---

## Stage 8 — Strict Mode & Final Polish
> Goal: Enable `strict: true` and resolve all remaining type errors.

### Tasks
- [ ] Set `"strict": true` and `"checkJs": false` in `tsconfig.json`
- [ ] Run `bun run typecheck` and triage all new errors
- [ ] Common fixes needed:
  - Null checks on `interaction.guild`, `interaction.member`, `interaction.channel`
  - Optional chaining on Discord.js objects that can be null
  - Return type annotations on async functions
  - `unknown` vs `any` in catch blocks
- [ ] Remove any temporary `// @ts-ignore` or `as any` added in earlier stages
- [ ] Update Dockerfile if needed (it should still work as-is)
- [ ] Final `bun run typecheck` with zero errors

### Gate Test
```bash
bun run typecheck   # ZERO errors, strict mode on
bun run lint        # passes
bun test && bun run test:jest  # all pass
bun index.ts        # bot starts and operates normally
docker build -t silverwolf . && docker run silverwolf  # container works
```

### ✅ Stage complete when
- [ ] `strict: true` with zero type errors
- [ ] Lint passes
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
