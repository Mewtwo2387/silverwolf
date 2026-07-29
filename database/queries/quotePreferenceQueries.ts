// Column names are never taken from user input: SET clauses are assembled from
// QUOTE_PREFERENCE_COLUMNS below, and every value is bound with a `?`.
const quotePreferenceQueries = {
  GET_PREFERENCES: 'SELECT * FROM QuotePreference WHERE user_id = ?',
  DELETE_PREFERENCES: 'DELETE FROM QuotePreference WHERE user_id = ?',
  ENSURE_ROW: 'INSERT OR IGNORE INTO QuotePreference (user_id) VALUES (?)',
  /** Builds `UPDATE QuotePreference SET <col> = ?, ... WHERE user_id = ?`. */
  updatePreferences: (columns: string[]): string => `
    UPDATE QuotePreference
    SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `,
};

export default quotePreferenceQueries;
