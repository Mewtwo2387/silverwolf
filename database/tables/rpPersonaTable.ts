import type { TableDefinition } from '../types';

/**
 * A user's roleplay persona — a self-description injected into the system prompt
 * (inside a <userPersona> tag) whenever that user talks to a self-mode spawn.
 * One per user, global across servers; re-adding overwrites (update-in-place).
 */
export interface RpPersonaRow {
  user_id: string;
  details: string;
  created_at: string;
  updated_at: string;
}

const rpPersonaTable: TableDefinition = {
  name: 'RpPersona',
  columns: [
    { name: 'user_id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'details', type: 'TEXT NOT NULL' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['user_id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (user_id) REFERENCES User(id)',
  ],
};

export default rpPersonaTable;
