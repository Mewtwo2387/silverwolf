const webSessionQueries = {
  INSERT_SESSION: `
    INSERT INTO WebSession (id, discord_id, csrf_token, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  GET_SESSION: 'SELECT * FROM WebSession WHERE id = ?',
  TOUCH_SESSION: 'UPDATE WebSession SET last_seen_at = ?, expires_at = ? WHERE id = ?',
  DELETE_SESSION: 'DELETE FROM WebSession WHERE id = ?',
  DELETE_EXPIRED: 'DELETE FROM WebSession WHERE expires_at < ?',
};

export default webSessionQueries;
