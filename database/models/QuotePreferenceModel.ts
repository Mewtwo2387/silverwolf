import quotePreferenceQueries from '../queries/quotePreferenceQueries';
import type Database from '../Database';
import type { QuotePreferences, QuotePrefField } from '../../utils/quote';

/**
 * The only column names this model will ever put into SQL. User input is
 * matched against these keys, never interpolated.
 */
const COLUMNS: Record<QuotePrefField, string> = {
  background: 'background',
  textColor: 'text_color',
  profileColor: 'profile_color',
  avatarSource: 'avatar_source',
  fontStyle: 'font_style',
  format: 'format',
};

const FIELDS = Object.keys(COLUMNS) as QuotePrefField[];

class QuotePreferenceModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /** Returns only the fields the user has actually set; `{}` when they have none. */
  async getPreferences(userId: string): Promise<QuotePreferences> {
    const row = await this.db.executeSelectQuery(quotePreferenceQueries.GET_PREFERENCES, [userId]);
    if (!row) return {};
    const prefs: QuotePreferences = {};
    FIELDS.forEach((field) => {
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') prefs[field] = value;
    });
    return prefs;
  }

  /**
   * Upserts the given fields. Unknown keys are ignored; an explicit `null`
   * clears that field. Returns the number of fields written.
   */
  async setPreferences(userId: string, patch: Partial<Record<QuotePrefField, string | null>>): Promise<number> {
    const fields = FIELDS.filter((field) => patch[field] !== undefined);
    if (fields.length === 0) return 0;

    return this.db.executeTransaction(async () => {
      await this.db.executeQuery(quotePreferenceQueries.ENSURE_ROW, [userId]);
      const query = quotePreferenceQueries.updatePreferences(fields.map((field) => COLUMNS[field]));
      await this.db.executeQuery(query, [...fields.map((field) => patch[field] ?? null), userId]);
      return fields.length;
    });
  }

  /** Clears a single saved field, falling back to the bot default. */
  async clearPreference(userId: string, field: QuotePrefField): Promise<void> {
    if (!FIELDS.includes(field)) return;
    await this.setPreferences(userId, { [field]: null });
  }

  /** Drops every saved preference for the user. */
  async clearAllPreferences(userId: string): Promise<void> {
    await this.db.executeQuery(quotePreferenceQueries.DELETE_PREFERENCES, [userId]);
  }
}

export default QuotePreferenceModel;
