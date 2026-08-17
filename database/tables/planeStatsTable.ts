import type { TableDefinition } from '../types';

// One row per player: the Plane Sim achievement stat blob (a JSON document of
// counters + objective flags — see database/models/PlaneStatsModel.ts and
// site_src/Assets/plane-achievements.js). Keyed by Discord user id, so a
// web-logged-in player and their bot account share the row.
export interface PlaneStatsRow {
  user_id: string;
  stats: string; // JSON
  updated_at: string;
}

const planeStatsTable: TableDefinition = {
  name: 'PlaneStats',
  columns: [
    // Inline PRIMARY KEY: the `primaryKey` array below only drives the
    // add-missing-column migration; the actual key must live in the column type
    // (and the UPSERT's ON CONFLICT needs it). See Database.createTable.
    { name: 'user_id', type: 'VARCHAR NOT NULL PRIMARY KEY' },
    { name: 'stats', type: 'TEXT NOT NULL DEFAULT \'{}\'' },
    { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['user_id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (user_id) REFERENCES User(id)',
  ],
};

export default planeStatsTable;
