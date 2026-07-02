// Bun runtime — globalThis is always available; the airbnb/node rule targets Node 8.
/* eslint-disable node/no-unsupported-features/es-builtins */
import {
  describe, it, expect, afterEach,
} from 'bun:test';
import {
  loadCharacterJson, validateDetails, validateStartingMessage, validateCharacterFields,
} from '../../utils/rpCharInput';

const realFetch = globalThis.fetch;
function stubFetch(body: string, ok = true): void {
  globalThis.fetch = (async () => ({
    ok,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  })) as any;
}
afterEach(() => { globalThis.fetch = realFetch; });

describe('rpCharInput validators', () => {
  it('enforces the details token budget', () => {
    expect(validateDetails('a normal system prompt')).toBeNull();
    expect(validateDetails('')).not.toBeNull();
    // ~5000 tokens (20000 chars / 4) exceeds the 4000-token cap.
    expect(validateDetails('x'.repeat(20000))).not.toBeNull();
  });

  it('enforces the 6000-char starting message limit', () => {
    expect(validateStartingMessage('hi there')).toBeNull();
    expect(validateStartingMessage('a'.repeat(6000))).toBeNull();
    expect(validateStartingMessage('a'.repeat(6001))).not.toBeNull();
    expect(validateStartingMessage('')).not.toBeNull();
  });

  it('validateCharacterFields rejects a bad name', () => {
    expect(validateCharacterFields({ name: 'ok_name', details: 'd', startingMessage: 's' })).toBeNull();
    // Spaces are allowed now; a dash (the id separator) is the invalid case.
    expect(validateCharacterFields({ name: 'Silver Wolf', details: 'd', startingMessage: 's' })).toBeNull();
    expect(validateCharacterFields({ name: 'bad-name', details: 'd', startingMessage: 's' })).not.toBeNull();
  });
});

describe('rpCharInput.loadCharacterJson', () => {
  const att = { url: 'https://example/char.json', size: 100 };

  it('parses a complete object', async () => {
    stubFetch(JSON.stringify({ name: 'bob', details: 'a bold knight', starting_message: 'Hail!' }));
    const res = await loadCharacterJson(att);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.fields).toEqual({ name: 'bob', details: 'a bold knight', startingMessage: 'Hail!' });
    }
  });

  it('reports every missing field', async () => {
    stubFetch(JSON.stringify({ name: 'bob' }));
    const res = await loadCharacterJson(att);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('details');
      expect(res.error).toContain('starting_message');
    }
  });

  it('rejects malformed JSON and non-objects', async () => {
    stubFetch('not json {');
    expect((await loadCharacterJson(att)).ok).toBe(false);
    stubFetch('[]');
    expect((await loadCharacterJson(att)).ok).toBe(false);
  });

  it('rejects oversize uploads before fetching', async () => {
    const res = await loadCharacterJson({ url: 'x', size: 999_999_999 });
    expect(res.ok).toBe(false);
  });

  it('ignores unknown fields and never pollutes the prototype', async () => {
    // Raw string so the literal "__proto__" key is actually present in the JSON.
    stubFetch('{"name":"bob","details":"d","starting_message":"s","evil":"x","__proto__":{"polluted":true}}');
    const res = await loadCharacterJson(att);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Object.keys(res.fields).sort()).toEqual(['details', 'name', 'startingMessage']);
    }
    expect(({} as any).polluted).toBeUndefined();
  });
});
