import type { TableDefinition } from '../types';

export interface BattleshipsMatchRow {
  id: string;
  x_discord_id: string;
  o_discord_id: string;
  winner_discord_id: string | null;
  end_reason: string;
  created_at: number;
  ended_at: number;
}

const battleshipsMatchTable: TableDefinition = {
  name: 'BattleshipsMatch',
  columns: [
    { name: 'id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'x_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'o_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'winner_discord_id', type: 'VARCHAR' },
    { name: 'end_reason', type: 'VARCHAR NOT NULL' },
    { name: 'created_at', type: 'INTEGER NOT NULL' },
    { name: 'ended_at', type: 'INTEGER NOT NULL' },
  ],
  primaryKey: ['id'],
  // Enforce the match invariants at the DB level too, not just in app code.
  specialConstraints: [
    "CHECK (end_reason IN ('win', 'disconnect', 'forfeit'))",
    'CHECK (winner_discord_id IS NULL OR winner_discord_id IN (x_discord_id, o_discord_id))',
  ],
  constraints: [],
};

export default battleshipsMatchTable;
