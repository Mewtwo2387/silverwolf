import footballMatchAnnouncementQueries from '../queries/footballMatchAnnouncementQueries';
import type Database from '../Database';

export interface FootballMatchAnnouncementState {
  matchId: string;
  preMatchSent: boolean;
  lastHomeScore: number | null;
  lastAwayScore: number | null;
  fullTimeSent: boolean;
}

class FootballMatchAnnouncementModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async getState(matchId: string): Promise<FootballMatchAnnouncementState | null> {
    const row = await this.db.executeSelectQuery(footballMatchAnnouncementQueries.GET, [matchId]);
    if (!row) return null;
    return {
      matchId: row.matchId,
      preMatchSent: Boolean(row.preMatchSent),
      lastHomeScore: row.lastHomeScore ?? null,
      lastAwayScore: row.lastAwayScore ?? null,
      fullTimeSent: Boolean(row.fullTimeSent),
    };
  }

  async markPreMatchSent(matchId: string): Promise<void> {
    await this.db.executeQuery(footballMatchAnnouncementQueries.UPSERT_PRE_MATCH, [matchId]);
  }

  async markScoreAnnounced(matchId: string, home: number, away: number): Promise<void> {
    await this.db.executeQuery(footballMatchAnnouncementQueries.UPSERT_SCORE, [matchId, home, away]);
  }

  async markFullTimeSent(matchId: string, home: number, away: number): Promise<void> {
    await this.db.executeQuery(footballMatchAnnouncementQueries.UPSERT_FULL_TIME, [matchId, home, away]);
  }

  async seedBaseline(
    matchId: string,
    home: number | null,
    away: number | null,
    fullTime: boolean,
  ): Promise<void> {
    if (fullTime && home != null && away != null) {
      await this.markFullTimeSent(matchId, home, away);
      return;
    }
    if (home != null && away != null) {
      await this.db.executeQuery(
        footballMatchAnnouncementQueries.UPSERT_BASELINE_WITH_SCORE,
        [matchId, home, away],
      );
      return;
    }
    await this.markPreMatchSent(matchId);
  }
}

export default FootballMatchAnnouncementModel;
