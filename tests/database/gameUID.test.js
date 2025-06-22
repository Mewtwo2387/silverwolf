const Database = require('../../database/Database');

describe('GameUIDModel', () => {
  let db;
  let gameUIDModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testGameUID-${timestamp}.db`);
    await db.ready;
    gameUIDModel = db.gameUID;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the GameUID table before each test
    await db.executeQuery('DELETE FROM GameUID');
    await db.executeQuery('DELETE FROM User');
  });

  describe('setGameUID and getGameUID', () => {
    it('should create user, add a new game UID and retrieve it', async () => {
      const userId = '123456789';
      const game = 'hsr';
      const gameUid = '900000001';
      const region = 'HK';

      await gameUIDModel.setGameUID(userId, game, gameUid, region);
      const result = await gameUIDModel.getGameUID(userId, game);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.game).toBe(game);
      expect(result.gameUid).toBe(gameUid);
      expect(result.region).toBe(region);
    });

    it('should update existing game UID', async () => {
      const userId = '123456789';
      const game = 'hsr';
      const gameUid = '900000001';
      const region = 'HK';
      const gameUid2 = '800000002';
      const region2 = 'AS';

      await gameUIDModel.setGameUID(userId, game, gameUid, region);
      await gameUIDModel.setGameUID(userId, game, gameUid2, region2);

      const result = await gameUIDModel.getGameUID(userId, game);

      expect(result).toBeDefined();
      expect(result.gameUid).toBe(gameUid2);
      expect(result.region).toBe(region2);
    });

    it('should return null for non-existent game UID', async () => {
      const userId = '123456789';
      const game1 = 'hsr';
      const gameUID = '900000001';
      const game2 = 'genshin';
      const region = 'HK';

      const result = await gameUIDModel.getGameUID(userId, game1);
      expect(result).toBeNull();

      await gameUIDModel.setGameUID(userId, game1, gameUID, region);
      const result2 = await gameUIDModel.getGameUID(userId, game2);
      expect(result2).toBeNull();
    });
  });

  describe('getAllGameUIDs', () => {
    it('should return all game UIDs for a user', async () => {
      const userId = '123456789';
      const game1 = 'hsr';
      const gameUID1 = '900000001';
      const region1 = 'HK';
      const game2 = 'genshin';
      const gameUID2 = '900000002';
      const region2 = 'HK';

      await gameUIDModel.setGameUID(userId, game1, gameUID1, region1);
      await gameUIDModel.setGameUID(userId, game2, gameUID2, region2);

      const results = await gameUIDModel.getAllGameUIDs(userId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.game)).toContain(game1);
      expect(results.map((r) => r.game)).toContain(game2);
      expect(results.map((r) => r.gameUid)).toContain(gameUID1);
      expect(results.map((r) => r.gameUid)).toContain(gameUID2);
    });

    it('should return empty array for user with no game UIDs', async () => {
      const userId = '123456789';
      const results = await gameUIDModel.getAllGameUIDs(userId);
      expect(results).toHaveLength(0);
    });
  });

  describe('deleteGameUID', () => {
    it('should successfully delete a game UID', async () => {
      const userId = '123456789';
      const game = 'hsr';
      const gameUid = '900000001';
      const region = 'HK';

      await gameUIDModel.setGameUID(userId, game, gameUid, region);
      await gameUIDModel.deleteGameUID(userId, game);

      const result = await gameUIDModel.getGameUID(userId, game);
      expect(result).toBeNull();
    });

    it('should not affect other game UIDs when deleting one', async () => {
      const userId = '123456789';
      const game1 = 'hsr';
      const gameUid1 = '900000001';
      const region1 = 'HK';
      const game2 = 'genshin';
      const gameUid2 = '900000002';
      const region2 = 'HK';

      await gameUIDModel.setGameUID(userId, game1, gameUid1, region1);
      await gameUIDModel.setGameUID(userId, game2, gameUid2, region2);
      await gameUIDModel.deleteGameUID(userId, game1);

      const results = await gameUIDModel.getAllGameUIDs(userId);
      expect(results).toHaveLength(1);
      expect(results[0].game).toBe(game2);
    });

    it('should do nothing if game UID does not exist', async () => {
      const userId = '123456789';
      const game = 'hsr';
      const gameUid = '900000001';
      const region = 'HK';
      const game2 = 'genshin';

      await gameUIDModel.setGameUID(userId, game, gameUid, region);
      await gameUIDModel.deleteGameUID(userId, game2);

      const results = await gameUIDModel.getAllGameUIDs(userId);
      expect(results).toHaveLength(1);
      expect(results[0].game).toBe(game);
    });
  });
});
