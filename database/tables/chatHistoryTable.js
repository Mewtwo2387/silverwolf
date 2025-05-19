const chatHistoryTable = {
  name: 'ChatHistory',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'session_id', type: 'INTEGER NOT NULL' },
    { name: 'message_id', type: 'VARCHAR NOT NULL' },
    { name: 'content', type: 'TEXT NOT NULL' },
    { name: 'timestamp', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (session_id) REFERENCES ChatSession(id)',
  ],
};

module.exports = chatHistoryTable;
