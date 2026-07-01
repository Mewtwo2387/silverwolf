import { describe, it, expect } from 'bun:test';
import { splitMessage } from '../../utils/rpDelivery';

describe('rpDelivery.splitMessage', () => {
  it('keeps a short message as a single chunk', () => {
    expect(splitMessage('hello there')).toEqual(['hello there']);
  });

  it('splits long unbroken text into <=2000-char chunks losslessly', () => {
    const chunks = splitMessage('a'.repeat(5000));
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length <= 2000)).toBe(true);
    expect(chunks.join('')).toBe('a'.repeat(5000));
  });

  it('prefers whitespace break points, never emits empty chunks, and is lossless', () => {
    const text = `${'word '.repeat(600)}end`; // ~3000 chars with spaces
    const chunks = splitMessage(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length > 0 && c.length <= 2000)).toBe(true);
    // Boundary whitespace must survive — no spaces/newlines dropped at chunk edges.
    expect(chunks.join('')).toBe(text);
  });

  it('preserves a newline sitting exactly on the chunk boundary', () => {
    const text = `${'a'.repeat(1999)}\n${'b'.repeat(1500)}`;
    const chunks = splitMessage(text);
    expect(chunks.join('')).toBe(text);
    expect(chunks[0].endsWith('\n')).toBe(true);
  });
});
