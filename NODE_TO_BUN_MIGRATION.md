# Node.js to Bun Migration Tutorial

A comprehensive guide for migrating a Node.js project to Bun. This tutorial is based on the Silverwolf bot migration and can be applied to any Node.js project.

---

## Table of Contents
1. [Why Migrate to Bun?](#why-migrate-to-bun)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Phase 1: Dependency Cleanup](#phase-1-dependency-cleanup)
4. [Phase 2: Database Migration (sqlite3 → bun:sqlite)](#phase-2-database-migration)
5. [Phase 3: HTTP Client Migration (axios → fetch)](#phase-3-http-client-migration)
6. [Phase 4: Testing Migration (Jest → bun test)](#phase-4-testing-migration)
7. [Phase 5: Scripts & Runtime](#phase-5-scripts--runtime)
8. [Troubleshooting](#troubleshooting)

---

## Why Migrate to Bun?

| Feature | Node.js | Bun |
|---------|---------|-----|
| Startup time | ~300ms | ~30ms |
| Package installation | npm: ~10s | bun: ~1s |
| SQLite performance | sqlite3 (C++ binding) | bun:sqlite (native, 5-10x faster) |
| fetch() | Requires `node-fetch` | Built-in |
| .env support | Requires `dotenv` | Built-in |
| Test runner | Requires Jest/Mocha | Built-in (`bun test`) |
| Watch mode | Requires `nodemon` | Built-in (`--watch`) |

---

## Pre-Migration Checklist

Before starting, verify:

- [ ] Your codebase is in version control (Git)
- [ ] All tests pass on Node.js
- [ ] You have a backup of your database
- [ ] You've installed Bun: `curl -fsSL https://bun.sh/install | bash`

### Dependency Compatibility Check

Review your `package.json` and categorize dependencies:

| Category | Examples | Action |
|----------|----------|--------|
| **Remove** (Bun-native) | `dotenv`, `node-fetch`, `nodemon` | Uninstall |
| **Replace** | `sqlite3` → `bun:sqlite`, `axios` → `fetch` | Rewrite code |
| **Keep** | `discord.js`, `express`, most npm packages | No change needed |
| **Caution** | Native addons (`canvas`, `sharp`) | Test carefully |

---

## Phase 1: Dependency Cleanup

### Step 1.1: Remove Redundant Packages

```bash
# Remove packages that Bun provides natively
npm uninstall dotenv node-fetch nodemon

# If you're replacing axios with fetch
npm uninstall axios

# If you're replacing sqlite3 with bun:sqlite
npm uninstall sqlite3

# If using bun test instead of Jest
npm uninstall jest ts-jest @types/jest
```

### Step 1.2: Remove dotenv Usage

**Before (Node.js):**
```javascript
const { config } = require('dotenv');
config();

const token = process.env.TOKEN;
```

**After (Bun):**
```javascript
// No import needed! Bun reads .env automatically
const token = process.env.TOKEN;

// Optional: Add a comment for clarity
// Note: Bun automatically reads .env files
```

---

## Phase 2: Database Migration

### sqlite3 → bun:sqlite

The key differences:
- `sqlite3` is callback-based and asynchronous
- `bun:sqlite` is synchronous (but faster!)

### Step 2.1: Update Imports

**Before:**
```javascript
const sqlite3 = require('sqlite3').verbose();
```

**After:**
```javascript
const { Database } = require('bun:sqlite');
```

### Step 2.2: Update Constructor

**Before:**
```javascript
this.db = new sqlite3.Database(path, (err) => {
  if (err) reject(err);
  else resolve();
});
```

**After:**
```javascript
this.db = new Database(path, { create: true });
// Enable WAL mode for better concurrency
this.db.run('PRAGMA journal_mode = WAL');
```

### Step 2.3: Update Query Methods

**db.run() - For INSERT/UPDATE/DELETE:**

Before:
```javascript
async executeQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    this.db.run(query, params, function(err) {
      if (err) reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}
```

After:
```javascript
executeQuery(query, params = []) {
  const stmt = this.db.query(query);
  stmt.run(...params);
  return { 
    changes: this.db.query('SELECT changes() as c').get().c,
    lastID: this.db.query('SELECT last_insert_rowid() as id').get().id
  };
}
```

**db.get() - For SELECT (single row):**

Before:
```javascript
async selectOne(query, params = []) {
  return new Promise((resolve, reject) => {
    this.db.get(query, params, (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}
```

After:
```javascript
selectOne(query, params = []) {
  const stmt = this.db.query(query);
  return stmt.get(...params);
}
```

**db.all() - For SELECT (multiple rows):**

Before:
```javascript
async selectAll(query, params = []) {
  return new Promise((resolve, reject) => {
    this.db.all(query, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
}
```

After:
```javascript
selectAll(query, params = []) {
  const stmt = this.db.query(query);
  return stmt.all(...params);
}
```

### Step 2.4: Maintaining Async Compatibility

If your codebase heavily uses `await` with database calls, you can keep the async wrappers:

```javascript
async executeQuery(query, params = []) {
  try {
    const stmt = this.db.query(query);
    stmt.run(...params);
    return { 
      changes: this.db.query('SELECT changes() as c').get().c,
      lastID: this.db.query('SELECT last_insert_rowid() as id').get().id
    };
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}
```

---

## Phase 3: HTTP Client Migration

### axios → fetch

### Step 3.1: Basic GET Request

**Before (axios):**
```javascript
const axios = require('axios');

const response = await axios.get(url);
const data = response.data;
```

**After (fetch):**
```javascript
const response = await fetch(url);
if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
const data = await response.json();
```

### Step 3.2: GET with Headers

**Before:**
```javascript
const response = await axios.get(url, {
  headers: { 'Authorization': 'Bearer token' }
});
```

**After:**
```javascript
const response = await fetch(url, {
  headers: { 'Authorization': 'Bearer token' }
});
```

### Step 3.3: POST Request

**Before:**
```javascript
const response = await axios.post(url, { name: 'John' });
```

**After:**
```javascript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
```

### Step 3.4: Binary Data (Images, Files)

**Before:**
```javascript
const response = await axios.get(url, { responseType: 'arraybuffer' });
const buffer = Buffer.from(response.data);
```

**After:**
```javascript
const response = await fetch(url);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
```

### Step 3.5: Error Handling Differences

**axios** throws on non-2xx status codes automatically.
**fetch** does NOT throw on non-2xx; you must check `response.ok`.

```javascript
// fetch pattern
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Request failed: ${response.status} ${response.statusText}`);
}
const data = await response.json();
```

---

## Phase 4: Testing Migration

### Jest → bun test

Bun's test runner is mostly Jest-compatible!

### Step 4.1: Update package.json

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

### Step 4.2: Update Test Files (if needed)

Most Jest syntax works directly. Key differences:

**Imports:**
```javascript
// Jest
const { describe, it, expect } = require('@jest/globals');

// Bun (optional, globals are available)
import { describe, it, expect } from 'bun:test';
// Or just use them directly without import
```

**Timeout:**
```javascript
// Jest
jest.setTimeout(30000);

// Bun (in bunfig.toml or as flag)
// bun test --timeout 30000
```

### Step 4.3: Create bunfig.toml (Optional)

```toml
[test]
timeout = 30000
coverage = true
```

---

## Phase 5: Scripts & Runtime

### Step 5.1: Update package.json Scripts

```json
{
  "scripts": {
    "start": "bun index.js",
    "start:node": "node index.js",
    "dev": "bun --watch index.js",
    "dev:node": "node --watch index.js",
    "test": "bun test",
    "test:jest": "jest",
    "lint": "eslint ."
  }
}
```

### Step 5.2: Running the Project

```bash
# Start with Bun
bun start

# Development with hot reload
bun run dev

# Run tests
bun test
```

---

## Troubleshooting

### "Cannot find module 'bun:sqlite'"
You're running with Node.js instead of Bun. Use `bun index.js`.

### Native modules fail to build
Some native modules (like `canvas`) may need system dependencies:
```bash
# macOS
brew install pkg-config cairo pango libpng jpeg giflib

# Ubuntu/Debian
sudo apt install build-essential libcairo2-dev libpango1.0-dev
```

### "fetch is not defined"
You're running with an older Node.js. Switch to Bun or upgrade to Node.js 18+.

### Database issues after migration
- Backup your database before testing
- Verify WAL mode is enabled: `PRAGMA journal_mode = WAL;`
- Check for concurrent access issues

### Tests fail with timeout
Increase timeout:
```bash
bun test --timeout 60000
```

---

## Migration Checklist

- [ ] Install Bun
- [ ] Remove: `dotenv`, `node-fetch`, `nodemon`, `axios` (if replacing)
- [ ] Remove: `sqlite3` (if replacing with `bun:sqlite`)
- [ ] Update database code to use `bun:sqlite`
- [ ] Replace `axios` calls with `fetch`
- [ ] Remove `dotenv` import from entry point
- [ ] Update `package.json` scripts
- [ ] Run tests with `bun test`
- [ ] Test the application end-to-end

---

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [bun:sqlite Docs](https://bun.sh/docs/api/sqlite)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Fetch API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
