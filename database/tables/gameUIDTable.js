const gameUIDTable = {
  name: 'GameUID',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR NOT NULL' },
    { name: 'game', type: 'TEXT NOT NULL' },
    { name: 'game_uid', type: 'TEXT NOT NULL' },
    { name: 'region', type: 'TEXT DEFAULT NULL' },
    { name: 'date', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'UNIQUE (user_id, game)',
    'FOREIGN KEY (user_id) REFERENCES User(id)',
  ],
};

module.exports = gameUIDTable;
