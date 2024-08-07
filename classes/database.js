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
            credits INTEGER DEFAULT 0,
            bitcoin FLOAT DEFAULT 0,
            last_bought_price FLOAT DEFAULT 0,
            last_bought_amount FLOAT DEFAULT 0,
            total_bought_price FLOAT DEFAULT 0,
            total_bought_amount FLOAT DEFAULT 0,
            total_sold_price FLOAT DEFAULT 0,
            total_sold_amount FLOAT DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Created the User table.');
            }
        });
    }

    async addCredits(userId, amount) {
        try {
            this.getUser(userId);
            await new Promise((resolve, reject) => {
                this.db.run(
                    `UPDATE User SET credits = credits + ? WHERE id = ?;`,
                    [amount, userId],
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

    async addBitcoin(userId, amount) {
        try {
            this.getUser(userId);
            await new Promise((resolve, reject) => {
                this.db.run(
                    `UPDATE User SET bitcoin = bitcoin + ? WHERE id = ?;`,
                    [amount, userId],
                    (err) => {
                        if (err) {
                            return reject(err);
                        }
                        console.log(`Added ${amount} bitcoin to user ${userId}.`);
                        resolve();
                    }
                );
            });
        } catch (err) {
            console.error(err.message);
        }
    }

    async getUser(userId) {
        try {
            const row = await new Promise((resolve, reject) => {
                this.db.get(`SELECT * FROM User WHERE id = ?`, [userId], (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(row);
                });
            });
    
            if (row) {
                console.log(`User ${userId} found`);
                console.log(row);
                return row;
            } else {
                console.log(`User ${userId} not found. Creating new user.`);
                await new Promise((resolve, reject) => {
                    this.db.run(
                        `INSERT INTO User (id, credits, bitcoin, last_bought_price, last_bought_amount, total_bought_price, total_bought_amount, total_sold_price, total_sold_amount) 
                         VALUES (?, 10000, 0, 0, 0, 0, 0, 0, 0)`,
                        [userId],
                        (insertErr) => {
                            if (insertErr) {
                                return reject(insertErr);
                            }
                            console.log(`New user ${userId} created`);
                            resolve();
                        }
                    );
                });
                return { id: userId, credits: 10000, bitcoin: 0 };
            }
        } catch (err) {
            console.error(err.message);
            return 0;
        }
    }

    async getCredits(userId) {
        try {
            const row = await this.getUser(userId);
            return row.credits;
        } catch (err) {
            console.error(err.message);
            return 0;
        }
    }

    async getBitcoin(userId) {
        try {
            const row = await this.getUser(userId);
            return row.bitcoin;
        } catch (err) {
            console.error(err.message);
            return 0;
        }
    }
}

module.exports = { Database };
