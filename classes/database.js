const sqlite3 = require('sqlite3').verbose();
const { log, logError } = require('../utils/log');


const userTable = {
    name: 'User',
    columns: [
        { name: 'id', type: 'VARCHAR PRIMARY KEY' },
        { name: 'credits', type: 'INTEGER DEFAULT 0' },
        { name: 'bitcoin', type: 'FLOAT DEFAULT 0' },
        { name: 'last_bought_price', type: 'FLOAT DEFAULT 0' },
        { name: 'last_bought_amount', type: 'FLOAT DEFAULT 0' },
        { name: 'total_bought_price', type: 'FLOAT DEFAULT 0' },
        { name: 'total_bought_amount', type: 'FLOAT DEFAULT 0' },
        { name: 'total_sold_price', type: 'FLOAT DEFAULT 0' },
        { name: 'total_sold_amount', type: 'FLOAT DEFAULT 0' },
        { name: 'dinonuggies', type: 'INTEGER DEFAULT 0' },
        { name: 'dinonuggies_last_claimed', type: 'DATETIME DEFAULT NULL' },
        { name: 'dinonuggies_claim_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'multiplier_amount_level', type: 'INTEGER DEFAULT 1' },
        { name: 'multiplier_rarity_level', type: 'INTEGER DEFAULT 1' },
        { name: 'beki_level', type: 'INTEGER DEFAULT 1' },
        { name: 'birthdays', type: 'DATETIME DEFAULT NULL' },
        { name: 'ascension_level', type: 'INTEGER DEFAULT 1' },
        { name: 'heavenly_nuggies', type: 'INTEGER DEFAULT 0' },
        { name: 'nuggie_flat_multiplier_level', type: 'INTEGER DEFAULT 1' },
        { name: 'nuggie_streak_multiplier_level', type: 'INTEGER DEFAULT 1' },
        { name: 'nuggie_credits_multiplier_level', type: 'INTEGER DEFAULT 1' },
        { name: 'pity', type: 'INTEGER DEFAULT 0' },
        { name: 'slots_times_played', type: 'INTEGER DEFAULT 0' },
        { name: 'slots_amount_gambled', type: 'FLOAT DEFAULT 0' },
        { name: 'slots_times_won', type: 'INTEGER DEFAULT 0' },
        { name: 'slots_amount_won', type: 'FLOAT DEFAULT 0' },
        { name: 'slots_relative_won', type: 'FLOAT DEFAULT 0' },
        { name: 'blackjack_times_played', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_amount_gambled', type: 'FLOAT DEFAULT 0' },
        { name: 'blackjack_times_won', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_times_drawn', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_times_lost', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_amount_won', type: 'FLOAT DEFAULT 0' },
        { name: 'blackjack_relative_won', type: 'FLOAT DEFAULT 0' },
        { name: 'roulette_times_played', type: 'INTEGER DEFAULT 0' },
        { name: 'roulette_amount_gambled', type: 'FLOAT DEFAULT 0' },
        { name: 'roulette_times_won', type: 'INTEGER DEFAULT 0' },
        { name: 'roulette_amount_won', type: 'FLOAT DEFAULT 0' },
        { name: 'roulette_relative_won', type: 'FLOAT DEFAULT 0' },
        { name: 'roulette_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'roulette_max_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'blackjack_max_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'dinonuggie_last_gambled', type: 'DATETIME DEFAULT NULL' },
        { name: 'nuggie_pokemon_multiplier_level', type: 'INTEGER DEFAULT 1' },
        { name: 'nuggie_nuggie_multiplier_level', type: 'INTEGER DEFAULT 1' },
        { name: 'stellar_nuggies', type: 'INTEGER DEFAULT 0' },
        { name: 'last_murder', type: 'DATETIME DEFAULT NULL' },
        { name: 'murder_success', type: 'INTEGER DEFAULT 0' },
        { name: 'murder_fail', type: 'INTEGER DEFAULT 0' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: []
};

const pokemonTable = {
    name: 'Pokemon',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'user_id', type: 'VARCHAR' },
        { name: 'pokemon_name', type: 'TEXT' },
        { name: 'pokemon_count', type: 'INTEGER DEFAULT 0' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'FOREIGN KEY (user_id) REFERENCES User(id)',
        'UNIQUE (user_id, pokemon_name)'
    ]
};

const marriageTable = {
    name: 'Marriage',
    columns: [
        { name: 'user1_id', type: 'VARCHAR NOT NULL' },
        { name: 'user2_id', type: 'VARCHAR NOT NULL' },
        { name: 'married_on', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ],
    primaryKey: ['user1_id', 'user2_id'],
    specialConstraints: [
        'PRIMARY KEY (user1_id, user2_id)'
    ],
    constraints: [
        'FOREIGN KEY (user1_id) REFERENCES User(id)',
        'FOREIGN KEY (user2_id) REFERENCES User(id)'
    ]
};


const serverRolesTable = {
    name: 'ServerRoles',
    columns: [
        { name: 'server_id', type: 'VARCHAR PRIMARY KEY' },
        { name: 'role_name', type: 'VARCHAR NOT NULL' },
        { name: 'role_id', type: 'VARCHAR NOT NULL' }
    ],
    primaryKey: ['server_id'],
    specialConstraints: [],
    constraints: []
};

const gameUIDTable = {
    name: 'GameUID',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'user_id', type: 'VARCHAR NOT NULL' },
        { name: 'game', type: 'TEXT NOT NULL' },
        { name: 'game_uid', type: 'TEXT NOT NULL' },
        { name: 'region', type: 'TEXT DEFAULT NULL' },
        { name: 'date', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'UNIQUE (user_id, game)'
    ]
};

const commandConfigTable = {
    name: 'CommandConfig',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'command_name', type: 'TEXT NOT NULL' },
        { name: 'server_id', type: 'VARCHAR NOT NULL' },
        { name: 'disabled_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'reason', type: 'TEXT' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'UNIQUE (command_name, server_id)'
    ]
};

const globalConfigTable = {
    name: 'GlobalConfig',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'key', type: 'TEXT NOT NULL' },
        { name: 'value', type: 'TEXT NOT NULL' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'UNIQUE (key)'
    ]
};


const babyTable = {
    name: 'Baby',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'mother_id', type: 'VARCHAR NOT NULL' },
        { name: 'father_id', type: 'VARCHAR NOT NULL' },
        { name: 'status', type: 'TEXT NOT NULL' },
        { name: 'name', type: 'TEXT DEFAULT "baby"' },
        { name: 'created', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'born', type: 'DATETIME DEFAULT NULL' },
        { name: 'level', type: 'INTEGER DEFAULT 0' },
        { name: 'job', type: 'TEXT DEFAULT NULL' },
        { name: 'pinger_target', type: 'VARCHAR DEFAULT NULL' },
        { name: 'pinger_channel', type: 'VARCHAR DEFAULT NULL' },
        { name: 'nuggie_claimer_claims', type: 'INTEGER DEFAULT 0'},
        { name: 'nuggie_claimer_claimed', type: 'INTEGER DEFAULT 0'},
        { name: 'gambler_games', type: 'INTEGER DEFAULT 0'},
        { name: 'gambler_wins', type: 'INTEGER DEFAULT 0'},
        { name: 'gambler_losses', type: 'INTEGER DEFAULT 0'},
        { name: 'gambler_credits_gambled', type: 'INTEGER DEFAULT 0'},
        { name: 'gambler_credits_won', type: 'INTEGER DEFAULT 0'},
        { name: 'pinger_pings', type: 'INTEGER DEFAULT 0'}
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'FOREIGN KEY (mother_id) REFERENCES User(id)',
        'FOREIGN KEY (father_id) REFERENCES User(id)'
    ]
};

const chatHistoryTable = {
    name: 'ChatHistory',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'session_id', type: 'INTEGER NOT NULL' },
        { name: 'role', type: "TEXT CHECK(role IN ('user', 'model')) NOT NULL" },
        { name: 'message', type: 'TEXT NOT NULL' },
        { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: []
};


const tables = [userTable, pokemonTable, marriageTable, serverRolesTable, gameUIDTable, commandConfigTable, globalConfigTable, babyTable, chatHistoryTable];


class Database {
    constructor(){
        this.db = new sqlite3.Database('./database.db', (err) => {
            if (err) {
                logError('Failed to connect to the database:', err.message);
            } else {
                log('Connected to the database.db SQLite database.');
                this.init();
            }
        });
    }

    createTable(tableJSON){
        let rows = tableJSON.columns.map(col => `${col.name} ${col.type}`).join(', ');
        if (tableJSON.specialConstraints.length > 0){
            rows += `, ${tableJSON.specialConstraints.join(', ')}`;
        }
        if (tableJSON.constraints.length > 0){
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

    updateTable(tableJSON){
        let columnsToAdd = tableJSON.columns.filter(col => !tableJSON.primaryKey.includes(col.name));
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


    init(){
        log("--------------------\nInitializing database...\n--------------------");

        for (const table of tables){
            this.createTable(table);
        }

        for (const table of tables){
            this.updateTable(table);
        }
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
            this.db.run(query, params, function (err) { // Use a regular function to access 'this'
                if (err) {
                    return reject(err);
                }
                resolve({ changes: this.changes }); // Return the number of changes
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
                log(`User ${userId} found`);
                return row;
            } else {
                log(`User ${userId} not found. Creating new user.`);
                await this.createUser(userId);
                return await this.getUser(userId);
            }
        } catch (err) {
            logError('Failed to get user:', err.message);
            throw err;
        }
    }

    async createUser(userId) {
        const query = `INSERT INTO User (id) VALUES (?)`;

        try {
            await this.executeQuery(query, [userId]);
            log(`New user ${userId} created`);
        } catch (err) {
            logError('Failed to create user:', err.message);
            throw err;
        }
    }

    async addUserAttr(userId, field, value) {
        try {
            if (value == null || value == undefined){
                if(field != 'dinonuggies_last_claimed'){
                    log(`Skipping update for ${field} as value is null`);
                    return;
                }
            }
            await this.getUser(userId);
            const query = `UPDATE User SET ${field} = ${field} + ? WHERE id = ?;`;
            await this.executeQuery(query, [value, userId]);
            log(`Updated user ${userId}: ${field} increased by ${value}.`);
        } catch (err) {
            logError(`Failed to update ${field}:`, err.message);
        }
    }

    async setUserAttr(userId, field, value) {
        try {
            if (value == null || value == undefined){
                if(field != 'dinonuggies_last_claimed'){
                    log(`Skipping update for ${field} as value is null`);
                    return;
                }
            }
            await this.getUser(userId);
            const query = `UPDATE User SET ${field} = ? WHERE id = ?;`;
            await this.executeQuery(query, [value, userId]);
            log(`Updated user ${userId}: ${field} set to ${value}.`);
        } catch (err) {
            logError(`Failed to override ${field}:`, err.message);
        }
    }

    async getUserAttr(userId, attribute) {
        try {
            const user = await this.getUser(userId);
            return user[attribute];
        } catch (err) {
            logError(`Failed to get ${attribute}:`, err.message);
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
            log(rows);
            return rows;
        } catch (err) {
            logError(`Failed to get ${attribute}:`, err.message);
            return null;
        }
    }

    async getRelativeNetWinnings(type, limit = null, offset = 0) {
        try {
            let query = `SELECT id, (${type}_relative_won - ${type}_times_played) AS relative_won FROM User WHERE ${type}_times_played <> 0 ORDER BY relative_won DESC`;
            if (limit !== null) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }
            const rows = await this.executeSelectAllQuery(query);
            log(rows);
            return rows;
        } catch (err) {
            logError(`Failed to get relative won:`, err.message);
            return null;
        }
    }

    async getAllRelativeNetWinnings(limit = null, offset = 0) {
        try {
            let query = `SELECT id, (slots_relative_won + blackjack_relative_won + roulette_relative_won - slots_times_played - blackjack_times_played - roulette_times_played) AS relative_won FROM User WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0 ORDER BY relative_won DESC`;
            if (limit !== null) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }
            const rows = await this.executeSelectAllQuery(query);
            log(rows);
            return rows;
        } catch (err) {
            logError(`Failed to get all relative net winnings:`, err.message);
            return null;
        }
    }
    
    async getEveryoneAttrCount(attribute) {
        try {
            const query = `SELECT COUNT(*) AS count FROM User WHERE ${attribute} <> 0;`;
            const rows = await this.executeSelectAllQuery(query);
            return rows[0].count;
        } catch (err) {
            logError(`Failed to count ${attribute}:`, err.message);
            return 0;
        }
    }

    async getAllRelativeNetWinningsCount() {
        try {
            const query = `SELECT COUNT(*) AS count FROM User WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0;`;
            const rows = await this.executeSelectAllQuery(query);
            return rows[0].count;
        } catch (err) {
            logError(`Failed to count all relative net winnings:`, err.message);
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
            log(`User ${userId} caught a ${pokemonName}`);
        } catch (err) {
            logError('Failed to catch Pokemon:', err.message);
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
                log(`User ${userId} sacrificed their last ${pokemonName} and it was removed from the database`);
            } else {
                // If count is greater than 1, decrement it
                const updateQuery = `UPDATE Pokemon SET pokemon_count = pokemon_count - 1 WHERE user_id = ? AND pokemon_name = ?;`;
                await this.executeQuery(updateQuery, [userId, pokemonName]);
                log(`User ${userId} sacrificed a ${pokemonName}`);
            }
        } catch (err) {
            logError('Failed to sacrifice Pokemon:', err.message);
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
    
    async getUniquePokemonCount(userId){
        const query = `SELECT COUNT(*) AS count FROM (SELECT DISTINCT pokemon_name FROM Pokemon WHERE user_id = ?);`;
        const row = await this.executeSelectQuery(query, [userId]);
        return row ? row.count : 0;
    }
    // the amazing crytek code (ip grabber)
    async getUsersWithPokemon(type) {
        const query = `
        SELECT DISTINCT u.id AS user_id, p.pokemon_count
        FROM User u
        INNER JOIN Pokemon p ON u.id = p.user_id
        WHERE LOWER(p.pokemon_name) = ?;
    `;
        const rows = await this.executeSelectAllQuery(query, [type]);
        return rows.map(row => ({
            user_id: row.user_id,
            pokemon_count: row.pokemon_count
        }));
    }

    async setUserBirthday(userId, birthday) {
        try {
            await this.getUser(userId);
            const query = `UPDATE User SET birthdays = ? WHERE id = ?;`;
            await this.executeQuery(query, [birthday, userId]);
            log(`Updated user ${userId}: birthday set to ${birthday}.`);
        } catch (err) {
            logError(`Failed to set birthday for user ${userId}:`, err.message);
        }
    }

    async getUserBirthday(userId) {
        return await this.getUserAttr(userId, 'birthdays');
    }

    async getUsersWithBirthday(todayHour) {
        // Check for users whose birthdays fall on the current UTC day and hour (ignoring the year)
        const query = `SELECT id FROM User WHERE strftime('%m-%dT%H', birthdays) = ?`;
        const users = await this.executeSelectAllQuery(query, [todayHour]);
        log('Database Response:', users);
        return users;
    }


    async dumpTable(tableName, formatUserIds = null) {
        const query = `SELECT * FROM ${tableName};`;
        const rows = await this.executeSelectAllQuery(query);
    
        // Check if rows is an array and has at least one item
        if (!Array.isArray(rows) || rows.length === 0) {
            log(`No data found in the ${tableName} table.`);
            return "";
        }
    
        const keys = Object.keys(rows[0]);
        const csv = [keys.join(',')];
        
        rows.forEach(row => {
            const values = keys.map(key => {
                if (formatUserIds && formatUserIds.includes(key)) {
                    return `<@${row[key]}>`;
                } else {
                    return row[key];
                }
            });
            csv.push(values.join(','));
        });
        
        return csv.join('\n');
    }
    
    async dump() {
        return await this.dumpTable('User', ['id']);
    }
    
    async dumpPokemon() {
        return await this.dumpTable('Pokemon', ['user_id']);
    }
    
    async dumpMarriage() {
        return await this.dumpTable('Marriage', ['user1_id', 'user2_id']);
    }

    async dumpBaby() {
        return await this.dumpTable('Baby', ['mother_id', 'father_id']);
    }
    
    // Add a marriage
    async addMarriage(user1Id, user2Id) {
        const query = `INSERT INTO Marriage (user1_id, user2_id) VALUES (?, ?)`;
        try {
            await this.executeQuery(query, [user1Id, user2Id]);
            log(`Marriage added between ${user1Id} and ${user2Id}.`);
        } catch (err) {
            logError('Failed to add marriage:', err.message);
        }
    }

    // Remove a marriage
    async removeMarriage(user1Id, user2Id) {
        const query = `DELETE FROM Marriage WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`;
        try {
            await this.executeQuery(query, [user1Id, user2Id, user2Id, user1Id]);
            log(`Marriage removed between ${user1Id} and ${user2Id}.`);
        } catch (err) {
            logError('Failed to remove marriage:', err.message);
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
            logError('Failed to check marriage status:', err.message);
            return { isMarried: false };
        }
    }

    async setServerRole(serverId, roleName, roleId) {
        const query = `INSERT OR REPLACE INTO ServerRoles (server_id, role_name, role_id) VALUES (?, ?, ?)`;
        try {
            await this.executeQuery(query, [serverId, roleName, roleId]);
            log(`Server role set for server ${serverId}: ${roleName}.`);
        } catch (err) {
            logError('Failed to set server role:', err.message);
        }
    }

    async getServerRole(serverId, roleName) {
        const query = `SELECT role_id FROM ServerRoles WHERE server_id = ? AND role_name = ?;`;
        const row = await this.executeSelectQuery(query, [serverId, roleName]);
        return row ? row.role_id : null;
    }

    // Get GameUIDs for a user
    async getGameUIDsForUser(userId) {
        const query = `SELECT id, game, game_uid, region, date FROM GameUID WHERE user_id = ?`;
        try {
            const rows = await this.executeSelectAllQuery(query, [userId]);
            return rows; // This will be an array, even if empty
        } catch (err) {
            logError('Error retrieving GameUIDs:', err.message);
            throw err; // Propagate the error so it can be handled by the caller
        }
    }
    

    // Add or update a GameUID
    async addOrUpdateGameUID(userId, game, gameUID, region) {
        const query = `
            INSERT INTO GameUID (user_id, game, game_uid, region)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, game)
            DO UPDATE SET game_uid = excluded.game_uid, region = excluded.region
        `;
        try {
            await this.executeQuery(query, [userId, game, gameUID, region]);
            log(`Added or updated game UID for game: ${game}`);
        } catch (err) {
            logError('Error adding or updating GameUID:', err.message);
            throw err;
        }
    }

    // Delete a GameUID by game name
    async deleteGameUID(userId, game) {
        const query = `DELETE FROM GameUID WHERE user_id = ? AND game = ?`;
        try {
            const result = await this.executeQuery(query, [userId, game]);
            if (result.changes > 0) {
                log(`Deleted game UID record for game: ${game}`);
                return `Successfully deleted the record for game: ${game}`;
            } else {
                log(`No record found for game: ${game}`);
                return `No record found for game: ${game}`;
            }
        } catch (err) {
            logError('Error deleting GameUID:', err.message);
            throw err;
        }
    }


    // Add or update a blacklist entry
    async addOrUpdateCommandBlacklist(commandName, serverId, reason) {
        const query = `
            INSERT INTO CommandConfig (command_name, server_id, reason)
            VALUES (?, ?, ?)
            ON CONFLICT(command_name, server_id)
            DO UPDATE SET reason = excluded.reason, disabled_date = CURRENT_TIMESTAMP
        `;
        try {
            await this.executeQuery(query, [commandName, serverId, reason]);
            log(`Added or updated blacklist for command: ${commandName} in server: ${serverId}`);
        } catch (err) {
            logError('Error adding or updating command blacklist:', err.message);
            throw err;
        }
    }

    // Retrieve all blacklisted commands for a server
    async getBlacklistedCommands(serverId) {
        const query = `SELECT id, command_name, disabled_date, reason FROM CommandConfig WHERE server_id = ?`;
        try {
            const rows = await this.executeSelectAllQuery(query, [serverId]);
            return rows; // Returns an array of blacklisted commands or empty array if none found
        } catch (err) {
            logError('Error retrieving blacklisted commands:', err.message);
            throw err;
        }
    }

    // Remove a blacklist entry by command name and server ID
    async deleteCommandBlacklist(commandName, serverId) {
        const query = `DELETE FROM CommandConfig WHERE command_name = ? AND server_id = ?`;
        try {
            const result = await this.executeQuery(query, [commandName, serverId]);
            if (result.changes > 0) {
                log(`Deleted blacklist entry for command: ${commandName} in server: ${serverId}`);
                return `Successfully deleted the blacklist entry for command: ${commandName}`;
            } else {
                log(`No blacklist entry found for command: ${commandName} in server: ${serverId}`);
                return `No blacklist entry found for command: ${commandName}`;
            }
        } catch (err) {
            logError('Error deleting command blacklist:', err.message);
            throw err;
        }
    }

    async setGlobalConfig(key, value) {
        const query = `INSERT OR REPLACE INTO GlobalConfig (key, value) VALUES (?, ?)`;
        await this.executeQuery(query, [key, value]);
        log(`Set global config ${key} to ${value}`);
    }

    async getGlobalConfig(key) {
        const query = `SELECT value FROM GlobalConfig WHERE key = ?`;
        const row = await this.executeSelectQuery(query, [key]);
        log(`Global config ${key} is ${row ? row.value : null}`);
        return row ? row.value : null;
    }

    async getAllGlobalConfig() {
        const query = `SELECT * FROM GlobalConfig`;
        const rows = await this.executeSelectAllQuery(query);
        return rows;
    }

    async addGachaItem(userId, itemName, itemType, rarity) {
        const query = `
            INSERT INTO GachaInventory (user_id, item_name, item_type, rarity, quantity)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(user_id, item_name) DO UPDATE SET
            quantity = quantity + 1;
        `;
        return this.executeQuery(query, [userId, itemName, itemType, rarity]);
    }

    async removeGachaItem(userId, itemName) {
        const currentCount = await this.getItemCount(userId, itemName);
        if (currentCount <= 1) {
            const deleteQuery = `DELETE FROM GachaInventory WHERE user_id = ? AND item_name = ?;`;
            return this.executeQuery(deleteQuery, [userId, itemName]);
        } else {
            const updateQuery = `UPDATE GachaInventory SET quantity = quantity - 1 WHERE user_id = ? AND item_name = ?;`;
            return this.executeQuery(updateQuery, [userId, itemName]);
        }
    }

    async getInventory(userId) {
        const query = `SELECT * FROM GachaInventory WHERE user_id = ?;`;
        return this.executeSelectAllQuery(query, [userId]);
    }

    async addChatHistory(sessionId, role, message) {
        const query = `INSERT INTO ChatHistory (session_id, role, message) VALUES (?, ?, ?)`;
        return this.executeQuery(query, [sessionId, role, message]);
    }

    async getChatHistory(sessionId) {
        const query = `SELECT role, message, timestamp FROM ChatHistory WHERE session_id = ? ORDER BY id DESC LIMIT 100`;
        return this.executeSelectAllQuery(query, [sessionId]);
    }

    async addBaby(motherId, fatherId) {
        const query = `INSERT INTO Baby (mother_id, father_id, status, name) VALUES (?, ?, "unborn", "baby")`;
        const result = await this.executeQuery(query, [motherId, fatherId]);
        const babyId = result.lastID;
        const query2 = `UPDATE Baby SET name = ? WHERE id = ?`;
        await this.executeQuery(query2, [`baby${babyId}`, babyId]);
        log(`Added baby to the database. Mother: ${motherId}, Father: ${fatherId}, Status: unborn, Name: baby${babyId}`);
        return babyId;
    }

    async nameBaby(babyId, name) {
        let query = `UPDATE Baby SET name = ? WHERE id = ?`;
        let result = await this.executeQuery(query, [name, babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Named baby ${babyId}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}, Name: ${baby.name}`);
    }

    async getBabyFromId(babyId) {
        let query = `SELECT * FROM Baby WHERE id = ?`;
        let row = await this.executeSelectQuery(query, [babyId]);
        return row;
    }

    async getBabies(motherId, fatherId) {
        let query = `SELECT * FROM Baby WHERE mother_id = ? AND father_id = ?`;
        let rows1 = await this.executeSelectAllQuery(query, [motherId, fatherId]);
        let rows2 = await this.executeSelectAllQuery(query, [fatherId, motherId]);
        return [...rows1, ...rows2];
    }

    async getAllBabies() {
        let query = `SELECT * FROM Baby`;
        let rows = await this.executeSelectAllQuery(query);
        return rows;
    }

    async haveBaby(motherId, fatherId) {
        const babies = await this.getBabies(motherId, fatherId);
        return babies.length > 0;
    }

    async babyIsUnborn(babyId) {
        let baby = await this.getBabyFromId(babyId);
        return baby.status === "unborn";
    }

    async bornBaby(babyId) {
        if (!(await this.babyIsUnborn(babyId))) {
            log(`Baby is not unborn`);
            return false;
        }
        await this.updateBabyStatus(babyId, "born");
        await this.updateBabyBirthday(babyId);
        let baby = await this.getBabyFromId(babyId);
        log(`Baby ${babyId} was born. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}, Birthday: ${baby.born}`);
        return true;
    }

    async updateBabyStatus(babyId, status) {
        let query = `UPDATE Baby SET status = ? WHERE id = ?`;
        await this.executeQuery(query, [status, babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Updated baby ${babyId} to status ${status}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}`);
    }

    async updateBabyJob(babyId, job, pingerTarget = null, pingerChannel = null) {
        if (pingerTarget){
            let query = `UPDATE Baby SET job = ?, pinger_target = ?, pinger_channel = ? WHERE id = ?`;
            await this.executeQuery(query, [job, pingerTarget, pingerChannel, babyId]);
            log(`Updated pinger target to ${pingerTarget} and channel to ${pingerChannel} for baby ${babyId}`);
        } else {
            let query = `UPDATE Baby SET job = ? WHERE id = ?`;
            await this.executeQuery(query, [job, babyId]);
        }
        let baby = await this.getBabyFromId(babyId);
        log(`Updated baby ${babyId} to job ${job}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}`);
    }

    async addBabyAttr(babyId, attr, value) {
        let query = `UPDATE Baby SET ${attr} = ${attr} + ? WHERE id = ?`;
        await this.executeQuery(query, [value, babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Updated baby ${babyId} ${attr} to ${value}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}`);
    }

    async getBabyAttr(babyId, attr) {
        let query = `SELECT ${attr} FROM Baby WHERE id = ?`;
        let row = await this.executeSelectQuery(query, [babyId]);
        return row[attr];
    }

    async setBabyAttr(babyId, attr, value) {
        let query = `UPDATE Baby SET ${attr} = ? WHERE id = ?`;
        await this.executeQuery(query, [value, babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Updated baby ${babyId} ${attr} to ${value}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}`);
    }

    async levelUpBaby(babyId) {
        let query = `UPDATE Baby SET level = level + 1 WHERE id = ?`;
        await this.executeQuery(query, [babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Baby ${babyId} leveled up. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}, Level: ${baby.level}`);
    }

    async updateBabyBirthday(babyId) {
        let query = `UPDATE Baby SET born = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.executeQuery(query, [babyId]);
        let baby = await this.getBabyFromId(babyId);
        log(`Updated baby ${babyId} to birthday ${baby.born}. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}`);
    }
}


module.exports = { Database };
