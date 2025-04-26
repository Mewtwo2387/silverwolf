const { log, logError } = require('../../../utils/log');

class UserService {
    constructor(db) {
        this.db = db; 
    }

    async createUser(userId) {
        const query = `INSERT INTO User (id) VALUES (?)`;
        try {
            await this.db.executeQuery(query, [userId]);
            log(`New user ${userId} created`);
        } catch (err) {
            logError('Failed to create user:', err.message);
            throw err;
        }
    }

    async createUserIfNotExists(userId) {
        const query = `INSERT INTO User (id) VALUES (?)`;
        try {
            await this.db.executeQuery(query, [userId]);
            log(`New user ${userId} created`);
        } catch (err) {
            log(`User ${userId} already exists`);
        }
    }

    async addUserAttr(userId, field, value) {
        try {
            if (value == null) {
                if (field !== 'dinonuggies_last_claimed') {
                    log(`Skipping update for ${field} as value is null`);
                    return;
                }
            }
            await this.createUserIfNotExists(userId);
            const query = `UPDATE User SET ${field} = ${field} + ? WHERE id = ?;`;
            await this.db.executeQuery(query, [value, userId]);
            log(`Updated user ${userId}: ${field} increased by ${value}.`);
        } catch (err) {
            logError(`Failed to update ${field}:`, err.message);
        }
    }

    async setUserAttr(userId, field, value) {
        try {
            if (value == null) {
                if (field !== 'dinonuggies_last_claimed') {
                    log(`Skipping update for ${field} as value is null`);
                    return;
                }
            }
            await this.createUserIfNotExists(userId);
            const query = `UPDATE User SET ${field} = ? WHERE id = ?;`;
            await this.db.executeQuery(query, [value, userId]);
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

    async getUser(userId) {
        try {
            const query = `SELECT * FROM User WHERE id = ?`;
            const user = await this.db.executeSelectQuery(query, [userId]);
            if (!user) {
                await this.createUser(userId);
                return await this.db.executeSelectQuery(query, [userId]);
            }
            return user;
        } catch (err) {
            logError('Failed to fetch user:', err.message);
            throw err;
        }
    }

    async getEveryoneAttr(attribute, limit = null, offset = 0) {
        try {
            let query = `SELECT id, ${attribute} FROM User WHERE ${attribute} <> 0 ORDER BY ${attribute} DESC`;
            if (limit !== null) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }
            const rows = await this.db.executeSelectAllQuery(query);
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
            const rows = await this.db.executeSelectAllQuery(query);
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
            const rows = await this.db.executeSelectAllQuery(query);
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
            const rows = await this.db.executeSelectAllQuery(query);
            return rows[0].count;
        } catch (err) {
            logError(`Failed to count ${attribute}:`, err.message);
            return 0;
        }
    }

    async getAllRelativeNetWinningsCount() {
        try {
            const query = `SELECT COUNT(*) AS count FROM User WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0;`;
            const rows = await this.db.executeSelectAllQuery(query);
            return rows[0].count;
        } catch (err) {
            logError(`Failed to count all relative net winnings:`, err.message);
            return 0;
        }
    }
}

module.exports = UserService;
