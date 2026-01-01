const { Database: BunDatabase } = require('bun:sqlite');
const { log, logError } = require('../utils/log');
const { snakeToCamelJSON } = require('../utils/caseConvert');
const tables = require('./tables');
const models = require('./models');

class Database {
  constructor(databasePath) {
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

  async createTable(tableJSON) {
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

  async updateTable(tableJSON) {
    const columnsToAdd = tableJSON.columns.filter((col) => !tableJSON.primaryKey.includes(col.name));
    for (const column of columnsToAdd) {
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
    }
  }

  async init() {
    log('--------------------\nInitializing database...\n--------------------');
    log('Database 3.0 - Bun Edition');

    // Create all tables (sequential for safety during init)
    for (const table of Object.values(tables)) {
      await this.createTable(table);
    }

    // Update all tables
    for (const table of Object.values(tables)) {
      await this.updateTable(table);
    }

    // Initialize models
    Object.entries(models).forEach(([modelName, ModelClass]) => {
      this.models[modelName] = new ModelClass(this);
    });

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  checkIfColumnExists(tableName, columnName) {
    // bun:sqlite is synchronous, no need for Promise wrapper
    const query = `PRAGMA table_info(${tableName})`;
    const rows = this.db.query(query).all();
    return rows.some((row) => row.name === columnName);
  }

  async executeQuery(query, params = []) {
    try {
      // bun:sqlite uses .run() for INSERT/UPDATE/DELETE
      const stmt = this.db.query(query);
      stmt.run(...params);

      // Get changes and lastInsertRowid from the database instance
      return {
        changes: this.db.query('SELECT changes() as changes').get().changes,
        lastID: this.db.query('SELECT last_insert_rowid() as id').get().id
      };
    } catch (error) {
      logError(`Error executing query "${query}":`, error);
      return { changes: 0, lastID: null };
    }
  }

  async executeSelectQuery(query, params = []) {
    try {
      // bun:sqlite .get() returns a single row
      const stmt = this.db.query(query);
      const row = stmt.get(...params);
      return row ? snakeToCamelJSON(row) : null;
    } catch (error) {
      logError(`Error executing select query "${query}":`, error);
      return null;
    }
  }

  async executeSelectAllQuery(query, params = []) {
    try {
      // bun:sqlite .all() returns all rows
      const stmt = this.db.query(query);
      const rows = stmt.all(...params);
      return rows.map((row) => snakeToCamelJSON(row));
    } catch (error) {
      logError(`Error executing select all query "${query}":`, error);
      return [];
    }
  }

  async dumpTable(tableName, formatUserIds = null) {
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

  async dumpUser() {
    return this.dumpTable('User', ['id']);
  }

  async dumpPokemon() {
    return this.dumpTable('Pokemon', ['user_id']);
  }

  async dumpMarriage() {
    return this.dumpTable('Marriage', ['user1_id', 'user2_id']);
  }

  async dumpBaby() {
    return this.dumpTable('Baby', ['mother_id', 'father_id']);
  }

  async dumpCommandConfig() {
    return this.dumpTable('CommandConfig', []);
  }

  async dumpServerRoles() {
    return this.dumpTable('ServerRoles', []);
  }

  async dumpChatHistory() {
    return this.dumpTable('ChatHistory', []);
  }

  async dumpChatSession() {
    return this.dumpTable('ChatSession', ['started_by']);
  }

  async dumpGlobalConfig() {
    return this.dumpTable('GlobalConfig', []);
  }

  async dumpGameUID() {
    return this.dumpTable('GameUID', ['user_id']);
  }

  get baby() {
    return this.models.BabyModel;
  }

  get chat() {
    return this.models.ChatModel;
  }

  get commandConfig() {
    return this.models.CommandConfigModel;
  }

  get gameUID() {
    return this.models.GameUIDModel;
  }

  get globalConfig() {
    return this.models.GlobalConfigModel;
  }

  get marriage() {
    return this.models.MarriageModel;
  }

  get pokemon() {
    return this.models.PokemonModel;
  }

  get serverRoles() {
    return this.models.ServerRolesModel;
  }

  get user() {
    return this.models.UserModel;
  }
}

module.exports = Database;
