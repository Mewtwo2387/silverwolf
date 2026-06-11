const imageGenQueries = {
  LOG_GENERATION: 'INSERT INTO ImageGenLog (user_id, prompt, model, success) VALUES (?, ?, ?, ?)',
  // Rolling 24h window; only successful generations count toward the limit.
  COUNT_LAST_24H: `
    SELECT COUNT(*) AS gen_count
    FROM ImageGenLog
    WHERE user_id = ? AND success = 1 AND created_at >= datetime('now', '-1 day')
  `,
};

export default imageGenQueries;
