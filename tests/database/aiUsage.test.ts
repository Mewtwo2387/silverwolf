import {
  describe, test, expect, beforeAll, afterAll, beforeEach,
} from 'bun:test';
import Database from '../../database/Database';
import type AiUsageModel from '../../database/models/AiUsageModel';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../../utils/ai';

describe('AiUsageModel', () => {
  let db: Database;
  let aiUsageModel: AiUsageModel;

  beforeAll(async () => {
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testAiUsage-${timestamp}.db`);
    await db.ready;
    aiUsageModel = db.aiUsage;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM AiUsage');
    await db.executeQuery('DELETE FROM User');
  });

  test('starts with zero usage for fresh user', async () => {
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(0);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(0);
    const limitStatus = await aiUsageModel.checkRateLimit('u1');
    expect(limitStatus.limited).toBe(false);
  });

  test('accumulates daily and weekly usage correctly', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', 1000, 2000);
    await aiUsageModel.addUsage('u1', 'test-model2', 500, 1500);

    expect(await aiUsageModel.getDailyUsage('u1')).toBe(5000);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(5000);
  });

  test('separates usage by user', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', 1000, 2000);
    await aiUsageModel.addUsage('u2', 'test-model', 500, 500);

    expect(await aiUsageModel.getDailyUsage('u1')).toBe(3000);
    expect(await aiUsageModel.getDailyUsage('u2')).toBe(1000);
  });

  test('excludes daily entries older than 24 hours but includes in weekly', async () => {
    // 25 hours ago
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-25 hours'))
    `, ['u1', 'test-model', 10000, 10000, 0]);

    // 2 hours ago
    await aiUsageModel.addUsage('u1', 'test-model', 2000, 3000);

    expect(await aiUsageModel.getDailyUsage('u1')).toBe(5000);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(25000);
  });

  test('excludes weekly entries older than 7 days', async () => {
    // 8 days ago
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-8 days'))
    `, ['u1', 'test-model', 50000, 50000, 0]);

    // 3 days ago
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-3 days'))
    `, ['u1', 'test-model', 20000, 20000, 0]);

    expect(await aiUsageModel.getDailyUsage('u1')).toBe(0);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(40000);
  });

  test('triggers daily rate limit when budget exceeded', async () => {
    // Under limit
    await aiUsageModel.addUsage('u1', 'test-model', DAILY_LIMIT - 5000, 0);
    let status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(false);

    // Over limit
    await aiUsageModel.addUsage('u1', 'test-model', 10000, 0);
    status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(true);
    expect(status.reason).toBe('daily');
    expect(status.limit).toBe(DAILY_LIMIT);
  });

  test('triggers weekly rate limit when budget exceeded', async () => {
    // Simulate usage across past 6 days, staying below the 250k daily limit on each day
    // Day 1 (6 days ago): 200k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-6 days'))
    `, ['u1', 'test-model', 200000, 0, 0]);

    // Day 2 (5 days ago): 200k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-5 days'))
    `, ['u1', 'test-model', 200000, 0, 0]);

    // Day 3 (4 days ago): 200k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-4 days'))
    `, ['u1', 'test-model', 200000, 0, 0]);

    // Day 4 (3 days ago): 200k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-3 days'))
    `, ['u1', 'test-model', 200000, 0, 0]);

    // Day 5 (2 days ago): 150k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'))
    `, ['u1', 'test-model', 150000, 0, 0]);

    // Day 6 (30 hours ago): 100k
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-30 hours'))
    `, ['u1', 'test-model', 100000, 0, 0]);

    // Total so far = 1,050,000. Daily usage = 0.
    const status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(true);
    expect(status.reason).toBe('weekly');
    expect(status.limit).toBe(WEEKLY_LIMIT);
  });

  test('bypasses rate limit checks for developers', async () => {
    const devId = process.env.ALLOWED_USERS?.split(',')[0];
    if (!devId) {
      // Skip if no ALLOWED_USERS configured
      return;
    }

    await aiUsageModel.addUsage(devId, 'test-model', DAILY_LIMIT * 5, 0);
    const status = await aiUsageModel.checkRateLimit(devId);
    expect(status.limited).toBe(false);
  });
});
