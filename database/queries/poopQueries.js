const poopQueries = {
  CREATE_OR_UPDATE_PROFILE: `
    INSERT INTO PoopProfile (user_id, timezone)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone
  `,

  GET_PROFILE: `
    SELECT * FROM PoopProfile WHERE user_id = ?
  `,

  LOG_POOP: `
    INSERT INTO PoopEntry (user_id, logged_at, colour, size, type, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `,

  GET_USER_POOP_COUNT: `
    SELECT COUNT(*) as poop_count FROM PoopEntry WHERE user_id = ?
  `,

  GET_USER_STATS: `
    SELECT
      COUNT(*) as total_poops,
      MAX(logged_at) as last_logged_at,
      AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration,
      (
        SELECT type FROM PoopEntry
        WHERE user_id = ? AND type IS NOT NULL
        GROUP BY type ORDER BY COUNT(*) DESC LIMIT 1
      ) as common_type,
      (
        SELECT colour FROM PoopEntry
        WHERE user_id = ? AND colour IS NOT NULL
        GROUP BY colour ORDER BY COUNT(*) DESC LIMIT 1
      ) as common_colour,
      CAST(
        COUNT(*) AS REAL
      ) / NULLIF(
        (CAST(julianday('now') AS INTEGER) - CAST(julianday(datetime(MIN(logged_at), 'unixepoch')) AS INTEGER) + 1),
        0
      ) as avg_daily
    FROM PoopEntry
    WHERE user_id = ?
  `,

  GET_LEADERBOARD: (period, limit, offset) => {
    const periodFilter = period === 'weekly'
      ? `AND logged_at >= strftime('%s', 'now', '-7 days')`
      : period === 'monthly'
        ? `AND logged_at >= strftime('%s', 'now', '-30 days')`
        : '';
    return `
      SELECT user_id as id, COUNT(*) as poop_count
      FROM PoopEntry
      WHERE 1=1 ${periodFilter}
      GROUP BY user_id
      ORDER BY poop_count DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  GET_LEADERBOARD_COUNT: (period) => {
    const periodFilter = period === 'weekly'
      ? `AND logged_at >= strftime('%s', 'now', '-7 days')`
      : period === 'monthly'
        ? `AND logged_at >= strftime('%s', 'now', '-30 days')`
        : '';
    return `
      SELECT COUNT(DISTINCT user_id) as total
      FROM PoopEntry
      WHERE 1=1 ${periodFilter}
    `;
  },
};

module.exports = poopQueries;
