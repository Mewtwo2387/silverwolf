const globalConfigQueries = require('../queries/globalConfigQueries');

class GlobalConfigModel {
  constructor(database) {
    this.db = database;
  }

  async setGlobalConfig(key, value) {
    const query = globalConfigQueries.ADD_OR_UPDATE_GLOBAL_CONFIG;
    await this.db.executeQuery(query, [key, value]);
  }

  async getGlobalConfig(key) {
    const query = globalConfigQueries.GET_GLOBAL_CONFIG;
    const result = await this.db.executeSelectQuery(query, [key]);
    return result ? result.value : null;
  }

  async getAllGlobalConfig() {
    const query = globalConfigQueries.GET_ALL_GLOBAL_CONFIG;
    const result = await this.db.executeSelectAllQuery(query);
    return result;
  }

  async deleteGlobalConfig(key) {
    const query = globalConfigQueries.DELETE_GLOBAL_CONFIG;
    await this.db.executeQuery(query, [key]);
  }
}

module.exports = GlobalConfigModel;
