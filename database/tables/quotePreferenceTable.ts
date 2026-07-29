import type { TableDefinition } from '../types';

/**
 * A user's saved quote defaults, applied to every quote *they* generate
 * (slash or mention) unless the invocation opts out with the override flag.
 * One row per user, global across servers. Every field is nullable: NULL means
 * "not set", so the bot's own default applies.
 */
export interface QuotePreferenceRow {
  user_id: string;
  background: string | null;
  text_color: string | null;
  profile_color: string | null;
  avatar_source: string | null;
  font_style: string | null;
  format: string | null;
  updated_at: string;
}

const quotePreferenceTable: TableDefinition = {
  name: 'QuotePreference',
  columns: [
    { name: 'user_id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'background', type: 'TEXT' },
    { name: 'text_color', type: 'TEXT' },
    { name: 'profile_color', type: 'TEXT' },
    { name: 'avatar_source', type: 'TEXT' },
    { name: 'font_style', type: 'TEXT' },
    { name: 'format', type: 'TEXT' },
    { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['user_id'],
  specialConstraints: [],
  constraints: [],
};

export default quotePreferenceTable;
