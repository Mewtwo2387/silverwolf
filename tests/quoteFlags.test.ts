import { describe, expect, test } from 'bun:test';
import {
  parseQuoteFlags,
  resolveQuoteFlags,
  FONT_INDEX,
  FAKEQUOTE_FONT_VALUES,
  FAKEQUOTE_FORMAT_VALUES,
  FAKEQUOTE_BACKGROUND_VALUES,
  FAKEQUOTE_PROFILE_COLOR_VALUES,
  FAKEQUOTE_AVATAR_SOURCE_VALUES,
  QUOTE_FLAG_DEFAULTS,
} from '../utils/quote';

describe('parseQuoteFlags', () => {
  test('returns only what was named, nothing implied', () => {
    expect(parseQuoteFlags('')).toEqual({ override: false });
    expect(parseQuoteFlags('v')).toEqual({ override: false, format: 'vertical' });
  });

  test('compact bare flags, order-independent and case-insensitive', () => {
    expect(parseQuoteFlags(' V caveat #FF00AA BW global ')).toEqual({
      override: false,
      textColor: '#ff00aa', // normalised to lowercase
      profileColor: 'bw',
      avatarSource: 'global',
      fontStyle: 'caveat',
      format: 'vertical',
    });
  });

  test('legacy key:value spelling still parses', () => {
    expect(parseQuoteFlags('bg:w font:3 fmt:v txt:ff00aa pfpc:bw pfp:global')).toEqual({
      override: false,
      background: 'white',
      textColor: '#ff00aa',
      profileColor: 'bw',
      avatarSource: 'global',
      fontStyle: 'caveat',
      format: 'vertical',
    });
  });

  test('fonts by 1-based number and by slug', () => {
    expect(parseQuoteFlags('1').fontStyle).toBe('sans-serif');
    expect(parseQuoteFlags('11').fontStyle).toBe('bebas-neue');
    expect(parseQuoteFlags('minecraft').fontStyle).toBe('minecraft');
    // out of range / not a font → not set at all
    expect(parseQuoteFlags('0 99 nope').fontStyle).toBeUndefined();
  });

  test('unknown tokens are ignored rather than breaking the quote', () => {
    expect(parseQuoteFlags('lol quote this one #ggg')).toEqual({ override: false });
  });

  test('last token wins for the same field', () => {
    expect(parseQuoteFlags('w b').background).toBe('black');
    expect(parseQuoteFlags('v h').format).toBe('landscape');
  });

  test('override flag and its aliases', () => {
    ['-o', '-O', '--override', '-d', '--default', '--defaults'].forEach((token) => {
      expect(parseQuoteFlags(token).override).toBe(true);
    });
    expect(parseQuoteFlags('o override d').override).toBe(false); // needs the dash
  });

  // The mention parser addresses fonts by position, so these two lists must
  // stay in the same order.
  test('numeric font index matches the slash-command font list', () => {
    expect(FONT_INDEX).toEqual(FAKEQUOTE_FONT_VALUES);
  });

  // quote(), the mention resolver and what /quote help and /quote settings
  // advertise all read QUOTE_FLAG_DEFAULTS, so every default must be a value
  // the slash-command choices actually offer.
  test('declared defaults are all valid choice values', () => {
    expect(FAKEQUOTE_FORMAT_VALUES).toContain(QUOTE_FLAG_DEFAULTS.format);
    expect(FAKEQUOTE_BACKGROUND_VALUES).toContain(QUOTE_FLAG_DEFAULTS.background);
    expect(FAKEQUOTE_FONT_VALUES).toContain(QUOTE_FLAG_DEFAULTS.fontStyle);
    expect(FAKEQUOTE_PROFILE_COLOR_VALUES).toContain(QUOTE_FLAG_DEFAULTS.profileColor);
    expect(FAKEQUOTE_AVATAR_SOURCE_VALUES).toContain(QUOTE_FLAG_DEFAULTS.avatarSource);
    expect(QUOTE_FLAG_DEFAULTS.textColor).toBeNull(); // derived from the background
  });
});

describe('resolveQuoteFlags', () => {
  const saved = { background: 'white', textColor: '#ff0124', format: 'vertical' };

  test('nothing set anywhere → bot defaults', () => {
    expect(resolveQuoteFlags(parseQuoteFlags(''), null)).toEqual(QUOTE_FLAG_DEFAULTS);
  });

  test('saved settings layer over the defaults', () => {
    expect(resolveQuoteFlags(parseQuoteFlags(''), saved)).toEqual({
      ...QUOTE_FLAG_DEFAULTS,
      background: 'white',
      textColor: '#ff0124',
      format: 'vertical',
    });
  });

  test('flags on the invocation beat saved settings, field by field', () => {
    const resolved = resolveQuoteFlags(parseQuoteFlags('h caveat'), saved);
    expect(resolved.format).toBe('landscape'); // flag wins
    expect(resolved.fontStyle).toBe('caveat');
    expect(resolved.background).toBe('white'); // untouched saved value survives
    expect(resolved.textColor).toBe('#ff0124');
  });

  test('-o drops the saved layer but keeps flags passed with it', () => {
    expect(resolveQuoteFlags(parseQuoteFlags('-o'), saved)).toEqual(QUOTE_FLAG_DEFAULTS);
    expect(resolveQuoteFlags(parseQuoteFlags('-o v'), saved)).toEqual({
      ...QUOTE_FLAG_DEFAULTS,
      format: 'vertical',
    });
  });
});
