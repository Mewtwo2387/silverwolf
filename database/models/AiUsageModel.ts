import type Database from '../Database';
import aiUsageQueries from '../queries/aiUsageQueries';
import { isUserDev } from '../../utils/accessControl';

export const DAILY_LIMIT = 250000; // 250,000 tokens
export const WEEKLY_LIMIT = 1000000; // 1,000,000 tokens (exactly 4 daily limits)

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

    await this.db.executeQuery(aiUsageQueries.ADD_USAGE, [
      userId,
      model,
      promptTokens,
      completionTokens,
      cost,
    ]);
  }

  async getDailyUsage(userId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(aiUsageQueries.GET_DAILY_USAGE, [userId]);
    return row?.total ?? 0;
  }

  async getWeeklyUsage(userId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(aiUsageQueries.GET_WEEKLY_USAGE, [userId]);
    return row?.total ?? 0;
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
      return { limited: true, reason: 'daily', usage: dailyUsage, limit: DAILY_LIMIT };
    }

    const weeklyUsage = await this.getWeeklyUsage(userId);
    if (weeklyUsage >= WEEKLY_LIMIT) {
      return { limited: true, reason: 'weekly', usage: weeklyUsage, limit: WEEKLY_LIMIT };
    }

    return { limited: false };
  }

  async isRateLimited(userId: string): Promise<boolean> {
    const status = await this.checkRateLimit(userId);
    return status.limited;
  }
}

export default AiUsageModel;
