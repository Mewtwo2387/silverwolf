const { log } = require('../../utils/log');
const chatQueries = require('../queries/chatQueries');

class ChatModel {
  constructor(db) {
    this.db = db;
  }

  async getChatSessionById(sessionId) {
    const query = chatQueries.GET_CHAT_SESSION_BY_ID;
    const result = await this.db.executeSelectQuery(query, [sessionId]);
    return result;
  }

  async startChatSession(startedBy, serverId) {
    await this.db.user.getUser(startedBy);
    const query = chatQueries.START_CHAT_SESSION;
    const result = await this.db.executeQuery(query, [startedBy, serverId]);
    log(`Started chat session ${result.lastID} for user ${startedBy} in server ${serverId}`);
    return this.getChatSessionById(result.lastID);
  }

  async endChatSession(sessionId) {
    const query = chatQueries.END_CHAT_SESSION;
    await this.db.executeQuery(query, [sessionId]);
    log(`Ended chat session ${sessionId}`);
    return this.getChatSessionById(sessionId);
  }

  async getActiveChatSessions() {
    const query = chatQueries.GET_ACTIVE_CHAT_SESSIONS;
    const result = await this.db.executeSelectAllQuery(query);
    return result;
  }

  async getLastActiveServerChatSession(serverId) {
    const query = chatQueries.GET_LAST_ACTIVE_SERVER_CHAT_SESSION;
    const result = await this.db.executeSelectQuery(query, [serverId]);
    return result;
  }

  async endLastActiveServerChatSession(serverId) {
    const session = await this.getLastActiveServerChatSession(serverId);
    if (session) {
      await this.endChatSession(session.sessionId);
      return true;
    }
    return false;
  }

  async startChatSessionIfNotExists(startedBy, serverId) {
    const session = await this.getLastActiveServerChatSession(serverId);
    if (session) {
      return session;
    }
    return this.startChatSession(startedBy, serverId);
  }

  async endAndStartNewChatSession(startedBy, serverId) {
    await this.endLastActiveServerChatSession(serverId);
    return this.startChatSession(startedBy, serverId);
  }

  async addChatHistory(sessionId, role, message) {
    const query = chatQueries.ADD_CHAT_HISTORY;
    await this.db.executeQuery(query, [sessionId, role, message]);
  }

  async getChatHistory(sessionId) {
    const query = chatQueries.GET_CHAT_HISTORY;
    const result = await this.db.executeSelectAllQuery(query, [sessionId]);
    return result;
  }
}

module.exports = ChatModel;
