const chatHistoryTable = {
  name: 'ChatHistory',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'session_id', type: 'INTEGER NOT NULL' },
    { name: 'role', type: "TEXT CHECK(role IN ('user', 'model')) NOT NULL" },
    { name: 'message', type: 'TEXT NOT NULL' },
    { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (session_id) REFERENCES ChatSession(session_id)',
  ],
};

module.exports = chatHistoryTable;
