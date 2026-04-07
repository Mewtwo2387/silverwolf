import type { TableDefinition } from '../types';

export interface ChatSessionRow {
  session_id: number;
  started_by: string;
  server_id: string;
  active: number;
}

const chatSessionTable: TableDefinition = {
  name: 'ChatSession',
  columns: [
    { name: 'session_id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'started_by', type: 'VARCHAR NOT NULL' },
    { name: 'server_id', type: 'VARCHAR NOT NULL' },
    { name: 'active', type: 'INTEGER DEFAULT 1' },
  ],
  primaryKey: ['session_id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (started_by) REFERENCES User(id)',
  ],
};

export default chatSessionTable;
