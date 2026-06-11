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

  it('counts zero generations for a fresh user', async () => {
    expect(await imageGenModel.countLast24h('u1')).toBe(0);
  });

  it('counts successful generations within the window', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', true);
    await imageGenModel.logGeneration('u1', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(2);
  });

  it('does not count failed generations toward the limit', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', false);
    await imageGenModel.logGeneration('u1', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  it('scopes the count to the requesting user', async () => {
    await imageGenModel.logGeneration('u1', 'a cat', 'test-model', true);
    await imageGenModel.logGeneration('u2', 'a dog', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  it('excludes rows older than 24 hours (rolling window)', async () => {
    await db.executeQuery(
      "INSERT INTO ImageGenLog (user_id, prompt, model, success, created_at) VALUES (?, ?, ?, 1, datetime('now', '-25 hours'))",
      ['u1', 'old prompt', 'test-model'],
    );
    await imageGenModel.logGeneration('u1', 'new prompt', 'test-model', true);
    expect(await imageGenModel.countLast24h('u1')).toBe(1);
  });

  it('reaches the limit after IMAGE_GEN_DAILY_LIMIT successes', async () => {
    for (let i = 0; i < IMAGE_GEN_DAILY_LIMIT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await imageGenModel.logGeneration('u1', `prompt ${i}`, 'test-model', true);
    }
    expect(await imageGenModel.countLast24h('u1')).toBe(IMAGE_GEN_DAILY_LIMIT);
  });
});
