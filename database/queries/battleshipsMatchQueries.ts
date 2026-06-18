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
};

export default battleshipsMatchQueries;
