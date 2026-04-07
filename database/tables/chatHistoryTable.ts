import type { TableDefinition } from '../types';

export interface ChatHistoryRow {
  id: number;
  session_id: number;
  role: 'user' | 'model';
  message: string;
  timestamp: string;
}

const chatHistoryTable: TableDefinition = {
  name: 'ChatHistory',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'session_id', type: 'INTEGER NOT NULL' },
    { name: 'role', type: "TEXT CHECK(role IN ('user', 'model')) NOT NULL" },
    { name: 'message', type: 'TEXT NOT NULL' },
    { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (session_id) REFERENCES ChatSession(session_id)',
  ],
};

export default chatHistoryTable;
