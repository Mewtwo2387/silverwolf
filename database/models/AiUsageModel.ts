import type Database from '../Database';
import aiUsageQueries from '../queries/aiUsageQueries';
import { isUserDev } from '../../utils/accessControl';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../../utils/ai';

type WindowType = 'daily' | 'weekly';

/** SQLite datetime modifiers per window: `pos` extends a window, `neg` tests if it's still open. */
const WINDOW_INTERVALS: Record<WindowType, { pos: string; neg: string }> = {
  daily: { pos: '+1 day', neg: '-1 day' },
  weekly: { pos: '+7 days', neg: '-7 days' },
};

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

    const total = promptTokens + completionTokens;

    // Log the call (audit) and fold its tokens into both fixed windows atomically.
    await this.db.executeTransaction((rawDb) => {
      const logResult = rawDb.query(aiUsageQueries.ADD_USAGE)
        .run(userId, model, promptTokens, completionTokens, cost);
      if (!logResult || logResult.changes === 0) {
        throw new Error('Failed to record AI usage in the database');
      }
      (Object.keys(WINDOW_INTERVALS) as WindowType[]).forEach((type) => {
        const { pos } = WINDOW_INTERVALS[type];
        rawDb.query(aiUsageQueries.UPSERT_WINDOW).run(userId, type, total, pos, pos);
      });
    });
  }

  /** Tokens used in the current fixed window (0 once it has lapsed) and when it resets. */
  private async getWindow(userId: string, type: WindowType): Promise<{ tokens: number; resetAt: Date | null }> {
    const { pos, neg } = WINDOW_INTERVALS[type];
    const row = await this.db.executeSelectQuery(aiUsageQueries.GET_WINDOW, [neg, neg, pos, userId, type]);
    const tokens = typeof row?.tokens === 'number' ? row.tokens : 0;

    let resetAt: Date | null = null;
    if (row?.resetAt) {
      // SQLite datetime() returns UTC "YYYY-MM-DD HH:MM:SS"; make it ISO-parseable.
      const date = new Date(`${String(row.resetAt).replace(' ', 'T')}Z`);
      if (!Number.isNaN(date.getTime())) resetAt = date;
    }
    return { tokens, resetAt };
  }

  async getDailyUsage(userId: string): Promise<number> {
    return (await this.getWindow(userId, 'daily')).tokens;
  }

  async getWeeklyUsage(userId: string): Promise<number> {
    return (await this.getWindow(userId, 'weekly')).tokens;
  }

  /**
   * When the given fixed window resets (its start + interval), or `null` when no
   * window is currently open. Under a fixed window a rate-limited user stays
   * limited until exactly this instant, when the counter clears wholesale.
   */
  async getResetAt(userId: string, reason: WindowType): Promise<Date | null> {
    return (await this.getWindow(userId, reason)).resetAt;
  }

  async checkRateLimit(userId: string): Promise<{
    limited: boolean;
    reason?: WindowType;
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
