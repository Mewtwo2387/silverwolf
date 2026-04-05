import { Database as BunDatabase } from 'bun:sqlite';
import { log, logError } from '../utils/log';
import { snakeToCamelJSON } from '../utils/caseConvert';
import * as tables from './tables';
import * as modelClasses from './models';
import type { TableDefinition, QueryResult } from './types';
import type UserModel from './models/UserModel';
import type BabyModel from './models/BabyModel';
import type AiChatModel from './models/AiChatModel';
import type ChatModel from './models/ChatModel';
import type PokemonModel from './models/PokemonModel';
import type MarriageModel from './models/MarriageModel';
import type CommandConfigModel from './models/CommandConfigModel';
import type GameUIDModel from './models/GameUIDModel';
import type GlobalConfigModel from './models/GlobalConfigModel';
import type ServerRolesModel from './models/ServerRolesModel';
import type BirthdayReminderModel from './models/BirthdayReminderModel';
import type PoopModel from './models/PoopModel';

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

    // Enforce at most one active AI session per user+persona
    this.db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_aichatsession_user_persona_active
      ON AiChatSession (user_id, persona_name)
      WHERE active = 1
    `);

    // Initialize models
    Object.entries(modelClasses).forEach(([modelName, ModelClass]) => {
      this.models[modelName] = new (ModelClass as any)(this);
    });

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
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
  async dumpServerRoles(): Promise<string> { return this.dumpTable('ServerRoles', []); }
  async dumpChatHistory(): Promise<string> { return this.dumpTable('ChatHistory', []); }
  async dumpChatSession(): Promise<string> { return this.dumpTable('ChatSession', ['started_by']); }
  async dumpGlobalConfig(): Promise<string> { return this.dumpTable('GlobalConfig', []); }
  async dumpGameUID(): Promise<string> { return this.dumpTable('GameUID', ['user_id']); }

  get aiChat(): AiChatModel { return this.models.AiChatModel; }
  get birthdayReminder(): BirthdayReminderModel { return this.models.BirthdayReminderModel; }
  get baby(): BabyModel { return this.models.BabyModel; }
  get chat(): ChatModel { return this.models.ChatModel; }
  get commandConfig(): CommandConfigModel { return this.models.CommandConfigModel; }
  get gameUID(): GameUIDModel { return this.models.GameUIDModel; }
  get globalConfig(): GlobalConfigModel { return this.models.GlobalConfigModel; }
  get marriage(): MarriageModel { return this.models.MarriageModel; }
  get pokemon(): PokemonModel { return this.models.PokemonModel; }
  get poop(): PoopModel { return this.models.PoopModel; }
  get serverRoles(): ServerRolesModel { return this.models.ServerRolesModel; }
  get user(): UserModel { return this.models.UserModel; }
}

export default Database;
