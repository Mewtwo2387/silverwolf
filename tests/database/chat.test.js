const Database = require('../../database/Database');

describe('ChatModel', () => {
  let db;
  let chatModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testChat-${timestamp}.db`);
    await db.ready;
    chatModel = db.chat;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the ChatSession and ChatHistory tables before each test
    await db.executeQuery('DELETE FROM ChatHistory');
    await db.executeQuery('DELETE FROM ChatSession');
    await db.executeQuery('DELETE FROM User');
  });

  describe('startChatSession and getChatSessionById', () => {
    it('should start a new chat session and retrieve it', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.startChatSession(userId, serverId);
      const retrievedSession = await chatModel.getChatSessionById(session.sessionId);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.startedBy).toBe(userId);
      expect(retrievedSession.serverId).toBe(serverId);
      expect(retrievedSession.active).toBe(1);
    });
  });

  describe('endChatSession', () => {
    it('should end an active chat session', async () => {
      const userId = '123456789';
      const serverId = '987654321';
      const session = await chatModel.startChatSession(userId, serverId);

      const endedSession = await chatModel.endChatSession(session.sessionId);
      expect(endedSession.active).toBe(0);
    });
  });

  describe('getActiveChatSessions', () => {
    it('should return only active chat sessions', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session1 = await chatModel.startChatSession(userId, serverId);
      const session2 = await chatModel.startChatSession(userId, serverId);
      await chatModel.endChatSession(session1.sessionId);

      const activeSessions = await chatModel.getActiveChatSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe(session2.sessionId);
    });

    it('should return empty array when no active sessions', async () => {
      const activeSessions = await chatModel.getActiveChatSessions();
      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('getLastActiveServerChatSession', () => {
    it('should return the most recent chat session for a server', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      await chatModel.startChatSession(userId, serverId);
      const session2 = await chatModel.startChatSession(userId, serverId);

      const lastSession = await chatModel.getLastActiveServerChatSession(serverId);
      expect(lastSession.sessionId).toBe(session2.sessionId);
    });

    it('should ignore inactive sessions', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session1 = await chatModel.startChatSession(userId, serverId);
      await chatModel.endChatSession(session1.sessionId);

      const session2 = await chatModel.startChatSession(userId, serverId);

      const lastSession = await chatModel.getLastActiveServerChatSession(serverId);
      expect(lastSession.sessionId).toBe(session2.sessionId);
    });

    it('should ignore sessions for other servers', async () => {
      const userId = '123456789';
      const serverId = '987654321';
      const serverId2 = '123456789';

      const correctSession = await chatModel.startChatSession(userId, serverId);
      await chatModel.startChatSession(userId, serverId2);

      const lastSession = await chatModel.getLastActiveServerChatSession(serverId);
      expect(lastSession.sessionId).toBe(correctSession.sessionId);
    });

    it('should return null for server with no sessions', async () => {
      const serverId = '987654321';
      const lastSession = await chatModel.getLastActiveServerChatSession(serverId);
      expect(lastSession).toBeNull();
    });
  });

  describe('endLastActiveServerChatSession', () => {
    it('should only end the last active session for a server', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session1 = await chatModel.startChatSession(userId, serverId);
      const session2 = await chatModel.startChatSession(userId, serverId);
      const result = await chatModel.endLastActiveServerChatSession(serverId);

      expect(result).toBe(true);

      const retrievedSession = await chatModel.getChatSessionById(session2.sessionId);
      expect(retrievedSession.active).toBe(0);

      const retrievedSession2 = await chatModel.getChatSessionById(session1.sessionId);
      expect(retrievedSession2.active).toBe(1);
    });

    it('should ignore if there are no active sessions', async () => {
      const serverId = '987654321';
      const result = await chatModel.endLastActiveServerChatSession(serverId);
      expect(result).toBe(false);
    });
  });

  describe('startChatSessionIfNotExists', () => {
    it('should start a new chat session if there is no active session', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.startChatSessionIfNotExists(userId, serverId);
      expect(session.startedBy).toBe(userId);
      expect(session.serverId).toBe(serverId);
      expect(session.active).toBe(1);
    });

    it('should return the existing session if it exists', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.startChatSession(userId, serverId);
      const retrievedSession = await chatModel.startChatSessionIfNotExists(userId, serverId);

      expect(retrievedSession.sessionId).toBe(session.sessionId);
      expect(retrievedSession.active).toBe(1);
    });
  });

  describe('endAndStartNewChatSession', () => {
    it('should end the last active session and start a new one', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session1 = await chatModel.startChatSession(userId, serverId);
      const session2 = await chatModel.endAndStartNewChatSession(userId, serverId);

      const retrievedSession1 = await chatModel.getChatSessionById(session1.sessionId);
      const retrievedSession2 = await chatModel.getChatSessionById(session2.sessionId);

      expect(retrievedSession1.active).toBe(0);
      expect(retrievedSession2.active).toBe(1);
    });

    it('should create a new session if there is no active session', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.endAndStartNewChatSession(userId, serverId);
      expect(session.startedBy).toBe(userId);
      expect(session.serverId).toBe(serverId);
      expect(session.active).toBe(1);
    });
  });

  describe('addChatHistory and getChatHistory', () => {
    it('should add and retrieve chat history', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.startChatSession(userId, serverId);

      const message1 = { role: 'user', content: 'Hello' };
      const message2 = { role: 'model', content: 'Hi there!' };

      await chatModel.addChatHistory(session.sessionId, message1.role, message1.content);
      await chatModel.addChatHistory(session.sessionId, message2.role, message2.content);

      const history = await chatModel.getChatHistory(session.sessionId);
      expect(history).toHaveLength(2);
      expect(history[1].role).toBe(message1.role);
      expect(history[1].message).toBe(message1.content);
      expect(history[0].role).toBe(message2.role);
      expect(history[0].message).toBe(message2.content);
    });

    it('should return empty array for session with no history', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session = await chatModel.startChatSession(userId, serverId);

      const history = await chatModel.getChatHistory(session.sessionId);
      expect(history).toHaveLength(0);
    });

    it('should only retrieve chat history for the specified session', async () => {
      const userId = '123456789';
      const serverId = '987654321';

      const session1 = await chatModel.startChatSession(userId, serverId);
      const session2 = await chatModel.startChatSession(userId, serverId);

      const message1 = { role: 'user', content: 'Hello' };
      const message2 = { role: 'model', content: 'Hi there!' };

      await chatModel.addChatHistory(session1.sessionId, message1.role, message1.content);
      await chatModel.addChatHistory(session2.sessionId, message2.role, message2.content);

      const history1 = await chatModel.getChatHistory(session1.sessionId);
      expect(history1).toHaveLength(1);
      expect(history1[0].role).toBe(message1.role);
      expect(history1[0].message).toBe(message1.content);

      const history2 = await chatModel.getChatHistory(session2.sessionId);
      expect(history2).toHaveLength(1);
      expect(history2[0].role).toBe(message2.role);
      expect(history2[0].message).toBe(message2.content);
    });
  });
});
