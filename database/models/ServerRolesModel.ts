import { log } from '../../utils/log';
import serverRolesQueries from '../queries/serverRolesQueries';
import type Database from '../Database';

class ServerRolesModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async setServerRole(serverId: string, roleName: string, roleId: string): Promise<void> {
    const query = serverRolesQueries.SET_SERVER_ROLE;
    await this.db.executeQuery(query, [serverId, roleName, roleId]);
    log(`Server role set for server ${serverId}: ${roleName}.`);
  }

  async getServerRole(serverId: string, roleName: string): Promise<string | null> {
    const query = serverRolesQueries.GET_SERVER_ROLE;
    const row = await this.db.executeSelectQuery(query, [serverId, roleName]);
    return row ? row.roleId : null;
  }

  async getAllServerRoles(serverId: string): Promise<Record<string, any>[]> {
    const query = serverRolesQueries.GET_ALL_SERVER_ROLES;
    return this.db.executeSelectAllQuery(query, [serverId]);
  }

  async removeServerRole(serverId: string, roleName: string): Promise<void> {
    const query = serverRolesQueries.REMOVE_SERVER_ROLE;
    await this.db.executeQuery(query, [serverId, roleName]);
    log(`Server role removed for server ${serverId}: ${roleName}.`);
  }
}

export default ServerRolesModel;
