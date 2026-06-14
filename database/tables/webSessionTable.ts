import type { TableDefinition } from '../types';

export interface WebSessionRow {
  id: string;
  discord_id: string;
  csrf_token: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
}

const webSessionTable: TableDefinition = {
  name: 'WebSession',
  columns: [
    { name: 'id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'csrf_token', type: 'VARCHAR NOT NULL' },
    { name: 'created_at', type: 'INTEGER NOT NULL' },
    { name: 'expires_at', type: 'INTEGER NOT NULL' },
    { name: 'last_seen_at', type: 'INTEGER NOT NULL' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [],
};

export default webSessionTable;
