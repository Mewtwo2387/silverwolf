# Silverwolf — Agent Guide

This document is for any AI/coding agent picking up work on this repo. It explains how the
codebase is wired together: how to add commands, how the database is structured and extended,
how the TCG card-battle subsystem works, and where the moving parts live. It deliberately
avoids cataloguing individual user-facing commands — read the source for those.

If something in this file conflicts with the source, **the source wins**; please update this
file when you make a structural change.

---

## 1. Tech stack and conventions

- **Runtime:** [Bun](https://bun.sh). `bun:sqlite` is used directly for the database; Bun also
  loads `.env` automatically (no `dotenv` import).
- **Language:** TypeScript (`ES2022` target, `module: ESNext`, `moduleResolution: bundler`,
  `strict: true`). See `tsconfig.json`. Tests live under `tests/` and are excluded from the
  main `tsc` include list.
- **Discord client:** [discord.js v14](https://discord.js.org/).
- **Image generation:** the `canvas` package (Skia under the hood). Used by TCG card rendering,
  the quote tool, etc.
- **Lint:** ESLint with `airbnb-base` + TypeScript + jest + node + promise plugins. Single
  quotes, no `console` warnings, max line length 120 (with the typical airbnb caveats for
  comments/strings/templates). Run `npm run lint` / `npm run lint:fix`.
- **Type-check:** `npm run typecheck` (`tsc --noEmit`).
- **Tests:** `npm test` runs Jest (`ts-jest`). Bun-only utilities (`tcg/tests/*.ts`) are not
  Jest tests — they're Bun scripts wired into `package.json` scripts (e.g. `card:generate`,
  `card:generate-items`, `card:battle`).

### Coding conventions

- Files are TypeScript. The runtime command loader **prefers `.ts`** and only falls back to
  `.js` when no `.ts` of the same name exists (see `Silverwolf.loadCommands`). Don't ship a
  shadowed pair.
- Database column names are `snake_case`; in-memory objects are `camelCase`. Conversion is
  centralised in `utils/caseConvert.ts` (`snakeToCamelJSON` is applied to every row read by
  `Database.executeSelect*`; `camelToSnake` is used inside model setters).
- HP / damage / energy and any chained-multiplier numbers go through `round2` from
  `utils/math.ts`. Anything user-visible numeric should be 2-decimal-rounded to avoid
  floating-point drift.
- Logging goes through `utils/log.ts` (`log`, `logError`, `logWarning`). These mirror to
  `persistence/logs.txt` and (for errors) `persistence/logs_error.txt`. Don't create your own
  log files.

---

## 2. Repository layout

| Path | Purpose |
| --- | --- |
| `index.ts` | Entry point. Constructs `Silverwolf` and calls `login` then `registerCommands`. |
| `classes/silverwolf.ts` | The `Client` subclass: command/keyword/listener loading, slash-command registration, message handling, scheduling. |
| `classes/handlers/` | Seasonal pokemon-summon handlers (`normalHandler`, `christmas…`, `halloween…`, `aprilFools…`) plus `keywordsBehaviorHandler` for keyword-trigger scripts. |
| `classes/birthdayScheduler.ts`, `classes/babyScheduler.ts` | `node-cron`-driven background jobs. Started inside `Silverwolf.init`. |
| `commands/` | One file per slash command (see §3). |
| `commands/classes/` | Command base classes: `Command`, `AdminCommand`, `DevCommand`, `NSFWCommand`, and `commandGroup.CommandGroup`. |
| `commands/commandgroups/` | Subcommand-group declarations (one file per group). |
| `database/` | DB layer (see §4). |
| `tcg/` | Card-battle subsystem (see §5). |
| `utils/` | Cross-cutting helpers (logging, math, accessControl, claim/upgrade/AI helpers, etc.). |
| `data/` | Static JSON: keywords, character/pokemon datasets, fonts, system prompts, season skin config. |
| `persistence/` | SQLite database files + log files. **Not committed.** |
| `tests/` | Jest test suite. `tests/database/` runs only via Bun's `bun test` (Jest excludes it via `testPathIgnorePatterns`). |
| `types/` | Hand-written `.d.ts` for things without published types. |
| `.env` | Required env vars (see README). |

---

## 3. Commands and command groups

### 3.1 The `Command` base class

All slash commands extend `commands/classes/Command.ts`. The constructor signature is:

```ts
new Command(
  client,
  name: string,
  description: string,
  options: ApplicationCommandOptionData[],
  args?: { ephemeral?: boolean; skipDefer?: boolean; isSubcommandOf?: string | null; blame?: string }
)
```

Subclasses **must** implement `async run(interaction)`. They must **not** override `execute` —
that's the wrapper that:

1. Aborts the command if `globalConfig.banned === 'true'` (unless the user is a dev).
2. `deferReply({ ephemeral })` unless `skipDefer` is set.
3. Calls `run(interaction)` inside a `try/catch` and shows a generic error embed on throw.

Inside `run`, you should use `interaction.editReply(...)` (since we already deferred).

### 3.2 Subclasses with permission gates

- `AdminCommand` — `isAdmin(interaction)` check (server admin OR dev) before `run`.
- `DevCommand` — `isDev(interaction)` check (id in `ALLOWED_USERS`).
- `NSFWCommand` — `isBasement(interaction)` check (specific guild id).

Permission helpers live in `utils/accessControl.ts` and read from env (`ALLOWED_USERS`,
`ALLOWED_SERVERS`).

### 3.3 Adding a new top-level command

1. Create `commands/<yourcommand>.ts` exporting a class (default export) that extends
   `Command` (or one of the gated subclasses).
2. The class name doesn't matter; the file name doesn't matter either — what matters is
   `command.name` (set in the `super` call). Whatever you set that to is the slash command
   name Discord will see.
3. The constructor must call `super(client, name, description, options, args)`.
4. Implement `async run(interaction)`.

Example:

```ts
import { Command } from './classes/Command';

class MyCommand extends Command {
  constructor(client: any) {
    super(client, 'mything', 'Does the thing', [
      { name: 'value', description: 'A value', type: 3, required: true },
    ], { ephemeral: false, blame: 'me' });
  }

  async run(interaction: any): Promise<void> {
    const value = interaction.options.getString('value', true);
    await interaction.editReply(`got: ${value}`);
  }
}

export default MyCommand;
```

`Silverwolf.loadCommands` will pick it up at startup. `registerCommands` then publishes the
slash command per guild (after filtering through `CommandConfig` blacklists).

### 3.4 Adding a subcommand of a group

To add a subcommand `/foo bar`:

1. Create `commands/foo_bar.ts` (or any filename; convention is `group_subcommand.ts`).
2. In its constructor, pass `{ isSubcommandOf: 'foo' }` to `super`. Its `name` is the
   subcommand name (`'bar'`).
3. Make sure `commands/commandgroups/foo.ts` exists and lists `'bar'` in its `commands`
   array. The `CommandGroup` will dynamically dispatch
   `interaction.options.getSubcommand()` → `client.commands.get('foo.bar')`.

The loader stores subcommands under the key `${group}.${name}` so both a top-level command and
a subcommand of the same name can coexist.

`registerCommands` only directly publishes top-level entries (`isSubcommandOf === null`). Each
group's `toJSON()` then expands to its child subcommands.

### 3.5 Command group base class

`commands/classes/commandGroup.ts` provides `CommandGroup`. To add a new group:

```ts
import { CommandGroup } from '../classes/commandGroup';

export default class Foo extends CommandGroup {
  constructor(client: any) {
    super(client, 'foo', 'Description shown in Discord', ['bar', 'baz']);
  }
}
```

The strings in the array must match the `name` of subcommand `Command` instances under
`commands/`.

### 3.6 Command lifecycle and registration

`Silverwolf.registerCommands(clientId)` is called once after login (`index.ts`). It:

1. Clears global commands (we register per-guild only).
2. For each guild in `process.env.GUILD_ID` (comma-separated):
   - Loads `CommandConfig` blacklist for that guild.
   - Builds the registration body from all loaded commands where `isSubcommandOf === null`,
     skipping any with a name in the blacklist.
   - PUTs `Routes.applicationGuildCommands(clientId, guildId)`.

To **disable a command per-guild**, write a row to `CommandConfig` (e.g. via
`db.commandConfig.addOrUpdateCommandBlacklist(name, serverId, reason)`); on next bot restart
that command won't be registered for that guild.

### 3.7 Listeners (non-slash interactions, messages)

The interaction handling for non-slash inputs (buttons, etc.) and message listeners
(`messageCreate`, `messageDelete`, `messageUpdate`) live in `Silverwolf.processInteraction`,
`processMessage`, `processDelete`, `processEdit`. They handle:

- Random pokemon summons (chance per message, season-specific handler).
- Random "arlecchino reply" trolling.
- The `/quote-by-mention` flow (mentioning the bot in reply to a message renders a quote
  card).
- Keyword triggers from `data/keywords.json` (`{triggers, reply, script, excludeSerious}`).
  Scripts must export a function from `classes/handlers/keywordsBehaviorHandler.ts`.

If you need to react to a new event type, hook it in `loadListeners`.

---

## 4. Database layer

### 4.1 Architecture

`database/Database.ts` wraps `bun:sqlite`. There's exactly one instance: `client.db`,
constructed by `Silverwolf` at startup with the file path `./persistence/database.db`. It's
synchronous under the hood but exposes `async` methods so call sites can `await db.ready` and
look like Promises.

Key methods:

- `executeQuery(query, params)` — for INSERT/UPDATE/DELETE. Returns `{ changes, lastID }`.
- `executeSelectQuery(query, params)` — single row, snake→camel converted (or `null`).
- `executeSelectAllQuery(query, params)` — array of rows, snake→camel converted.
- `executeTransaction(fn)` — `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` wrapper.
- `dumpTable(name, formatUserIds?)` — CSV dump (used by dev commands).

Models are exposed as getters on `Database`: `db.user`, `db.baby`, `db.commandConfig`, etc.

### 4.2 Tables

A table is a `TableDefinition` (see `database/types.ts`):

```ts
interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];   // [{ name, type }]
  primaryKey: string[];           // names of PK columns (used by migration logic)
  specialConstraints: string[];   // arbitrary table-level fragments
  constraints: string[];          // FK / UNIQUE / etc.
}
```

Each table lives in its own file under `database/tables/`, exports a default
`TableDefinition`, **and** exports a row-type interface (e.g. `UserRow`) describing the
*raw* (snake-case) shape. `database/tables/index.ts` re-exports each `TableDefinition` as a
named export and each row type. The `Database` constructor iterates `Object.values(tables)` to
create and migrate tables.

#### Migration semantics

`Database.init()` does:

1. `Promise.all(tables.map(createTable))` — `CREATE TABLE IF NOT EXISTS <name> (...)`.
2. `Promise.all(tables.map(updateTable))` — for each non-PK column, runs
   `ALTER TABLE ... ADD COLUMN` if it doesn't already exist.

This means **adding a column** to an existing table is safe: define it in `columns` with a
`DEFAULT` and the migration adds it on next start. It does **not** support drops, type
changes, or PK changes — you'd need to write a manual migration in `init()` (see the legacy
`AiChatSession` normalisation block for an example).

#### Adding a new table

1. Create `database/tables/yourThingTable.ts`:

   ```ts
   import type { TableDefinition } from '../types';

   export interface YourThingRow {
     id: number;
     user_id: string;
     // ...
   }

   const yourThingTable: TableDefinition = {
     name: 'YourThing',
     columns: [
       { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
       { name: 'user_id', type: 'VARCHAR NOT NULL' },
     ],
     primaryKey: ['id'],
     specialConstraints: [],
     constraints: ['FOREIGN KEY (user_id) REFERENCES User(id)'],
   };

   export default yourThingTable;
   ```

2. Register it in `database/tables/index.ts` (both as a value export and a row-type export).
   The order doesn't matter — tables are created in parallel — but FK targets must exist when
   you actually start using them; SQLite will create the tables either way.

#### Adding a column

Just add a new entry to the `columns` array of an existing table. Provide a `DEFAULT` so
existing rows don't break. The on-startup `updateTable` call will `ADD COLUMN` automatically.

Example (already in the repo): the TCG deck column

```ts
{ name: 'tcg_deck', type: 'TEXT DEFAULT NULL' },
```

was added to `userTable.ts` and the JSON-encoded composition is read/written via
`tcg/deckStorage.ts`.

### 4.3 Models and queries

Each table generally has:

- `database/queries/<name>Queries.ts` — an object literal of SQL strings (and small string
  builders for dynamic `SET <col> = ?` queries).
- `database/models/<Name>Model.ts` — a class with one method per logical operation. Models
  internally use `db.executeQuery` / `db.executeSelect*Query` / `camelToSnake`.

To add a new model:

1. Create both files.
2. Re-export the model from `database/models/index.ts`.
3. (Optional but standard) Add a getter on `Database` so call sites can do
   `client.db.yourthing.method(...)` instead of `client.db.models.YourThingModel.method(...)`.
   `init()` constructs models automatically by iterating `modelClasses`, so step 3 is purely
   for ergonomic typed access.

Convention for `Model` constructors: `constructor(database: Database) { this.db = database; }`.

### 4.4 The `User` model (special case)

`UserModel` is the universal "a row per Discord user" home for game state — credits,
dinonuggies, gambling stats, ascension level, TCG deck, etc. There is no separate "User
profile" table; *everything* per-user lives on this row. Be careful adding columns here — the
table has a lot already.

`getUser(id)` auto-creates a row if the user doesn't exist, then runs a stats-aggregating
SELECT. `addUserAttr` / `setUserAttr` accept a camelCase field name and apply
`camelToSnake` before substituting into the SQL builder. Always go through the model unless
you need ad hoc SQL.

### 4.5 Naming and conventions checklist

- DB columns: `snake_case`. JS field names you pass to `setUserAttr` etc.: `camelCase`.
- Foreign keys to `User`: `FOREIGN KEY (user_id) REFERENCES User(id)`. PRAGMA `foreign_keys`
  is enabled in `init`.
- Use parameterised queries; never interpolate user input into SQL strings (`SET_USER_ATTR`
  interpolates the *column name*, which is a closed set).
- Run a fresh model creation through `tests/database/<name>.test.ts` (Bun-only, see below).

---

## 5. The TCG (`tcg/`)

This is the largest subsystem in the repo. It powers `/tcgbattle …` and the standalone CLI
demo (`bun tcg/tests/battleExample.ts`).

### 5.1 Game rules (the "what")

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
- Decks are persisted per Discord user in `User.tcg_deck` (JSON `{itemId: count}`).
- A **legal deck** is exactly 25 known items, each with count `0..PER_CARD_MAX (10)`.
- Two kinds of items:
  - **Equipment** — attaches permanently to a character (max 3 per character, see
    `MAX_EQUIPMENTS_PER_CHARACTER`). Its `effects` are pushed onto the character's effect
    list with whatever duration the effect declares (use 9999 for permanent).
  - **Consumable** — runs its `effect` callback once on the target, then is destroyed.

#### Victory

`Battle.checkVictory()` runs after every action. Side with no alive characters loses; both
empty = draw.

### 5.2 Class map (the "how")

```
Character (data)             — hp/element/skills/abilities + visual config (Background, ImagePanel, TextColors).
CharacterInBattle            — runtime state: currentHp, energy, effects, equipments, side.
Skill                        — name/desc/damage/range/effects + battleCost (Normal|Charged|Ultimate).
Ability                      — passive: applies static effects on activation, optional onBattleEvent hook.
Effect                       — { name, description, type, amount, duration, positive, metadata }.
EffectType                   — IncomingDamage / OutgoingDamage / FormChange / EnergyGain
                                / SkillPointsMaxBonus / DamageElementOverride.
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

### 5.3 Building a character

Use the helpers in `tcg/characterBuilder.ts` (`createCharacter`, `createSkill`,
`createEffect`, `createAbility`, `createAbilityEffect`, `createRangeEffect`,
`createSimpleBackground`, plus the `Normal`/`Charged`/`Ultimate` factories re-exported). You
*can* call the constructors directly, but the helpers exist to keep examples readable.

Place character definitions in `tcg/characters.ts`. Add the character to the `CHARACTERS`
array — `tcg/characterRoster.ts` automatically derives Discord choice values from the array.

Patterns used in existing characters:

- **Element-themed colors** — every elemental "family" defines a `*_TEXT_COLORS` object and
  an ability panel color, then passes them via `createCharacter({ textColors, ... })`.
- **Two-column skill layout** — set `twoColumnSkills: true` on `createCharacter` for
  characters with many skills (Electro). `Character.generateCard` will scale + grid the skill
  blocks. Override layout via `SkillDrawLayout` when you call `Skill.draw` directly.
- **FormChange** — pass `formChange: [skillIdx,...]` on a skill and `defaultForm: [...]` on
  the character to enable transformations. The active skill set is what
  `CharacterInBattle.getActiveSkills()` filters.
- **Buff/debuff polarity** — every `createEffect` call must pass `positive: true|false`. This
  drives log phrasing ("X gained [Y]" vs "X was inflicted with [Y]") and the Cleanser
  consumable (which only removes `positive: false` effects).

### 5.4 Adding a new effect type

1. Add a variant to `EffectType` in `tcg/effectType.ts`.
2. Wire it where it should apply:
   - Damage modifiers: `Skill.useSkill` → `CharacterInBattle.calculateDamage` /
     `dealDamage`.
   - Resource caps: `Battle.skillPointsCapForSide`.
   - Per-element rules: respect `effect.appliesToDamageElement(element)`.
   - One-off behaviour at end of turn: `CharacterInBattle.processEndOfTurn`.
3. If there's metadata to carry (e.g. `overrideElement`), extend the `metadata` shape on
   `Effect` and the matching `createEffect` builder.

### 5.5 Battle events (passive triggers)

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

### 5.6 Adding a new item

`tcg/items.ts` is where items are declared:

```ts
export const MAID_OUTFIT = elementalDamageEquipment('maid_outfit', 'Maid Outfit', Element.Fairy);
// …other 3★ type boosters (Oculi, Rusted Sword, Quantum Compressor) use the same helper in items.ts

export const HEALING_POTION = new Consumable(
  'healing_potion',
  'Healing Potion',
  'Immediately restores 20 HP to the target.',
  new Rarity(2),
  itemImagePanel('healing_potion', '#1c2a22'),
  defaultConsumableBackground(),
  (target, battle) => { target.heal(20); /* battle.logEvent('…') if useful */ },
);
```

Then add the new constant to `ALL_ITEMS`. `ITEMS_BY_ID` and `ITEM_DISCORD_CHOICES` are
derived from that array, so the deck-edit slash commands will pick it up automatically.

Equipment effects should use `duration: 9999` (treated as permanent in display logic). The
equip cap is enforced in `CharacterInBattle.equip` (returns `false` when full).

If an item performs something that doesn't map to "push an effect" or "call a method on the
target", call back into `Battle` via the second parameter (`battle.logEvent(...)`,
`battle.dispatchBattleEvent(...)`, etc.).

### 5.7 Card rendering

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

`Item.generateCard` is the simpler version: `Background → type emblem → name/rarity →
ImagePanel → wrapped description`.

For Discord battle thumbnails, `tcg/renderDiscordBattleBoard.ts` scales each card down,
overlays HP/effect rows, glows the active character, and arranges sides so the *current
player's team is on the bottom*.

If you add a new card type, implement `Card` and reuse `Background`/`ImagePanel`/`Rarity` —
don't draw your own background from scratch.

**Asset layout** (`tcg/assetPaths.ts`):

| Path | Purpose |
| --- | --- |
| `tcg/assets/characters/images/` | Character source art (referenced from `characters.ts`) |
| `tcg/assets/characters/cards/` | Generated character card PNGs (`bun run card:generate`) |
| `tcg/assets/items/images/` | Item source art (`<itemId>.png`, used by `itemImagePanel` in `items.ts`) |
| `tcg/assets/items/cards/` | Generated item card PNGs (`bun run card:generate-items`) |
| `tcg/assets/common/`, `tcg/assets/types/` | Shared UI icons (stars, skill points, element badges) |

### 5.8 Battle interface

`tcg/battleInterface.ts` is the **shared** layer between the CLI battle harness and the
Discord commands. It exposes:

- `executeUseSkill`, `executeUseItem`, `executeEndTurn`, etc. — return result objects with
  `success`, `failureReason`, and (on success) `logLines` from `battle.getLastActionLog()`.
- Formatters: `formatSkillsForSide`, `formatAllyStatusForDiscord`, `statusLine`,
  `formatHandForSide`, `formatActiveSlotLabel`.
- `resolveTargetForSkill` — converts an absolute slot index to a `CharacterInBattle`,
  rejecting KO'd targets. **Use absolute slot indices, never compacted "alive only"
  indices**, or targeting will desync when characters die.

`tcg/discordBattle.ts` then wraps these helpers with channel-keyed session state
(`DiscordBattleSession`, `DiscordBattlePending`, `setSession`, `getSession`,
`setPending`, etc.) and provides `battleDisplayPayload(session, description)` which renders
the board PNG and returns a discord.js message payload.

### 5.9 Logging in battle

Every meaningful battle event goes through `Battle.logEvent(message)`:

- Pushes onto `currentActionLog` (cleared at the start of each `useMainAction`/`useUltimate`/
  `useItem` call) and `turnHistory`.
- Calls the global `log()` so it lands in `persistence/logs.txt`.

`getLastActionLog()` returns the lines from the most recent action, which the Discord layer
formats into the battle update message.

### 5.10 Tests and demos

- `tcg/tests/battleExample.ts` — interactive CLI battle (bun script).
- `tcg/tests/testGenerateCard.ts` — renders every character card to `tcg/assets/characters/cards/`.
- `tcg/tests/testGenerateItemCard.ts` — renders every item card to `tcg/assets/items/cards/`.

Use these as smoke tests when you change rendering logic.

---

## 6. Other systems (high-level pointers)

### 6.1 Schedulers

- `BirthdayScheduler` and `BabyScheduler` are constructed in `Silverwolf.constructor` and
  `start`ed in `init`. Both use `node-cron`. To add a recurring task either pick the relevant
  scheduler or create a new one and start it in `init`.

### 6.2 Seasonal handlers

`getHandler()` reads `globalConfig.season` and looks up
`data/config/skin/pokemon.json` to decide which class in `classes/handlers/index.ts` to
instantiate per pokemon-summon event. To add a new season, add an entry in the JSON and a
new handler class extending `Handler` (`classes/handlers/handler.ts`) implementing
`summonPokemon`/`summonShinyPokemon`/`summonMysteryPokemon`/`summonNormalPokemon`.

### 6.3 Keyword auto-replies

Anything in `data/keywords.json` is loaded into `client.keywords`. Each entry is
`{ triggers: string[], reply?: string, script?: string, excludeSerious?: boolean }`. A
`trigger` may be a substring or a regex of the form `/.../g`. `script` references a function
in `classes/handlers/keywordsBehaviorHandler.ts`. `excludeSerious` skips trigger in the
hard-coded "serious channels" list.

### 6.4 Quote tool

`utils/quote.ts` powers the "@bot in reply to a message" → quote-card pipeline (`processMessage`
in `silverwolf.ts`). Inline params `bg:`, `pfp:`, `pfpc:`, `font:`, `txt:` are parsed from the
message that mentions the bot.

### 6.5 AI

`utils/ai.ts` and `database/models/AiChatModel.ts` (+ `AiChatHistoryRow`/`AiChatSessionRow`)
implement the Gemini/persona chat sessions. Important: `Database.init` enforces a unique
index `(user_id, persona_name) WHERE active = 1` to prevent duplicate-active sessions. If you
add a new persona, drop a system prompt into `data/aiPersonas.json` /
`data/SilverwolfSystemPrompt.txt` etc. — see existing usage.

---

## 7. Testing

- `npm test` (Jest) — runs everything except `tests/database/**` (which is Bun-only).
- `bun test tests/database/...` — runs the integration tests against a temp SQLite file
  (`tests/temp/<name>-<timestamp>.db`). They build a fresh `Database` per test file and clear
  tables in `beforeEach`. Pattern after `tests/database/user.test.ts` when adding a new model.
- For card rendering changes, run `bun run card:generate` and/or `bun run card:generate-items`
  and visually inspect output under `tcg/assets/characters/cards/` and `tcg/assets/items/cards/`.

---

## 8. Common gotchas

- **Bun-only APIs.** This codebase imports `bun:sqlite` directly. Don't try to swap that for
  `better-sqlite3` casually — the synchronous behaviour and the `query().get()/all()/run()`
  shape are baked into `Database.executeQuery` etc.
- **Floating-point.** `round2` everywhere or you'll see `12.499999999`. The HP/damage path is
  already rounded; if you add new arithmetic that surfaces to the user, do the same.
- **Effect polarity.** Don't forget `positive: boolean` when building `Effect`s — the type
  system enforces it, but a wrong polarity silently breaks Cleanser and the log text.
- **Absolute slot indices.** When wiring new TCG UI, target by slot 0/1/2, not by alive-only
  position — see `resolveTargetForSkill`.
- **Don't add commands during runtime.** All commands are loaded once at startup. Hot-reload
  would require touching `Silverwolf.loadCommands` and `registerCommands`.
- **Don't write CRLF mismatches.** `eslint-by-rule.sh` is CRLF; it's documented in the README
  if you hit `required file not found` on Linux.
- **`.env` is required.** Missing `TOKEN` aborts startup before any commands load.

---

## 9. Where to start when you change something

| Want to… | Touch… |
| --- | --- |
| Add a slash command | `commands/<file>.ts` (+ `commands/commandgroups/<group>.ts` if a sub) |
| Add a DB column | `database/tables/<X>Table.ts` (+ types). No migration needed for additions. |
| Add a DB model method | `database/queries/<x>Queries.ts` and `database/models/<X>Model.ts` |
| Add a TCG character | `tcg/characters.ts` (use `characterBuilder` helpers); register through `CHARACTERS`. |
| Add a TCG item | `tcg/items.ts`; add to `ALL_ITEMS`. |
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
