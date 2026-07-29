import {
  describe, it, expect, beforeAll, afterAll, beforeEach,
} from 'bun:test';
import Database from '../../database/Database';
import type QuotePreferenceModel from '../../database/models/QuotePreferenceModel';
import { parseQuoteFlags, resolveQuoteFlags, QUOTE_FLAG_DEFAULTS } from '../../utils/quote';

describe('QuotePreferenceModel', () => {
  let db: Database;
  let prefs: QuotePreferenceModel;
  const USER = 'user-1';

  beforeAll(async () => {
    db = new Database(`./tests/temp/testQuotePrefs-${Date.now()}.db`);
    await db.ready;
    prefs = db.quotePreference;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM QuotePreference');
  });

  it('returns an empty object for a user with nothing saved', async () => {
    expect(await prefs.getPreferences(USER)).toEqual({});
  });

  it('saves and reads back a partial patch', async () => {
    await prefs.setPreferences(USER, { background: 'white', textColor: '#ff0124' });
    expect(await prefs.getPreferences(USER)).toEqual({ background: 'white', textColor: '#ff0124' });
  });

  it('merges further patches instead of replacing the row', async () => {
    await prefs.setPreferences(USER, { background: 'white' });
    await prefs.setPreferences(USER, { format: 'vertical' });
    expect(await prefs.getPreferences(USER)).toEqual({ background: 'white', format: 'vertical' });
  });

  it('clears a single field and leaves the rest', async () => {
    await prefs.setPreferences(USER, { background: 'white', format: 'vertical' });
    await prefs.clearPreference(USER, 'background');
    expect(await prefs.getPreferences(USER)).toEqual({ format: 'vertical' });
  });

  it('clears everything', async () => {
    await prefs.setPreferences(USER, { background: 'white', format: 'vertical' });
    await prefs.clearAllPreferences(USER);
    expect(await prefs.getPreferences(USER)).toEqual({});
  });

  it('ignores unknown keys rather than putting them in SQL', async () => {
    const written = await prefs.setPreferences(USER, { nickname: 'nope' } as any);
    expect(written).toBe(0);
    expect(await prefs.getPreferences(USER)).toEqual({});
  });

  it('keeps preferences per user', async () => {
    await prefs.setPreferences(USER, { background: 'white' });
    await prefs.setPreferences('user-2', { background: 'black' });
    expect(await prefs.getPreferences(USER)).toEqual({ background: 'white' });
    expect(await prefs.getPreferences('user-2')).toEqual({ background: 'black' });
  });

  it('feeds the mention-quote resolution chain end to end', async () => {
    await prefs.setPreferences(USER, { background: 'white', textColor: '#ff0124' });
    const saved = await prefs.getPreferences(USER);

    // saved settings apply on a bare mention
    expect(resolveQuoteFlags(parseQuoteFlags(''), saved)).toEqual({
      ...QUOTE_FLAG_DEFAULTS, background: 'white', textColor: '#ff0124',
    });
    // a flag beats the saved value for that field only
    expect(resolveQuoteFlags(parseQuoteFlags('b'), saved).background).toBe('black');
    expect(resolveQuoteFlags(parseQuoteFlags('b'), saved).textColor).toBe('#ff0124');
    // -o drops the whole saved layer
    expect(resolveQuoteFlags(parseQuoteFlags('-o'), saved)).toEqual(QUOTE_FLAG_DEFAULTS);
  });
});
