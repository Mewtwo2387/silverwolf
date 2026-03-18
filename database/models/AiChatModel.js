const { log } = require('../../utils/log');
const aiChatQueries = require('../queries/aiChatQueries');

/**
 * Model for managing per-user, per-persona AI chat sessions and history.
 * Completely separate from ChatModel (which is used by /ask-silverwolf-ai).
 */
class AiChatModel {
  constructor(db) {
    this.db = db;
  }

  /**
     * Retrieves an active session for a user+persona pair, or creates one if none exists.
     * @param {string} userId - Discord user ID
     * @param {string} personaName - Persona name (e.g. 'Grok', 'GPT')
     * @returns {Promise<object>} The session row (camelCase keys)
     */
  async getOrCreateSession(userId, personaName) {
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
      session = await this.getSessionById(result.lastID);
      log(`AiChat: Created session ${session.sessionId} for user ${userId} with persona ${personaName}`);
    }

    return session;
  }

  /**
     * Returns a session row by its ID.
     * @param {number} sessionId
     * @returns {Promise<object|null>}
     */
  async getSessionById(sessionId) {
    return this.db.executeSelectQuery(aiChatQueries.GET_SESSION_BY_ID, [sessionId]);
  }

  /**
     * Returns all sessions for a user (active and inactive), newest first.
     * @param {string} userId
     * @returns {Promise<object[]>}
     */
  async getAllUserSessions(userId) {
    return this.db.executeSelectAllQuery(aiChatQueries.GET_ALL_USER_SESSIONS, [userId]);
  }

  /**
     * Marks a session as inactive.
     * @param {number} sessionId
     */
  async endSession(sessionId) {
    await this.db.executeQuery(aiChatQueries.END_SESSION, [sessionId]);
    log(`AiChat: Ended session ${sessionId}`);
  }

  /**
     * Switches the active session for a user/persona to a specific session.
     * Deactivates all current sessions for that user/persona first, then activates the target.
     * @param {string} userId - Must match the session owner (caller must validate)
     * @param {number} sessionId
     * @returns {Promise<object>} The activated session row
     */
  async switchSession(userId, sessionId) {
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
     * @param {string} userId - The requesting user's Discord ID
     * @param {number} sessionId
     * @returns {Promise<boolean>} false if session not found or not owned by user
     */
  async deleteSession(userId, sessionId) {
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
     * @param {number} sessionId
     * @param {string} role - 'user', 'model' (Gemini), or 'assistant' (OpenRouter)
     * @param {string} message
     */
  async addHistory(sessionId, role, message) {
    await this.db.executeQuery(aiChatQueries.ADD_HISTORY, [sessionId, role, message]);
  }

  /**
     * Fetches the last N messages for a session, returned in chronological order (oldest first).
     * Capped at 30 by default per cost constraints.
     * @param {number} sessionId
     * @param {number} limit - max messages to load
     * @returns {Promise<object[]>} Array of history rows, oldest first
     */
  async getHistory(sessionId, limit = 30) {
    // DB query returns newest-first; reverse for chronological order
    const rows = await this.db.executeSelectAllQuery(
      aiChatQueries.GET_HISTORY,
      [sessionId, limit],
    );
    return rows.reverse();
  }
}

module.exports = AiChatModel;
