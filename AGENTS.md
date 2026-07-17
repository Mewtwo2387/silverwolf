# Silverwolf — Agent / Contributor Technical Reference

**Silverwolf** is a Discord bot (discord.js v14) **and** a companion website that run **in the same
Bun process**. It serves fun/games both as slash commands and as web pages, plus Discord-side admin
("dev") commands for managing the bot. State lives in a single SQLite DB shared by both halves.
**The website is public, so security and performance are first-class concerns — code defensively:
validate every input, never trust client data, keep the CSP tight.**

**Last updated: 2026-06-30**

> **Maintenance rules.** Edit this file when something here becomes factually wrong, or when you
> make a qualifying structural change. Rules differ by area:
> - **Bot, website, DB, shared infra** — update only on *substantive architectural* change (new
>   auth, data flows, schema/security model, etc.). Do **not** touch it for routine work: a single
>   command, page, asset, or content tweak.
> - **TCG (`tcg/`)** — also update §6 when you add or change a **convention other agents must
>   follow**: a new `EffectType`, `BattleEvent`, item/equipment pattern, battle-phase rule,
>   card-rendering contract, or catalog layout. Adding a single character or item using an existing
>   pattern does not require a doc edit.
> When you make a qualifying change, bump the date above and edit only the affected section. Keep
> it dense; no fluff.

---

## 1. Stack & runtime
- **Runtime:** Bun (also the test runner; auto-loads `.env`, no dotenv). Lockfile `bun.lock`.
- **Language:** TypeScript, strict. `tsconfig.json`: target ES2022, module ESNext,
  moduleResolution `bundler`, typeRoots `./types`. `any` is allowed by lint config.
- **Bot:** `discord.js` ^14.26.
- **Web:** `hono` ^4.12 + Tailwind v3. Server-rendered HTML via Hono's `html` tag (no React).
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
| `tcg/` | Card-battle subsystem (`/tcgbattle`, card rendering, item/character catalogs). |
| `site_src/` | The Hono website: `server.ts`, `routes/`, `middleware/`, `auth/`, `pages/`, `components/`, `multiplayer/`, `tcg/` (web TCG), `Assets/`, `bot-bridge.ts`. |
| `utils/` | Shared logic + infra: `log.ts`, `accessControl.ts`, `mcp.ts`, game math/betting/etc. |
| `data/` | Static JSON (`keywords.json`, personas, status, config). |
| `persistence/` | Runtime SQLite DB + log files. **Docker volume — the data lives here.** |
| `tests/` | Bun tests + `setup.ts` preload. |
| `scripts/` | Build helpers (`build-images.ts`). |
| `.github/workflows/` | CI/CD (`deploy.yml`, `claude_code*.yml`). |

## 3. Setup & commands
Boot locally: `bun install` → create `.env` (keys below; values in `.env.example`) → `bun run dev`.

`package.json` scripts (verbatim):
- `start` = `bun index.ts` — production.
- `dev` = `bun --watch index.ts` — hot-reload dev.
- `test` / `test:watch` = `bun test [--watch] --preload ./tests/setup.ts`.
- `lint` / `lint:fix` = `eslint . [--fix]`.
- `typecheck` = `tsc --noEmit`.
- `build:css` / `build:css:watch` = compile `site_src/Assets/input.css` → `styles.css` (`--minify`).
- `build:images` = `bun scripts/build-images.ts` (WebP/AVIF variants).
- `card:battle` / `card:generate` / `card:generate-items` = TCG CLI demos and card PNG generation.

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
(`data/keywords.json`, each maps to a script in `utils/`) and a ~1% random seasonal Pokémon summon
(`classes/handlers/*` — normal/Christmas/Halloween/April-Fools); `interactionCreate` → command
dispatch + button handlers; message delete/edit tracked for history.

**Schedulers** (`Bun.cron`): birthday announcer (hourly), baby automation (daily + every 10 min).

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
  there.
- Multi-statement atomicity: `db.executeTransaction((rawDb) => { ... })`.

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
`routes/cyclic-tictactoe-mp.ts` (multiplayer WebSocket; game logic in `multiplayer/`),
`site_src/tcg/routes.ts` (web TCG: deck builder, PvP/solo battle rooms over WS — see §6.11). Pages: `/`,
`/me`, `/about`, `/games/*`, `/leaderboards`, `/birthdays`. `static.ts` also serves pre-generated TCG
card PNGs at `/static/tcg/char/:slug.png` and `/static/tcg/item/:id.png`, **path-validated** against
the `CHARACTERS` slugs / `ITEMS_BY_ID` catalogs (no traversal).

**Rendering & assets.** Pages are composed with `Layout()` (`components/layout.ts`) using Hono's
`html` tag, which **auto-escapes interpolated values**. Inline `<script>` needs the request nonce
via `c.get('nonce')`. CSS: edit `Assets/input.css`, run `build:css` → minified `styles.css`, served
`immutable, max-age=31536000` and cache-busted by content hash (`asset-version.ts`, `?v=<hash>`).
Fonts are self-hosted woff2 (`font-src 'self'`, `font-display: swap`). Client JS is a single cached,
hash-busted, `defer`-loaded `app.js`. Search index ships as a JSON `<script>` data-island; renders
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

## 6. The TCG (`tcg/`)

This is the largest subsystem in the repo. It powers `/tcgbattle …` and the standalone CLI
demo (`bun tcg/tests/battleExample.ts`). See the maintenance rules above — §6 expects updates when
TCG *patterns* change, not when you ship another character or item that follows them.

### 6.1 Game rules (the "what")

Two players. Each picks a **team of three Characters**. Both sides also bring a **25-card
item deck**.

#### Resources

- **HP** — per character, taken from `Character.hp`. KO at 0; KO'd characters can't act and
  ignore most effects.
- **Energy** — per character, used to fire that character's Ultimate. Starts at 0.
  - +5 after using a Normal attack.
  - +15 after using a Charged attack.
  - +5 when hit by an enemy.
  - Can also be granted by items / abilities.
- **Skill Points (SP)** — **shared per side** (team pool). Starts at 2. Default cap is 5,
  but `EffectType.SkillPointsMaxBonus` effects on alive allies raise that cap (Sparkle's
  passive adds 2). Capacity is dynamic — `Battle.skillPointsCapForSide` recomputes each query.

#### Skill categories

A skill's `battleCost` (a `SkillBattleCost` discriminated union) decides its category:

| Factory | Category | Effect |
| --- | --- | --- |
| `Normal(n=1)` | Main action | Grants `n` team SP; gives caster +5 energy. |
| `Charged(n=1)` | Main action | Consumes `n` team SP; gives caster +15 energy. |
| `Ultimate(e, opts?)` | Free action | Costs `e` energy; optional `grantTeamSkillPoints`. |

#### Turn order and phases

The rotation is **slot-by-slot, alternating sides**:
P1 slot 0 → P2 slot 0 → P1 slot 1 → P2 slot 1 → P1 slot 2 → P2 slot 2 → next round.

Each phase, the **active character** can use **at most one** Normal/Charged attack (the
"main action"). Knocked-out actives cannot act, but the slot doesn't auto-skip — you must
`/tcgbattle end`.

**Ultimates** are free-action: any alive character on the *currently acting side* may fire
them, any number of times per phase, while their team's turn is running. They don't consume
the main action.

**Items** are also free-action: any item from your hand, onto any of your *own alive*
characters, multiple per phase; doesn't consume the main action or energy or SP.

When the rotation wraps (full round complete) `Battle.endTurn` fires `processEndOfTurn` on
all alive cards (this is when effect durations tick) and draws 2 cards per side.

#### Items

- `DECK_SIZE = 25`, `STARTING_HAND = 5`, `DRAW_PER_ROUND = 2`.
- Decks are persisted per user inside their **active team slot** (`User.tcg_teams` — see §6.11;
  JSON `{itemId: count}`), accessed via `tcg/deckStorage.ts`.
- A **legal deck** is exactly 25 known items, each with count `0..PER_CARD_MAX (10)`, at most
  **5** copies at 5★+, and at most **15** copies at 4★+ (the 5★ cap counts toward the 4★ cap).
  See `validateDeckComposition` in `tcg/items/deck.ts`.
- Two kinds of items:
  - **Equipment** — attaches permanently to a character (max 3 per character, see
    `MAX_EQUIPMENTS_PER_CHARACTER`). Its `effects` are pushed onto the character's effect
    list with whatever duration the effect declares (use 9999 for permanent).
  - **Consumable** — runs its `effect` callback once on the target, then is destroyed.

#### Victory

`Battle.checkVictory()` runs after every action. Side with no alive characters loses; both
empty = draw.

### 6.2 Class map (the "how")

```text
Character (data)             — hp/element/skills/abilities + visual config (Background, ImagePanel, TextColors).
CharacterInBattle            — runtime state: currentHp, energy, effects, equipments, side.
Skill                        — name/desc/damage/range/effects + battleCost (Normal|Charged|Ultimate).
Ability                      — passive: applies static effects on activation, optional onBattleEvent hook.
Effect                       — { name, description, type, amount, duration, positive, metadata }.
EffectType                   — IncomingDamage / OutgoingDamage / FormChange / EnergyGain
                                / SkillPointsMaxBonus / DamageElementOverride / DodgeChance
                                / ChargedOutgoingDamage / ChargedSkillPointScaling.
RangeType                    — Self / SingleAlly / AllAllies / SingleOpponent / AllOpponents / AllCards.
SkillBattleCost              — { kind: 'normal' | 'charged' | 'ultimate', ... }.
Item (abstract)              — base for cards in the deck/hand.
Equipment, Consumable        — Item subclasses.
Battle                       — orchestrator: turn loop, SP/energy/HP rules, decks, hands, log.
BattleEvent                  — discriminated union dispatched by Battle to subscribed abilities.
```

`CharacterInBattle.effectiveDamageElement` returns the character's element unless a
`DamageElementOverride` effect is active, in which case it returns
`metadata.overrideElement`. **Always go through this getter** when computing outgoing damage
type — that's how items like `STRANGE_QUARK` work.

### 6.3 Building a character

Use the helpers in `tcg/characterBuilder.ts` (`createCharacter`, `createSkill`,
`createEffect`, `createAbility`, `createAbilityEffect`, `createRangeEffect`,
`createSimpleBackground`, plus the `Normal`/`Charged`/`Ultimate` factories re-exported). You
*can* call the constructors directly, but the helpers exist to keep examples readable.

Characters live under `tcg/characters/` — **one file per character** (e.g. `mystic.ts`).
Shared element palettes are in `shared.ts`; `tcg/characters/roster.ts` aggregates exports
into `CHARACTERS`. Import from `tcg/characters` (barrel) elsewhere. Add a new character
module and append it to `ROSTER_ENTRIES` in `roster.ts` — `tcg/characterRoster.ts`
automatically derives Discord choice values from `CHARACTERS`.

Patterns used in existing characters:

- **Element-themed colors** — every elemental "family" defines a `*_TEXT_COLORS` object and
  an ability panel color, then passes them via `createCharacter({ textColors, ... })`.
- **Two-column skill layout** — set `twoColumnSkills: true` on `createCharacter` for
  characters with many skills (Electro). `Character.generateCard` will scale + grid the skill
  blocks. Override layout via `SkillDrawLayout` when you call `Skill.draw` directly.
- **FormChange** — pass `formChange: [skillIdx,...]` on a skill and `defaultForm: [...]` on
  the character to enable transformations. The active skill set is what
  `CharacterInBattle.getActiveSkills()` filters.
- **Multi-hit / per-hit element** — `createSkill({ hitCount, damageElement?, randomElementPerHit? })`.
  Card damage shows as `4x4` when `hitCount > 1`. Each hit rolls dodge and damage separately;
  `damageElement` or `randomElementPerHit` sets the element passed to
  `calculateDamage` / `takeDamage` so elemental buffs match the hit.
- **Character-specific skill logic** — `createSkill({ onUse })` runs after declarative
  `effects` resolve. Put bespoke behaviour here (e.g. Mystic's Polygrowth stacks² bonus in
  `tcg/characters/mystic.ts`), not in `characterInBattle.ts`.
- **Display name vs slug** — `name` is the display string shown on the card / Discord UI.
  File outputs (the generated card PNG) use `character.slug`, which defaults to a slug of
  `name` but should be set explicitly when the display name differs from the internal
  namespace (e.g. `name: 'Keqisław Keqowski', slug: 'keqislaw'`). Keep the slug aligned with
  the character's file/const name.
- **Buff/debuff polarity** — every `createEffect` call must pass `positive: true|false`. This
  drives log phrasing ("X gained [Y]" vs "X was inflicted with [Y]") and the Cleanser
  consumable (which only removes `positive: false` effects).
- **Tags** — declare identity and group tags explicitly on `createCharacter` (e.g.
  `tags: [TAGS.KAITLIN, TAGS.TGP]`). Internal only (not rendered on cards or in Discord UI).
  Constants live in `tcg/characterTags.ts`; include the character's own `TAGS.*` entry in their
  file. Use tags for cross-character conditions; keep name-pattern checks (e.g.
  `name.startsWith('V')`) when the rule is about letters in the name itself.
  Helpers: `characterHasTag`, `countTaggedAllies`, `allyHasTag`, `Character.hasTag`.

### 6.4 Adding a new effect type

1. Add a variant to `EffectType` in `tcg/effectType.ts`.
2. Wire it where it should apply:
   - Damage modifiers: `Skill.useSkill` → `CharacterInBattle.calculateDamage` /
     `dealDamage`.
   - Dodge: rolled once per hostile target at the start of `Skill.useSkill` (sums
     `DodgeChance`, capped at 100%). A dodge skips **all** of that skill on that target
     (hostile effects and damage); ally-targeted parts of the same skill still resolve.
   - Charged attack damage: `ChargedOutgoingDamage` / `ChargedSkillPointScaling` apply only
     inside `CharacterInBattle.calculateDamage` when `Skill.useSkill` passes
     `{ chargedAttack: true, skillPointsSpent }` — they are not separate timed buffs.
   - Resource caps: `Battle.skillPointsCapForSide`.
   - Per-element rules: respect `effect.appliesToDamageElement(element)`.
   - One-off behaviour at end of turn: `CharacterInBattle.processEndOfTurn`.
3. If there's metadata to carry (e.g. `overrideElement`), extend the `metadata` shape on
   `Effect` and the matching `createEffect` builder.

### 6.5 Battle events (passive triggers)

Use this when a passive needs to react to in-battle moments rather than just apply a static
effect:

```ts
import { createAbility } from './characterBuilder';
import type { BattleEvent } from './battleEvents';

createAbility({
  name: 'Red Herring',
  description: '…',
  effects: [...],
  onBattleEvent: (event: BattleEvent, owner) => {
    if (event.type !== 'skill_points_consumed') return;
    if (event.consumer.side !== owner.side) return;
    // mutate state, push effects, etc.
  },
});
```

To add a new event variant:

1. Add it to the union in `tcg/battleEvents.ts`.
2. Emit it from `Battle` (via `dispatchBattleEvent`) at the appropriate call site —
   currently SP gain/spend hooks live in `Battle.changeSkillPoints`.
3. Subscribers receive the event for **every alive ally that owns an ability with an
   `onBattleEvent`** — guard inside the handler if you only care about your own side.

### 6.6 Adding a new item

Items live under `tcg/items/`, grouped by **function** (not theme). Each module exports
named constants plus a uniquely named catalog array (e.g. `elementalDamageItems`,
`equipmentItems`); `tcg/items/catalog.ts` flattens those into
`ALL_ITEMS` (no per-item manual listing). Import from `tcg/items` (barrel) elsewhere.

| Module | Purpose |
| --- | --- |
| `equipment/elementalDamage.ts` | +X% outgoing damage for one element (`elementalDamageEquipment`) |
| `equipment/outgoingDamage.ts` | +X% all-element outgoing (`outgoingDamageEquipment`, `mergableOutgoingDamageEquipment` for combine tiers) |
| `equipment/incomingReduction.ts` | −X% incoming (`incomingReductionEquipment`) |
| `equipment/elementOverride.ts` | `DamageElementOverride` gear (`elementOverrideEquipment`) |
| `equipment/signatureEquipment.ts` | `SignatureEquipment` character-bound gear |
| `consumables/healing.ts` | HP restore |
| `consumables/utility.ts` | Cleanse, energy, etc. |
| `consumables/timedBuffs.ts` | Timed buffs with cooldowns |
| `shared.ts` | `itemImagePanel` |
| `deck.ts` | Deck validation / default composition |

To add an item: declare it in the matching module and append it to that file's `items`
array. `ITEMS_BY_ID` and `ITEM_DISCORD_CHOICES` update on next start automatically.

```ts
// tcg/items/equipment/elementalDamage.ts
export const MAID_OUTFIT = elementalDamageEquipment(
  'maid_outfit', 'Maid Outfit', Element.Fairy, 3, 30, 'Optional lore.',
);
export const elementalDamageItems: Item[] = [ /* …existing… */, MAID_OUTFIT ];
```

Equipment effects should use `duration: 9999` (treated as permanent in display logic). The
equip cap is enforced in `CharacterInBattle.equip` (returns `false` when full).

**Equipment combine** (`tcg/equipmentCombine.ts`): set `Equipment.combinesWhenEquipped` so
equipping enough copies (default 3) of an item replaces them with one upgraded piece.
`CharacterInBattle.equip` runs this automatically after `onEquipped`. For one-off rules,
use `combineWhenEquipped({ fromItemId, into, requiredCount? })` or call
`tryCombineEquipment` directly.

```ts
export const MUTE = outgoingDamageEquipment('mute', 'Mute', 4, 32);
export const WARN = mergableOutgoingDamageEquipment('warn', 'Warn', 2, 16, MUTE);
export const NOTICE = mergableOutgoingDamageEquipment('notice', 'Notice', 1, 8, WARN);
```

**Signature equipment** (`SignatureEquipment` in `tcg/item.ts`): same combat rules as
`Equipment`, but the card uses a gold frame and a banner naming
`signatureOf` (e.g. Estrogen → Kaitlin). No extra in-battle restrictions.

```ts
export const ESTROGEN = new SignatureEquipment(
  'estrogen', 'Estrogen', 'Kaitlin', description, new Rarity(5),
  itemImagePanel('estrogen'),
  itemBackgroundForRarity(5),
  [ /* effects */ ], onEquipped?, footer?,
);
```

If an item performs something that doesn't map to "push an effect" or "call a method on the
target", call back into `Battle` via the second parameter (`battle.logEvent(...)`,
`battle.dispatchBattleEvent(...)`, etc.).

### 6.7 Card rendering

Cards are rendered through the `canvas` package at 1080×1920. Every card implements the
`Card` interface (`tcg/interfaces/card.ts`):

```ts
interface Card {
  name: string;
  generateCard: () => Promise<Canvas.Canvas>;
}
```

`Character.generateCard` composes `Background → element icon → name/HP → TitleDesc →
ImagePanel → skills (Skill.draw) → abilities (Ability.draw)`.

`Item.generateCard` is the simpler version: `Background (gradient tinted by star tier)
→ type icon (equipment/consumable PNG) → name/rarity →
ImagePanel → wrapped description → optional italic gray footer` (set via the last constructor
arg on `Item` / `Equipment` / `Consumable`, or the 6th arg on `elementalDamageEquipment`).

For Discord battle thumbnails, `tcg/renderDiscordBattleBoard.ts` scales each card down,
overlays HP/effect rows, glows the active character, and arranges sides so the *current
player's team is on the bottom*.

If you add a new card type, implement `Card` and reuse `Background`/`ImagePanel`/`Rarity` —
don't draw your own background from scratch.

**Asset layout** (`tcg/assetPaths.ts`):

| Path | Purpose |
| --- | --- |
| `tcg/assets/characters/images/` | Character source art (referenced from `tcg/characters/<name>.ts`) |
| `tcg/assets/characters/cards/` | Generated character card PNGs (`bun run card:generate`), named `<character.slug>.png` |
| `tcg/assets/items/images/` | Item source art (`<itemId>.png`; `itemImagePanel` fits art on a transparent panel; estrogen uses white) |
| `tcg/assets/items/cards/` | Generated item card PNGs (`bun run card:generate-items`) |
| `tcg/assets/common/`, `tcg/assets/types/` | Shared UI icons (stars, skill points, element badges) |

### 6.8 Battle interface (core / text / snapshot split)

The shared layer between CLI, Discord, and Website is split by concern. **Keep the
dependency direction one-way: `battleCore` → (`battleText`, `battleSnapshot`); never make
`battleCore` import the other two.**

- **`tcg/battleCore.ts`** — transport-agnostic engine actions and helpers. No rendering.
 - `executeUseSkill`, `executeUseItem`, `endTurnAsCurrentPlayer` — return result objects
 (`{ ok, error?, hints?, ... }`); on success the caller reads `battle.getLastActionLog()`.
 - `resolveTargetForSkill` — converts an absolute slot index to a `CharacterInBattle`,
 rejecting KO'd targets. **Use absolute slot indices, never compacted "alive only"
 indices**, or targeting desyncs when characters die.
 - `computeSkillAvailability(battle, side, charIndex, char, skill)` → `{ available, reason }`
 — the single source of truth for "can this skill be used and why" (drives both the
 Discord text and the web buttons).
 - `skillTargetKind` / `skillNeedsExplicitTarget`, `parseBattleSide`, `createDemoBattle`,
 `debugMaxEnergy`, and minimal slot/label formatters used by the executors.
- **`tcg/battleText.ts`** — CLI + Markdown formatters (`formatSkillsForSide`,
 `formatHandForSide`, `formatAllyStatusForDiscord`, `statusLine`, `formatBattleForDiscord`,
 `formatUseSkillMessage/Failure`, `formatUseItemMessage/Failure`, `getLatestPhaseSummary`).
 Depends on `battleCore`.
- **`tcg/battleSnapshot.ts`** — `buildBattleSnapshot(battle, viewerSide)` returns a JSON-safe,
 **viewer-aware** DTO (`BattleSnapshot`): status/turn/active, per-side SP/hand/deck sizes,
 both teams with hp/energy/effects and per-skill `{available, reason, needsTarget,
 targetKind, …}`, and **only the viewer's hand** (never leaks the opponent's). This DTO is
 the single contract the website client renders from.
- **`tcg/battleInterface.ts`** — thin re-export barrel of `battleCore` + `battleText` so the
 `commands/tcgbattle_*.ts` files keep working unchanged. New code should import from the
 specific module instead.

`tcg/discordBattle.ts` wraps the core/text helpers with channel-keyed session state
(`DiscordBattleSession`, `DiscordBattlePending`, `setSession`, `getSession`, `setPending`,
etc.) and provides `battleDisplayPayload(session, description)` which renders the board PNG
and returns a discord.js message payload.

### 6.9 Logging in battle

Every meaningful battle event goes through `Battle.logEvent(text, kind?)`. The log is a list of
**structured `BattleLogEntry { kind, text }`** (defined in `tcg/battle.ts`), not raw strings:

- `text` must be **plain** (no markdown / `#` / `**`) — each surface styles by `kind`, so embedded
  markup would leak. `kind` is one of: `turn` (round/phase header), `action` (skill used), `item`,
  `damage`, `heal`, `effect`, `ko`, `dodge`, `draw`, `info` (default). Pick the closest kind when
  adding a log line; add a new kind (and style it on every surface) only if none fits.
- Pushes onto `currentActionLog` (cleared at the start of each `useMainAction`/`useUltimate`/
  `useItem`/`endTurn`) and `turnHistory`; also calls global `log()` → `persistence/logs.txt`.
- **Self-contained log:** the action announcement ("X used [Skill] on Y", kind `action`) is logged
  by `useMainAction`/`useUltimate` themselves, and a `turn` header is logged at the start of every
  phase (`endTurn` + construction via `logTurnHeader`). So the log alone tells the whole story —
  surfaces do **not** synthesize their own headers.
- Damage is logged element-aware and **per hit** ("X took N pyro damage") — a multi-hit skill logs
  one line per landed hit in `Skill.useSkill` (`takeDamage(..., { silent: true, silentKo: true })`
  suppresses its own per-hit/KO lines so the caller controls ordering: each hit's damage line, then
  the KO line after the lethal hit). The web client mirrors this — it spawns one floating
  damage/heal indicator per `damage`/`heal` log line (parsed in `tcg-battle-room.src.js`), so each
  hit flashes separately rather than showing one aggregated number.

`getLastActionLog()` (plain strings) and `getLastActionLogEntries()` (structured) return the most
recent action's lines. Rendering: website styles each entry by kind via `tcg-log-<kind>` CSS
(`tcg-battle-room.src.js`); `battleText.ts` maps entries to Discord markdown / CLI; the snapshot DTO
carries `lastActionLog: BattleLogEntry[]`.

### 6.10 Tests and demos

- `tcg/tests/battleExample.ts` — interactive CLI battle (bun script).
- `tcg/tests/testGenerateCard.ts` — renders every character card to `tcg/assets/characters/cards/`.
- `tcg/tests/testGenerateItemCard.ts` — renders every item card to `tcg/assets/items/cards/`.

Use these as smoke tests when you change rendering logic.

### 6.11 Website TCG (PvP + solo battles, web deck builder)

The website exposes the TCG as a dynamic, WebSocket-driven experience built **on top of the
core/snapshot contract** (§6.8) — it never re-implements battle rules. Mirrors the
cyclic-tic-tac-toe multiplayer pattern.

- **Rooms** — `site_src/tcg/rooms.ts` (`tcgRoomManager`, in-memory; a restart
 drops rooms). Modes: `pvp` (creator seats p1 at create; the 2nd player picks a team and
 joins to seat p2 + start) and `solo` (one user drives both sides; `sideForUser` returns
 `battle.currentPlayer`). **Teams and decks are always rebuilt server-side** from validated
 roster values (`buildTeamOfThree`) and the user's saved `User.tcg_deck` (`expandDeckComposition`);
 client card data is never trusted. PvP has a turn timer (`TCG_TURN_TIMER_MS`) and a
 disconnect grace window; GC sweeps lobby/ended/abandoned rooms.
- **Spectators** — any other logged-in user who opens a room link (and isn't the PvP joiner offered
 the team-picker) attaches as a **spectator** (`room.spectators`, capped at `TCG_MAX_SPECTATORS`).
 `attachSocket` routes non-seated users here; their snapshot is built with `buildBattleSnapshot(…,
 spectator: true)` so **no hand is included** and `yourSide` is just the layout side. Spectators
 can't act (`actionGuard` rejects them) but **can chat**; first-socket-join / last-socket-leave emit
 a `system` chat notice. The room snapshot carries `spectator: boolean` + `spectatorCount`.
- **WebSocket** — `site_src/tcg/ws.ts` (`createTcgWsEvents`). First message must be
 `join` carrying the CSRF token (`constantTimeEqual`); then `use_skill` / `use_item` /
 `end_turn` / `rematch_request` / `chat` / `leave` / `ping`, each routed through the `battleCore`
 executors (except `chat` → `tcgRoomManager.postChat`). Broadcasts are **per-socket viewer-aware
 snapshots** (hands stay private; spectators share one hand-less snapshot). Same burst rate-limit as
 the cyclic socket. `chat` is open to any seated player **or spectator** regardless of turn; text is
 control-char-stripped + length-capped (`TCG_CHAT_MAX_LEN`). The room maintains the single source of
 truth `room.feed` (combined log + chat in arrival order); the snapshot ships a recent slice as
 `feed: TcgFeedItem[]` and the client **renders straight from `state.feed`** (so a re-joining client
 shows full history and never replays the last action). Each chat `TcgChatMessage` carries
 `{ kind: 'chat'|'system', senderId, username, isPlayer, isDev, … }`; the client marks `isPlayer`/`isDev`
 chatters with icons.
- **Room lifecycle** — a battle *ending* (`endBattle`: victory/timeout/forfeit/disconnect) only sets
 `status:'ended'` + result; the **room stays open** for rematch/chat. The room **closes** (→ history)
 only once it's empty — every player *and* spectator has left — after a `TCG_EMPTY_CLOSE_MS` grace
 (`maybeScheduleClose`/`closeRoom`; a `sweep` backstop closes long-idle empty rooms). Presence drives
 `system` chat lines: `joined` (first connect), `reconnected`, `disconnected` (drop; mid-battle PvP
 also arms the disconnect-forfeit grace), `left` (explicit Leave), and spectator `started/stopped
 spectating`. `listActive()` returns **all** in-memory rooms (any status) for the browse list.
- **Match history** — `closeRoom` → `db.tcgMatch.recordMatch` persists the **final, un-editable**
 state (table `TcgMatch`: mode, both players' id/username/team-slugs, winner side, end reason, rounds,
 timestamps, plus `final_state` — JSON `{ snapshot: hand-less BattleSnapshot, feed: TcgFeedItem[] }`:
 the final board + the cumulative combined log/chat feed, so the record renders **identically to the
 live battle**). The match id **is the room id**, so a closed room's old `/games/tcg/:id` link
 redirects to `/games/tcg/match/:id`. This is the **only** durable TCG state (rooms are in-memory).
 `getRecent` feeds the browse history list; `getById` feeds the clickable match-detail page (static
 board + feed re-rendered server-side). Rooms that never started a battle aren't recorded.
- **Routes** — `site_src/tcg/routes.ts` (`registerTcgBattleRoutes`, wired in `server.ts`
 with `upgradeWebSocket` + `tcgRoomManager.init`): `GET /games/tcg` (**browse** — all in-progress
 rooms via `tcgRoomManager.listActive()` + recent history, the default page), `GET /games/tcg/create`
 (create form — registered before `:id`), `POST /games/tcg/create`, `GET /games/tcg/match/:id`
 (permanent match-detail view, before `:id`), `GET /games/tcg/:id` (room —
 renders the battle client for seated players, a team-picker for an eligible PvP joiner, else a
 read-only **spectator** view), `POST /games/tcg/:id/join`, `GET /games/tcg/ws/:id` (origin pre-check
 + upgrade), `GET /games/tcg/deck` + `POST /games/tcg/deck/save` (deck builder). All POSTs use
 `authedGameRequest` (CSRF); deck save re-runs `validateDeckComposition` server-side.
- **Pages** — `site_src/tcg/pages/` (`landing.ts` = `TcgBrowsePage` + `TcgCreatePage`, `room.ts`,
 `deck-builder.ts`, `detail.ts`; HTML templates in `site_src/tcg/html/`; client JS in
 `site_src/tcg/assets/`). Battle client renders over WS: card-PNG board with live HP/energy/effect
 overlays, active-slot glow, availability-driven skill buttons with targeting, hand tray, end-turn,
 action log, result banner, rematch/leave). The **Log/Chat panel** is a single persistent element
 (built once, updated in place so the chat input keeps focus across re-renders): a wide right-hand
 column ≥920px, and a floating-launcher modal below that width.
- **Team slots** — each user has **five loadout slots** (`{active, slots: [{team, deck}]}` in
 `User.tcg_teams`, via `tcg/teamSlotStorage.ts`); **every battle plays from the active slot** — the
 web create/join POSTs take no team from the client, they rebuild it server-side from the active
 slot. The create/join pages render a slot bar (`tcg-team-slots.lib.js`): selecting a slot
 (`POST /games/tcg/teams/select`) makes it active + loads its lineup into the picker; picker edits
 auto-save (debounced, flushed before create/join) via `POST /games/tcg/teams/lineup`. **Decks live
 inside slots**: `tcg/deckStorage.ts`'s load/save route to the active slot's deck (`null` =
 default deck), so the web deck builder (which **auto-syncs on every change** — debounced, with a
 `pagehide` keepalive flush; no save button) and Discord `/tcgbattle deckset` edit the active slot
 without knowing about slots. A legacy `User.tcg_deck` is migrated into slot 1 on first load.
 **Slots save anything** — partial lineups and illegal decks persist as-is; legality is
 display-only (red `x/3` / `y/25` readiness on the slot chips, red badge in the deck builder)
 and enforced only at battle time (web create/join reject; Discord `buildDeckForUser` falls back
 to the default deck). Clients only ever receive `{active, deckSize, slots:[{team, deckCount,
 deckLegal}]}` briefs (deck contents stay server-side).

---

## 7. Security & performance guardrails (read before touching the website)
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

## 8. Shared code (bot ↔ website)
Both halves read the **same** SQLite DB and share `utils/` (math, betting, blackjack, roulette,
slots, claim, eat, upgrades, leaderboards, birthdays). `site_src/bot-bridge.ts` is the bridge for
website-facing data access and the leaderboard/birthday cache.

## 9. CI/CD & Docker (mechanism — specifics live in the workflow files)
- `.github/workflows/deploy.yml`: push to `master` → Buildx builds & pushes the Docker image →
  SSH to the prod VM and `docker compose pull && docker compose up -d`. (Host/SSH user/image name
  are in `deploy.yml` — not duplicated here.)
- `.github/workflows/claude_code*.yml`: `@claude` PR assistant, restricted to authorized actors.
- **Docker** (`Dockerfile`): multi-stage — `oven/bun:1` builder with cairo/pango/jpeg/gif/rsvg dev
  libs to compile `canvas`, then `oven/bun:1-slim` runtime as non-root user `bun`,
  `CMD ["bun","index.ts"]`. `docker-compose.yaml` mounts `./persistence` (SQLite persistence),
  publishes `127.0.0.1:8080:6769`, `mem_limit: 1g`.

## 10. Other bot systems (high-level pointers)

### 10.1 Schedulers

`BirthdayScheduler` and `BabyScheduler` are constructed in `Silverwolf.constructor` and started
in `init`. Both use `Bun.cron`. To add a recurring task either extend the relevant scheduler or
create a new one and start it in `init`.

### 10.2 Seasonal handlers

`getHandler()` reads `globalConfig.season` and looks up
`data/config/skin/pokemon.json` to decide which class in `classes/handlers/index.ts` to
instantiate per pokemon-summon event. To add a new season, add an entry in the JSON and a
new handler class extending `Handler` (`classes/handlers/handler.ts`) implementing
`summonPokemon`/`summonShinyPokemon`/`summonMysteryPokemon`/`summonNormalPokemon`.

### 10.3 Keyword auto-replies

Anything in `data/keywords.json` is loaded into `client.keywords`. Each entry is
`{ triggers: string[], reply?: string, script?: string, excludeSerious?: boolean }`. A
`trigger` may be a substring or a regex of the form `/.../g`. `script` references a function
in `classes/handlers/keywordsBehaviorHandler.ts`. `excludeSerious` skips trigger in the
hard-coded "serious channels" list.

### 10.4 Quote tool

`utils/quote.ts` powers the "@bot in reply to a message" → quote-card pipeline (`processMessage`
in `silverwolf.ts`). Inline params `bg:`, `pfp:`, `pfpc:`, `font:`, `txt:` are parsed from the
message that mentions the bot.

### 10.5 AI

`utils/ai.ts` and `database/models/AiChatModel.ts` (+ `AiChatHistoryRow`/`AiChatSessionRow`)
implement the Gemini/persona chat sessions. Important: `Database.init` enforces a unique
index `(user_id, persona_name) WHERE active = 1` to prevent duplicate-active sessions. If you
add a new persona, drop a system prompt into `data/aiPersonas.json` /
`data/SilverwolfSystemPrompt.txt` etc. — see existing usage.

## 11. Conventions, tooling & gotchas

- **Lint:** `.eslintrc.json` = airbnb-base + node + promise. TS overrides: `no-explicit-any` off,
  unused vars ignored when `_`-prefixed, `max-len` 120, `no-console` off. `site_src/Assets/` is
  lint-ignored. `eslint-by-rule.sh` (needs `jq`) lists issues by rule.
- **Tests:** `bun test` in `tests/` with `tests/setup.ts` preload (30s default timeout). Jest-like
  API (`describe`/`test`/`expect`). Database integration tests live under `tests/database/` and
  run against a temp SQLite file (`tests/temp/<name>-<timestamp>.db`); pattern after
  `tests/database/user.test.ts` when adding a new model. For card rendering changes, run
  `bun run card:generate` and/or `bun run card:generate-items` and visually inspect output under
  `tcg/assets/characters/cards/` and `tcg/assets/items/cards/`.
- **Numeric rounding:** HP / damage / energy and chained multipliers use `round2` from `utils/math.ts`.
- **Adding things:** a new command = new file in `commands/` extending `Command`/`DevCommand`
  (auto-discovered on restart). A new page = `pages/` component wrapped in `Layout()` + a route in
  `routes/pages.ts`. A new game API = handler in `routes/games-api.ts` guarded by
  `authedGameRequest`. CSS change = edit `input.css` + `build:css`. TCG character =
  `tcg/characters/<name>.ts`; TCG item = matching file under `tcg/items/`; battle rule =
  `tcg/battle.ts`.
- **Gotchas:** use absolute slot indices (0/1/2) for TCG targeting, not alive-only positions;
  every `Effect` needs `positive: true|false`; the repo uses **CRLF** line endings; there are **no DB
  migrations** (see §4); a website crash is caught and logged while the bot continues;
  `persistence/` holds all runtime data; this codebase imports `bun:sqlite` directly — don't swap
  it for `better-sqlite3` casually; commands are loaded once at startup (no hot-reload without
  touching `loadCommands`/`registerCommands`); missing `TOKEN` aborts startup before any commands load.

## 12. Where to start when you change something

| Want to… | Touch… |
| --- | --- |
| Add a slash command | `commands/<file>.ts` (+ `commands/commandgroups/<group>.ts` if a sub) |
| Add a DB column | `database/tables/<X>Table.ts` (+ types). No migration needed for additions. |
| Add a DB model method | `database/queries/<x>Queries.ts` and `database/models/<X>Model.ts` |
| Add a TCG character | `tcg/characters/<name>.ts` (use `characterBuilder` helpers); append to `ROSTER_ENTRIES` in `roster.ts`. |
| Add a TCG item | Matching file under `tcg/items/`; append to that module's `*Items` catalog array (e.g. `elementalDamageItems`). |
| Change a web-battle action/snapshot field | `tcg/battleCore.ts` (action) / `tcg/battleSnapshot.ts` (DTO); render in `site_src/tcg/assets/tcg-battle-room.src.js` (§6.8, §6.11). |
| Change web TCG rooms/WS/routes | `site_src/tcg/rooms.ts`, `ws.ts`, `routes.ts` (§6.11). |
| Add a battle rule | `tcg/battle.ts` (turn loop, victory, draws). |
| Add a passive trigger | `tcg/battleEvents.ts` + emission in `Battle` + subscriber in an `Ability`. |
| Add a status effect kind | `tcg/effectType.ts` + the relevant resolver(s) in `characterInBattle.ts`/`battle.ts`. |
| Tweak card art | `tcg/character.ts`, `tcg/skill.ts`, `tcg/ability.ts`, `tcg/item.ts`, `tcg/background.ts`, `tcg/imagePanel.ts`. |
| Tweak Discord battle board | `tcg/renderDiscordBattleBoard.ts`. |
| Schedule a recurring job | New cron in `BirthdayScheduler`/`BabyScheduler` or a new scheduler started in `Silverwolf.init`. |
| Block a command per guild | `CommandConfig` blacklist (via dev tools) — applied on next bot start. |

---

Keep this document honest. When you add a new system or change a public-ish convention,
update the relevant section.
