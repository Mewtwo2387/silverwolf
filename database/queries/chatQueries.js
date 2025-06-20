const chatQueries = {
  START_CHAT_SESSION: 'INSERT INTO ChatSession (started_by, server_id) VALUES (?, ?)',
  END_CHAT_SESSION: 'UPDATE ChatSession SET active = 0 WHERE session_id = ?',

  GET_ACTIVE_CHAT_SESSIONS: 'SELECT * FROM ChatSession WHERE active = 1',
  GET_LAST_ACTIVE_SERVER_CHAT_SESSION: 'SELECT * FROM ChatSession WHERE server_id = ? AND active = 1 ORDER BY session_id DESC LIMIT 1',
  GET_CHAT_SESSION_BY_ID: 'SELECT * FROM ChatSession WHERE session_id = ?',

  ADD_CHAT_HISTORY: 'INSERT INTO ChatHistory (session_id, role, message) VALUES (?, ?, ?)',
  GET_CHAT_HISTORY: 'SELECT * FROM ChatHistory WHERE session_id = ? ORDER BY id DESC LIMIT 100',
};

module.exports = chatQueries;
