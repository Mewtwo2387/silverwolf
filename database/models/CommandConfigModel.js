const { log } = require('../../utils/log');
const commandConfigQueries = require('../queries/commandConfigQueries');

class CommandConfigModel {
  constructor(database) {
    this.db = database;
  }

  async addOrUpdateCommandBlacklist(commandName, serverId, reason) {
    const query = commandConfigQueries.ADD_OR_UPDATE_COMMAND_BLACKLIST;
    await this.db.executeQuery(query, [commandName, serverId, reason]);
    log(`Added or updated blacklist for command: ${commandName} in server: ${serverId}`);
  }

  async getBlacklistedCommands(serverId) {
    const query = commandConfigQueries.GET_BLACKLISTED_COMMANDS;
    return this.db.executeSelectAllQuery(query, [serverId]);
  }

  async deleteCommandBlacklist(commandName, serverId) {
    const query = commandConfigQueries.DELETE_COMMAND_BLACKLIST;
    const result = await this.db.executeQuery(query, [commandName, serverId]);
    if (result.changes > 0) {
      log(`Deleted blacklist entry for command: ${commandName} in server: ${serverId}`);
      return `Successfully deleted the blacklist entry for command: ${commandName}`;
    }
    log(`No blacklist entry found for command: ${commandName} in server: ${serverId}`);
    return `No blacklist entry found for command: ${commandName}`;
  }

  async isCommandBlacklisted(commandName, serverId) {
    const blacklist = await this.getBlacklistedCommands(serverId);
    return blacklist.some((command) => command.commandName === commandName);
  }
}

module.exports = CommandConfigModel;
