const { log } = require('../../utils/log');
const serverRolesQueries = require('../queries/serverRolesQueries');

class ServerRolesModel {
  constructor(database) {
    this.db = database;
  }

  async setServerRole(serverId, roleName, roleId) {
    const query = serverRolesQueries.SET_SERVER_ROLE;
    await this.db.executeQuery(query, [serverId, roleName, roleId]);
    log(`Server role set for server ${serverId}: ${roleName}.`);
  }

  async getServerRole(serverId, roleName) {
    const query = serverRolesQueries.GET_SERVER_ROLE;
    const row = await this.db.executeSelectQuery(query, [serverId, roleName]);
    return row ? row.roleId : null;
  }

  async getAllServerRoles(serverId) {
    const query = serverRolesQueries.GET_ALL_SERVER_ROLES;
    return this.db.executeSelectAllQuery(query, [serverId]);
  }

  async removeServerRole(serverId, roleName) {
    const query = serverRolesQueries.REMOVE_SERVER_ROLE;
    await this.db.executeQuery(query, [serverId, roleName]);
    log(`Server role removed for server ${serverId}: ${roleName}.`);
  }
}

module.exports = ServerRolesModel;
