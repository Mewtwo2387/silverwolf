import Database from '../../database/Database';
import type AiChatModel from '../../database/models/AiChatModel';

describe('AiChatModel', () => {
  let db: Database;
  let aiChat: AiChatModel;

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
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.personaName).toBe('Grok');
      expect(session.active).toBe(1);
    });

    it('should return the same active session on subsequent calls', async () => {
      const userId = '111111111111111111';

      const s1 = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const s2 = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      expect(s1.sessionId).toBe(s2.sessionId);
    });

    it('should create separate sessions per persona', async () => {
      const userId = '111111111111111111';

      const grokSession = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const gptSession = (await aiChat.getOrCreateSession(userId, 'GPT'))!;

      expect(grokSession.sessionId).not.toBe(gptSession.sessionId);
      expect(grokSession.personaName).toBe('Grok');
      expect(gptSession.personaName).toBe('GPT');
    });

    it('should create separate sessions per user for the same persona', async () => {
      const user1 = '111111111111111111';
      const user2 = '222222222222222222';

      const s1 = (await aiChat.getOrCreateSession(user1, 'Grok'))!;
      const s2 = (await aiChat.getOrCreateSession(user2, 'Grok'))!;

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

      const s = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
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
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      await aiChat.addHistory(session.sessionId, 'user', 'hello');
      await aiChat.addHistory(session.sessionId, 'model', 'hi!');

      const result = await aiChat.deleteSession(userId, session.sessionId);
      expect(result).toBe(true);

      const afterDelete = (await aiChat.getSessionById(session.sessionId))!;
      expect(afterDelete).toBeNull();

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(0);
    });

    it('should return false when session belongs to a different user', async () => {
      const owner = '111111111111111111';
      const intruder = '222222222222222222';

      const session = (await aiChat.getOrCreateSession(owner, 'Grok'))!;
      const result = await aiChat.deleteSession(intruder, session.sessionId);

      expect(result).toBe(false);

      // Session should still exist
      const stillThere = (await aiChat.getSessionById(session.sessionId))!;
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
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

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
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      for (let i = 0; i < 40; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await aiChat.addHistory(session.sessionId, 'user', `msg ${i}`);
      }

      const history = await aiChat.getHistory(session.sessionId, 30);
      expect(history.length).toBeLessThanOrEqual(30);
    });

    it('should respect the 30-message default cap', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      for (let i = 0; i < 35; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await aiChat.addHistory(session.sessionId, 'user', `msg ${i}`);
      }

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(30);
    });

    it('should only return history for the specified session', async () => {
      const userId = '111111111111111111';
      const s1 = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const s2 = (await aiChat.getOrCreateSession(userId, 'GPT'))!;

      await aiChat.addHistory(s1.sessionId, 'user', 'grok msg');
      await aiChat.addHistory(s2.sessionId, 'user', 'gpt msg');

      const h1 = await aiChat.getHistory(s1.sessionId);
      expect(h1).toHaveLength(1);
      expect(h1[0].message).toBe('grok msg');
    });

    it('should return empty array for session with no history', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(0);
    });
  });

  // ─── switchSession ────────────────────────────────────────────────────────

  describe('switchSession', () => {
    it('should deactivate current session and activate the target', async () => {
      const userId = '111111111111111111';

      const oldSession = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      await aiChat.endSession(oldSession.sessionId);
      const newSession = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      await aiChat.switchSession(userId, oldSession.sessionId);

      const reactivated = (await aiChat.getSessionById(oldSession.sessionId))!;
      const deactivated = (await aiChat.getSessionById(newSession.sessionId))!;

      expect(reactivated.active).toBe(1);
      expect(deactivated.active).toBe(0);
    });
  });

  // ─── undoLastTurn ─────────────────────────────────────────────────────────

  describe('undoLastTurn', () => {
    it('should delete the last user/tool/assistant turn and keep earlier history', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      await aiChat.addHistory(session.sessionId, 'user', 'first');
      await aiChat.addHistory(session.sessionId, 'assistant', 'first reply');
      await aiChat.addHistory(session.sessionId, 'user', 'second');
      await aiChat.addHistory(session.sessionId, 'tool', '{"name":"web_search"}');
      await aiChat.addHistory(session.sessionId, 'assistant', 'second reply');

      const result = await aiChat.undoLastTurn(userId, 'Grok');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.sessionId).toBe(session.sessionId);
      expect(result.deletedCount).toBe(3);
      expect(result.userMessage).toBe('second');

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('first');
      expect(history[1].message).toBe('first reply');
    });

    it('should return empty when the active session has no messages', async () => {
      const userId = '111111111111111111';
      await aiChat.getOrCreateSession(userId, 'Grok');

      const result = await aiChat.undoLastTurn(userId, 'Grok');
      expect(result).toEqual({ ok: false, reason: 'empty' });
    });

    it('should return no_session when the user has no active session for that persona', async () => {
      const result = await aiChat.undoLastTurn('111111111111111111', 'Grok');
      expect(result).toEqual({ ok: false, reason: 'no_session' });
    });

    it('should only undo the active persona session', async () => {
      const userId = '111111111111111111';
      const grok = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const gpt = (await aiChat.getOrCreateSession(userId, 'GPT'))!;

      await aiChat.addHistory(grok.sessionId, 'user', 'grok q');
      await aiChat.addHistory(grok.sessionId, 'assistant', 'grok a');
      await aiChat.addHistory(gpt.sessionId, 'user', 'gpt q');
      await aiChat.addHistory(gpt.sessionId, 'assistant', 'gpt a');

      const result = await aiChat.undoLastTurn(userId, 'Grok');
      expect(result.ok).toBe(true);

      expect(await aiChat.getHistory(grok.sessionId)).toHaveLength(0);
      expect(await aiChat.getHistory(gpt.sessionId)).toHaveLength(2);
    });
  });

  // ─── reassignSessionPersona ───────────────────────────────────────────────

  describe('reassignSessionPersona', () => {
    it('should move a session to a new persona and keep its history', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      await aiChat.addHistory(session.sessionId, 'user', 'hello');
      await aiChat.addHistory(session.sessionId, 'assistant', 'hi!');

      const result = await aiChat.reassignSessionPersona(userId, session.sessionId, 'GPT');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.previousPersona).toBe('Grok');
      expect(result.session.personaName).toBe('GPT');
      expect(result.session.sessionId).toBe(session.sessionId);
      expect(result.session.active).toBe(1);

      const history = await aiChat.getHistory(session.sessionId);
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('hello');
      expect(history[1].message).toBe('hi!');
    });

    it('should no-op when the session is already on that persona', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.getOrCreateSession(userId, 'Grok'))!;

      const result = await aiChat.reassignSessionPersona(userId, session.sessionId, 'Grok');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.previousPersona).toBe('Grok');
      expect(result.session.personaName).toBe('Grok');
    });

    it('should deactivate the destination persona\'s current active Discord session', async () => {
      const userId = '111111111111111111';
      const grok = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const gpt = (await aiChat.getOrCreateSession(userId, 'GPT'))!;

      const result = await aiChat.reassignSessionPersona(userId, grok.sessionId, 'GPT');
      expect(result.ok).toBe(true);

      const moved = (await aiChat.getSessionById(grok.sessionId))!;
      const previousGpt = (await aiChat.getSessionById(gpt.sessionId))!;

      expect(moved.personaName).toBe('GPT');
      expect(moved.active).toBe(1);
      expect(previousGpt.active).toBe(0);
      expect(previousGpt.personaName).toBe('GPT');
    });

    it('should not steal the destination\'s active slot when moving an inactive session', async () => {
      const userId = '111111111111111111';
      const oldGrok = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      await aiChat.endSession(oldGrok.sessionId);
      const liveGrok = (await aiChat.getOrCreateSession(userId, 'Grok'))!;
      const gpt = (await aiChat.getOrCreateSession(userId, 'GPT'))!;

      const result = await aiChat.reassignSessionPersona(userId, oldGrok.sessionId, 'GPT');
      expect(result.ok).toBe(true);

      const moved = (await aiChat.getSessionById(oldGrok.sessionId))!;
      expect(moved.personaName).toBe('GPT');
      expect(moved.active).toBe(0);
      expect((await aiChat.getSessionById(liveGrok.sessionId))!.active).toBe(1);
      expect((await aiChat.getSessionById(gpt.sessionId))!.active).toBe(1);
    });

    it('should reassign a web session without flipping active', async () => {
      const userId = '111111111111111111';
      const session = (await aiChat.createWebSession(userId, 'Grok'))!;
      expect(session.active).toBe(0);
      expect(session.source).toBe('web');

      await aiChat.addHistory(session.sessionId, 'user', 'web hello');

      const result = await aiChat.reassignSessionPersona(userId, session.sessionId, 'Jarvis');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.session.personaName).toBe('Jarvis');
      expect(result.session.active).toBe(0);
      expect(result.session.source).toBe('web');
      expect(await aiChat.getHistory(session.sessionId)).toHaveLength(1);
    });

    it('should return forbidden when the session belongs to a different user', async () => {
      const owner = '111111111111111111';
      const intruder = '222222222222222222';
      const session = (await aiChat.getOrCreateSession(owner, 'Grok'))!;

      const result = await aiChat.reassignSessionPersona(intruder, session.sessionId, 'GPT');
      expect(result).toEqual({ ok: false, reason: 'forbidden' });
      expect((await aiChat.getSessionById(session.sessionId))!.personaName).toBe('Grok');
    });

    it('should return not_found for a missing session', async () => {
      const result = await aiChat.reassignSessionPersona('111111111111111111', 99999, 'GPT');
      expect(result).toEqual({ ok: false, reason: 'not_found' });
    });
  });
});
