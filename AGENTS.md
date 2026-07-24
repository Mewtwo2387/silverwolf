# Silverwolf — Agent / Contributor Technical Reference

**Silverwolf** is a Discord bot (discord.js v14) **and** a companion website that run **in the same
Bun process**. It serves fun/games both as slash commands and as web pages, plus Discord-side admin
("dev") commands for managing the bot. State lives in a single SQLite DB shared by both halves.
**The website is public, so security and performance are first-class concerns — code defensively:
validate every input, never trust client data, keep the CSP tight.**

**Last updated: 2026-07-02**

> **Maintenance rule.** Edit this file only on *substantive architectural* change — new
> architecture, new auth, new data flows/services, schema or security-model changes, or when
> something here becomes factually wrong. Do **not** touch it for routine work (adding a single
> command, page, asset, or a content tweak). When you make a qualifying change, bump the date above
> and edit only the affected section. Keep it dense; no fluff.

---

## 1. Stack & runtime
- **Runtime:** Bun (also the test runner; auto-loads `.env`, no dotenv). Lockfile `bun.lock`.
- **Language:** TypeScript, strict. `tsconfig.json`: target ES2022, module ESNext,
  moduleResolution `bundler`, typeRoots `./types`. `any` is allowed by lint config.
- **Bot:** `discord.js` ^14.26.
- **Web:** `hono` ^4.12 + Tailwind v3. Server-rendered HTML via Hono's `html` tag (no React).
- **3D:** `three` — powers the Plane Sim game + its model inspector; **self-hosted/bundled, never a
  CDN** (the CSP is `script-src 'self'`) — see §5/§8.
- **DB:** `bun:sqlite` (synchronous), file `persistence/database.db`.
- **AI:** `@google/generative-ai` (Gemini), `openai`, OpenRouter; bot is also an **MCP client**
  (`@modelcontextprotocol/sdk`).
- **Native dep:** `canvas` ^3.2 (image drawing) — needs system build libs (see Docker).
- **Tooling:** ESLint (airbnb-base), Docker, GitHub Actions. No Prettier, no git hooks.
- **Single process:** the bot boots, then starts the website in-process — see §4 and §6.

## 2. Repo layout
| Path | What |
|------|------|
| `index.ts` | Entry point. Boots the client, logs in, registers commands, starts the website. |
| `classes/` | `silverwolf.ts` (the Client subclass), `handlers/` (seasonal Pokémon summon), schedulers. |
| `commands/` | One file per slash command; `classes/` (base classes), `commandgroups/` (subcommand containers). |
| `database/` | `Database.ts` orchestrator; `tables/` (schema), `models/` (DAOs), `queries/` (SQL), `types.ts`. |
| `site_src/` | The Hono website: `server.ts`, `routes/`, `middleware/`, `auth/`, `pages/`, `components/`, `multiplayer/`, `Assets/`, `bot-bridge.ts`. |
| `utils/` | Shared logic + infra: `log.ts`, `accessControl.ts`, `mcp.ts`, game math/betting/etc. |
| `data/` | Static JSON (`keywords.json`, personas, status, config). |
| `persistence/` | Runtime SQLite DB + log files. **Docker volume — the data lives here.** |
| `tests/` | Bun tests + `setup.ts` preload. |
| `scripts/` | Build helpers (`build-images.ts`). |
| `.github/workflows/` | CI/CD (`deploy.yml`, `claude_code*.yml`). |

## 3. Setup & commands
Boot locally: `bun install` → create `.env` (keys below; values in `.env.example`) → `bun run dev`.

`package.json` scripts (verbatim):
- `start` = `bun run build:css && bun run build:js && bun index.ts` — production.
- `dev` = builds CSS + JS, then `bun --watch index.ts` — hot-reload dev.
- `test` / `test:watch` = `bun test [--watch] --preload ./tests/setup.ts`.
- `lint` / `lint:fix` = `eslint . [--fix]`.
- `typecheck` = `tsc --noEmit`.
- `build:css` / `build:css:watch` = compile `site_src/Assets/input.css` → `styles.css` (`--minify`).
- `build:js` = bundle+minify the self-hosted client-JS entrypoints: `app.src.js`→`app.js`, plus the
  Three.js bundles `plane-sim.src.js`→`plane-sim.js`, `plane-viewer.src.js`→`plane-viewer.js` and
  `wave-sim.src.js`→`wave-sim.js`. Outputs are **gitignored** (rebuilt in the Dockerfile);
  a new entrypoint must be added here **and** in the `Dockerfile` build+overlay steps.
- `build:images` = `bun scripts/build-images.ts` (WebP/AVIF variants).

**Env keys** (names only — Bun reads `.env` automatically; see `.env.example`):
`TOKEN`, `CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `SESSION_SECRET`,
`DISCORD_FETCH_TIMEOUT_MS`, `ALLOWED_USERS`, `BIRTHDAY_CHANNELS`, `WEBHOOK_NAME`, `GEMINI_TOKEN`,
`OPENROUTER_API_KEY`, `PUBLIC_ORIGIN`, `NODE_ENV`. Some settings also live in the DB `GlobalConfig`
table (allowed servers, birthday channels, global `banned` kill-switch) and override/augment env.

## 4. Bot architecture
**Startup** (`index.ts` → `classes/silverwolf.ts`): construct `Silverwolf` (extends discord.js
`Client`) → `init()` loads commands, keywords, listeners; awaits `db.ready`; loads allowed servers;
starts schedulers → `login()` → `registerCommands(CLIENT_ID)` → `startWebsite(silverwolf)` (wrapped
in try/catch: a website failure is logged and the **bot keeps running**). `SIGTERM`/`SIGINT` →
`shutdownMcp()` then exit.

**Commands.** Base classes in `commands/classes/`: `Command` (normal), `DevCommand` (dev-gated, see
§ access control), `commandGroup.ts` (`CommandGroup` for subcommands). Conventions:
- One file per command in `commands/`. The constructor calls `super(client, name, description,
  options[], opts)` where `opts = { ephemeral, skipDefer, isSubcommandOf, blame }`; implement
  `async run(interaction)`.
- **Subcommands:** file named `group_sub.ts`, set `isSubcommandOf: 'group'`; the group container
  lives in `commands/commandgroups/group.ts` listing its subcommand names.
- Loading is automatic on (re)start via `loadCommands()` (Bun.Glob over `commands/*.ts`, loaded with
  `createRequire` to avoid ESM circular-import issues). Stored in a Map keyed `name` or
  `group.sub`.
- `registerCommands()` deploys to Discord: `/server` registered globally; everything else per-guild;
  honors the per-guild `CommandConfig` blacklist. Call `clearCachedAllowedServers()` after
  registering/unregistering a server.

**Access control** (`utils/accessControl.ts`): `isDev` (user ID in `ALLOWED_USERS`), `isAdmin`
(guild admin **or** dev), `isAllowedServer` (guild in DB `GlobalConfig.allowed_servers`, cached),
plus a global `banned` flag as an emergency kill-switch. `DevCommand` enforces `isDev` before
running. **There is no website admin panel — all bot administration is via these Discord commands.**

**Events** (wired in `classes/silverwolf.ts`): `messageCreate` → keyword triggers
(`data/keywords.json`, each maps to a script in `utils/`), a ~1% random seasonal Pokémon summon
(`classes/handlers/*` — normal/Christmas/Halloween/April-Fools), and the roleplay mention router
(`utils/rpRuntime.ts`); `interactionCreate` → command dispatch + button handlers + autocomplete
dispatch; message delete/edit tracked for history.

**Schedulers**: `Bun.cron` jobs — birthday announcer (hourly), baby automation (daily + every 10
min); plus a 30s `setInterval` roleplay scheduler (`classes/rpScheduler.ts`).

**Roleplay** (`utils/rp*.ts`, `commands/ai_rp_*.ts`, `db.rp` →
`RpCharacter`/`RpSpawn`/`RpHistory`/`RpLorebook`/`RpPersona`):
user-defined characters (`/ai rp-create-char`) spawned per-channel (`/ai rp-spawn`, ≤5/channel) that
reply through the shared AI webhook as themselves — name + a 128×128 avatar re-hosted in a per-server
asset channel (ServerConfig key `rp_asset_channel`, set via `/ai rp-setasset`; signed CDN URLs are
refreshed from the stored message id). Model `deepseek/deepseek-v4-flash` (reasoning on), no
function-calling, **per-character private history** with auto-compaction (oldest ~80% folded into a
first-person memory) near the 128k window. Spawns are **soft-deleted** so history survives removal/re-spawn. Names allow letters,
numbers, underscores and single spaces (no dashes); `@name` / `@id` / `@name-id` mentions route in
`messageCreate` and match the space-stripped name by prefix (`@SilverWolf` / `@Silver`). `all`-mode
characters also chime in via the scheduler (≤1 reply/channel/tick). Bot/webhook/app messages **are**
heard as context (`RpHistory.from_bot`) — including other characters, whose replies are fed to the
rest of the channel at generation time (`propagateReplyToChannel`) — but only an **unanswered human
turn** ever triggers a reply, so characters can react to each other without an infinite bot-to-bot
loop. An in-memory active-channel set keeps non-RP traffic off the DB. Characters are defined via
command fields **or** an uploaded `.json` (`utils/rpCharInput.ts` — size-capped, parsed in a
try/catch, only the three known string fields read, never spread — the upload attack surface);
`details` is token-capped (~4k), `starting_message` char-capped (6k, split on delivery). `{user}` in
details/starting-message is substituted with the spawner's name in **self**-mode only (left literal
in `all`-mode). **Lorebooks** (`utils/rpLorebook.ts`, `RpLorebook`, `/ai rp-lorebook-add/-remove/-view`,
≤5/character, creator/dev-only editing): `keywords` (.json of `{triggers, context}` entries; plain
word-boundary triggers matched against the un-replied human turns — **no user regex, deliberate ReDoS
stance**) and `skill` (.md note recalled on demand via a `<recall:name>` marker → one regeneration; no
function-calling dependency). Both inject **ephemerally into the system prompt only** — never into
`RpHistory`, so nothing leaks into compaction (which uses the raw character details). Budgets: 200
tokens/keyword context, 1k/skill, 4k total injected per generation. **Personas** (`RpPersona`,
`/ai rp-persona-add/-remove`, ≤1k tokens, one per user, add = overwrite): the spawner's
self-description injected in a `<userPersona>` block for **self-mode spawns only** (also visible to
the compaction prompt). The `/ai rp-*` command replies are non-ephemeral (public) except admin
`rp-setasset`, `rp-lorebook-view` (content dump is creator/dev-only) and the `rp-persona-*` pair.

**Database** (`bun:sqlite`, `persistence/database.db`). Layered: `tables/` (TableDefinition schema
objects) → `models/` (DAOs) → `queries/` (SQL strings). **Access pattern:**
`this.client.db.<model>.<method>` (e.g. `db.user.getUser(id)`, `db.user.addUserAttrs(id, {...})`).
Rules an agent must follow:
- **Never** write raw SQL outside `database/queries/`, and **never** interpolate user data into SQL
  — queries use `?` placeholders / prepared statements.
- Field names auto-convert camelCase ↔ snake_case (`camelToSnake` / `snakeToCamelJSON`); pass
  camelCase.
- **No formal migration system.** `Database.init()` does `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`
  to add missing columns, manual index creation, and `PRAGMA foreign_keys = ON`. Schema changes go
  there. Legacy `ServerRoles` rows auto-migrate into `ServerConfig` (`role:<name>` keys) on boot.
- Multi-statement atomicity: `db.executeTransaction((rawDb) => { ... })`.
- Per-guild settings: `ServerConfig` (`db.serverConfig`, keyed by `server_id` + `key`) — named roles
  use `role:<name>` keys; gameplay tuning via `/serverconfig setvalue`, `/serverconfig setchannel`,
  and `/serverconfig setrole`; `CommandConfig` remains
  separate for per-guild command blacklists.

## 5. Website architecture (`site_src/`)
**Server** (`server.ts`): a Hono app served by `Bun.serve` on **`PORT 6769` / host `0.0.0.0`**
(prod publishes it to `127.0.0.1:8080` behind a reverse proxy — see `docker-compose.yaml`). It runs
in the **same process** as the bot and receives the `Silverwolf` instance, so it can use the Discord
client and the shared DB. Uses `createBunWebSocket()` — **the returned `websocket` handler must be
passed to `Bun.serve` or WS upgrades hang.** Cache pre-warm (`startWebsiteCachePrewarm`) runs on the
bot's `clientReady` so the first `/leaderboards` / `/birthdays` hit a populated cache.

**Middleware order matters** (registered in `server.ts`, applied outermost-first):
`embedMetaMiddleware` (rewrites HTML to add social-embed meta) → `rateLimiter(120, 60_000)`
(120 req/min per IP, IPv6 bucketed to /64) → `securityHeadersMiddleware` (CSP + **per-request
nonce**, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy) →
`sessionMiddleware`.

**Routes** (registered in `server.ts`): `routes/static.ts`, `routes/auth.ts` (Discord OAuth),
`routes/pages.ts` (HTML), `routes/games-api.ts` (JSON POST game actions), `routes/ai-slop-api.ts`,
`routes/cyclic-tictactoe-mp.ts` (multiplayer WebSocket; game logic in `multiplayer/`). Pages: `/`,
`/me`, `/about`, `/games/*`, `/leaderboards`, `/birthdays`.

**Rendering & assets.** Pages are composed with `Layout()` (`components/layout.ts`) using Hono's
`html` tag, which **auto-escapes interpolated values**. Inline `<script>` needs the request nonce
via `c.get('nonce')`. CSS: edit `Assets/input.css`, run `build:css` → minified `styles.css`, served
`immutable, max-age=31536000` and cache-busted by content hash (`asset-version.ts`, `?v=<hash>`).
Fonts are self-hosted woff2 (`font-src 'self'`, `font-display: swap`). Client JS is the cached,
hash-busted, `defer`-loaded `app.js`; a client-only game that needs a library (Plane Sim's `three`)
is **self-hosted, bundled** by `build:js` into its own hash-busted `<script type=module>`
(`plane-sim.js` / `plane-viewer.js`) — never a CDN (CSP `script-src 'self'`). `Layout({ fullscreen:
true })` drops the navbar/footer/centred `<main>` for full-viewport pages (Plane Sim
`/games/plane-sim` and its model inspector `/games/plane-sim/inspect`). Search index ships as a JSON
`<script>` data-island; renders
coalesce per animation frame; below-fold images lazy-load. HTML responses are
`Cache-Control: private, no-store` (prevents per-request nonce leaking through a CDN).
`PUBLIC_ORIGIN` pins absolute embed URLs so untrusted `x-forwarded-*` headers can't redirect link
previews.

**Auth — Discord OAuth *user* login (no admin UI).** Sessions in
`database/models/WebSessionModel.ts`; cookie `__Host-sw_session`; token is HMAC-SHA256 verified with
`timingSafeEqual`; TTL 30-day sliding / 90-day absolute; OAuth `state` has a 5-min CSRF TTL;
return-URLs are same-origin-whitelisted. A per-session **CSRF token is required on every game POST
and as the first WebSocket message** (`authedGameRequest` validates session + CSRF). Login only lets
a user see their own dashboard/stats and play account-tied games — there is **no** admin/management
surface on the web.

## 6. Security & performance guardrails (read before touching the website)
- **Validate/whitelist every input.** `Number.isFinite` / `Number.isInteger` / `Math.trunc`, enum
  whitelists, `checkValidBetRaw` for bets. Coerce, then check; reject otherwise.
- **Never interpolate untrusted data** into SQL/HTML/JS. Use prepared statements (`?`), Hono `html`
  auto-escaping, and `inlineJSON()` / `attr()` / `escapeHtml()` for `<script>`/attribute contexts.
- **Keep the CSP tight.** Nonce inline scripts; do not add `unsafe-inline` or new external origins
  without cause; extend the `img-src` whitelist deliberately (`middleware/security.ts`).
- **CSRF on every state-changing endpoint** (HTTP + WS). Respect the global rate limiter.
- **Perf:** prefer the cached `app.js` over new inline scripts; put styles in `input.css` (not
  inline `<style>`); lazy-load below-fold images; parallelize DB reads (`Promise.all`); extend the
  cache pre-warm (`bot-bridge.ts`) for new heavy queries.
- **Logging:** use `log()` / `logError()` (`utils/log.ts`) → `persistence/`. **Never log secrets.**

## 7. Shared code (bot ↔ website)
Both halves read the **same** SQLite DB and share `utils/` (math, betting, blackjack, roulette,
slots, claim, eat, upgrades, leaderboards, birthdays). `site_src/bot-bridge.ts` is the bridge for
website-facing data access and the leaderboard/birthday cache.

## 8. CI/CD & Docker (mechanism — specifics live in the workflow files)
- `.github/workflows/deploy.yml`: push to `master` → Buildx builds & pushes the Docker image →
  SSH to the prod VM and `docker compose pull && docker compose up -d`. (Host/SSH user/image name
  are in `deploy.yml` — not duplicated here.)
- `.github/workflows/claude_code*.yml`: `@claude` PR assistant, restricted to authorized actors.
- **Docker** (`Dockerfile`): multi-stage — `oven/bun:1` builder with cairo/pango/jpeg/gif/rsvg dev
  libs to compile `canvas`; the builder also runs `build:css` + `build:js` (Tailwind + the bundled
  client JS — `app.js` and the Three.js `plane-sim.js`/`plane-viewer.js`) and overlays those
  artifacts into the runtime (they're `.dockerignore`d from the source copy). Then `oven/bun:1-slim`
  runtime as non-root user `bun`, `CMD ["bun","index.ts"]`. `docker-compose.yaml` mounts
  `./persistence` (SQLite persistence), publishes `127.0.0.1:8080:6769`, `mem_limit: 1g`.

## 9. Conventions, tooling & gotchas
- **Lint:** `.eslintrc.json` = airbnb-base + node + promise. TS overrides: `no-explicit-any` off,
  unused vars ignored when `_`-prefixed, `max-len` 120, `no-console` off. `site_src/Assets/` is
  lint-ignored. `eslint-by-rule.sh` (needs `jq`) lists issues by rule.
- **Tests:** `bun test` in `tests/` with `tests/setup.ts` preload (30s default timeout). Jest-like
  API (`describe`/`test`/`expect`).
- **Adding things:** a new command = new file in `commands/` extending `Command`/`DevCommand`
  (auto-discovered on restart). A new page = `pages/` component wrapped in `Layout()` + a route in
  `routes/pages.ts`. A new game API = handler in `routes/games-api.ts` guarded by
  `authedGameRequest`. CSS change = edit `input.css` + `build:css`. A client-bundled game (needs a
  JS lib) = a `*.src.js` in `Assets/` (imports the lib) wired into `build:js` + the `Dockerfile` +
  `routes/static.ts`, loaded as a hash-busted `<script type=module>`; put shared geometry/logic in a
  plain module imported by both the game and any tooling (e.g. `plane-sim-models.js`, used by the
  game and the model inspector). Immersive pages pass `Layout({ fullscreen: true })`.
- **Gotchas:** the repo uses **CRLF** line endings; there are **no DB migrations** (see §4); a
  website crash is caught and logged while the bot continues; `persistence/` holds all runtime data.
