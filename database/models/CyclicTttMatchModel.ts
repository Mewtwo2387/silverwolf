import cyclicTttMatchQueries from '../queries/cyclicTttMatchQueries';
import type Database from '../Database';

export interface RecordMatchInput {
  id: string;
  xDiscordId: string;
  oDiscordId: string;
  winnerDiscordId: string | null;
  endReason: 'win' | 'draw' | 'timeout' | 'disconnect' | 'forfeit';
  boardSize: number;
  createdAt: number;
  endedAt: number;
}

class CyclicTttMatchModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async recordMatch(input: RecordMatchInput): Promise<void> {
    await this.db.executeQuery(
      cyclicTttMatchQueries.INSERT_MATCH,
      [
        input.id,
        input.xDiscordId,
        input.oDiscordId,
        input.winnerDiscordId,
        input.endReason,
        input.boardSize,
        input.createdAt,
        input.endedAt,
      ],
    );
  }

  async getRecentForUser(discordId: string, limit = 20): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(
      cyclicTttMatchQueries.GET_RECENT_FOR_USER,
      [discordId, discordId, limit],
    );
  }
}

export default CyclicTttMatchModel;
