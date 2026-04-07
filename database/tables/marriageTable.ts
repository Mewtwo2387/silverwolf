import type { TableDefinition } from '../types';

export interface MarriageRow {
  user1_id: string;
  user2_id: string;
  married_on: string;
}

const marriageTable: TableDefinition = {
  name: 'Marriage',
  columns: [
    { name: 'user1_id', type: 'VARCHAR NOT NULL' },
    { name: 'user2_id', type: 'VARCHAR NOT NULL' },
    { name: 'married_on', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['user1_id', 'user2_id'],
  specialConstraints: [
    'PRIMARY KEY (user1_id, user2_id)',
  ],
  constraints: [
    'FOREIGN KEY (user1_id) REFERENCES User(id)',
    'FOREIGN KEY (user2_id) REFERENCES User(id)',
  ],
};

export default marriageTable;
