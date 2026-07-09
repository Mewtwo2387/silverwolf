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

  test('getResetAt returns null when under the limit', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', 1000, 1000);
    expect(await aiUsageModel.getResetAt('u1', 'daily')).toBeNull();
    expect(await aiUsageModel.getResetAt('u1', 'weekly')).toBeNull();
  });

  test('getResetAt (daily) clears when the oldest over-budget entry ages out', async () => {
    // 20h ago: 200k. Once this drops out (at 20h-ago + 24h = ~4h from now),
    // the remaining 100k is under the 250k daily limit.
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-20 hours'))
    `, ['u1', 'test-model', 200000, 0, 0]);
    // 5h ago: 100k (stays in the window past the reset).
    await db.executeQuery(`
      INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'))
    `, ['u1', 'test-model', 100000, 0, 0]);

    expect(await aiUsageModel.getDailyUsage('u1')).toBe(300000);

    const resetAt = await aiUsageModel.getResetAt('u1', 'daily');
    expect(resetAt).not.toBeNull();
    // Expected ≈ now + 4h (20h-ago entry + 24h window).
    const expected = Date.now() + 4 * 60 * 60 * 1000;
    expect(Math.abs((resetAt as Date).getTime() - expected)).toBeLessThan(2 * 60 * 1000);
  });

  test('getResetAt (weekly) clears when the oldest over-budget entry ages out', async () => {
    // Spread 1.05M across the week without tripping the daily limit; weekly is
    // over by 50k, so the limit lifts once the oldest (6d-ago) entry drops out
    // at 6d-ago + 7d = ~1 day from now.
    for (const [ago, tokens] of [
      ['-6 days', 200000], ['-5 days', 200000], ['-4 days', 200000],
      ['-3 days', 200000], ['-2 days', 150000], ['-30 hours', 100000],
    ] as const) {
      // eslint-disable-next-line no-await-in-loop
      await db.executeQuery(`
        INSERT INTO AiUsage (user_id, model, tokens_prompt, tokens_completion, cost, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', ?))
      `, ['u1', 'test-model', tokens, 0, 0, ago]);
    }

    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(1050000);

    const resetAt = await aiUsageModel.getResetAt('u1', 'weekly');
    expect(resetAt).not.toBeNull();
    // Expected ≈ now + 1 day (6d-ago entry + 7d window).
    const expected = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs((resetAt as Date).getTime() - expected)).toBeLessThan(2 * 60 * 1000);
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
