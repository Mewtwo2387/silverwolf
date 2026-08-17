import { stripModelTimestampPrefix } from '../../utils/ai';
import { log, logError } from '../../utils/log';
import aiChatQueries from '../queries/aiChatQueries';
import type Database from '../Database';

/** Audit field, not a control value — long enough for the full category list. */
const MAX_MODERATION_CATEGORY_CHARS = 500;

/** Model for managing per-user, per-persona AI chat sessions and history. */
class AiChatModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Retrieves an active session for a user+persona pair, or creates one if none exists.
   */
  async getOrCreateSession(userId: string, personaName: string): Promise<Record<string, any> | null> {
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
  async startNewSession(userId: string, personaName: string): Promise<Record<string, any> | null> {
    // Ensure the user exists in the User table
    await this.db.user.getUser(userId);

    const newSessionId = await this.db.executeTransaction(async (rawDb: any) => {
      rawDb.query(aiChatQueries.END_ALL_USER_PERSONA_SESSIONS).run(userId, personaName);
      rawDb.query(aiChatQueries.START_SESSION).run(userId, personaName);
      return rawDb.query('SELECT last_insert_rowid() as id').get().id;
    });

    const session = await this.getSessionById(newSessionId);
    if (session) {
      log(`AiChat: Started new session ${session.sessionId} for user ${userId} with persona ${personaName}`);
    }
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
   * Returns only the user's web-created sessions (source='web'), newest first.
   * Used by the /games/ai-slop sidebar — keeps Discord-bot sessions hidden.
   */
  async getUserWebSessions(userId: string): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(aiChatQueries.GET_USER_WEB_SESSIONS, [userId]);
  }

  /**
   * Returns only the user's Discord-created sessions (source='discord'),
   * newest first. Used by /ai view so Discord users don't see (and can't
   * manipulate) the web-created sessions that live in the same table.
   */
  async getUserDiscordSessions(userId: string): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(aiChatQueries.GET_USER_DISCORD_SESSIONS, [userId]);
  }

  /**
   * Creates a new web-source session for the given user/persona. Web sessions
   * are inserted with active=0 so they never collide with the bot's
   * per-persona active-session uniqueness invariant.
   */
  async createWebSession(userId: string, personaName: string): Promise<Record<string, any> | null> {
    await this.db.user.getUser(userId);
    const result = await this.db.executeQuery(
      aiChatQueries.START_WEB_SESSION,
      [userId, personaName],
    );
    if (!result.lastID) return null;
    const session = await this.getSessionById(result.lastID);
    if (session) {
      log(`AiChat (web): Created session ${session.sessionId} for user ${userId} with persona ${personaName}`);
    }
    return session;
  }

  /**
   * Renames a session after verifying it belongs to the requesting user.
   * Unlike updateTitle (which only fires once on auto-title), this overwrites
   * an existing title.
   */
  async renameSession(userId: string, sessionId: number, title: string): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session || session.userId !== userId) return false;
    await this.db.executeQuery(aiChatQueries.RENAME_SESSION, [title, sessionId]);
    return true;
  }

  /**
   * Moves a session (and its entire history) to a different persona by updating
   * `persona_name` in place. History rows stay attached via session_id.
   *
   * Discord has at most one active session per user+persona. If this session is
   * the live Discord one, any currently-active session for the *destination*
   * persona is deactivated first so the unique index isn't violated; this
   * session stays active under the new name. Inactive Discord sessions and all
   * web sessions (active=0) are a plain UPDATE.
   */
  async reassignSessionPersona(
    userId: string,
    sessionId: number,
    newPersonaName: string,
  ): Promise<
    | { ok: true; session: Record<string, any>; previousPersona: string }
    | { ok: false; reason: 'not_found' | 'forbidden' }
  > {
    const session = await this.getSessionById(sessionId);
    if (!session) return { ok: false, reason: 'not_found' };
    if (session.userId !== userId) return { ok: false, reason: 'forbidden' };

    const previousPersona = session.personaName;
    if (previousPersona === newPersonaName) {
      return { ok: true, session, previousPersona };
    }

    await this.db.executeTransaction((rawDb: any) => {
      // Deactivate the destination's current live Discord session *before*
      // renaming ours — at that point we still have the old persona, so we
      // won't deactivate ourselves. Web rows are active=0 and skip this.
      if (session.active === 1 && session.source === 'discord') {
        rawDb.query(aiChatQueries.END_ALL_USER_PERSONA_SESSIONS).run(userId, newPersonaName);
      }
      rawDb.query(aiChatQueries.UPDATE_SESSION_PERSONA).run(newPersonaName, sessionId, userId);
    });

    const updated = await this.getSessionById(sessionId);
    if (!updated) return { ok: false, reason: 'not_found' };
    log(`AiChat: Reassigned session ${sessionId} for user ${userId} from ${previousPersona} to ${newPersonaName}`);
    return { ok: true, session: updated, previousPersona };
  }

  /**
   * Marks a session as inactive.
   */
  async endSession(sessionId: number): Promise<void> {
    await this.db.executeQuery(aiChatQueries.END_SESSION, [sessionId]);
    log(`AiChat: Ended session ${sessionId}`);
  }

  /**
   * Updates the generated title for a session.
   */
  async updateTitle(sessionId: number, title: string): Promise<void> {
    await this.db.executeQuery(aiChatQueries.UPDATE_SESSION_TITLE, [title, sessionId]);
    log(`AiChat: Updated title for session ${sessionId}`);
  }

  /**
   * Marks a session as paused by the content-safety screen. Idempotent; the
   * session keeps its `active` flag so the user can still read the history and
   * so `getOrCreateSession` keeps returning it (and keeps refusing).
   *
   * Returns whether the pause actually persisted. `executeQuery` swallows DB
   * errors and reports `changes: 0` rather than throwing, so a caller that
   * assumed success would tell the user the chat was paused while leaving the
   * row unflagged — and the very next message would generate normally.
   */
  async flagSessionModeration(sessionId: number, categories?: string | null): Promise<boolean> {
    const id = Math.trunc(Number(sessionId));
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      logError(`AiChat: refusing to flag invalid session id ${String(sessionId)}`);
      return false;
    }
    // Categories are free-form classifier output stored for audit only; trim and
    // cap rather than whitelisting, since the model's taxonomy is its own and a
    // new category label should be recorded, not silently dropped.
    const trimmed = categories?.trim().slice(0, MAX_MODERATION_CATEGORY_CHARS) || null;

    const result = await this.db.executeQuery(
      aiChatQueries.FLAG_SESSION_MODERATION,
      [trimmed, id],
    );
    if (Number(result.changes ?? 0) !== 1) {
      logError(`AiChat: failed to persist content-safety pause for session ${id} (no row changed)`);
      return false;
    }
    log(`AiChat: Session ${id} paused by content-safety screen${trimmed ? ` (${trimmed})` : ''}`);
    return true;
  }

  /**
   * Switches the active session for a user/persona to a specific session.
   * Deactivates all current sessions for that user/persona first, then activates the target.
   */
  async switchSession(userId: string, sessionId: number): Promise<Record<string, any> | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) return null;
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
   *
   * No-ops when the session has been paused by the content-safety screen — the
   * guard lives in the INSERT itself, so a turn that was already generating when
   * another turn paused the session cannot write into it. Returns whether the
   * row was written.
   */
  async addHistory(sessionId: number, role: 'user' | 'model' | 'assistant' | 'tool', message: string): Promise<boolean> {
    const stored = role === 'model' || role === 'assistant'
      ? stripModelTimestampPrefix(message)
      : message;
    const result = await this.db.executeQuery(
      aiChatQueries.ADD_HISTORY,
      [sessionId, role, stored, sessionId],
    );
    return Number(result.changes ?? 0) > 0;
  }

  /**
   * Deletes the most recent user→(tools)→assistant/model turn from the user's
   * active session for this persona. Tool audit rows between the pair are
   * removed with it.
   */
  async undoLastTurn(
    userId: string,
    personaName: string,
    honorModerationPause: boolean = true,
  ): Promise<
    | { ok: true; sessionId: number; deletedCount: number; userMessage: string }
    | { ok: false; reason: 'no_session' | 'empty' | 'paused' }
  > {
    const session = await this.db.executeSelectQuery(
      aiChatQueries.GET_ACTIVE_SESSION,
      [userId, personaName],
    );
    if (!session || session.userId !== userId) {
      return { ok: false, reason: 'no_session' };
    }
    // A paused session never persisted the turn that tripped the filter, so
    // amnesia here would silently eat an *earlier*, legitimate turn — and must
    // never be mistaken for a way out of the pause. `kys` is the only exit.
    //
    // Gated on the caller's view of the `ai_moderation` switch: it is a master
    // switch, so turning it off must restore normal behaviour everywhere at
    // once. Otherwise a flagged session would chat normally but refuse amnesia.
    if (honorModerationPause && session.moderationFlagged) {
      return { ok: false, reason: 'paused' };
    }

    const outcome = await this.db.executeTransaction((rawDb: any) => {
      const lastUser = rawDb.query(aiChatQueries.GET_LAST_USER_HISTORY)
        .get(session.sessionId) as { id: number; message: string } | null;
      if (!lastUser) {
        return { ok: false as const, reason: 'empty' as const };
      }

      const result = rawDb.query(aiChatQueries.DELETE_HISTORY_FROM_ID)
        .run(session.sessionId, lastUser.id);
      const deletedCount = Number(result.changes ?? 0);
      if (deletedCount <= 0) {
        return { ok: false as const, reason: 'empty' as const };
      }

      return {
        ok: true as const,
        deletedCount,
        userMessage: typeof lastUser.message === 'string' ? lastUser.message : '',
      };
    });

    if (!outcome.ok) {
      return { ok: false, reason: 'empty' };
    }

    log(`AiChat: Undid last turn (${outcome.deletedCount} rows) in session ${session.sessionId} for user ${userId}`);
    return {
      ok: true,
      sessionId: session.sessionId,
      deletedCount: outcome.deletedCount,
      userMessage: outcome.userMessage,
    };
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
