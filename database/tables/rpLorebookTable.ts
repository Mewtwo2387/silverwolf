import type { TableDefinition } from '../types';

/**
 * A lorebook attached to a roleplay character (max 5 per character, editable only
 * by the character's creator). Two types:
 * - `keywords`: `content` is a JSON array of `{ triggers, context }` entries; when a
 *   trigger word appears in the un-replied human turns the entry's context is
 *   injected into the system prompt for that generation only.
 * - `skill`: `content` is a markdown reference note; the model recalls it on demand
 *   via a `<recall:name>` marker (see utils/rpLorebook.ts). `description` tells the
 *   model when to use it.
 */
export interface RpLorebookRow {
  lorebook_id: number;
  char_id: string;
  name: string;
  name_lower: string;
  type: 'keywords' | 'skill';
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const rpLorebookTable: TableDefinition = {
  name: 'RpLorebook',
  columns: [
    { name: 'lorebook_id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'char_id', type: 'TEXT NOT NULL' },
    { name: 'name', type: 'VARCHAR NOT NULL' },
    { name: 'name_lower', type: 'VARCHAR NOT NULL' },
    { name: 'type', type: "TEXT NOT NULL CHECK(type IN ('keywords', 'skill'))" },
    { name: 'description', type: "TEXT NOT NULL DEFAULT ''" },
    { name: 'content', type: 'TEXT NOT NULL' },
    { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['lorebook_id'],
  specialConstraints: [
    'UNIQUE (char_id, name_lower)',
  ],
  constraints: [
    'FOREIGN KEY (char_id) REFERENCES RpCharacter(char_id)',
  ],
};

export default rpLorebookTable;
