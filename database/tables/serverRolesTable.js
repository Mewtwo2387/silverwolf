const serverRolesTable = {
  name: 'ServerRoles',
  columns: [
    { name: 'server_id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'role_name', type: 'VARCHAR NOT NULL' },
    { name: 'role_id', type: 'VARCHAR NOT NULL' },
  ],
  primaryKey: ['server_id'],
  specialConstraints: [],
  constraints: [],
};

module.exports = serverRolesTable;
