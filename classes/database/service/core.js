const sqlite3 = require('sqlite3').verbose();
const { log, logError } = require('../../../utils/log');

class CoreDatabase {
    constructor(path = './database.db') {
        this.db = new sqlite3.Database(path, (err) => {
            if (err) logError('Failed to connect to the database:', err.message);
            else log('Connected to the database.');
        });
    }

    async createTable(tableJSON) {
        let columns = tableJSON.columns.map(col => `${col.name} ${col.type}`).join(', ');
        if (tableJSON.specialConstraints.length) {
            columns += `, ${tableJSON.specialConstraints.join(', ')}`;
        }
        if (tableJSON.constraints.length) {
            columns += `, ${tableJSON.constraints.join(', ')}`;
        }

        this.db.run(`CREATE TABLE IF NOT EXISTS ${tableJSON.name} (${columns})`, (err) => {
            if (err) logError(`Failed to create ${tableJSON.name} table:`, err.message);
            else log(`Created the ${tableJSON.name} table.`);
        });
    }

    checkIfColumnExists(tableName, columnName) {
        return new Promise((resolve, reject) => {
            const query = `PRAGMA table_info(${tableName})`;
            this.db.all(query, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.some(row => row.name === columnName));
            });
        });
    }

    async updateTable(tableJSON) {
        const columnsToAdd = tableJSON.columns.filter(col => !tableJSON.primaryKey.includes(col.name));
        for (const column of columnsToAdd) {
            const exists = await this.checkIfColumnExists(tableJSON.name, column.name);
            if (!exists) {
                this.db.run(`ALTER TABLE ${tableJSON.name} ADD COLUMN ${column.name} ${column.type}`, (err) => {
                    if (err) logError(`Failed to add column ${column.name}:`, err.message);
                    else log(`Column ${column.name} added to ${tableJSON.name}.`);
                });
            }
        }
    }

    async executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function (err) {
                if (err) return reject(err);
                resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
    }

    async executeSelectQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    async executeSelectAllQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

module.exports = CoreDatabase;
