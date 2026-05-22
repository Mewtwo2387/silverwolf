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
