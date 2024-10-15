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
            beki_level INTEGER DEFAULT 1,
            birthdays DATETIME DEFAULT NULL,
            ascension_level INTEGER DEFAULT 1,
            heavenly_nuggies INTEGER DEFAULT 0,
            nuggie_flat_multiplier_level INTEGER DEFAULT 1,
            nuggie_streak_multiplier_level INTEGER DEFAULT 1,
            pity INTEGER DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Created the User table.');
                this.updateSchema();
                this.fixTable();
            }
        });
    
        this.db.run(`CREATE TABLE IF NOT EXISTS Pokemon (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR,
            pokemon_name TEXT,
            pokemon_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES User(id)
            UNIQUE (user_id, pokemon_name)
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Created the Pokemon table.');
            }
        });
    
        // Create Marriage table
        this.db.run(`CREATE TABLE IF NOT EXISTS Marriage (
            user1_id VARCHAR NOT NULL,
            user2_id VARCHAR NOT NULL,
            married_on DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user1_id, user2_id),
            FOREIGN KEY (user1_id) REFERENCES User(id),
            FOREIGN KEY (user2_id) REFERENCES User(id)
        )`, (err) => {
            if (err) {
                console.error('Failed to create Marriage table:', err.message);
            } else {
                console.log('Created the Marriage table.');
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
            { name: 'beki_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'birthdays', type: 'DATETIME', defaultValue: 'NULL' },
            { name: 'ascension_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'heavenly_nuggies', type: 'INTEGER', defaultValue: 0 },
            { name: 'nuggie_flat_multiplier_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'nuggie_streak_multiplier_level', type: 'INTEGER', defaultValue: 1 },
            { name: 'pity', type: 'INTEGER', defaultValue: 0 }
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
        INSERT INTO User (id, credits, bitcoin, last_bought_price, last_bought_amount, total_bought_price, total_bought_amount, total_sold_price, total_sold_amount, dinonuggies, dinonuggies_last_claimed, dinonuggies_claim_streak, multiplier_amount_level, multiplier_rarity_level, beki_level, birthdays, ascension_level, heavenly_nuggies, nuggie_flat_multiplier_level, nuggie_streak_multiplier_level, pity)
        VALUES (?, 10000, 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0, 1, 1, 1, ?, 1, 0, 1, 1, 0);`;

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

    async getEveryoneAttr(attribute, limit = null, offset = 0) {
        try {
            let query = `SELECT id, ${attribute} FROM User WHERE ${attribute} <> 0 ORDER BY ${attribute} DESC`;
            if (limit !== null) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }
            const rows = await this.executeSelectAllQuery(query);
            console.log(rows);
            return rows;
        } catch (err) {
            console.error(`Failed to get ${attribute}:`, err.message);
            return null;
        }
    }
    
    async getEveryoneAttrCount(attribute) {
        try {
            const query = `SELECT COUNT(*) AS count FROM User WHERE ${attribute} <> 0;`;
            const rows = await this.executeSelectAllQuery(query);
            return rows[0].count;
        } catch (err) {
            console.error(`Failed to count ${attribute}:`, err.message);
            return 0;
        }
    }
    

    async catchPokemon(userId, pokemonName) {
        try {
            await this.getUser(userId); // Ensure user exists
            const query = `
                INSERT INTO Pokemon (user_id, pokemon_name, pokemon_count)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id, pokemon_name) DO UPDATE SET
                pokemon_count = pokemon_count + 1;
            `;
            await this.executeQuery(query, [userId, pokemonName]);
            console.log(`User ${userId} caught a ${pokemonName}`);
        } catch (err) {
            console.error('Failed to catch Pokemon:', err.message);
            throw err;
        }
    }

    async sacrificePokemon(userId, pokemonName) {
        try {
            await this.getUser(userId);

            // First, check the current count
            const currentCount = await this.getPokemonCount(userId, pokemonName);

            if (currentCount <= 1) {
                // If count is 1 or less, remove the entry
                const deleteQuery = `DELETE FROM Pokemon WHERE user_id = ? AND pokemon_name = ?;`;
                await this.executeQuery(deleteQuery, [userId, pokemonName]);
                console.log(`User ${userId} sacrificed their last ${pokemonName} and it was removed from the database`);
            } else {
                // If count is greater than 1, decrement it
                const updateQuery = `UPDATE Pokemon SET pokemon_count = pokemon_count - 1 WHERE user_id = ? AND pokemon_name = ?;`;
                await this.executeQuery(updateQuery, [userId, pokemonName]);
                console.log(`User ${userId} sacrificed a ${pokemonName}`);
            }
        } catch (err) {
            console.error('Failed to sacrifice Pokemon:', err.message);
            throw err;
        }
    }


    async getPokemons(userId){
        const query = `SELECT * FROM Pokemon WHERE user_id = ?;`;
        const rows = await this.executeSelectAllQuery(query, [userId]);
        return rows;
    }

    async getPokemonCount(userId, pokemonName){
        const query = `SELECT pokemon_count FROM Pokemon WHERE user_id = ? AND pokemon_name = ?;`;
        const row = await this.executeSelectQuery(query, [userId, pokemonName]);
        return row ? row.pokemon_count : 0;
    }

    async setUserBirthday(userId, birthday) {
        try {
            await this.getUser(userId);
            const query = `UPDATE User SET birthdays = ? WHERE id = ?;`;
            await this.executeQuery(query, [birthday, userId]);
            console.log(`Updated user ${userId}: birthday set to ${birthday}.`);
        } catch (err) {
            console.error(`Failed to set birthday for user ${userId}:`, err.message);
        }
    }

    async getUserBirthday(userId) {
        return await this.getUserAttr(userId, 'birthdays');
    }

    async getUsersWithBirthday(todayHour) {
        // Check for users whose birthdays fall on the current UTC day and hour (ignoring the year)
        const query = `SELECT id FROM User WHERE strftime('%m-%dT%H', birthdays) = ?`;
        const users = await this.executeSelectAllQuery(query, [todayHour]);
        console.log('Database Response:', users);
        return users;
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

    async dumpPokemon(){
        const query = `SELECT * FROM Pokemon;`;
        const rows = await this.executeSelectAllQuery(query);
        const keys = Object.keys(rows[0]);
        const csv = [keys.join(',')];
        rows.forEach(row => {
            const values = keys.map(key => {
                if (key === 'user_id') {
                    return `<@${row[key]}>`;
                } else {
                    return row[key];
                }
            });
            csv.push(values.join(','));
        });
        return csv.join('\n');
    }

    // Add a marriage
    async addMarriage(user1Id, user2Id) {
        const query = `INSERT INTO Marriage (user1_id, user2_id) VALUES (?, ?)`;
        try {
            await this.executeQuery(query, [user1Id, user2Id]);
            console.log(`Marriage added between ${user1Id} and ${user2Id}.`);
        } catch (err) {
            console.error('Failed to add marriage:', err.message);
        }
    }

    // Remove a marriage
    async removeMarriage(user1Id, user2Id) {
        const query = `DELETE FROM Marriage WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`;
        try {
            await this.executeQuery(query, [user1Id, user2Id, user2Id, user1Id]);
            console.log(`Marriage removed between ${user1Id} and ${user2Id}.`);
        } catch (err) {
            console.error('Failed to remove marriage:', err.message);
        }
    }

    // Check if a user is married
    async checkMarriageStatus(userId) {
        const query = `SELECT * FROM Marriage WHERE user1_id = ? OR user2_id = ?`;
        try {
            const marriage = await this.executeSelectQuery(query, [userId, userId]);
            if (marriage) {
                const partnerId = marriage.user1_id === userId ? marriage.user2_id : marriage.user1_id;
                return { isMarried: true, partnerId };
            } else {
                return { isMarried: false };
            }
        } catch (err) {
            console.error('Failed to check marriage status:', err.message);
            return { isMarried: false };
        }
    }
}

module.exports = { Database };
