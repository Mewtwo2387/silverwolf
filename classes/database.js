const sqlite3 = require('sqlite3').verbose();

class Database {
    constructor(){
        this.db = new sqlite3.Database('./database.db', (err) => {
            if (err) {
              console.error(err.message);
            }
            console.log('Connected to the database.db SQlite database.');
        });
        this.init();
    }

    init(){
        this.db.run(`CREATE TABLE IF NOT EXISTS User (
            id INTEGER PRIMARY KEY,
            credits INTEGER DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Created the User table.');
        });
    }

    async addCredits(userId, amount) {
        try {
            await new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT INTO User (id, credits) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET credits = credits + ?`,
                    [userId, amount, amount],
                    (err) => {
                        if (err) {
                            return reject(err);
                        }
                        console.log(`Added ${amount} credits to user ${userId}.`);
                        resolve();
                    }
                );
            });
        } catch (err) {
            console.error(err.message);
        }
    }

    async getCredits(userId) {
        try {
            const row = await new Promise((resolve, reject) => {
                this.db.get(`SELECT credits FROM User WHERE id = ?`, [userId], (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(row);
                });
            });
    
            if (row) {
                console.log(`User ${userId} has ${row.credits} mystic credits.`);
                return row.credits;
            } else {
                console.log(`User ${userId} not found. Creating new user.`);
                await new Promise((resolve, reject) => {
                    this.db.run(`INSERT INTO User (id, credits) VALUES (?, ?)`, [userId, 0], (insertErr) => {
                        if (insertErr) {
                            return reject(insertErr);
                        }
                        console.log(`New user ${userId} created`);
                        resolve();
                    });
                });
                return 0;
            }
        } catch (err) {
            console.error(err.message);
            return 0;
        }
    }
}

module.exports = { Database };
