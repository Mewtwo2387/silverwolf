const serverRolesQueries = {
  SET_SERVER_ROLE: 'INSERT OR REPLACE INTO ServerRoles (server_id, role_name, role_id) VALUES (?, ?, ?)',
  GET_SERVER_ROLE: 'SELECT role_id FROM ServerRoles WHERE server_id = ? AND role_name = ?',
  GET_ALL_SERVER_ROLES: 'SELECT role_name, role_id FROM ServerRoles WHERE server_id = ?',
  REMOVE_SERVER_ROLE: 'DELETE FROM ServerRoles WHERE server_id = ? AND role_name = ?'
};

module.exports = serverRolesQueries;
