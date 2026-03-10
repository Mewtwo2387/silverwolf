const aiChatSessionTable = {
    name: 'AiChatSession',
    columns: [
        { name: 'session_id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'user_id', type: 'VARCHAR NOT NULL' },
        { name: 'persona_name', type: 'VARCHAR NOT NULL' },
        { name: 'active', type: 'INTEGER DEFAULT 1' },
        { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
    primaryKey: ['session_id'],
    specialConstraints: [],
    constraints: [
        'FOREIGN KEY (user_id) REFERENCES User(id)',
    ],
};

module.exports = aiChatSessionTable;
