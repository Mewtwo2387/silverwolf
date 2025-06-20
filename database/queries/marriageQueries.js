const marriageQueries = {
  ADD_MARRIAGE: 'INSERT INTO Marriage (user1_id, user2_id) VALUES (?, ?)',
  DELETE_MARRIAGE: 'DELETE FROM Marriage WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
  GET_MARRIAGE: 'SELECT * FROM Marriage WHERE user1_id = ? OR user2_id = ?',
};

module.exports = marriageQueries;
