export const DAILY_POOP_LIMIT = 4;

const OUTLIER_CTE = `
  WITH daily_counts AS (
    SELECT e.user_id,
           date(e.logged_at + COALESCE(p.timezone, 0) * 3600, 'unixepoch') AS local_day,
           COUNT(*) AS day_count
    FROM PoopEntry e
    LEFT JOIN PoopProfile p ON p.user_id = e.user_id
    GROUP BY e.user_id, local_day
  ),
  valid_entries AS (
    SELECT e.*
    FROM PoopEntry e
    LEFT JOIN PoopProfile p ON p.user_id = e.user_id
    JOIN daily_counts dc
      ON dc.user_id = e.user_id
      AND dc.local_day = date(e.logged_at + COALESCE(p.timezone, 0) * 3600, 'unixepoch')
    WHERE dc.day_count <= ${DAILY_POOP_LIMIT}
  )
`;

// Scoped variant used for per-user queries to avoid full-table scans.
const OUTLIER_CTE_USER = `
  WITH daily_counts AS (
    SELECT e.user_id,
           date(e.logged_at + COALESCE(p.timezone, 0) * 3600, 'unixepoch') AS local_day,
           COUNT(*) AS day_count
    FROM PoopEntry e
    LEFT JOIN PoopProfile p ON p.user_id = e.user_id
    WHERE e.user_id = $userId
    GROUP BY e.user_id, local_day
  ),
  valid_entries AS (
    SELECT e.*
    FROM PoopEntry e
    LEFT JOIN PoopProfile p ON p.user_id = e.user_id
    JOIN daily_counts dc
      ON dc.user_id = e.user_id
      AND dc.local_day = date(e.logged_at + COALESCE(p.timezone, 0) * 3600, 'unixepoch')
    WHERE dc.day_count <= ${DAILY_POOP_LIMIT}
  )
`;

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

  GET_TODAY_COUNT: `
    SELECT COUNT(*) as today_count
    FROM PoopEntry
    WHERE user_id = ?
      AND logged_at >= ?
      AND logged_at < ?
  `,

  GET_RANDOM_POOP: `${OUTLIER_CTE}
    SELECT id, user_id, logged_at, colour, size, type, duration
    FROM valid_entries
    ORDER BY RANDOM()
    LIMIT 1
  `,

  GET_USER_STATS: `${OUTLIER_CTE_USER}
    SELECT
      COUNT(*) as total_poops,
      MAX(logged_at) as last_logged_at,
      AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration,
      (
        SELECT type FROM valid_entries
        WHERE user_id = $userId AND type IS NOT NULL
        GROUP BY type ORDER BY COUNT(*) DESC LIMIT 1
      ) as common_type,
      (
        SELECT colour FROM valid_entries
        WHERE user_id = $userId AND colour IS NOT NULL
        GROUP BY colour ORDER BY COUNT(*) DESC LIMIT 1
      ) as common_colour,
      CAST(
        COUNT(*) AS REAL
      ) / NULLIF(
        (CAST(julianday('now') AS INTEGER) - CAST(julianday(datetime(MIN(logged_at), 'unixepoch')) AS INTEGER) + 1),
        0
      ) as avg_daily
    FROM valid_entries
    WHERE user_id = $userId
  `,

  GET_LEADERBOARD: (period: string): string => {
    let periodFilter = '';
    if (period === 'weekly') periodFilter = "AND logged_at >= strftime('%s', 'now', '-7 days')";
    else if (period === 'monthly') periodFilter = "AND logged_at >= strftime('%s', 'now', '-30 days')";
    return `${OUTLIER_CTE}
      SELECT user_id as id, COUNT(*) as poop_count
      FROM valid_entries
      WHERE 1=1 ${periodFilter}
      GROUP BY user_id
      ORDER BY poop_count DESC
      LIMIT ? OFFSET ?
    `;
  },

  GET_LEADERBOARD_COUNT: (period: string): string => {
    let periodFilter = '';
    if (period === 'weekly') periodFilter = "AND logged_at >= strftime('%s', 'now', '-7 days')";
    else if (period === 'monthly') periodFilter = "AND logged_at >= strftime('%s', 'now', '-30 days')";
    return `${OUTLIER_CTE}
      SELECT COUNT(DISTINCT user_id) as total
      FROM valid_entries
      WHERE 1=1 ${periodFilter}
    `;
  },
};

export default poopQueries;
