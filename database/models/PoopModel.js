const { log } = require('../../utils/log');
const poopQueries = require('../queries/poopQueries');

class PoopModel {
  constructor(database) {
    this.db = database;
  }

  async createOrUpdateProfile(userId, timezone) {
    await this.db.user.getUser(userId);
    const query = poopQueries.CREATE_OR_UPDATE_PROFILE;
    await this.db.executeQuery(query, [userId, timezone]);
    log(`Poop profile upserted for user ${userId} with timezone ${timezone}`);
  }

  async getProfile(userId) {
    const query = poopQueries.GET_PROFILE;
    return this.db.executeSelectQuery(query, [userId]);
  }

  async logPoop(userId, colour, size, type, duration) {
    // Auto-create user and profile at UTC+0 if none exists
    await this.db.user.getUser(userId);
    const profile = await this.getProfile(userId);
    if (!profile) {
      await this.db.executeQuery(poopQueries.CREATE_OR_UPDATE_PROFILE, [userId, 0]);
    }

    const loggedAt = Math.floor(Date.now() / 1000);
    const query = poopQueries.LOG_POOP;
    await this.db.executeQuery(query, [
      userId,
      loggedAt,
      colour ?? null,
      size ?? null,
      type ?? null,
      duration ?? null,
    ]);

    const countRow = await this.db.executeSelectQuery(poopQueries.GET_USER_POOP_COUNT, [userId]);
    const count = countRow?.poopCount ?? 1;
    log(`User ${userId} logged poop #${count}`);
    return count;
  }

  async getUserStats(userId) {
    const query = poopQueries.GET_USER_STATS;
    return this.db.executeSelectQuery(query, [userId, userId, userId]);
  }

  async getLeaderboard(period, limit, offset) {
    const query = poopQueries.GET_LEADERBOARD(period, limit, offset);
    return this.db.executeSelectAllQuery(query);
  }

  async getLeaderboardCount(period) {
    const query = poopQueries.GET_LEADERBOARD_COUNT(period);
    const row = await this.db.executeSelectQuery(query);
    return row?.total ?? 0;
  }
}

module.exports = PoopModel;
