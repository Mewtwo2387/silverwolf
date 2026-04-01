import { log } from '../../utils/log';
import { camelToSnake } from '../../utils/caseConvert';
import userQueries from '../queries/userQueries';
import type Database from '../Database';

class UserModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async getUser(userId: string): Promise<Record<string, any>> {
    const query = userQueries.GET_USER_STATS;
    const user = await this.db.executeSelectQuery(query, [userId]);
    if (!user) {
      log(`User ${userId} not found. Creating new user.`);
      return this.createUser(userId);
    }
    log(`User ${userId} found`);
    return user;
  }

  async createUser(userId: string): Promise<Record<string, any>> {
    const query = userQueries.CREATE_USER;
    await this.db.executeQuery(query, [userId]);
    log(`New user ${userId} created`);
    return this.getUser(userId);
  }

  async addUserAttr(userId: string, field: string, value: any): Promise<void> {
    const attribute = camelToSnake(field);
    if (Number.isNaN(value)) {
      log(`Skipping update for ${field} as value is NaN`);
      return;
    }
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

  async setUserAttr(userId: string, field: string, value: any): Promise<void> {
    const attribute = camelToSnake(field);
    if (Number.isNaN(value)) {
      log(`Skipping update for ${field} as value is NaN`);
      return;
    }
    if (value === null || value === undefined) {
      if (attribute !== 'dinonuggies_last_claimed' && attribute !== 'birthdays') {
        log(`Skipping update for ${field} as value is null`);
        return;
      }
    }
    await this.getUser(userId);
    const query = userQueries.SET_USER_ATTR(attribute);
    await this.db.executeQuery(query, [value, userId]);
    log(`Updated user ${userId}: ${attribute} set to ${value}.`);
  }

  async ascendUser(userId: string, allMaxed: boolean): Promise<void> {
    const query = userQueries.ASCEND_USER;
    await this.db.executeQuery(query, [userId]);
    if (allMaxed) {
      await this.addUserAttr(userId, 'ascensionLevel', 1);
    }
    log(`User ${userId} ascended. ${allMaxed ? 'All upgrades maxed.' : 'Not all upgrades maxed.'}`);
  }

  async getUserAttr(userId: string, attribute: string): Promise<any> {
    const user = await this.getUser(userId);
    return user[attribute];
  }

  async getEveryoneAttr(attribute: string, limit: number | null = null, offset: number = 0): Promise<Record<string, any>[]> {
    const attr = camelToSnake(attribute);
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_ATTR_LIMIT(attr, limit, offset)
      : userQueries.GET_EVERYONE_ATTR(attr);
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getRelativeNetWinnings(type: string, limit: number | null = null, offset: number = 0): Promise<Record<string, any>[]> {
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_LIMIT(type, limit, offset)
      : userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS(type);
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getAllRelativeNetWinnings(limit: number | null = null, offset: number = 0): Promise<Record<string, any>[]> {
    const query = (limit !== null)
      ? userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_LIMIT(limit, offset)
      : userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL;
    const rows = await this.db.executeSelectAllQuery(query);
    log(rows);
    return rows;
  }

  async getEveryoneAttrCount(attribute: string): Promise<number> {
    const attr = camelToSnake(attribute);
    const query = userQueries.GET_EVERYONE_ATTR_COUNT(attr);
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getRelativeNetWinningsCount(type: string): Promise<number> {
    const query = userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_COUNT(type);
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getAllRelativeNetWinningsCount(): Promise<number> {
    const query = userQueries.GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_COUNT;
    const rows = await this.db.executeSelectAllQuery(query);
    return rows[0].count;
  }

  async getUsersWithBirthday(todayHour: string): Promise<Record<string, any>[]> {
    const query = userQueries.GET_USERS_WITH_BIRTHDAY;
    const rows = await this.db.executeSelectAllQuery(query, [todayHour]);
    return rows;
  }
}

export default UserModel;
