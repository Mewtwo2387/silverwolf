import {
  describe, test, expect, beforeAll, afterAll, beforeEach,
} from 'bun:test';
import Database from '../../database/Database';
import type AiUsageModel from '../../database/models/AiUsageModel';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../../utils/ai';

// Back-dates a user's fixed window so it reads as lapsed — the test-time
// equivalent of the window's interval elapsing.
async function lapseWindow(db: Database, userId: string, type: 'daily' | 'weekly') {
  const ago = type === 'daily' ? '-25 hours' : '-8 days';
  await db.executeQuery(
    `
      UPDATE AiRateLimitWindow SET window_start = datetime('now', ?)
      WHERE user_id = ? AND window_type = ?
    `,
    [ago, userId, type],
  );
}

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
    await db.executeQuery('DELETE FROM AiRateLimitWindow');
    await db.executeQuery('DELETE FROM User');
  });

  test('starts with zero usage for fresh user', async () => {
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(0);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(0);
    const limitStatus = await aiUsageModel.checkRateLimit('u1');
    expect(limitStatus.limited).toBe(false);
  });

  test('accumulates usage within a window', async () => {
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

  test('clears the daily window wholesale once it lapses, weekly keeps rolling', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', 100000, 0);
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(100000);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(100000);

    await lapseWindow(db, 'u1', 'daily');
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(0); // daily reset to zero
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(100000); // weekly still open

    // The next call opens a fresh daily window rather than resuming the old total.
    await aiUsageModel.addUsage('u1', 'test-model', 50000, 0);
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(50000);
    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(150000);
  });

  test('triggers daily rate limit when the window budget is exceeded', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', DAILY_LIMIT - 5000, 0);
    let status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(false);

    await aiUsageModel.addUsage('u1', 'test-model', 10000, 0);
    status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(true);
    expect(status.reason).toBe('daily');
    expect(status.limit).toBe(DAILY_LIMIT);
  });

  test('daily rate limit clears once the window resets', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', DAILY_LIMIT, 0);
    expect((await aiUsageModel.checkRateLimit('u1')).limited).toBe(true);

    await lapseWindow(db, 'u1', 'daily');
    const status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(false); // daily cleared; weekly (250k) still under 1M
  });

  test('weekly rate limit trips independently while daily keeps resetting', async () => {
    // Five 200k "days": daily is lapsed between each so it never exceeds 250k,
    // but the weekly window keeps accumulating to 1,000,000.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await aiUsageModel.addUsage('u1', 'test-model', 200000, 0);
      // eslint-disable-next-line no-await-in-loop
      await lapseWindow(db, 'u1', 'daily');
    }

    expect(await aiUsageModel.getWeeklyUsage('u1')).toBe(1000000);
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(0);

    const status = await aiUsageModel.checkRateLimit('u1');
    expect(status.limited).toBe(true);
    expect(status.reason).toBe('weekly');
    expect(status.limit).toBe(WEEKLY_LIMIT);
  });

  test('getResetAt is null when no window is open', async () => {
    expect(await aiUsageModel.getResetAt('u1', 'daily')).toBeNull();
    expect(await aiUsageModel.getResetAt('u1', 'weekly')).toBeNull();

    await aiUsageModel.addUsage('u1', 'test-model', 1000, 0);
    await lapseWindow(db, 'u1', 'daily');
    expect(await aiUsageModel.getResetAt('u1', 'daily')).toBeNull();
  });

  test('getResetAt (daily) is the window start + 24h', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', DAILY_LIMIT, 0);
    const resetAt = await aiUsageModel.getResetAt('u1', 'daily');
    expect(resetAt).not.toBeNull();
    const expected = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs((resetAt as Date).getTime() - expected)).toBeLessThan(2 * 60 * 1000);
  });

  test('getResetAt (weekly) is the window start + 7d', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', 500000, 0);
    const resetAt = await aiUsageModel.getResetAt('u1', 'weekly');
    expect(resetAt).not.toBeNull();
    const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
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

  test('meters credit-priced models by multiplier, not raw tokens', async () => {
    // deepseek/deepseek-v4-flash: 0.5x input, 1x output ($0.14/M in, $0.28/M out)
    await aiUsageModel.addUsage('u1', 'deepseek/deepseek-v4-flash', 100000, 50000);
    expect(await aiUsageModel.getDailyUsage('u1')).toBe(100000); // 50k + 50k credits

    // Unlisted models keep the old 1x/1x accounting
    await aiUsageModel.addUsage('u2', 'some-unknown-model', 100000, 50000);
    expect(await aiUsageModel.getDailyUsage('u2')).toBe(150000);

    // x-ai/grok-4.5: 7x input, 21.43x output
    await aiUsageModel.addUsage('u3', 'x-ai/grok-4.5', 10000, 10000);
    expect(await aiUsageModel.getDailyUsage('u3')).toBe(284300);
  });

  test('stores the derived USD cost on the audit row', async () => {
    await aiUsageModel.addUsage('u1', 'deepseek/deepseek-v4-flash', 1_000_000, 1_000_000);
    const row = await db.executeSelectQuery('SELECT cost FROM AiUsage WHERE user_id = ?', ['u1']);
    // 0.5M + 1M = 1.5M credits × $0.28/M
    expect(row!.cost).toBeCloseTo(0.42, 5);
  });

  test('tryReserve counts in-flight usage toward the limit', async () => {
    await aiUsageModel.addUsage('u1', 'test-model', DAILY_LIMIT - 10000, 0);

    const first = aiUsageModel.tryReserve('u1', 8000);
    expect(first.ok).toBe(true);
    expect(aiUsageModel.getPendingCredits('u1')).toBe(8000);

    // 240k recorded + 8k in flight + another 8k would exceed 250k — blocked.
    const second = aiUsageModel.tryReserve('u1', 8000);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('daily');

    // Releasing the reservation opens the gate again.
    aiUsageModel.release('u1', 8000);
    expect(aiUsageModel.getPendingCredits('u1')).toBe(0);
    const third = aiUsageModel.tryReserve('u1', 8000);
    expect(third.ok).toBe(true);
    aiUsageModel.release('u1', 8000);
  });

  test('tryReserve is unlimited for developers', async () => {
    const devId = process.env.ALLOWED_USERS?.split(',')[0];
    if (!devId) return; // skip if no ALLOWED_USERS configured

    await aiUsageModel.addUsage(devId, 'test-model', DAILY_LIMIT * 5, 0);
    const gate = aiUsageModel.tryReserve(devId, 100000);
    expect(gate.ok).toBe(true);
    expect(aiUsageModel.getPendingCredits(devId)).toBe(0);
  });

  test('release never drives pending negative', async () => {
    aiUsageModel.release('u1', 5000); // no reservation held
    expect(aiUsageModel.getPendingCredits('u1')).toBe(0);

    aiUsageModel.tryReserve('u1', 1000);
    aiUsageModel.release('u1', 99999);
    expect(aiUsageModel.getPendingCredits('u1')).toBe(0);
  });
});
