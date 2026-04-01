import globalConfigQueries from '../queries/globalConfigQueries';
import type Database from '../Database';

class GlobalConfigModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async setGlobalConfig(key: string, value: string): Promise<void> {
    const query = globalConfigQueries.ADD_OR_UPDATE_GLOBAL_CONFIG;
    await this.db.executeQuery(query, [key, value]);
  }

  async getGlobalConfig(key: string): Promise<string | null> {
    const query = globalConfigQueries.GET_GLOBAL_CONFIG;
    const result = await this.db.executeSelectQuery(query, [key]);
    return result ? result.value : null;
  }

  async getAllGlobalConfig(): Promise<Record<string, any>[]> {
    const query = globalConfigQueries.GET_ALL_GLOBAL_CONFIG;
    return this.db.executeSelectAllQuery(query);
  }

  async deleteGlobalConfig(key: string): Promise<void> {
    const query = globalConfigQueries.DELETE_GLOBAL_CONFIG;
    await this.db.executeQuery(query, [key]);
  }
}

export default GlobalConfigModel;
