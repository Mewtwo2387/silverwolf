import type { TableDefinition } from '../types';

/**
 * A roleplay character *definition* (global, owned by its creator). Spawned into
 * channels via RpSpawn. `char_id` is a 6-char lowercase alphanumeric handle that
 * disambiguates same-named characters (see utils/rpIdentity.ts). The pfp is
 * re-hosted in a server asset channel; we keep the message id so a fresh signed
 * CDN url can be re-derived when the cached one expires.
 */
export interface RpCharacterRow {
  char_id: string;
  creator_id: string;
  name: string;
  name_lower: string;
  details: string;
  starting_message: string;
  pfp_url: string | null;
  pfp_message_id: string | null;
  pfp_channel_id: string | null;
  created_at: string;
  updated_at: string;
}

const rpCharacterTable: TableDefinition = {
  name: 'RpCharacter',
  columns: [
    { name: 'char_id', type: 'TEXT PRIMARY KEY' },
    { name: 'creator_id', type: 'VARCHAR NOT NULL' },
    { name: 'name', type: 'VARCHAR NOT NULL' },
    { name: 'name_lower', type: 'VARCHAR NOT NULL' },
    { name: 'details', type: 'TEXT NOT NULL' },
    { name: 'starting_message', type: 'TEXT NOT NULL DEFAULT \'\'' },
    { name: 'pfp_url', type: 'TEXT DEFAULT NULL' },
    { name: 'pfp_message_id', type: 'TEXT DEFAULT NULL' },
    { name: 'pfp_channel_id', type: 'TEXT DEFAULT NULL' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['char_id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (creator_id) REFERENCES User(id)',
  ],
};

export default rpCharacterTable;
