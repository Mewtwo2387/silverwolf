import type { TableDefinition } from '../types';

export interface CyclicTttMatchRow {
  id: string;
  x_discord_id: string;
  o_discord_id: string;
  winner_discord_id: string | null;
  end_reason: string;
  board_size: number;
  created_at: number;
  ended_at: number;
}

const cyclicTttMatchTable: TableDefinition = {
  name: 'CyclicTttMatch',
  columns: [
    { name: 'id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'x_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'o_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'winner_discord_id', type: 'VARCHAR' },
    { name: 'end_reason', type: 'VARCHAR NOT NULL' },
    { name: 'board_size', type: 'INTEGER NOT NULL' },
    { name: 'created_at', type: 'INTEGER NOT NULL' },
    { name: 'ended_at', type: 'INTEGER NOT NULL' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [],
};

export default cyclicTttMatchTable;
