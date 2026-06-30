import footballMatchAnnouncementQueries from '../queries/footballMatchAnnouncementQueries';
import type Database from '../Database';

export interface FootballMatchAnnouncementState {
  matchId: string;
  preMatchSent: boolean;
  lastHomeScore: number | null;
  lastAwayScore: number | null;
  fullTimeSent: boolean;
  lastShootoutKickCount: number;
  shootoutMessageIds: Record<string, string>;
}

function parseShootoutMessageIds(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
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
      lastShootoutKickCount: row.lastShootoutKickCount ?? 0,
      shootoutMessageIds: parseShootoutMessageIds(row.shootoutMessageIds),
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

  async markShootoutSynced(
    matchId: string,
    kickCount: number,
    messageIds: Record<string, string>,
    penHome: number,
    penAway: number,
  ): Promise<void> {
    await this.db.executeQuery(
      footballMatchAnnouncementQueries.UPSERT_SHOOTOUT_SYNC,
      [matchId, kickCount, JSON.stringify(messageIds), penHome, penAway],
    );
  }

  async markShootoutFinished(
    matchId: string,
    kickCount: number,
    messageIds: Record<string, string>,
    penHome: number,
    penAway: number,
  ): Promise<void> {
    await this.db.executeQuery(
      footballMatchAnnouncementQueries.UPSERT_SHOOTOUT_FINISHED,
      [matchId, kickCount, JSON.stringify(messageIds), penHome, penAway],
    );
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
