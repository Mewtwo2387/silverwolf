import { createHash } from 'node:crypto';
import { log } from '../../utils/log';
import webSessionQueries from '../queries/webSessionQueries';
import type Database from '../Database';

export interface WebSession {
  id: string;
  discordId: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
}

class WebSessionModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async createSession(
    id: string,
    discordId: string,
    csrfToken: string,
    ttlMs: number,
  ): Promise<void> {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    await this.db.executeQuery(
      webSessionQueries.INSERT_SESSION,
      [id, discordId, csrfToken, now, expiresAt, now],
    );
    // Anonymize discord_id in logs: PII shouldn't appear in plaintext.
    const discordIdHash = createHash('sha256').update(discordId).digest('hex').slice(0, 12);
    log(`Created web session for discord_id=${discordIdHash}`);
  }

  async getSession(id: string): Promise<WebSession | null> {
    const row = await this.db.executeSelectQuery(webSessionQueries.GET_SESSION, [id]);
    return row as WebSession | null;
  }

  async touchSession(id: string, ttlMs: number): Promise<void> {
    const now = Date.now();
    await this.db.executeQuery(webSessionQueries.TOUCH_SESSION, [now, now + ttlMs, id]);
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.executeQuery(webSessionQueries.DELETE_SESSION, [id]);
  }

  async deleteExpired(): Promise<void> {
    await this.db.executeQuery(webSessionQueries.DELETE_EXPIRED, [Date.now()]);
  }
}

export default WebSessionModel;
