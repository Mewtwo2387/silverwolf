const sqlite3 = require('sqlite3').verbose();

class Database {
    constructor(){
        this.db = new sqlite3.Database('./database.db', (err) => {
            if (err) {
                console.error('Failed to connect to the database:', err.message);
            } else {
                console.log('Connected to the database.db SQLite database.');
                this.init();
            }
        });
    }

    init(){
        this.db.run(`CREATE TABLE IF NOT EXISTS User (
            id VARCHAR PRIMARY KEY,
            credits INTEGER DEFAULT 0,
            bitcoin FLOAT DEFAULT 0,
            last_bought_price FLOAT DEFAULT 0,
            last_bought_amount FLOAT DEFAULT 0,
            total_bought_price FLOAT DEFAULT 0,
            total_bought_amount FLOAT DEFAULT 0,
            total_sold_price FLOAT DEFAULT 0,
            total_sold_amount FLOAT DEFAULT 0,
            dinonuggies INTEGER DEFAULT 0,
            dinonuggies_last_claimed DATETIME DEFAULT NULL,
            dinonuggies_claim_streak INTEGER DEFAULT 0,
            multiplier_amount_level INTEGER DEFAULT 1,
            multiplier_rarity_level INTEGER DEFAULT 1,
            beki_level INTEGER DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Created the User table.');
                this.updateSchema();
                this.fixTable();
            }
        });
    }

    updateSchema() {
        const columnsToAdd = [
            { name: 'dinonuggies', type: 'INTEGER', defaultValue: 0 },
            { name: 'dinonuggies_last_claimed', type: 'DATETIME', defaultValue: 'NULL' },
            { name: 'dinonuggies_claim_streak', type: 'INTEGER', defaultValue: 0 },
            { name: 'multiplier_amount_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'multiplier_rarity_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'beki_level', type: 'INTEGER', defaultValue: 1 }
        ];

        columnsToAdd.forEach(async (column) => {
            try {
                const columnExists = await this.checkIfColumnExists('User', column.name);
                if (!columnExists) {
                    const addColumnQuery = `ALTER TABLE User ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.defaultValue}`;
                    this.db.run(addColumnQuery, (err) => {
                        if (err) {
                            console.error(`Failed to add column ${column.name}:`, err.message);
                        } else {
                            console.log(`Column ${column.name} added successfully.`);
                        }
                    });
                }
            } catch (err) {
                console.error(`Failed to check or add column ${column.name}:`, err.message);
            }
        });
    }
    
    fixTable() {
        const levelColumns = ['multiplier_amount_level', 'multiplier_rarity_level', 'beki_level'];
        levelColumns.forEach(async (column) => {
            const updateLevelQuery = `UPDATE User SET ${column} = 30 WHERE ${column} > 30`;
            this.db.run(updateLevelQuery, (err) => {
                if (err) {
                    console.error(`Failed to update column ${column} to max level 30:`, err.message);
                } else {
                    console.log(`Column ${column} updated to max level 30 where necessary.`);
                }
            });
        });
    }

    // Method to check if a column exists in the table
    checkIfColumnExists(tableName, columnName) {
        return new Promise((resolve, reject) => {
            const query = `PRAGMA table_info(${tableName})`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const columnExists = rows.some(row => row.name === columnName);
                resolve(columnExists);
            });
        });
    }

    async executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    async executeSelectQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row);
            });
        });
    }

    async executeSelectAllQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }

    async getUser(userId) {
        try {
            const row = await this.executeSelectQuery(`SELECT * FROM User WHERE id = ?`, [userId]);

            if (row) {
                console.log(`User ${userId} found`);
                return row;
            } else {
                console.log(`User ${userId} not found. Creating new user.`);
                await this.createUser(userId);
                return { id: userId, credits: 10000, bitcoin: 0, last_bought_price: 0, last_bought_amount: 0, total_bought_price: 0, total_bought_amount: 0, total_sold_price: 0, total_sold_amount: 0 };
            }
        } catch (err) {
            console.error('Failed to get user:', err.message);
            throw err;
        }
    }

    async createUser(userId) {
        const query = `
            INSERT INTO User (id, credits, bitcoin, last_bought_price, last_bought_amount, total_bought_price, total_bought_amount, total_sold_price, total_sold_amount, dinonuggies, dinonuggies_last_claimed, dinonuggies_claim_streak, multiplier_amount_level, multiplier_rarity_level, beki_level)
            VALUES (?, 10000, 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0, 1, 1, 1);`;
        
        try {
            await this.executeQuery(query, [userId]);
            console.log(`New user ${userId} created`);
        } catch (err) {
            console.error('Failed to create user:', err.message);
            throw err;
        }
    }

    async addUserAttr(userId, field, value) {
        try {
            await this.getUser(userId);
            const query = `UPDATE User SET ${field} = ${field} + ? WHERE id = ?;`;
            await this.executeQuery(query, [value, userId]);
            console.log(`Updated user ${userId}: ${field} increased by ${value}.`);
        } catch (err) {
            console.error(`Failed to update ${field}:`, err.message);
        }
    }

    async setUserAttr(userId, field, value) {
        try {
            await this.getUser(userId);
            const query = `UPDATE User SET ${field} = ? WHERE id = ?;`;
            await this.executeQuery(query, [value, userId]);
            console.log(`Updated user ${userId}: ${field} set to ${value}.`);
        } catch (err) {
            console.error(`Failed to override ${field}:`, err.message);
        }
    }

    async getUserAttr(userId, attribute) {
        try {
            const user = await this.getUser(userId);
            return user[attribute];
        } catch (err) {
            console.error(`Failed to get ${attribute}:`, err.message);
            return null;
        }
    }

    async getEveryoneAttr(attribute) {
        try {
            const query = `SELECT id, ${attribute} FROM User WHERE ${attribute} <> 0 ORDER BY ${attribute} DESC;`;
            const rows = await this.executeSelectAllQuery(query);
            console.log(rows);
            return rows;
        } catch (err) {
            console.error(`Failed to get ${attribute}:`, err.message);
            return null;
        }
    }

    async dump(){
        // output as a table
        const query = `SELECT * FROM User;`;
        const rows = await this.executeSelectAllQuery(query);
        const keys = Object.keys(rows[0]);
        const csv = [keys.join(',')];
        rows.forEach(row => {
            const values = keys.map(key => {
                if (key === 'id') {
                    return `<@${row[key]}>`;
                } else {
                    return row[key];
                }
            });
            csv.push(values.join(','));
        });
        return csv.join('\n');
    }
}

module.exports = { Database };
