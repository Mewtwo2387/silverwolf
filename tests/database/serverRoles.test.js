const Database = require('../../database/Database');

describe('ServerRolesModel', () => {
  let db;
  let serverRolesModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testServerRoles-${timestamp}.db`);
    await db.ready;
    serverRolesModel = db.serverRoles;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the ServerRoles table before each test
    await db.executeQuery('DELETE FROM ServerRoles');
  });

  describe('setServerRole and getServerRole', () => {
    it('should set and retrieve a server role', async () => {
      const serverId = '123456789';
      const roleName = 'egirl';
      const roleId = '987654321';

      await serverRolesModel.setServerRole(serverId, roleName, roleId);
      const result = await serverRolesModel.getServerRole(serverId, roleName);

      expect(result).toBe(roleId);
    });

    it('should update existing server role', async () => {
      const serverId = '123456789';
      const roleName = 'egirl';
      const initialRoleId = '987654321';
      const updatedRoleId = '111222333';

      await serverRolesModel.setServerRole(serverId, roleName, initialRoleId);
      await serverRolesModel.setServerRole(serverId, roleName, updatedRoleId);
      const result = await serverRolesModel.getServerRole(serverId, roleName);

      expect(result).toBe(updatedRoleId);
    });

    it('should return null for non-existent role', async () => {
      const serverId = '123456789';
      const roleName = 'nonexistent';
      const roleName2 = 'egirl';
      const roleId = '987654321';
      await serverRolesModel.setServerRole(serverId, roleName2, roleId);
      const result = await serverRolesModel.getServerRole(serverId, roleName);
      expect(result).toBeNull();
    });
  });

  describe('getAllServerRoles', () => {
    it('should return all roles for a server', async () => {
      const serverId = '123456789';
      await serverRolesModel.setServerRole(serverId, 'egirl', '111111111');
      await serverRolesModel.setServerRole(serverId, 'femboy', '222222222');

      const results = await serverRolesModel.getAllServerRoles(serverId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.roleName)).toContain('egirl');
      expect(results.map((r) => r.roleName)).toContain('femboy');
    });

    it('should return empty array for server with no roles', async () => {
      const serverId = '123456789';
      const results = await serverRolesModel.getAllServerRoles(serverId);
      expect(results).toHaveLength(0);
    });
  });

  describe('removeServerRole', () => {
    it('should successfully remove a server role', async () => {
      const serverId = '123456789';
      const roleName = 'egirl';
      const roleId = '987654321';

      await serverRolesModel.setServerRole(serverId, roleName, roleId);
      await serverRolesModel.removeServerRole(serverId, roleName);

      const result = await serverRolesModel.getServerRole(serverId, roleName);
      expect(result).toBeNull();
    });

    it('should not affect other roles when removing one', async () => {
      const serverId = '123456789';
      await serverRolesModel.setServerRole(serverId, 'egirl', '111111111');
      await serverRolesModel.setServerRole(serverId, 'femboy', '222222222');

      await serverRolesModel.removeServerRole(serverId, 'egirl');

      const results = await serverRolesModel.getAllServerRoles(serverId);
      expect(results).toHaveLength(1);
      expect(results[0].roleName).toBe('femboy');
    });
  });
});
