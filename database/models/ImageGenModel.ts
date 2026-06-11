import imageGenQueries from '../queries/imageGenQueries';
import type Database from '../Database';

class ImageGenModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async logGeneration(userId: string, prompt: string, model: string | null, success: boolean): Promise<void> {
    await this.db.executeQuery(
      imageGenQueries.LOG_GENERATION,
      [userId, prompt, model, success ? 1 : 0],
    );
  }

  /** Successful generations by this user in the last rolling 24 hours. */
  async countLast24h(userId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(imageGenQueries.COUNT_LAST_24H, [userId]);
    return row?.genCount ?? 0;
  }
}

export default ImageGenModel;
