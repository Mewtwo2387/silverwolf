const planeStatsQueries = {
  GET: 'SELECT stats FROM PlaneStats WHERE user_id = ?',
  UPSERT: `INSERT INTO PlaneStats (user_id, stats, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET stats = excluded.stats, updated_at = CURRENT_TIMESTAMP`,
};

export default planeStatsQueries;
