import type { TableDefinition } from '../types';

/**
 * One turn in a spawned character's private conversation. Keyed by spawn_id (stable
 * across remove/re-spawn since spawns are soft-deleted). User turns carry speaker
 * attribution so the model can address people by name in a multi-user channel;
 * model turns leave them null. `from_bot` marks turns authored by a bot/webhook/app
 * (including other RP characters) — they're kept as *context* but never count as an
 * "unanswered" turn, so a character can hear other bots without being triggered into
 * an infinite reply loop. Raw rows are never erased on compaction — they're just
 * skipped during replay once folded into RpSpawn.compacted_memory.
 */
export interface RpHistoryRow {
  id: number;
  spawn_id: number;
  role: 'user' | 'model';
  speaker_id: string | null;
  speaker_name: string | null;
  message: string;
  from_bot: number;
  timestamp: string;
}

const rpHistoryTable: TableDefinition = {
  name: 'RpHistory',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'spawn_id', type: 'INTEGER NOT NULL' },
    { name: 'role', type: "TEXT CHECK(role IN ('user', 'model')) NOT NULL" },
    { name: 'speaker_id', type: 'VARCHAR DEFAULT NULL' },
    { name: 'speaker_name', type: 'VARCHAR DEFAULT NULL' },
    { name: 'message', type: 'TEXT NOT NULL' },
    { name: 'from_bot', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (spawn_id) REFERENCES RpSpawn(spawn_id)',
  ],
};

export default rpHistoryTable;
