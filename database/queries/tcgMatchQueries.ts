const tcgMatchQueries = {
  INSERT_MATCH: `
    INSERT INTO TcgMatch
      (id, mode, p1_discord_id, p1_username, p1_team,
       p2_discord_id, p2_username, p2_team, winner, end_reason, rounds, created_at, ended_at, final_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  GET_BY_ID: `
    SELECT * FROM TcgMatch WHERE id = ?
  `,
  GET_RECENT: `
    SELECT * FROM TcgMatch
    ORDER BY ended_at DESC
    LIMIT ? OFFSET ?
  `,
  GET_RECENT_FOR_USER: `
    SELECT * FROM TcgMatch
    WHERE p1_discord_id = ? OR p2_discord_id = ?
    ORDER BY ended_at DESC
    LIMIT ?
  `,
};

export default tcgMatchQueries;
