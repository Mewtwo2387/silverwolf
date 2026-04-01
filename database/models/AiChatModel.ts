import { log } from '../../utils/log';
import aiChatQueries from '../queries/aiChatQueries';
import type Database from '../Database';

/**
 * Model for managing per-user, per-persona AI chat sessions and history.
 * Completely separate from ChatModel (which is used by /ask-silverwolf-ai).
 */
class AiChatModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Retrieves an active session for a user+persona pair, or creates one if none exists.
   */
  async getOrCreateSession(userId: string, personaName: string): Promise<Record<string, any>> {
    // Ensure the user exists in the User table
    await this.db.user.getUser(userId);

    let session = await this.db.executeSelectQuery(
      aiChatQueries.GET_ACTIVE_SESSION,
      [userId, personaName],
    );

    if (!session) {
      const result = await this.db.executeQuery(
        aiChatQueries.START_SESSION,
        [userId, personaName],
      );
      if (result.lastID) {
        session = await this.getSessionById(result.lastID);
      }

      // If an insert raced and hit uniqueness constraints, recover by re-reading active session.
      if (!session) {
        session = await this.db.executeSelectQuery(
          aiChatQueries.GET_ACTIVE_SESSION,
          [userId, personaName],
        );
      }

      if (session) {
        log(`AiChat: Created session ${session.sessionId} for user ${userId} with persona ${personaName}`);
      }
    }

    return session;
  }

  /**
   * Creates a brand-new active session for a user+persona pair.
   * Deactivates any existing active sessions for that persona first.
   */
  async startNewSession(userId: string, personaName: string): Promise<Record<string, any>> {
    // Ensure the user exists in the User table
    await this.db.user.getUser(userId);

    const newSessionId = await this.db.executeTransaction(async (rawDb: any) => {
      rawDb.query(aiChatQueries.END_ALL_USER_PERSONA_SESSIONS).run(userId, personaName);
      rawDb.query(aiChatQueries.START_SESSION).run(userId, personaName);
      return rawDb.query('SELECT last_insert_rowid() as id').get().id;
    });

    const session = await this.getSessionById(newSessionId);
    log(`AiChat: Started new session ${session.sessionId} for user ${userId} with persona ${personaName}`);
    return session;
  }

  /**
   * Returns a session row by its ID.
   */
  async getSessionById(sessionId: number): Promise<Record<string, any> | null> {
    return this.db.executeSelectQuery(aiChatQueries.GET_SESSION_BY_ID, [sessionId]);
  }

  /**
   * Returns all sessions for a user (active and inactive), newest first.
   * Includes `messageCount` for each session.
   */
  async getAllUserSessions(userId: string): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(aiChatQueries.GET_ALL_USER_SESSIONS, [userId]);
  }

  /**
   * Marks a session as inactive.
   */
  async endSession(sessionId: number): Promise<void> {
    await this.db.executeQuery(aiChatQueries.END_SESSION, [sessionId]);
    log(`AiChat: Ended session ${sessionId}`);
  }

  /**
   * Switches the active session for a user/persona to a specific session.
   * Deactivates all current sessions for that user/persona first, then activates the target.
   */
  async switchSession(userId: string, sessionId: number): Promise<Record<string, any> | null> {
    const session = await this.getSessionById(sessionId);
    await this.db.executeQuery(
      aiChatQueries.END_ALL_USER_PERSONA_SESSIONS,
      [userId, session.personaName],
    );
    await this.db.executeQuery(aiChatQueries.ACTIVATE_SESSION, [sessionId]);
    log(`AiChat: Switched user ${userId} to session ${sessionId} (${session.personaName})`);
    return this.getSessionById(sessionId);
  }

  /**
   * Permanently deletes a session and all its history.
   * Validates that the session belongs to the requesting user.
   */
  async deleteSession(userId: string, sessionId: number): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }
    await this.db.executeQuery(aiChatQueries.DELETE_HISTORY_BY_SESSION, [sessionId]);
    await this.db.executeQuery(aiChatQueries.DELETE_SESSION, [sessionId]);
    log(`AiChat: Deleted session ${sessionId} for user ${userId}`);
    return true;
  }

  /**
   * Appends a message to the session's history.
   */
  async addHistory(sessionId: number, role: 'user' | 'model' | 'assistant', message: string): Promise<void> {
    await this.db.executeQuery(aiChatQueries.ADD_HISTORY, [sessionId, role, message]);
  }

  /**
   * Fetches the last N messages for a session, returned in chronological order (oldest first).
   * Capped at 30 by default per cost constraints.
   */
  async getHistory(sessionId: number, limit: number = 30): Promise<Record<string, any>[]> {
    // DB query returns newest-first; reverse for chronological order
    const rows = await this.db.executeSelectAllQuery(
      aiChatQueries.GET_HISTORY,
      [sessionId, limit],
    );
    return rows.reverse();
  }
}

export default AiChatModel;
