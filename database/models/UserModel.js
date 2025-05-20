const { log } = require('../../utils/log');
const { camelToSnake } = require('../../utils/caseConvert');
const userQueries = require('../queries/userQueries');

class UserModel {
  constructor(database) {
    this.db = database;
  }

  async getUser(userId) {
    const query = userQueries.GET_USER_STATS;
    const user = await this.db.executeSelectQuery(query, [userId]);
    if (!user) {
      log(`User ${userId} not found. Creating new user.`);
      return this.createUser(userId);
    }
    log(`User ${userId} found`);
    return user;
  }

  async createUser(userId) {
    const query = userQueries.CREATE_USER;
    await this.db.executeQuery(query, [userId]);
    log(`New user ${userId} created`);
    return this.getUser(userId);
  }

  async addUserAttr(userId, field, value) {
    const attribute = camelToSnake(field);
    if (value === null || value === undefined) {
      if (attribute !== 'dinonuggies_last_claimed') {
        log(`Skipping update for ${field} as value is null`);
        return;
      }
    }
    await this.getUser(userId);
    const query = userQueries.ADD_USER_ATTR(attribute);
    await this.db.executeQuery(query, [value, userId]);
    log(`Updated user ${userId}: ${attribute} increased by ${value}.`);
  }

  async setUserAttr(userId, field, value) {
    const attribute = camelToSnake(field);
    if (value === null || value === undefined) {
      if (attribute !== 'dinonuggies_last_claimed') {
        log(`Skipping update for ${field} as value is null`);
        return;
      }
    }
    await this.getUser(userId);
    const query = userQueries.SET_USER_ATTR(attribute);
    await this.db.executeQuery(query, [value, userId]);
    log(`Updated user ${userId}: ${attribute} set to ${value}.`);
  }

  async getUserAttr(userId, attribute) {
    const user = await this.getUser(userId);
    return user[attribute];
  }

  async getEveryoneAttr(attribute, limit = null, offset = 0) {
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_ATTR_LIMIT(attribute, limit, offset)
      : userQueries.GET_EVERYONE_ATTR(attribute);
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getRelativeNetWinnings(type, limit = null, offset = 0) {
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_LIMIT(type, limit, offset)
      : userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS(type);
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getAllRelativeNetWinnings(limit = null, offset = 0) {
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_LIMIT(limit, offset)
      : userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL;
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getEveryoneAttrCount(attribute) {
    const query = userQueries.GET_EVERYONE_ATTR_COUNT(attribute);
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getRelativeNetWinningsCount(type) {
    const query = userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_COUNT(type);
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getAllRelativeNetWinningsCount() {
    const query = userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_COUNT;
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getUsersWithBirthday(todayHour) {
    const query = userQueries.GET_USERS_WITH_BIRTHDAY;
    const rows = await this.db.executeSelectAllQuery(query, [todayHour]);
    return rows;
  }
}

module.exports = UserModel;
