const Database = require('../../database/Database');

describe('CommandConfigModel', () => {
  let db;
  let commandConfigModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testCommandConfig-${timestamp}.db`);
    await db.ready;
    commandConfigModel = db.commandConfig;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the CommandBlacklist table before each test
    await db.executeQuery('DELETE FROM CommandConfig');
  });

  describe('addOrUpdateCommandBlacklist', () => {
    it('should add a new command to blacklist', async () => {
      const commandName = 'testCommand';
      const serverId = '123456789';
      const reason = 'Test reason';
      await commandConfigModel.addOrUpdateCommandBlacklist(commandName, serverId, reason);
      const blacklistedCommands = await commandConfigModel.getBlacklistedCommands(serverId);
      expect(blacklistedCommands).toHaveLength(1);
      expect(blacklistedCommands[0].commandName).toBe(commandName);
      expect(blacklistedCommands[0].serverId).toBe(serverId);
      expect(blacklistedCommands[0].reason).toBe(reason);
    });

    it('should update existing blacklisted command', async () => {
      const commandName = 'testCommand';
      const serverId = '123456789';
      const initialReason = 'Initial reason';
      const updatedReason = 'Updated reason';

      await commandConfigModel.addOrUpdateCommandBlacklist(commandName, serverId, initialReason);
      await commandConfigModel.addOrUpdateCommandBlacklist(commandName, serverId, updatedReason);

      const blacklistedCommands = await commandConfigModel.getBlacklistedCommands(serverId);
      expect(blacklistedCommands).toHaveLength(1);
      expect(blacklistedCommands[0].reason).toBe(updatedReason);
    });
  });

  describe('getBlacklistedCommands', () => {
    it('should return all blacklisted commands for a server', async () => {
      const serverId = '123456789';
      await commandConfigModel.addOrUpdateCommandBlacklist('command1', serverId, 'reason1');
      await commandConfigModel.addOrUpdateCommandBlacklist('command2', serverId, 'reason2');

      const blacklistedCommands = await commandConfigModel.getBlacklistedCommands(serverId);
      expect(blacklistedCommands).toHaveLength(2);
      expect(blacklistedCommands.map((cmd) => cmd.commandName)).toContain('command1');
      expect(blacklistedCommands.map((cmd) => cmd.commandName)).toContain('command2');
    });

    it('should return empty array for server with no blacklisted commands', async () => {
      const serverId = '123456789';
      const blacklistedCommands = await commandConfigModel.getBlacklistedCommands(serverId);
      expect(blacklistedCommands).toHaveLength(0);
    });
  });

  describe('deleteCommandBlacklist', () => {
    it('should successfully delete a blacklisted command', async () => {
      const commandName = 'testCommand';
      const serverId = '123456789';
      await commandConfigModel.addOrUpdateCommandBlacklist(commandName, serverId, 'reason');

      const result = await commandConfigModel.deleteCommandBlacklist(commandName, serverId);
      expect(result).toBe(`Successfully deleted the blacklist entry for command: ${commandName}`);

      const blacklistedCommands = await commandConfigModel.getBlacklistedCommands(serverId);
      expect(blacklistedCommands).toHaveLength(0);
    });

    it('should do nothing if command is not blacklisted', async () => {
      const commandName = 'nonexistentCommand';
      const serverId = '123456789';
      const result = await commandConfigModel.deleteCommandBlacklist(commandName, serverId);
      expect(result).toBe(`No blacklist entry found for command: ${commandName}`);
    });
  });

  describe('isCommandBlacklisted', () => {
    it('should return true for blacklisted command', async () => {
      const commandName = 'testCommand';
      const serverId = '123456789';
      await commandConfigModel.addOrUpdateCommandBlacklist(commandName, serverId, 'reason');

      const isBlacklisted = await commandConfigModel.isCommandBlacklisted(commandName, serverId);
      expect(isBlacklisted).toBe(true);
    });

    it('should return false for non-blacklisted command', async () => {
      const commandName = 'testCommand';
      const serverId = '123456789';

      const isBlacklisted = await commandConfigModel.isCommandBlacklisted(commandName, serverId);
      expect(isBlacklisted).toBe(false);
    });
  });
});
