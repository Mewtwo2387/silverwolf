import { log } from '../../utils/log';
import chatQueries from '../queries/chatQueries';
import type Database from '../Database';

class ChatModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getChatSessionById(sessionId: number): Promise<Record<string, any> | null> {
    const query = chatQueries.GET_CHAT_SESSION_BY_ID;
    return this.db.executeSelectQuery(query, [sessionId]);
  }

  async startChatSession(startedBy: string, serverId: string): Promise<Record<string, any> | null> {
    await this.db.user.getUser(startedBy);
    const query = chatQueries.START_CHAT_SESSION;
    const result = await this.db.executeQuery(query, [startedBy, serverId]);
    log(`Started chat session ${result.lastID} for user ${startedBy} in server ${serverId}`);
    return this.getChatSessionById(result.lastID as number);
  }

  async endChatSession(sessionId: number): Promise<Record<string, any> | null> {
    const query = chatQueries.END_CHAT_SESSION;
    await this.db.executeQuery(query, [sessionId]);
    log(`Ended chat session ${sessionId}`);
    return this.getChatSessionById(sessionId);
  }

  async getActiveChatSessions(): Promise<Record<string, any>[]> {
    const query = chatQueries.GET_ACTIVE_CHAT_SESSIONS;
    return this.db.executeSelectAllQuery(query);
  }

  async getLastActiveServerChatSession(serverId: string): Promise<Record<string, any> | null> {
    const query = chatQueries.GET_LAST_ACTIVE_SERVER_CHAT_SESSION;
    return this.db.executeSelectQuery(query, [serverId]);
  }

  async endLastActiveServerChatSession(serverId: string): Promise<boolean> {
    const session = await this.getLastActiveServerChatSession(serverId);
    if (session) {
      await this.endChatSession(session.sessionId);
      return true;
    }
    return false;
  }

  async startChatSessionIfNotExists(startedBy: string, serverId: string): Promise<Record<string, any> | null> {
    const session = await this.getLastActiveServerChatSession(serverId);
    if (session) {
      return session;
    }
    return this.startChatSession(startedBy, serverId);
  }

  async endAndStartNewChatSession(startedBy: string, serverId: string): Promise<Record<string, any> | null> {
    await this.endLastActiveServerChatSession(serverId);
    return this.startChatSession(startedBy, serverId);
  }

  async addChatHistory(sessionId: number, role: 'user' | 'model', message: string): Promise<void> {
    const query = chatQueries.ADD_CHAT_HISTORY;
    await this.db.executeQuery(query, [sessionId, role, message]);
  }

  async getChatHistory(sessionId: number): Promise<Record<string, any>[]> {
    const query = chatQueries.GET_CHAT_HISTORY;
    return this.db.executeSelectAllQuery(query, [sessionId]);
  }
}

export default ChatModel;
