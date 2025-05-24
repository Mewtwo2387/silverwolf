const gameUIDQueries = require('../queries/gameUIDQueries');

class GameUIDModel {
  constructor(database) {
    this.db = database;
  }

  async getAllGameUIDs(userId) {
    const query = gameUIDQueries.GET_ALL_GAME_UIDS;
    const result = await this.db.executeSelectAllQuery(query, [userId]);
    return result;
  }

  async setGameUID(userId, game, gameUID, region) {
    await this.db.user.getUser(userId);
    const query = gameUIDQueries.ADD_OR_UPDATE_GAME_UID;
    await this.db.executeQuery(query, [userId, game, gameUID, region]);
  }

  async deleteGameUID(userId, game) {
    const query = gameUIDQueries.DELETE_GAME_UID;
    await this.db.executeQuery(query, [userId, game]);
  }

  async getGameUID(userId, game) {
    const query = gameUIDQueries.GET_GAME_UID;
    const result = await this.db.executeSelectQuery(query, [userId, game]);
    return result;
  }
}

module.exports = GameUIDModel;
