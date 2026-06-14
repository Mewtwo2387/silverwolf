// Single source of truth for the "love calculator" hash + phrase mapping.
//
// Previously the Discord command hashed with MD5 (via Bun.CryptoHasher) while
// the web page hashed with FNV-1a in browser JS — same two names produced
// different percentages on each surface. FNV-1a is picked here because it is
// trivial to run on either side and produces a stable 32-bit integer that we
// reduce modulo 101 for the percentage.

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

// FNV-1a is by definition a bitwise operation; disable the no-bitwise rule
// for the body of this function only.
/* eslint-disable no-bitwise */
export function fnv1a(str: string): number {
  let h = FNV_OFFSET_BASIS >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}
/* eslint-enable no-bitwise */

// Order-insensitive, case-insensitive: hash(`Alice` + `Bob`) === hash(`bob` + `alice`).
export function computeLoveCompatibility(input1: string, input2: string): number {
  const sorted = [input1.toLowerCase(), input2.toLowerCase()].sort().join('');
  return fnv1a(sorted) % 101;
}

export function lovePhraseFor(percentage: number): string {
  if (percentage <= 20) return 'Chances are low, but never zero!';
  if (percentage <= 40) return 'You might be better off as friends.';
  if (percentage <= 60) return "There's something there... maybe!";
  if (percentage <= 80) return "Looks like there's some potential!";
  return 'True love! Get ready for the wedding bells!';
}
