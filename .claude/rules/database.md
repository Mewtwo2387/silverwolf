---
paths:
  - 'database/**'
---

# Database layer

`bun:sqlite`, file `persistence/database.db`. Layered: `tables/` (TableDefinition schema objects) →
`models/` (DAOs) → `queries/` (SQL strings).

**Access pattern:** `this.client.db.<model>.<method>` — e.g. `db.user.getUser(id)`,
`db.user.addUserAttrs(id, {...})`.

- Field names auto-convert camelCase ↔ snake_case (`camelToSnake` / `snakeToCamelJSON`) — pass
  camelCase.
- **No formal migration system.** `Database.init()` does `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`
  to add missing columns, manual index creation, and `PRAGMA foreign_keys = ON`. Schema changes go
  there. Legacy `ServerRoles` rows auto-migrate into `ServerConfig` (`role:<name>` keys) on boot.
- Multi-statement atomicity: `db.executeTransaction((rawDb) => { ... })`. Transactions are
  serialized through an in-process FIFO queue (a single connection can't interleave BEGINs — the
  second used to roll back the first's writes). **Never call `executeTransaction` from inside a
  transaction fn** — there is a guard that throws.

## Settings tables

- **Per-user quote defaults:** `QuotePreference` (`db.quotePreference`, one nullable-column row per
  user) — saved via `/quote settings`, applied to every quote that user makes (slash **and**
  mention). Resolution order is bot defaults → saved settings → flags on this invocation
  (`utils/quote.ts`: `parseQuoteFlags` → `resolveQuoteFlags`); `-o` / `override:true` drops the
  saved layer for one quote. Mention quoting takes compact space-separated flags
  (`@bot w v caveat #ff0124`), documented in-bot by `/quote help`.
- **Per-guild settings:** `ServerConfig` (`db.serverConfig`, keyed by `server_id` + `key`) — named
  roles use `role:<name>` keys; gameplay tuning via `/serverconfig setvalue`, `setchannel`,
  `setrole`. `CommandConfig` stays separate, for per-guild command blacklists.
- **Global:** `GlobalConfig` — allowed servers, birthday channels, the `banned` kill-switch. These
  override/augment the corresponding env vars.
