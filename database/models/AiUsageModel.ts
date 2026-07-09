import type Database from '../Database';
import aiUsageQueries from '../queries/aiUsageQueries';
import { isUserDev } from '../../utils/accessControl';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../../utils/ai';

class AiUsageModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async addUsage(
    userId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cost = 0,
  ): Promise<void> {
    // Ensure user exists in User table
    await this.db.user.getUser(userId);

    const result = await this.db.executeQuery(aiUsageQueries.ADD_USAGE, [
      userId,
      model,
      promptTokens,
      completionTokens,
      cost,
    ]);

    if (!result || result.changes === 0) {
      throw new Error('Failed to record AI usage in the database');
    }
  }

  async getDailyUsage(userId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(aiUsageQueries.GET_DAILY_USAGE, [userId]);
    if (row === null) {
      throw new Error('Database query failed while fetching daily usage');
    }
    return row.total ?? 0;
  }

  async getWeeklyUsage(userId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(aiUsageQueries.GET_WEEKLY_USAGE, [userId]);
    if (row === null) {
      throw new Error('Database query failed while fetching weekly usage');
    }
    return row.total ?? 0;
  }

  /**
   * When a rolling-window limit will clear for a user. Usage is a trailing sum
   * (24h / 7d), so the limit lifts as the oldest entries age out — this returns
   * the moment the windowed sum first drops back below the limit, or `null` if
   * the user is not currently over that limit.
   */
  async getResetAt(userId: string, reason: 'daily' | 'weekly'): Promise<Date | null> {
    const usage = reason === 'daily'
      ? await this.getDailyUsage(userId)
      : await this.getWeeklyUsage(userId);
    const limit = reason === 'daily' ? DAILY_LIMIT : WEEKLY_LIMIT;
    if (usage < limit) return null;

    const query = reason === 'daily'
      ? aiUsageQueries.GET_DAILY_RESET_AT
      : aiUsageQueries.GET_WEEKLY_RESET_AT;
    const row = await this.db.executeSelectQuery(query, [userId, usage - limit]);
    if (!row?.resetAt) return null;

    // SQLite datetime() returns UTC "YYYY-MM-DD HH:MM:SS"; make it ISO-parseable.
    const date = new Date(`${String(row.resetAt).replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async checkRateLimit(userId: string): Promise<{
    limited: boolean;
    reason?: 'daily' | 'weekly';
    usage?: number;
    limit?: number;
  }> {
    if (isUserDev(userId)) {
      return { limited: false };
    }

    const dailyUsage = await this.getDailyUsage(userId);
    if (dailyUsage >= DAILY_LIMIT) {
      return {
        limited: true, reason: 'daily', usage: dailyUsage, limit: DAILY_LIMIT,
      };
    }

    const weeklyUsage = await this.getWeeklyUsage(userId);
    if (weeklyUsage >= WEEKLY_LIMIT) {
      return {
        limited: true, reason: 'weekly', usage: weeklyUsage, limit: WEEKLY_LIMIT,
      };
    }

    return { limited: false };
  }

  async isRateLimited(userId: string): Promise<boolean> {
    const status = await this.checkRateLimit(userId);
    return status.limited;
  }
}

export default AiUsageModel;
