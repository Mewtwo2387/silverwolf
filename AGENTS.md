# Silverwolf — Agent / Contributor Technical Reference

**Silverwolf** is a Discord bot (discord.js v14) **and** a public companion website that run **in
the same Bun process**, sharing one SQLite DB. Fun/games ship as both slash commands and web pages;
bot administration is Discord-side only.

**The website is public — security and performance are first-class. Validate every input, never
trust client data, keep the CSP tight.**

**Last updated: 2026-08-04**

> **Maintenance rule.** Edit agent docs only on *substantive architectural* change — new
> architecture, new auth, new data flows/services, schema or security-model changes, or when
> something here becomes factually wrong. Do **not** touch them for routine work (adding a single
> command, page, asset, or a content tweak). Put each fact in the **narrowest-scoped file that
> covers it** — this root file is loaded on every turn of every session, so it stays small and
> holds only what's true everywhere. When you make a qualifying change, bump the date above and
> edit only the affected section. Keep it dense; no fluff.

## Context map

Detail lives in path-scoped rules that load automatically when you open the matching files. Don't
duplicate their content here.

| Working on | Loads |
| ------ | ------ |
| `site_src/**` | `.claude/rules/website.md` — server, middleware order, auth/CSRF, assets, perf |
| `database/**` | `.claude/rules/database.md` — DAO layering, transactions, settings tables |
| `utils/rp*`, `commands/ai_rp_*` | `.claude/rules/roleplay.md` — characters, lorebooks, personas |
| `utils/ai*`, `utils/llmRetry` | `.claude/rules/ai-limits.md` — credit metering, retry policy |
| `Dockerfile`, `.github/**` | `.claude/rules/deploy.md` — CI/CD, image, volumes |

## Commands

Boot locally: `bun install` → create `.env` (see `.env.example`) → `bun run dev`.

- `bun run dev` / `bun run start` — both build CSS+JS first, then run `index.ts`.
- `bun test` — Bun test runner, `tests/` with the `tests/setup.ts` preload (30s default timeout),
  Jest-like API.
- `bun run lint` / `lint:fix` — ESLint (airbnb-base + node + promise).
- `bun run typecheck` — `tsc --noEmit`.
- `bun run build:css` / `build:js` / `build:images` / `build:all` — asset pipeline.

Full script list is in `package.json`; env key names are in `.env.example`. Some settings also live
in the DB `GlobalConfig` table and override/augment env.

## Bot architecture

**Startup** (`index.ts` → `classes/silverwolf.ts`): construct `Silverwolf` (extends discord.js
`Client`) → `init()` loads commands, keywords, listeners; awaits `db.ready`; loads allowed servers;
starts schedulers → `login()` → `registerCommands(CLIENT_ID)` → `startWebsite(silverwolf)`, wrapped
in try/catch so **a website failure is logged and the bot keeps running**. `SIGTERM`/`SIGINT` →
`shutdownMcp()` then exit.

**Adding a command.** One file per command in `commands/`, extending `Command` or `DevCommand`
(`commands/classes/`); auto-discovered on restart by `loadCommands()`. The constructor calls
`super(client, name, description, options[], opts)` where
`opts = { ephemeral, skipDefer, isSubcommandOf, blame }`; implement `async run(interaction)`.
Subcommands: file named `group_sub.ts` with `isSubcommandOf: 'group'`, plus an entry in the group
container at `commands/commandgroups/group.ts`.

`registerCommands()` deploys to Discord: `/server` globally, everything else per-guild, honoring the
per-guild `CommandConfig` blacklist. Call `clearCachedAllowedServers()` after
registering/unregistering a server.

**Access control** (`utils/accessControl.ts`): `isDev` (user ID in `ALLOWED_USERS`), `isAdmin`
(guild admin **or** dev), `isAllowedServer` (guild in `GlobalConfig.allowed_servers`, cached), plus
a global `banned` kill-switch. `DevCommand` enforces `isDev` before running. **There is no website
admin panel — all bot administration is via these Discord commands.**

**Events** (wired in `classes/silverwolf.ts`): `messageCreate` → keyword triggers
(`data/keywords.json`, each mapping to a script in `utils/`), a ~1% random seasonal Pokémon summon
(`classes/handlers/*`), and the roleplay mention router (`utils/rpRuntime.ts`); `interactionCreate`
→ command dispatch + button handlers + autocomplete; message delete/edit tracked for history.

**Schedulers:** `Bun.cron` — birthday announcer (hourly), baby automation (daily + every 10 min);
plus a 30s `setInterval` roleplay scheduler (`classes/rpScheduler.ts`).

**Shared code:** both halves read the same DB and share `utils/` (math, betting, blackjack,
roulette, slots, claim, eat, upgrades, leaderboards, birthdays). `site_src/bot-bridge.ts` is the
bridge for website-facing data access and the leaderboard/birthday cache.

## Security & performance guardrails

Apply everywhere, but read `.claude/rules/website.md` before touching anything public-facing.

- **Validate/whitelist every input.** `Number.isFinite` / `Number.isInteger` / `Math.trunc`, enum
  whitelists, `checkValidBetRaw` for bets. Coerce, then check; reject otherwise.
- **Never interpolate untrusted data** into SQL/HTML/JS. Use prepared statements (`?`), Hono `html`
  auto-escaping, and `inlineJSON()` / `attr()` / `escapeHtml()` for `<script>`/attribute contexts.
- **Never write raw SQL outside `database/queries/`.** Queries use `?` placeholders only.
- **Keep the CSP tight.** Nonce inline scripts; don't add `unsafe-inline` or new external origins
  without cause; extend the `img-src` whitelist deliberately (`middleware/security.ts`).
- **CSRF on every state-changing endpoint** (HTTP + WS). Respect the global rate limiter.
- **Logging:** use `log()` / `logError()` (`utils/log.ts`) → `persistence/`. **Never log secrets.**

## Gotchas

- **No DB migrations.** Schema changes go in `Database.init()` (`CREATE TABLE IF NOT EXISTS` +
  `ALTER TABLE`). See `.claude/rules/database.md`.
- **`persistence/` holds all runtime data** and is the Docker volume — nothing written elsewhere
  survives a redeploy.
- A website crash is caught and logged while the bot continues, so a broken page won't page you via
  a dead bot. Check the logs.
- `canvas` ^3.2 is a native dep needing system build libs — see the `Dockerfile` before bumping it.
- `site_src/Assets/` is lint-ignored, and `app.js`/`styles.css` there are build **outputs**.
