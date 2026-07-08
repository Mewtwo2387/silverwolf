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
  CREATE_INDEX_USER_CREATED: `
    CREATE INDEX IF NOT EXISTS idx_aiusage_user_created ON AiUsage (user_id, created_at)
  `,
};

export default aiUsageQueries;
