import tcgMatchQueries from '../queries/tcgMatchQueries';
import type Database from '../Database';

export interface RecordTcgMatchInput {
  id: string;
  mode: 'pvp' | 'solo';
  p1DiscordId: string;
  p1Username: string;
  p1Team: string[];
  p2DiscordId: string;
  p2Username: string;
  p2Team: string[];
  winner: 'p1' | 'p2' | 'draw' | null;
  endReason: string;
  rounds: number;
  createdAt: number;
  endedAt: number;
  /** JSON blob of the final board snapshot + full chat + full battle log. */
  finalState: string | null;
}

class TcgMatchModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async recordMatch(input: RecordTcgMatchInput): Promise<void> {
    // executeQuery swallows SQL errors and reports changes:0, so inspect the result
    // and throw — otherwise callers' .catch (e.g. closeRoom) never sees the failure.
    const res = await this.db.executeQuery(
      tcgMatchQueries.INSERT_MATCH,
      [
        input.id,
        input.mode,
        input.p1DiscordId,
        input.p1Username,
        JSON.stringify(input.p1Team),
        input.p2DiscordId,
        input.p2Username,
        JSON.stringify(input.p2Team),
        input.winner,
        input.endReason,
        input.rounds,
        input.createdAt,
        input.endedAt,
        input.finalState,
      ],
    );
    if (!res || res.changes < 1) {
      throw new Error(`TcgMatch insert affected no rows (id=${input.id}, mode=${input.mode})`);
    }
  }

  /** Most recent matches across everyone (for the public history list). */
  async getRecent(limit = 30, offset = 0): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(tcgMatchQueries.GET_RECENT, [limit, offset]);
  }

  async getById(id: string): Promise<Record<string, any> | null> {
    return this.db.executeSelectQuery(tcgMatchQueries.GET_BY_ID, [id]);
  }

  async getRecentForUser(discordId: string, limit = 20): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(
      tcgMatchQueries.GET_RECENT_FOR_USER,
      [discordId, discordId, limit],
    );
  }
}

export default TcgMatchModel;
