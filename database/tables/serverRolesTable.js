const serverRolesTable = {
  name: 'ServerRoles',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'server_id', type: 'VARCHAR' },
    { name: 'role_name', type: 'VARCHAR NOT NULL' },
    { name: 'role_id', type: 'VARCHAR NOT NULL' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'UNIQUE (server_id, role_name)',
  ],
};

module.exports = serverRolesTable;
