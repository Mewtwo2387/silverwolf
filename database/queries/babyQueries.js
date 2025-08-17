const babyQueries = {
  // Get all babies
  GET_ALL_BABIES: `
    SELECT * FROM Baby
  `,

  // Get baby details and parent names by baby id
  GET_BABY_BY_ID: `
    SELECT * FROM Baby WHERE id = ?
  `,

  // Get baby details and parent names by parent id
  GET_BABIES_BY_PARENT: `
    SELECT * FROM Baby WHERE mother_id = ? OR father_id = ?
  `,

  // Get statistics of a user
  GET_USER_BABY_STATS: `
    SELECT 
      COUNT(*) as total_babies,
      COUNT(CASE WHEN status = 'pregnant' THEN 1 END) as pregnant_count,
      COUNT(CASE WHEN status = 'born' THEN 1 END) as born_count,
      AVG(level) as average_level,
      SUM(nuggie_claimer_claims) as total_claims,
      SUM(gambler_games) as total_games,
      SUM(pinger_pings) as total_pings
    FROM Baby
    WHERE mother_id = ? OR father_id = ?
  `,

  // Create new unborn baby
  CREATE_BABY: `
    INSERT INTO Baby (mother_id, father_id, status, name) VALUES (?, ?, "unborn", "baby")
  `,

  DELETE_BABY: `
    DELETE FROM Baby WHERE id = ?
  `,

  // Update baby attribute by baby id
  SET_BABY_ATTR: (attr) => `
    UPDATE Baby SET ${attr} = ? WHERE id = ?
  `,

  ADD_BABY_ATTR: (attr) => `
    UPDATE Baby SET ${attr} = ${attr} + ? WHERE id = ?
  `,

  SET_BABY_BIRTHDAY: `
    UPDATE Baby SET born = CURRENT_TIMESTAMP WHERE id = ?
  `,
};

module.exports = babyQueries;
