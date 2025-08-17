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
    { name: 'nuggie_claimer_claims', type: 'INTEGER DEFAULT 0' },
    { name: 'nuggie_claimer_claimed', type: 'INTEGER DEFAULT 0' },
    { name: 'gambler_games', type: 'INTEGER DEFAULT 0' },
    { name: 'gambler_wins', type: 'INTEGER DEFAULT 0' },
    { name: 'gambler_losses', type: 'INTEGER DEFAULT 0' },
    { name: 'gambler_credits_gambled', type: 'INTEGER DEFAULT 0' },
    { name: 'gambler_credits_won', type: 'INTEGER DEFAULT 0' },
    { name: 'pinger_pings', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (mother_id) REFERENCES User(id)',
    'FOREIGN KEY (father_id) REFERENCES User(id)',
  ],
};

module.exports = babyTable;
