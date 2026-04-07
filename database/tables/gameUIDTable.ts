import type { TableDefinition } from '../types';

export interface GameUIDRow {
  id: number;
  user_id: string;
  game: string;
  game_uid: string;
  region: string | null;
  date: string;
}

const gameUIDTable: TableDefinition = {
  name: 'GameUID',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR NOT NULL' },
    { name: 'game', type: 'TEXT NOT NULL' },
    { name: 'game_uid', type: 'TEXT NOT NULL' },
    { name: 'region', type: 'TEXT DEFAULT NULL' },
    { name: 'date', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'UNIQUE (user_id, game)',
    'FOREIGN KEY (user_id) REFERENCES User(id)',
  ],
};

export default gameUIDTable;
