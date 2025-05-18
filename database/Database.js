const sqlite3 = require('sqlite3').verbose();
const { log, logError } = require('../utils/log');
const { snakeToCamelJSON } = require('../utils/caseConvert');

class Database {
  constructor() {
    this.db = new sqlite3.Database('./database.db', (err) => {
      if (err) {
        logError('Failed to connect to the database:', err.message);
      } else {
        log('Connected to the database.db SQLite database.');
        this.init();
      }
    });
  }

  createTable(tableJSON) {
    let rows = tableJSON.columns.map((col) => `${col.name} ${col.type}`).join(', ');
    if (tableJSON.specialConstraints.length > 0) {
      rows += `, ${tableJSON.specialConstraints.join(', ')}`;
    }
    if (tableJSON.constraints.length > 0) {
      rows += `, ${tableJSON.constraints.join(', ')}`;
    }
    this.db.run(`CREATE TABLE IF NOT EXISTS ${tableJSON.name} (${rows})`, (err) => {
      if (err) {
        logError(`Failed to create ${tableJSON.name} table:`, err.message);
      } else {
        log(`Created the ${tableJSON.name} table.`);
      }
    });
  }

  updateTable(tableJSON) {
    const columnsToAdd = tableJSON.columns.filter((col) => !tableJSON.primaryKey.includes(col.name));
    columnsToAdd.forEach(async (column) => {
      try {
        const columnExists = await this.checkIfColumnExists(tableJSON.name, column.name);
        if (!columnExists) {
          const addColumnQuery = `ALTER TABLE ${tableJSON.name} ADD COLUMN ${column.name} ${column.type}`;
          this.db.run(addColumnQuery, (err) => {
            if (err) {
              logError(`Failed to add column ${column.name}:`, err.message);
            } else {
              log(`Column ${column.name} added successfully.`);
            }
          });
        }
      } catch (err) {
        logError(`Failed to check or add column ${column.name}:`, err.message);
      }
    });
  }

  init() {
    log('--------------------\nInitializing database...\n--------------------');
    const tables = require('./tables');
    for (const table of Object.values(tables)) {
      this.createTable(table);
    }
    for (const table of Object.values(tables)) {
      this.updateTable(table);
    }
  }

  checkIfColumnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      this.db.all(query, [], (err, rows) => {
        if (err) {
          return reject(err);
        }
        const columnExists = rows.some((row) => row.name === columnName);
        resolve(columnExists);
      });
    });
  }

  async executeQuery(query, params = []) {
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.run(query, params, function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ changes: this.changes, lastID: this.lastID });
        });
      });
      return result;
    } catch (error) {
      logError(`Error executing query "${query}": ${error.message}`);
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
      logError(`Error executing select query "${query}": ${error.message}`);
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
      logError(`Error executing select all query "${query}": ${error.message}`);
      return [];
    }
  }
}

module.exports = Database; 