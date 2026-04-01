import type { TableDefinition } from '../types';

export interface PoopEntryRow {
  id: number;
  user_id: string;
  logged_at: number;
  colour: string | null;
  size: string | null;
  type: string | null;
  duration: number | null;
}

const poopEntryTable: TableDefinition = {
  name: 'PoopEntry',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR NOT NULL' },
    { name: 'logged_at', type: 'INTEGER NOT NULL' },
    { name: 'colour', type: 'TEXT' },
    { name: 'size', type: 'TEXT' },
    { name: 'type', type: 'TEXT' },
    { name: 'duration', type: 'INTEGER' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: ['FOREIGN KEY (user_id) REFERENCES User(id)'],
};

export default poopEntryTable;
