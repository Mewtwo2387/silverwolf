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

// Client-side number formatter mirroring server's `utils/math.ts` `format()`.
//
// Same call shape: format(num, alwaysFixed=false, shortenThreshold=6).
// Numbers ≥ 1e6 (and magnitude ≥ shortenThreshold) collapse to "1.235M" /
// "1.000Qi" / etc. so leaderboard-style display stays consistent everywhere
// large counters appear (profile, gambling banners, dinonuggie upgrades…).
//
// Embed via raw(FORMAT_NUMBER_JS) inside a <script> before calling `format(n)`.
export const FORMAT_NUMBER_JS = `
var FORMAT_T1A = ['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No'];
var FORMAT_T1B = ['','U','D','T','Qa','Qi','Sx','Sp','Oc','No'];
var FORMAT_T2  = ['','Dc','Vg','Tg','Qg','Qig','Sxg','Spg','Og','Ng'];
var FORMAT_T3  = ['','Ce','De','Te','Qe','Qie','Sxe','Spe','Oe','Ne'];
function _formatPrefix(n) {
  if (n < 10) return FORMAT_T1A[n];
  if (n < 100) return FORMAT_T1B[n % 10] + FORMAT_T2[Math.floor(n / 10)];
  if (n < 1000) return FORMAT_T1B[n % 10] + FORMAT_T2[Math.floor(n / 10) % 10] + FORMAT_T3[Math.floor(n / 100)];
  return 'OWO';
}
function format(num, alwaysFixed, shortenThreshold) {
  if (num === null) return 'null';
  if (typeof num === 'undefined') return 'undefined';
  if (alwaysFixed === undefined) alwaysFixed = false;
  if (shortenThreshold === undefined) shortenThreshold = 6;
  var safeNum = Number(num);
  if (!Number.isFinite(safeNum)) safeNum = 0;
  var formattedNum;
  if (alwaysFixed) {
    formattedNum = safeNum.toFixed(2);
  } else {
    var magnitude = safeNum > 0 ? Math.floor(Math.log10(safeNum)) : 0;
    if (magnitude >= shortenThreshold && safeNum >= 1000) {
      var prefix = _formatPrefix(Math.floor(magnitude / 3) - 1);
      var magUsed = magnitude - (magnitude % 3);
      return (safeNum / Math.pow(10, magUsed)).toFixed(3) + prefix;
    }
    var numStr = safeNum.toString();
    var decIdx = numStr.indexOf('.');
    if (decIdx === -1 || numStr.length - decIdx - 1 <= 2) {
      formattedNum = safeNum.toString();
    } else {
      formattedNum = safeNum.toFixed(2);
    }
  }
  return formattedNum.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
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
