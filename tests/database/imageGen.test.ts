import Database from '../../database/Database';
import type ImageGenModel from '../../database/models/ImageGenModel';
import { IMAGE_GEN_DAILY_LIMIT } from '../../utils/imageGen';

describe('ImageGenModel', () => {
  let db: Database;
  let imageGenModel: ImageGenModel;

  beforeAll(async () => {
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testImageGen-${timestamp}.db`);
    await db.ready;
    imageGenModel = db.imageGen;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM ImageGenLog');
  });

  test('counts zero generations for a fresh user', async () => {
    expect(await imageGenModel.countLast24h('u1')).toBe(0);
  });

  test('counts successful generations within the window', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', true);
    await imageGenModel.logGeneration('u1', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(2);
  });

  test('does not count failed generations toward the limit', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', false);
    await imageGenModel.logGeneration('u1', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  test('scopes the count to the requesting user', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', true);
    await imageGenModel.logGeneration('u2', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  test('excludes rows older than 24 hours (rolling window)', async () => {
    await db.executeQuery(
      "INSERT INTO ImageGenLog (user_id, prompt, model, success, created_at) VALUES (?, ?, ?, 1, datetime('now', '-25 hours'))",
      ['u1', 'old prompt', 'test-model'],
    );
    await imageGenModel.logGeneration('u1', 'new prompt', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  test('reserveGeneration consumes slots until the limit, then returns null', async () => {
    for (let i = 0; i < IMAGE_GEN_DAILY_LIMIT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const id = await imageGenModel.reserveGeneration('u1', `prompt ${i}`, 'test-model', IMAGE_GEN_DAILY_LIMIT);
      expect(id).not.toBeNull();
    }
    const blocked = await imageGenModel.reserveGeneration('u1', 'one too many', 'test-model', IMAGE_GEN_DAILY_LIMIT);
    expect(blocked).toBeNull();
    expect(await imageGenModel.countLast24h('u1')).toBe(IMAGE_GEN_DAILY_LIMIT);
  });

  test('markFailed releases a reserved slot', async () => {
    for (let i = 0; i < IMAGE_GEN_DAILY_LIMIT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await imageGenModel.reserveGeneration('u1', `prompt ${i}`, 'test-model', IMAGE_GEN_DAILY_LIMIT);
    }
    const id = await imageGenModel.reserveGeneration('u1', 'blocked', 'test-model', IMAGE_GEN_DAILY_LIMIT);
    expect(id).toBeNull();

    const lastRow = await db.executeSelectQuery('SELECT id FROM ImageGenLog ORDER BY id DESC LIMIT 1');
    await imageGenModel.markFailed(lastRow!.id);

    const freed = await imageGenModel.reserveGeneration('u1', 'retry', 'test-model', IMAGE_GEN_DAILY_LIMIT);
    expect(freed).not.toBeNull();
  });
});
