const battleshipsMatchQueries = {
  INSERT_MATCH: `
    INSERT INTO BattleshipsMatch
      (id, x_discord_id, o_discord_id, winner_discord_id, end_reason, created_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  GET_RECENT_FOR_USER: `
    SELECT * FROM BattleshipsMatch
    WHERE x_discord_id = ? OR o_discord_id = ?
    ORDER BY ended_at DESC
    LIMIT ?
  `,
  // Back the per-user recent-match lookup (GET_RECENT_FOR_USER).
  CREATE_INDEX_X_RECENT: `
    CREATE INDEX IF NOT EXISTS idx_battleships_x_id_ended_at
    ON BattleshipsMatch (x_discord_id, ended_at DESC)
  `,
  CREATE_INDEX_O_RECENT: `
    CREATE INDEX IF NOT EXISTS idx_battleships_o_id_ended_at
    ON BattleshipsMatch (o_discord_id, ended_at DESC)
  `,
};

export default battleshipsMatchQueries;
