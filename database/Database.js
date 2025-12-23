const sqlite3 = require('sqlite3').verbose();
const { log, logError } = require('../utils/log');
const { snakeToCamelJSON } = require('../utils/caseConvert');
const tables = require('./tables');
const models = require('./models');

class Database {
  constructor(databasePath) {
    this.ready = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(databasePath, async (err) => {
        if (err) {
          logError('Failed to connect to the database:', err.message);
          reject(err);
        } else {
          log('Connected to the database.db SQLite database.');
          await this.init();
          resolve();
        }
      });
    });
    this.models = {};
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
      await new Promise((resolve, reject) => {
        this.db.run(`CREATE TABLE IF NOT EXISTS ${tableJSON.name} (${rows})`, (err) => {
          if (err) {
            logError(`Failed to create ${tableJSON.name} table:`, err.message);
            reject(err);
          } else {
            log(`Created the ${tableJSON.name} table.`);
            resolve();
          }
        });
      });
    } catch (err) {
      logError(`Error creating table ${tableJSON.name}:`, err);
    }
  }

  async updateTable(tableJSON) {
    const columnsToAdd = tableJSON.columns.filter((col) => !tableJSON.primaryKey.includes(col.name));
    await Promise.all(columnsToAdd.map(async (column) => {
      try {
        const columnExists = await this.checkIfColumnExists(tableJSON.name, column.name);
        if (!columnExists) {
          await new Promise((resolve, reject) => {
            const addColumnQuery = `ALTER TABLE ${tableJSON.name} ADD COLUMN ${column.name} ${column.type}`;
            this.db.run(addColumnQuery, (err) => {
              if (err) {
                logError(`Failed to add column ${column.name}:`, err.message);
                reject(err);
              } else {
                log(`Column ${column.name} added successfully.`);
                resolve();
              }
            });
          });
        }
      } catch (err) {
        logError(`Failed to check or add column ${column.name}:`, err);
      }
    }));
  }

  async init() {
    log('--------------------\nInitializing database...\n--------------------');
    log('Database 2.0 - Electric Boogaloo');
    // Create all tables
    await Promise.all(Object.values(tables).map((table) => this.createTable(table)));
    // Update all tables
    await Promise.all(Object.values(tables).map((table) => this.updateTable(table)));
    // Initialize models
    Object.entries(models).forEach(([modelName, ModelClass]) => {
      this.models[modelName] = new ModelClass(this);
    });

    await this.db.run('PRAGMA foreign_keys = ON');
  }

  checkIfColumnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          return reject(err);
        }
        const columnExists = rows.some((row) => row.name === columnName);
        return resolve(columnExists);
      });
    });
  }

  async executeQuery(query, params = []) {
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.run(query, params, function x(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ changes: this.changes, lastID: this.lastID });
        });
      });
      return result;
    } catch (error) {
      logError(`Error executing query "${query}":`, error);
      return { changes: 0, lastID: null };
    }
  }

  async executeSelectQuery(query, params = []) {
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.get(query, params, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? snakeToCamelJSON(row) : null);
        });
      });
      return result;
    } catch (error) {
      logError(`Error executing select query "${query}":`, error);
      return null;
    }
  }

  async executeSelectAllQuery(query, params = []) {
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map((row) => snakeToCamelJSON(row)));
        });
      });
      return result;
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
