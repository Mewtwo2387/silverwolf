import battleshipsMatchQueries from '../queries/battleshipsMatchQueries';
import type Database from '../Database';

export interface RecordMatchInput {
  id: string;
  xDiscordId: string;
  oDiscordId: string;
  winnerDiscordId: string | null;
  endReason: 'win' | 'disconnect' | 'forfeit';
  createdAt: number;
  endedAt: number;
}

class BattleshipsMatchModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async recordMatch(input: RecordMatchInput): Promise<void> {
    await this.db.executeQuery(
      battleshipsMatchQueries.INSERT_MATCH,
      [
        input.id,
        input.xDiscordId,
        input.oDiscordId,
        input.winnerDiscordId,
        input.endReason,
        input.createdAt,
        input.endedAt,
      ],
    );
  }

  async getRecentForUser(discordId: string, limit = 20): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(
      battleshipsMatchQueries.GET_RECENT_FOR_USER,
      [discordId, discordId, limit],
    );
  }
}

export default BattleshipsMatchModel;
