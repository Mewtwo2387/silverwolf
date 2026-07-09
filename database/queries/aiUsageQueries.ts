const aiUsageQueries = {
  ADD_USAGE: `
    INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost)
    VALUES (?, ?, ?, ?, ?)
  `,
  GET_DAILY_USAGE: `
    SELECT COALESCE(SUM(tokens_prompt + tokens_completion), 0) AS total
    FROM AiUsage
    WHERE user_id = ? AND created_at > datetime('now', '-1 day')
  `,
  GET_WEEKLY_USAGE: `
    SELECT COALESCE(SUM(tokens_prompt + tokens_completion), 0) AS total
    FROM AiUsage
    WHERE user_id = ? AND created_at > datetime('now', '-7 days')
  `,
  // Rolling-window reset time: usage is a trailing sum, so the limit lifts as the
  // oldest entries age out. Walking entries oldest→newest, `running` is the
  // cumulative tokens dropped once that entry exits the window; the limit clears
  // when enough have dropped that the remainder falls under it — i.e. when the
  // cumulative exceeds the excess (usage - limit, passed as `?`). The first such
  // entry's timestamp + the window length is the moment the pool cools down.
  GET_DAILY_RESET_AT: `
    SELECT datetime(MIN(created_at), '+1 day') AS reset_at
    FROM (
      SELECT created_at,
        SUM(tokens_prompt + tokens_completion) OVER (ORDER BY created_at) AS running
      FROM AiUsage
      WHERE user_id = ? AND created_at > datetime('now', '-1 day')
    )
    WHERE running > ?
  `,
  GET_WEEKLY_RESET_AT: `
    SELECT datetime(MIN(created_at), '+7 days') AS reset_at
    FROM (
      SELECT created_at,
        SUM(tokens_prompt + tokens_completion) OVER (ORDER BY created_at) AS running
      FROM AiUsage
      WHERE user_id = ? AND created_at > datetime('now', '-7 days')
    )
    WHERE running > ?
  `,
  CREATE_INDEX_USER_CREATED: `
    CREATE INDEX IF NOT EXISTS idx_aiusage_user_created ON AiUsage (user_id, created_at)
  `,
};

export default aiUsageQueries;
