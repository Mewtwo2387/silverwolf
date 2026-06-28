import type { TableDefinition } from '../types';

export interface TcgMatchRow {
  id: string;
  mode: string;
  p1_discord_id: string;
  p1_username: string;
  p1_team: string; // JSON array of character slugs
  p2_discord_id: string;
  p2_username: string;
  p2_team: string; // JSON array of character slugs
  winner: string | null; // 'p1' | 'p2' | 'draw'
  end_reason: string;
  rounds: number;
  created_at: number;
  ended_at: number;
  /** JSON: { snapshot: BattleSnapshot, chat: TcgChatMessage[], log: BattleLogEntry[] }. */
  final_state: string | null;
}

const tcgMatchTable: TableDefinition = {
  name: 'TcgMatch',
  columns: [
    { name: 'id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'mode', type: 'VARCHAR NOT NULL' },
    { name: 'p1_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'p1_username', type: 'VARCHAR NOT NULL' },
    { name: 'p1_team', type: 'TEXT NOT NULL' },
    { name: 'p2_discord_id', type: 'VARCHAR NOT NULL' },
    { name: 'p2_username', type: 'VARCHAR NOT NULL' },
    { name: 'p2_team', type: 'TEXT NOT NULL' },
    { name: 'winner', type: 'VARCHAR' },
    { name: 'end_reason', type: 'VARCHAR NOT NULL' },
    { name: 'rounds', type: 'INTEGER NOT NULL' },
    { name: 'created_at', type: 'INTEGER NOT NULL' },
    { name: 'ended_at', type: 'INTEGER NOT NULL' },
    { name: 'final_state', type: 'TEXT' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [],
};

export default tcgMatchTable;
