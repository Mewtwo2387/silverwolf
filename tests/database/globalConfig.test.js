const Database = require('../../database/Database');

describe('GlobalConfigModel', () => {
  let db;
  let globalConfigModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testGlobalConfig-${timestamp}.db`);
    await db.ready;
    globalConfigModel = db.globalConfig;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the GlobalConfig table before each test
    await db.executeQuery('DELETE FROM GlobalConfig');
  });

  describe('setGlobalConfig and getGlobalConfig', () => {
    it('should set and retrieve a global config value', async () => {
      const key = 'testKey';
      const value = 'testValue';

      await globalConfigModel.setGlobalConfig(key, value);
      const result = await globalConfigModel.getGlobalConfig(key);

      expect(result).toBeDefined();
      expect(result).toBe(value);
    });

    it('should update existing config value', async () => {
      const key = 'testKey';
      const initialValue = 'initialValue';
      const updatedValue = 'updatedValue';

      await globalConfigModel.setGlobalConfig(key, initialValue);
      await globalConfigModel.setGlobalConfig(key, updatedValue);
      const result = await globalConfigModel.getGlobalConfig(key);

      expect(result).toBe(updatedValue);
    });

    it('should return null for non-existent config key', async () => {
      const key = 'nonexistentKey';
      const result = await globalConfigModel.getGlobalConfig(key);
      expect(result).toBeNull();
    });
  });

  describe('getAllGlobalConfig', () => {
    it('should return all global config entries', async () => {
      await globalConfigModel.setGlobalConfig('key1', 'value1');
      await globalConfigModel.setGlobalConfig('key2', 'value2');

      const results = await globalConfigModel.getAllGlobalConfig();
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.key)).toContain('key1');
      expect(results.map((r) => r.key)).toContain('key2');
    });

    it('should return empty array when no config exists', async () => {
      const results = await globalConfigModel.getAllGlobalConfig();
      expect(results).toHaveLength(0);
    });
  });

  describe('deleteGlobalConfig', () => {
    it('should successfully delete a global config entry', async () => {
      const key = 'testKey';
      const value = 'testValue';

      await globalConfigModel.setGlobalConfig(key, value);
      await globalConfigModel.deleteGlobalConfig(key);

      const result = await globalConfigModel.getGlobalConfig(key);
      expect(result).toBeNull();
    });

    it('should not affect other config entries when deleting one', async () => {
      await globalConfigModel.setGlobalConfig('key1', 'value1');
      await globalConfigModel.setGlobalConfig('key2', 'value2');

      await globalConfigModel.deleteGlobalConfig('key1');

      const results = await globalConfigModel.getAllGlobalConfig();
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('key2');
    });
  });
});
