import type { TableDefinition } from '../types';

/**
 * A character spawned into a specific channel. UNIQUE(channel_id, char_id) makes
 * "no duplicates in a channel" a DB invariant; re-spawning reactivates and
 * reconfigures the existing row (so history survives a remove). `active = 0` is a
 * soft-remove — the row and its compaction state stay so re-spawn can resume.
 *
 * Compaction state lives here: `compacted_memory` is the model-authored summary of
 * everything up to `compacted_upto_id` (an RpHistory.id); replay = starting message
 * + compacted_memory + history rows newer than that id. `compaction_failed` halts
 * the character until it is mentioned again (then we retry / fall back to truncation).
 */
export interface RpSpawnRow {
  spawn_id: number;
  channel_id: string;
  guild_id: string;
  char_id: string;
  spawner_id: string;
  interactability: 'self' | 'all';
  compaction_enabled: number;
  compacted_memory: string | null;
  compacted_upto_id: number | null;
  compaction_failed: number;
  active: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

const rpSpawnTable: TableDefinition = {
  name: 'RpSpawn',
  columns: [
    { name: 'spawn_id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'channel_id', type: 'VARCHAR NOT NULL' },
    { name: 'guild_id', type: 'VARCHAR NOT NULL' },
    { name: 'char_id', type: 'TEXT NOT NULL' },
    { name: 'spawner_id', type: 'VARCHAR NOT NULL' },
    { name: 'interactability', type: "TEXT NOT NULL DEFAULT 'self'" },
    { name: 'compaction_enabled', type: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'compacted_memory', type: 'TEXT DEFAULT NULL' },
    { name: 'compacted_upto_id', type: 'INTEGER DEFAULT NULL' },
    { name: 'compaction_failed', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'active', type: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'last_activity_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['spawn_id'],
  specialConstraints: [
    'UNIQUE (channel_id, char_id)',
  ],
  constraints: [
    'FOREIGN KEY (char_id) REFERENCES RpCharacter(char_id)',
  ],
};

export default rpSpawnTable;
