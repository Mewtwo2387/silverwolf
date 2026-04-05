import type { TableDefinition } from '../types';

export interface PoopProfileRow {
  user_id: string;
  timezone: number;
}

const poopProfileTable: TableDefinition = {
  name: 'PoopProfile',
  columns: [
    { name: 'user_id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'timezone', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['user_id'],
  specialConstraints: [],
  constraints: ['FOREIGN KEY (user_id) REFERENCES User(id)'],
};

export default poopProfileTable;
