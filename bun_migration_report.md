# Bun Migration Analysis & Plan

## Goal
Assess the feasibility and benefits of migrating the `silverwolf` Discord bot from Node.js to Bun, focusing on using native Bun APIs (`bun:sqlite`, `fetch`, `bun test`, etc.).

## Executive Summary
**Verdict: Highly Recommended**
Switching to Bun is highly beneficial for this codebase. The project relies heavily on `sqlite3`, `axios`, and standard tooling (`dotenv`, `nodemon`, `jest`), all of which have superior, faster, and built-in equivalents in Bun. 

**Key Benefits:**
1.  **Performance**: `bun:sqlite` is significantly faster (up to 5-10x) than `node-sqlite3`. Bun's runtime startup and execution are also faster.
2.  **Simplicity**: You can remove ~5-6 dependencies (`sqlite3`, `dotenv`, `node-fetch`, `axios`, `nodemon`, `jest`).
3.  **Developer Experience**: Built-in watch mode, `.env` support, and a lightning-fast test runner make development smoother.

## Dependency Analysis

| Package | Status | Action | Notes |
| :--- | :--- | :--- | :--- |
| `discord.js` | ✅ Compatible | Keep | Works well with Bun. |
| `sqlite3` | ⚠️ Replace | **Remove** | Replace with native `bun:sqlite`. |
| `dotenv` | ⚠️ Redundant | **Remove** | Bun reads `.env` automatically. |
| `node-fetch` | ⚠️ Redundant | **Remove** | Use global `fetch`. |
| `axios` | ⚠️ Redundant | **Remove** | Use global `fetch`. |
| `node-cron` | ✅ Compatible | Keep | Works fine. |
| `jest` | ⚠️ Replace | **Remove** | Use `bun test` (jest-compatible). |
| `nodemon` | ⚠️ Redundant | **Remove** | Use `bun --watch`. |
| `canvas` | ⚠️ Caution | Keep | Usually works, but requires system libs. If issues arise, use `napi-rs/canvas`. |

## Implementation Plan

### Phase 1: Preparation & Cleanup
1.  **Uninstall redundant packages**:
    ```bash
    npm uninstall sqlite3 dotenv node-fetch axios nodemon jest ts-jest @types/jest
    ```
2.  **Install Bun types** (optional but good for IDE support):
    ```bash
    bun add -d @types/bun
    ```

### Phase 2: Database Migration (`bun:sqlite`)
The `database/Database.js` file heavily wraps `sqlite3` in Promises. `bun:sqlite` is synchronous (and faster), which simplifies things.
**Strategy**: **Keep the async API** to avoid breaking the rest of the app, but replace the internals with sync `bun:sqlite` calls.

**Example `database/Database.js` changes:**
```javascript
// OLD
const sqlite3 = require('sqlite3').verbose();
this.db = new sqlite3.Database(path);

// NEW
import { Database } from "bun:sqlite";
this.db = new Database(databasePath, { create: true });
// Enable WAL mode for concurrency performance
this.db.query("PRAGMA journal_mode = WAL;").run(); 
```
**Refactoring Methods:**
Instead of `return new Promise(...)`, simply wrap the sync call in `async`:
```javascript
async executeQuery(query, params = []) {
    try {
        const stmt = this.db.query(query);
        const result = stmt.run(...params); 
        // bun:sqlite results differ slightly in structure, need to map 'changes' and 'lastID'
        return { changes: this.db.changes, lastID: this.db.lastInsertRowid }; 
    } catch (err) { ... }
}
```

### Phase 3: Network Requests (`fetch`)
Replace `axios` usages in `classes/bitcoin.js` and `commands/*.js` with native `fetch`.

**Example:**
```javascript
// OLD (Axios)
const response = await axios.get(url);
return response.data;

// NEW (Fetch)
const response = await fetch(url);
if (!response.ok) throw new Error('Fetch failed');
return await response.json();
```

### Phase 4: Entry Point & Scripts
1.  **`index.js`**: Remove `require('dotenv').config();`.
2.  **`package.json`**: Update scripts.
    ```json
    "scripts": {
      "start": "bun index.js",
      "dev": "bun --watch index.js",
      "test": "bun test"
    }
    ```

### Phase 5: Testing
The `tests/setup.js` setting `jest.setTimeout` might need adjustment, but `bun test` often respects jest globals. If `bun test` fails on timeout, passing a flag or config file works.

## Potential Conflicts / Alerts
*   **`canvas`**: If you encounter errors like `strict mode violation` or build errors with `canvas`, ensure you have the necessary system libraries installed (GTK, Cairo). Bun usually handles it, but it's the most "native" dependency you have.
*   **Database Locking**: `bun:sqlite` is very fast, but if you have extremely high concurrency, verify using WAL mode (`PRAGMA journal_mode = WAL;`).

## Conclusion
The migration is straightforward and low-risk. The biggest task is refactoring `Database.js`, but it allows for massive code reduction (removing Promise boilerplate).
