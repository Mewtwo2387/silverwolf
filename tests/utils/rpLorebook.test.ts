import { describe, it, expect } from 'bun:test';
import {
  validateLorebookName, parseKeywordLorebook, validateSkillContent, triggerMatches,
  collectTriggeredContexts, findRecallMarkers, stripRecallMarkers, formatRecallMarker,
  MAX_KEYWORD_ENTRIES, KEYWORD_CONTEXT_MAX_TOKENS,
} from '../../utils/rpLorebook';

describe('validateLorebookName', () => {
  it('accepts letters, numbers, underscores and single spaces', () => {
    expect(validateLorebookName('world lore')).toBeNull();
    expect(validateLorebookName('relationships_2')).toBeNull();
  });

  it('rejects empty, dashed, and over-long names', () => {
    expect(validateLorebookName('')).not.toBeNull();
    expect(validateLorebookName('bad-name')).not.toBeNull();
    expect(validateLorebookName('a'.repeat(40))).not.toBeNull();
    expect(validateLorebookName('double  space')).not.toBeNull();
  });
});

describe('parseKeywordLorebook', () => {
  const entry = (triggers: string[], context = 'ctx'): object => ({ triggers, context });

  it('parses a valid lorebook and normalizes triggers', () => {
    const res = parseKeywordLorebook(JSON.stringify([entry([' casino ', 'penacony'])]));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].triggers).toEqual(['casino', 'penacony']);
    }
  });

  it('rejects non-JSON, non-array, and empty inputs', () => {
    expect(parseKeywordLorebook('not json').ok).toBe(false);
    expect(parseKeywordLorebook('{"a":1}').ok).toBe(false);
    expect(parseKeywordLorebook('[]').ok).toBe(false);
  });

  it('rejects malformed entries with a labelled error', () => {
    const noTriggers = parseKeywordLorebook(JSON.stringify([{ context: 'x' }]));
    expect(noTriggers.ok).toBe(false);
    const badTrigger = parseKeywordLorebook(JSON.stringify([entry([''])]));
    expect(badTrigger.ok).toBe(false);
    const noContext = parseKeywordLorebook(JSON.stringify([{ triggers: ['x'] }]));
    expect(noContext.ok).toBe(false);
  });

  it('enforces the entry-count and per-context token caps', () => {
    const many = Array.from({ length: MAX_KEYWORD_ENTRIES + 1 }, () => entry(['x']));
    expect(parseKeywordLorebook(JSON.stringify(many)).ok).toBe(false);

    const fat = entry(['x'], 'word '.repeat(KEYWORD_CONTEXT_MAX_TOKENS * 4));
    expect(parseKeywordLorebook(JSON.stringify([fat])).ok).toBe(false);
  });

  it('ignores unknown fields instead of trusting them', () => {
    const res = parseKeywordLorebook(JSON.stringify([{ ...entry(['x']), evil: { nested: true } }]));
    expect(res.ok).toBe(true);
    if (res.ok) expect(Object.keys(res.entries[0]).sort()).toEqual(['context', 'triggers']);
  });
});

describe('validateSkillContent', () => {
  it('accepts normal markdown and rejects empty/oversized content', () => {
    expect(validateSkillContent('# Relationships\nAlice trusts Bob.').ok).toBe(true);
    expect(validateSkillContent('   ').ok).toBe(false);
    expect(validateSkillContent('word '.repeat(8000)).ok).toBe(false);
  });
});

describe('triggerMatches', () => {
  it('matches case-insensitively on word boundaries', () => {
    expect(triggerMatches('casino', 'welcome to the CASINO!')).toBe(true);
    expect(triggerMatches('golden ratio', 'the Golden Ratio station')).toBe(true);
    expect(triggerMatches('cat', 'concatenate')).toBe(false);
    expect(triggerMatches('cat', 'the cat sat')).toBe(true);
  });

  it('treats regex metacharacters as literals (no user regex)', () => {
    expect(triggerMatches('a+b', 'aab')).toBe(false);
    expect(triggerMatches('a+b', 'what is a+b?')).toBe(true);
    expect(triggerMatches('(a+)+$', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!')).toBe(false);
  });
});

describe('collectTriggeredContexts', () => {
  const book = (entries: object[]): any => ({
    name: 'lore', type: 'keywords', description: '', content: JSON.stringify(entries),
  });

  it('collects contexts for triggered entries in order', () => {
    const books = [book([
      { triggers: ['casino'], context: 'about the casino' },
      { triggers: ['nowhere'], context: 'never injected' },
      { triggers: ['festival'], context: 'about the festival' },
    ])];
    expect(collectTriggeredContexts(books, 'the casino festival is on'))
      .toEqual(['about the casino', 'about the festival']);
    expect(collectTriggeredContexts(books, 'unrelated message')).toEqual([]);
    expect(collectTriggeredContexts(books, '')).toEqual([]);
  });

  it('stops at the token budget and skips malformed stored content', () => {
    const books = [
      {
        name: 'broken', type: 'keywords', description: '', content: 'not json',
      },
      book([
        { triggers: ['hit'], context: 'short one' },
        { triggers: ['hit'], context: 'word '.repeat(600) },
      ]),
    ];
    // Budget of 20 tokens fits the short context but not the fat one.
    expect(collectTriggeredContexts(books as any, 'hit', 20)).toEqual(['short one']);
  });

  it('ignores skill-type lorebooks', () => {
    const books = [{
      name: 's', type: 'skill', description: 'd', content: 'hit',
    }];
    expect(collectTriggeredContexts(books as any, 'hit')).toEqual([]);
  });
});

describe('recall markers', () => {
  it('finds distinct requested skills, case-insensitively', () => {
    const text = `${formatRecallMarker('world lore')} and <RECALL:Relationships> and ${formatRecallMarker('world lore')}`;
    expect(findRecallMarkers(text).sort()).toEqual(['relationships', 'world lore']);
    expect(findRecallMarkers('a plain reply')).toEqual([]);
  });

  it('does not match malformed or oversized markers', () => {
    expect(findRecallMarkers('<recall:has-dash>')).toEqual([]);
    expect(findRecallMarkers(`<recall:${'x'.repeat(100)}>`)).toEqual([]);
  });

  it('strips markers from a final reply', () => {
    expect(stripRecallMarkers('<recall:world lore>\nActual reply.')).toBe('Actual reply.');
    expect(stripRecallMarkers('Reply with <recall:notes> inline.')).toBe('Reply with  inline.');
    expect(stripRecallMarkers('untouched reply')).toBe('untouched reply');
  });
});
