import { Database as BunDatabase } from 'bun:sqlite';
import { log, logError } from '../utils/log';
import { snakeToCamelJSON } from '../utils/caseConvert';
import * as tables from './tables';
import serverConfigQueries from './queries/serverConfigQueries';
import imageGenQueries from './queries/imageGenQueries';
import battleshipsMatchQueries from './queries/battleshipsMatchQueries';
import rpQueries from './queries/rpQueries';
import * as modelClasses from './models';
import type { TableDefinition, QueryResult } from './types';
import type UserModel from './models/UserModel';
import type BabyModel from './models/BabyModel';
import type BattleshipsMatchModel from './models/BattleshipsMatchModel';
import type AiChatModel from './models/AiChatModel';
import type PokemonModel from './models/PokemonModel';
import type MarriageModel from './models/MarriageModel';
import type CommandConfigModel from './models/CommandConfigModel';
import type CyclicTttMatchModel from './models/CyclicTttMatchModel';
import type GameUIDModel from './models/GameUIDModel';
import type GlobalConfigModel from './models/GlobalConfigModel';
import type ImageGenModel from './models/ImageGenModel';
import type ServerConfigModel from './models/ServerConfigModel';
import type BirthdayReminderModel from './models/BirthdayReminderModel';
import type FootballMatchAnnouncementModel from './models/FootballMatchAnnouncementModel';
import type PoopModel from './models/PoopModel';
import type RpModel from './models/RpModel';
import type WebSessionModel from './models/WebSessionModel';

class Database {
  db!: BunDatabase;
  models: Record<string, any>;
  ready: Promise<void>;

  constructor(databasePath: string) {
    this.models = {};

    // bun:sqlite is synchronous but we keep the async ready pattern for compatibility
    this.ready = (async () => {
      try {
        this.db = new BunDatabase(databasePath, { create: true });

        // Enable WAL mode for better concurrency performance
        this.db.run('PRAGMA journal_mode = WAL');

        log('Connected to the database.db SQLite database.');
        await this.init();
      } catch (err) {
        logError('Failed to connect to the database:', err);
        throw err;
      }
    })();
  }

  async createTable(tableJSON: TableDefinition): Promise<void> {
    let rows = tableJSON.columns.map((col) => `${col.name} ${col.type}`).join(', ');
    if (tableJSON.specialConstraints.length > 0) {
      rows += `, ${tableJSON.specialConstraints.join(', ')}`;
    }
    if (tableJSON.constraints.length > 0) {
      rows += `, ${tableJSON.constraints.join(', ')}`;
    }
    try {
      this.db.run(`CREATE TABLE IF NOT EXISTS ${tableJSON.name} (${rows})`);
      log(`Created the ${tableJSON.name} table.`);
    } catch (err) {
      logError(`Error creating table ${tableJSON.name}:`, err);
    }
  }

  async updateTable(tableJSON: TableDefinition): Promise<void> {
    const columnsToAdd = tableJSON.columns.filter((col) => !tableJSON.primaryKey.includes(col.name));
    columnsToAdd.forEach((column) => {
      try {
        const columnExists = this.checkIfColumnExists(tableJSON.name, column.name);
        if (!columnExists) {
          const addColumnQuery = `ALTER TABLE ${tableJSON.name} ADD COLUMN ${column.name} ${column.type}`;
          this.db.run(addColumnQuery);
          log(`Column ${column.name} added successfully.`);
        }
      } catch (err) {
        logError(`Failed to check or add column ${column.name}:`, err);
      }
    });
  }

  async init(): Promise<void> {
    log('--------------------\nInitializing database...\n--------------------');
    log('Database 3.0 - Bun Edition');

    // Create all tables
    await Promise.all(Object.values(tables).map((table) => this.createTable(table)));

    // Update all tables
    await Promise.all(Object.values(tables).map((table) => this.updateTable(table)));

    // Normalize legacy duplicate-active AI sessions before adding uniqueness enforcement
    this.db.run(`
      UPDATE AiChatSession
      SET active = 0
      WHERE active = 1
        AND session_id NOT IN (
          SELECT MAX(session_id)
          FROM AiChatSession
          WHERE active = 1
          GROUP BY user_id, persona_name
        )
    `);

    // Enforce at most one active AI session per user+persona on Discord. Scoped
    // to source='discord' so an accidental active=1 web row can't collide with
    // the bot's active session. The legacy source-agnostic index is dropped
    // first so older databases pick up the new predicate.
    this.db.run('DROP INDEX IF EXISTS idx_aichatsession_user_persona_active');
    this.db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_aichatsession_user_discord_active
      ON AiChatSession (user_id, persona_name)
      WHERE active = 1 AND source = 'discord'
    `);

    // Speed up the website sidebar query (user's web-only chat list).
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_aichatsession_user_source
      ON AiChatSession (user_id, source)
    `);

    // SQLite can't ALTER a CHECK constraint — rebuild AiChatHistory if the
    // 'tool' role isn't allowed yet. Idempotent: skipped on subsequent boots.
    const aiChatSchema = this.db
      .query("SELECT sql FROM sqlite_master WHERE type='table' AND name='AiChatHistory'")
      .get() as { sql?: string } | null;
    if (aiChatSchema?.sql && !aiChatSchema.sql.includes("'tool'")) {
      log('Migrating AiChatHistory: adding tool role to CHECK constraint');
      this.db.run('BEGIN IMMEDIATE TRANSACTION');
      try {
        this.db.run(`
          CREATE TABLE AiChatHistory_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT CHECK(role IN ('user', 'model', 'assistant', 'tool')) NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES AiChatSession(session_id)
          )
        `);
        this.db.run('INSERT INTO AiChatHistory_new (id, session_id, role, message, timestamp) SELECT id, session_id, role, message, timestamp FROM AiChatHistory');
        this.db.run('DROP TABLE AiChatHistory');
        this.db.run('ALTER TABLE AiChatHistory_new RENAME TO AiChatHistory');
        this.db.run('COMMIT');
        log('AiChatHistory migration complete');
      } catch (err) {
        this.db.run('ROLLBACK');
        logError('AiChatHistory migration failed:', err);
        throw err;
      }
    }

    // Speed up per-user poop lookups and daily-count range queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_poopentry_user_logged
      ON PoopEntry (user_id, logged_at)
    `);

    // Back the per-user rolling-24h image-generation rate-limit count.
    this.db.run(imageGenQueries.CREATE_USER_CREATED_INDEX);

    // Back the per-user recent-match lookup (GET_RECENT_FOR_USER).
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_cyclic_ttt_x_id_ended_at
      ON CyclicTttMatch (x_discord_id, ended_at DESC)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_cyclic_ttt_o_id_ended_at
      ON CyclicTttMatch (o_discord_id, ended_at DESC)
    `);

    // Back the per-user recent battleships-match lookup (GET_RECENT_FOR_USER).
    this.db.run(battleshipsMatchQueries.CREATE_INDEX_X_RECENT);
    this.db.run(battleshipsMatchQueries.CREATE_INDEX_O_RECENT);

    // Roleplay: mention routing, the proactive "all"-mode scan, and search.
    this.db.run(rpQueries.CREATE_INDEX_SPAWN_CHANNEL);
    this.db.run(rpQueries.CREATE_INDEX_SPAWN_ALL);
    this.db.run(rpQueries.CREATE_INDEX_HISTORY_SPAWN);
    this.db.run(rpQueries.CREATE_INDEX_HISTORY_SPAWN_ROLE);
    this.db.run(rpQueries.CREATE_INDEX_CHAR_NAME);
    this.db.run(rpQueries.CREATE_INDEX_CHAR_CREATOR);

    // Migrate legacy ServerRoles into ServerConfig when opening an older database.
    this.migrateLegacyServerRolesIfNeeded();

    // Initialize models
    Object.entries(modelClasses).forEach(([modelName, ModelClass]) => {
      this.models[modelName] = new (ModelClass as any)(this);
    });

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  migrateLegacyServerRolesIfNeeded(): void {
    const legacyTable = this.db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='ServerRoles'")
      .get();
    if (!legacyTable) return;

    const rowCount = (this.db
      .query(serverConfigQueries.COUNT_LEGACY_SERVER_ROLES)
      .get() as { count: number }).count;

    log(`Migrating ${rowCount} legacy ServerRoles row(s) to ServerConfig`);
    this.db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      this.db.run(serverConfigQueries.MIGRATE_FROM_SERVER_ROLES);

      const unmigrated = (this.db
        .query(serverConfigQueries.COUNT_UNMIGRATED_SERVER_ROLES)
        .get() as { count: number }).count;
      if (unmigrated > 0) {
        throw new Error(`${unmigrated} ServerRoles row(s) failed to migrate into ServerConfig`);
      }

      this.db.run(serverConfigQueries.DROP_LEGACY_SERVER_ROLES);
      this.db.run('COMMIT');
      log(`ServerRoles migration complete (${rowCount} row(s) moved to ServerConfig)`);
    } catch (err) {
      this.db.run('ROLLBACK');
      logError('ServerRoles migration failed:', err);
      throw err;
    }
  }

  checkIfColumnExists(tableName: string, columnName: string): boolean {
    // bun:sqlite is synchronous, no need for Promise wrapper
    const query = `PRAGMA table_info(${tableName})`;
    const rows = this.db.query(query).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === columnName);
  }

  async executeQuery(query: string, params: any[] = []): Promise<QueryResult> {
    try {
      // bun:sqlite uses .run() for INSERT/UPDATE/DELETE
      const stmt = this.db.query(query);
      stmt.run(...params);

      // Get changes and lastInsertRowid from the database instance
      return {
        changes: (this.db.query('SELECT changes() as changes').get() as any).changes,
        lastID: (this.db.query('SELECT last_insert_rowid() as id').get() as any).id,
      };
    } catch (error) {
      logError(`Error executing query "${query}":`, error);
      return { changes: 0, lastID: null };
    }
  }

  async executeTransaction(transactionFn: (db: BunDatabase) => any): Promise<any> {
    try {
      this.db.run('BEGIN IMMEDIATE TRANSACTION');
      const result = await transactionFn(this.db);
      this.db.run('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.run('ROLLBACK');
      } catch (rollbackError) {
        logError('Error during transaction rollback:', rollbackError);
      }
      logError('Error executing transaction:', error);
      throw error;
    }
  }

  async executeSelectQuery(query: string, params: any[] = []): Promise<Record<string, any> | null> {
    try {
      // bun:sqlite .get() returns a single row
      const stmt = this.db.query(query);
      const row = stmt.get(...params) as Record<string, any> | null;
      return row ? snakeToCamelJSON(row) : null;
    } catch (error) {
      logError(`Error executing select query "${query}":`, error);
      return null;
    }
  }

  async executeSelectAllQuery(query: string, params: any[] = []): Promise<Record<string, any>[]> {
    try {
      // bun:sqlite .all() returns all rows
      const stmt = this.db.query(query);
      const rows = stmt.all(...params) as Record<string, any>[];
      return rows.map((row) => snakeToCamelJSON(row));
    } catch (error) {
      logError(`Error executing select all query "${query}":`, error);
      return [];
    }
  }

  async dumpTable(tableName: string, formatUserIds: string[] | null = null): Promise<string> {
    const query = `SELECT * FROM ${tableName};`;
    const rows = await this.executeSelectAllQuery(query);

    if (!Array.isArray(rows) || rows.length === 0) {
      log(`No data found in the ${tableName} table.`);
      return '';
    }

    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')];

    rows.forEach((row) => {
      const values = keys.map((key) => {
        if (formatUserIds && formatUserIds.includes(key)) {
          return `<@${row[key]}>`;
        }
        return row[key];
      });
      csv.push(values.join(','));
    });

    return csv.join('\n');
  }

  async dumpUser(): Promise<string> { return this.dumpTable('User', ['id']); }
  async dumpPokemon(): Promise<string> { return this.dumpTable('Pokemon', ['user_id']); }
  async dumpMarriage(): Promise<string> { return this.dumpTable('Marriage', ['user1_id', 'user2_id']); }
  async dumpBaby(): Promise<string> { return this.dumpTable('Baby', ['mother_id', 'father_id']); }
  async dumpCommandConfig(): Promise<string> { return this.dumpTable('CommandConfig', []); }
  async dumpServerConfig(): Promise<string> { return this.dumpTable('ServerConfig', []); }
  async dumpGlobalConfig(): Promise<string> { return this.dumpTable('GlobalConfig', []); }
  async dumpGameUID(): Promise<string> { return this.dumpTable('GameUID', ['user_id']); }

  get aiChat(): AiChatModel { return this.models.AiChatModel; }
  get birthdayReminder(): BirthdayReminderModel { return this.models.BirthdayReminderModel; }
  get footballMatchAnnouncement(): FootballMatchAnnouncementModel { return this.models.FootballMatchAnnouncementModel; }
  get baby(): BabyModel { return this.models.BabyModel; }

  get battleshipsMatch(): BattleshipsMatchModel { return this.models.BattleshipsMatchModel; }
  get commandConfig(): CommandConfigModel { return this.models.CommandConfigModel; }
  get cyclicTttMatch(): CyclicTttMatchModel { return this.models.CyclicTttMatchModel; }
  get gameUID(): GameUIDModel { return this.models.GameUIDModel; }
  get globalConfig(): GlobalConfigModel { return this.models.GlobalConfigModel; }
  get imageGen(): ImageGenModel { return this.models.ImageGenModel; }
  get marriage(): MarriageModel { return this.models.MarriageModel; }
  get pokemon(): PokemonModel { return this.models.PokemonModel; }
  get poop(): PoopModel { return this.models.PoopModel; }
  get rp(): RpModel { return this.models.RpModel; }
  get serverConfig(): ServerConfigModel { return this.models.ServerConfigModel; }
  get user(): UserModel { return this.models.UserModel; }
  get webSession(): WebSessionModel { return this.models.WebSessionModel; }
}

export default Database;
