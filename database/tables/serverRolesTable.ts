import type { TableDefinition } from '../types';

export interface ServerRolesRow {
  id: number;
  server_id: string;
  role_name: string;
  role_id: string;
}

const serverRolesTable: TableDefinition = {
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

export default serverRolesTable;
