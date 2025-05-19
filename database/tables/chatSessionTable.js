const chatSessionTable = {
  name: 'ChatSession',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR NOT NULL' },
    { name: 'channel_id', type: 'VARCHAR NOT NULL' },
    { name: 'started_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { name: 'ended_at', type: 'DATETIME DEFAULT NULL' },
    { name: 'message_count', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (user_id) REFERENCES User(id)',
  ],
};

module.exports = chatSessionTable;
