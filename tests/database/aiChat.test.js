const Database = require('../../database/Database');

describe('AiChatModel', () => {
  let db;
  let aiChat;

  beforeAll(async () => {
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testAiChat-${timestamp}.db`);
    await db.ready;
    aiChat = db.aiChat;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM AiChatHistory');
    await db.executeQuery('DELETE FROM AiChatSession');
    await db.executeQuery('DELETE FROM User');
  });

  // ─── getOrCreateSession ───────────────────────────────────────────────────

  describe('getOrCreateSession', () => {
    it('should create a new session on the first call', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.personaName).toBe('Grok');
      expect(session.active).toBe(1);
    });

    it('should return the same active session on subsequent calls', async () => {
      const userId = '111111111111111111';

      const s1 = await aiChat.getOrCreateSession(userId, 'Grok');
      const s2 = await aiChat.getOrCreateSession(userId, 'Grok');

      expect(s1.sessionId).toBe(s2.sessionId);
    });

    it('should create separate sessions per persona', async () => {
      const userId = '111111111111111111';

      const grokSession = await aiChat.getOrCreateSession(userId, 'Grok');
      const gptSession = await aiChat.getOrCreateSession(userId, 'GPT');

      expect(grokSession.sessionId).not.toBe(gptSession.sessionId);
      expect(grokSession.personaName).toBe('Grok');
      expect(gptSession.personaName).toBe('GPT');
    });

    it('should create separate sessions per user for the same persona', async () => {
      const user1 = '111111111111111111';
      const user2 = '222222222222222222';

      const s1 = await aiChat.getOrCreateSession(user1, 'Grok');
      const s2 = await aiChat.getOrCreateSession(user2, 'Grok');

      expect(s1.sessionId).not.toBe(s2.sessionId);
    });
  });

  // ─── getAllUserSessions ───────────────────────────────────────────────────

  describe('getAllUserSessions', () => {
    it('should return only sessions for the specified user', async () => {
      const user1 = '111111111111111111';
      const user2 = '222222222222222222';

      await aiChat.getOrCreateSession(user1, 'Grok');
      await aiChat.getOrCreateSession(user1, 'GPT');
      await aiChat.getOrCreateSession(user2, 'Grok');

      const sessions = await aiChat.getAllUserSessions(user1);
      expect(sessions).toHaveLength(2);
      sessions.forEach((s) => expect(s.userId).toBe(user1));
    });

    it('should return empty array when user has no sessions', async () => {
      const sessions = await aiChat.getAllUserSessions('999999999999999999');
      expect(sessions).toHaveLength(0);
    });

    it('should include both active and inactive sessions', async () => {
      const userId = '111111111111111111';

      const s = await aiChat.getOrCreateSession(userId, 'Grok');
      await aiChat.endSession(s.sessionId);
      await aiChat.getOrCreateSession(userId, 'Grok');

      const sessions = await aiChat.getAllUserSessions(userId);
      expect(sessions).toHaveLength(2);
    });
  });

  // ─── deleteSession ────────────────────────────────────────────────────────

  describe('deleteSession', () => {
    it('should delete a session and its history', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');

      await aiChat.addHistory(session.sessionId, 'user', 'hello');
      await aiChat.addHistory(session.sessionId, 'model', 'hi!');

      const result = await aiChat.deleteSession(userId, session.sessionId);
      expect(result).toBe(true);

      const afterDelete = await aiChat.getSessionById(session.sessionId);
      expect(afterDelete).toBeNull();

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(0);
    });

    it('should return false when session belongs to a different user', async () => {
      const owner = '111111111111111111';
      const intruder = '222222222222222222';

      const session = await aiChat.getOrCreateSession(owner, 'Grok');
      const result = await aiChat.deleteSession(intruder, session.sessionId);

      expect(result).toBe(false);

      // Session should still exist
      const stillThere = await aiChat.getSessionById(session.sessionId);
      expect(stillThere).toBeDefined();
    });

    it('should return false for a non-existent session ID', async () => {
      const result = await aiChat.deleteSession('111111111111111111', 99999);
      expect(result).toBe(false);
    });
  });

  // ─── getHistory ───────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return history in chronological order (oldest first)', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');

      await aiChat.addHistory(session.sessionId, 'user', 'first');
      await aiChat.addHistory(session.sessionId, 'model', 'second');
      await aiChat.addHistory(session.sessionId, 'user', 'third');

      const history = await aiChat.getHistory(session.sessionId);
      expect(history[0].message).toBe('first');
      expect(history[1].message).toBe('second');
      expect(history[2].message).toBe('third');
    });

    it('should cap results at the specified limit', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');

      for (let i = 0; i < 40; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await aiChat.addHistory(session.sessionId, 'user', `msg ${i}`);
      }

      const history = await aiChat.getHistory(session.sessionId, 30);
      expect(history.length).toBeLessThanOrEqual(30);
    });

    it('should respect the 30-message default cap', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');

      for (let i = 0; i < 35; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await aiChat.addHistory(session.sessionId, 'user', `msg ${i}`);
      }

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(30);
    });

    it('should only return history for the specified session', async () => {
      const userId = '111111111111111111';
      const s1 = await aiChat.getOrCreateSession(userId, 'Grok');
      const s2 = await aiChat.getOrCreateSession(userId, 'GPT');

      await aiChat.addHistory(s1.sessionId, 'user', 'grok msg');
      await aiChat.addHistory(s2.sessionId, 'user', 'gpt msg');

      const h1 = await aiChat.getHistory(s1.sessionId);
      expect(h1).toHaveLength(1);
      expect(h1[0].message).toBe('grok msg');
    });

    it('should return empty array for session with no history', async () => {
      const userId = '111111111111111111';
      const session = await aiChat.getOrCreateSession(userId, 'Grok');
      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(0);
    });
  });

  // ─── switchSession ────────────────────────────────────────────────────────

  describe('switchSession', () => {
    it('should deactivate current session and activate the target', async () => {
      const userId = '111111111111111111';

      const oldSession = await aiChat.getOrCreateSession(userId, 'Grok');
      await aiChat.endSession(oldSession.sessionId);
      const newSession = await aiChat.getOrCreateSession(userId, 'Grok');

      await aiChat.switchSession(userId, oldSession.sessionId);

      const reactivated = await aiChat.getSessionById(oldSession.sessionId);
      const deactivated = await aiChat.getSessionById(newSession.sessionId);

      expect(reactivated.active).toBe(1);
      expect(deactivated.active).toBe(0);
    });
  });
});
