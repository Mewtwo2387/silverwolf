const aiChatHistoryTable = {
    name: 'AiChatHistory',
    columns: [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'session_id', type: 'INTEGER NOT NULL' },
        { name: 'role', type: "TEXT CHECK(role IN ('user', 'model', 'assistant')) NOT NULL" },
        { name: 'message', type: 'TEXT NOT NULL' },
        { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
    primaryKey: ['id'],
    specialConstraints: [],
    constraints: [
        'FOREIGN KEY (session_id) REFERENCES AiChatSession(session_id)',
    ],
};

module.exports = aiChatHistoryTable;
