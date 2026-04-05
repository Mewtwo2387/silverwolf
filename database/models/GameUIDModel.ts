import gameUIDQueries from '../queries/gameUIDQueries';
import type Database from '../Database';

class GameUIDModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async getAllGameUIDs(userId: string): Promise<Record<string, any>[]> {
    const query = gameUIDQueries.GET_ALL_GAME_UIDS;
    return this.db.executeSelectAllQuery(query, [userId]);
  }

  async setGameUID(userId: string, game: string, gameUID: string, region: string | null): Promise<void> {
    await this.db.user.getUser(userId);
    const query = gameUIDQueries.ADD_OR_UPDATE_GAME_UID;
    await this.db.executeQuery(query, [userId, game, gameUID, region]);
  }

  async deleteGameUID(userId: string, game: string): Promise<void> {
    const query = gameUIDQueries.DELETE_GAME_UID;
    await this.db.executeQuery(query, [userId, game]);
  }

  async getGameUID(userId: string, game: string): Promise<Record<string, any> | null> {
    const query = gameUIDQueries.GET_GAME_UID;
    return this.db.executeSelectQuery(query, [userId, game]);
  }
}

export default GameUIDModel;
