import Database from '../../database/Database';
import { Database as BunDatabase } from 'bun:sqlite';
import type ServerConfigModel from '../../database/models/ServerConfigModel';

describe('ServerConfigModel', () => {
  let db: Database;
  let serverConfigModel: ServerConfigModel;

  beforeAll(async () => {
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testServerConfig-${timestamp}.db`);
    await db.ready;
    serverConfigModel = db.serverConfig;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM ServerConfig');
  });

  describe('setServerConfig and getServerConfig', () => {
    it('should set and retrieve a config value', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerConfig(serverId, 'theme', 'dark');
      const result = await serverConfigModel.getServerConfig(serverId, 'theme');
      expect(result).toBe('dark');
    });

    it('should update an existing config value', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerConfig(serverId, 'theme', 'dark');
      await serverConfigModel.setServerConfig(serverId, 'theme', 'light');
      const result = await serverConfigModel.getServerConfig(serverId, 'theme');
      expect(result).toBe('light');
    });

    it('should return null for a missing key', async () => {
      const result = await serverConfigModel.getServerConfig('123456789', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('setServerRole and getServerRole', () => {
    it('should set and retrieve a server role', async () => {
      const serverId = '123456789';
      const roleName = 'egirl';
      const roleId = '987654321';

      await serverConfigModel.setServerRole(serverId, roleName, roleId);
      const result = await serverConfigModel.getServerRole(serverId, roleName);

      expect(result).toBe(roleId);
    });

    it('should store roles under role: keys', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerRole(serverId, 'girl', '111111111');
      const result = await serverConfigModel.getServerConfig(serverId, 'role:girl');
      expect(result).toBe('111111111');
    });
  });

  describe('getAllServerConfig and getAllServerRoles', () => {
    it('should return all config rows for a server', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerConfig(serverId, 'theme', 'dark');
      await serverConfigModel.setServerRole(serverId, 'egirl', '111111111');

      const results = await serverConfigModel.getAllServerConfig(serverId);
      expect(results).toHaveLength(2);
    });

    it('should return only role entries from getAllServerRoles', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerConfig(serverId, 'theme', 'dark');
      await serverConfigModel.setServerRole(serverId, 'egirl', '111111111');
      await serverConfigModel.setServerRole(serverId, 'femboy', '222222222');

      const results = await serverConfigModel.getAllServerRoles(serverId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.roleName)).toContain('egirl');
      expect(results.map((r) => r.roleName)).toContain('femboy');
    });
  });

  describe('removeServerRole and deleteServerConfig', () => {
    it('should remove a server role', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerRole(serverId, 'egirl', '987654321');
      await serverConfigModel.removeServerRole(serverId, 'egirl');

      const result = await serverConfigModel.getServerRole(serverId, 'egirl');
      expect(result).toBeNull();
    });

    it('should delete an arbitrary config key', async () => {
      const serverId = '123456789';
      await serverConfigModel.setServerConfig(serverId, 'theme', 'dark');
      await serverConfigModel.deleteServerConfig(serverId, 'theme');

      const result = await serverConfigModel.getServerConfig(serverId, 'theme');
      expect(result).toBeNull();
    });
  });

  describe('appendUniqueToList and removeFromList', () => {
    it('should append and remove list values per server', async () => {
      const serverId = '123456789';
      const added = await serverConfigModel.appendUniqueToList(serverId, 'channels', '111');
      expect(added).toBe(true);

      const duplicate = await serverConfigModel.appendUniqueToList(serverId, 'channels', '111');
      expect(duplicate).toBe(false);

      await serverConfigModel.appendUniqueToList(serverId, 'channels', '222');
      expect(await serverConfigModel.getServerConfig(serverId, 'channels')).toBe('111,222');

      await serverConfigModel.removeFromList(serverId, 'channels', '111');
      expect(await serverConfigModel.getServerConfig(serverId, 'channels')).toBe('222');
    });
  });

  describe('ServerRoles migration', () => {
    it('migrates legacy ServerRoles rows into ServerConfig on init', async () => {
      const dbPath = `./tests/temp/testServerConfigMigration-${Date.now()}.db`;
      const legacyDb = new BunDatabase(dbPath, { create: true });
      legacyDb.run(`
        CREATE TABLE ServerRoles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id VARCHAR,
          role_name VARCHAR NOT NULL,
          role_id VARCHAR NOT NULL,
          UNIQUE (server_id, role_name)
        )
      `);
      legacyDb.run(
        'INSERT INTO ServerRoles (server_id, role_name, role_id) VALUES (?, ?, ?)',
        ['111111111', 'girl', '999999999'],
      );
      legacyDb.close();

      const migratedDb = new Database(dbPath);
      await migratedDb.ready;

      expect(await migratedDb.serverConfig.getServerRole('111111111', 'girl')).toBe('999999999');
      const legacyTable = migratedDb.db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='ServerRoles'")
        .get();
      expect(legacyTable).toBeNull();

      migratedDb.db.close();
    });

    it('drops an empty legacy ServerRoles table after migration', async () => {
      const dbPath = `./tests/temp/testServerConfigMigrationEmpty-${Date.now()}.db`;
      const legacyDb = new BunDatabase(dbPath, { create: true });
      legacyDb.run(`
        CREATE TABLE ServerRoles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id VARCHAR,
          role_name VARCHAR NOT NULL,
          role_id VARCHAR NOT NULL,
          UNIQUE (server_id, role_name)
        )
      `);
      legacyDb.close();

      const migratedDb = new Database(dbPath);
      await migratedDb.ready;

      const legacyTable = migratedDb.db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='ServerRoles'")
        .get();
      expect(legacyTable).toBeNull();

      migratedDb.db.close();
    });
  });
});
