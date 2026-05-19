// Safely embed a value as a JS literal inside an inline <script> block.
//
// JSON.stringify alone is unsafe in two ways:
//  1. The substring "</script>" inside any string would close the surrounding
//     <script> tag and start an HTML-injection attack. Escaping "<" prevents it.
//  2. JSON allows the raw line-terminator codepoints U+2028 / U+2029 inside
//     strings, but JS engines pre-ES2019 (and some embedded WebViews) treat
//     them as line terminators, breaking the script. Escaping defends portability.
//
// Inputs today are all developer-controlled JSON files, but this is the kind
// of helper that must already be in place before any user-controlled value
// gets near a <script> body.
// Client-side bet-amount normalizer.
//
// Server-side `antiFormat` (utils/math.ts) is case-sensitive: it accepts "K",
// "M", "Qa", "Dc"… but rejects "k", "m", "qa". Rather than loosen the parser,
// we Title-case the alphabetic suffix in the browser before sending so common
// typos like "1k" or "5.5m" still resolve. Anything that doesn't match
// digits + letters is passed through untouched — the server will reject it.
//
// Embed via raw(NORMALIZE_AMOUNT_JS) inside a <script>, then call
// `normalizeAmount(input)` to produce the string to POST.
export const NORMALIZE_AMOUNT_JS = `
function normalizeAmount(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  const m = t.match(/^([0-9.,]+)([A-Za-z]+)$/);
  if (!m) return t;
  const suf = m[2];
  return m[1] + suf.charAt(0).toUpperCase() + suf.slice(1).toLowerCase();
}
`;

export function inlineJSON(value: unknown): string {
  const s = JSON.stringify(value);
  // JSON.stringify returns undefined for undefined / functions / symbols;
  // fall back to a safe JS literal so callers can interpolate without crashing.
  if (s === undefined) return 'null';
  return s
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
