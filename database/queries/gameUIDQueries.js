const gameUIDQueries = {
  GET_ALL_GAME_UIDS: 'SELECT * FROM GameUID WHERE user_id = ?',
  ADD_GAME_UID: 'INSERT INTO GameUID (user_id, game, game_uid, region) VALUES (?, ?, ?, ?)',
  DELETE_GAME_UID: 'DELETE FROM GameUID WHERE user_id = ? AND game = ?',
  GET_GAME_UID: 'SELECT * FROM GameUID WHERE user_id = ? AND game = ?',
};

module.exports = gameUIDQueries;
