import { log } from '../../utils/log';
import poopQueries, { DAILY_POOP_LIMIT } from '../queries/poopQueries';
import type Database from '../Database';

class PoopModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async createOrUpdateProfile(userId: string, timezone: number): Promise<void> {
    await this.db.user.getUser(userId);
    const query = poopQueries.CREATE_OR_UPDATE_PROFILE;
    const result = await this.db.executeQuery(query, [userId, timezone]);
    if (!result.changes) {
      throw new Error(`Failed to upsert poop profile for user ${userId} with timezone ${timezone}`);
    }
    log(`Poop profile upserted for user ${userId} with timezone ${timezone}`);
  }

  async getProfile(userId: string): Promise<Record<string, any> | null> {
    const query = poopQueries.GET_PROFILE;
    return this.db.executeSelectQuery(query, [userId]);
  }

  private startOfLocalDay(timezoneSeconds: number): number {
    const now = Math.floor(Date.now() / 1000);
    const localNow = now + timezoneSeconds;
    return Math.floor(localNow / 86400) * 86400 - timezoneSeconds;
  }

  // eslint-disable-next-line max-len
  async logPoop(userId: string, colour: string | null, size: string | null, type: string | null, duration: number | null): Promise<number | null> {
    // Auto-create user and profile at UTC+0 if none exists
    await this.db.user.getUser(userId);
    let profile = await this.getProfile(userId);
    if (!profile) {
      await this.db.executeQuery(poopQueries.CREATE_OR_UPDATE_PROFILE, [userId, 0]);
      profile = { timezone: 0 };
    }

    const timezone: number = profile.timezone ?? 0;
    const timezoneSeconds = Math.round(timezone * 3600);
    const dayStart = this.startOfLocalDay(timezoneSeconds);
    const dayEnd = dayStart + 86400;

    const inserted = await this.db.executeTransaction((rawDb) => {
      const todayRow = rawDb.query(poopQueries.GET_TODAY_COUNT).get(userId, dayStart, dayEnd) as Record<string, any> | null;
      if ((todayRow?.today_count ?? 0) >= DAILY_POOP_LIMIT) return false;

      const loggedAt = Math.floor(Date.now() / 1000);
      rawDb.query(poopQueries.LOG_POOP).run(userId, loggedAt, colour ?? null, size ?? null, type ?? null, duration ?? null);
      return true;
    });

    if (!inserted) return null;

    const countRow = await this.db.executeSelectQuery(poopQueries.GET_USER_POOP_COUNT, [userId]);
    const count = countRow?.poopCount ?? 1;
    log(`User ${userId} logged poop #${count}`);
    return count;
  }

  async getUserStats(userId: string): Promise<Record<string, any> | null> {
    const query = poopQueries.GET_USER_STATS;
    return this.db.executeSelectQuery(query, [{ $userId: userId }]);
  }

  async getRandomPoop(): Promise<Record<string, any> | null> {
    const query = poopQueries.GET_RANDOM_POOP;
    return this.db.executeSelectQuery(query);
  }

  async getLeaderboard(period: string, limit: number, offset: number): Promise<Record<string, any>[]> {
    const query = poopQueries.GET_LEADERBOARD(period);
    return this.db.executeSelectAllQuery(query, [limit, offset]);
  }

  async getLeaderboardCount(period: string): Promise<number> {
    const query = poopQueries.GET_LEADERBOARD_COUNT(period);
    const row = await this.db.executeSelectQuery(query);
    return row?.total ?? 0;
  }
}

export default PoopModel;
