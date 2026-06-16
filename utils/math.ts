const t1a = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
const t1b = ['', 'U', 'D', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
const t2 = ['', 'Dc', 'Vg', 'Tg', 'Qg', 'Qig', 'Sxg', 'Spg', 'Og', 'Ng'];
const t3 = ['', 'Ce', 'De', 'Te', 'Qe', 'Qie', 'Sxe', 'Spe', 'Oe', 'Ne'];

function getPrefix(n: number): string {
  if (n < 10) {
    return t1a[n];
  }
  if (n < 100) {
    return t1b[n % 10] + t2[Math.floor(n / 10)];
  }
  if (n < 1000) {
    return t1b[n % 10] + t2[Math.floor(n / 10) % 10] + t3[Math.floor(n / 100)];
  }
  return 'OWO';
}

function getNumberFromPrefix(prefix: string): number {
  for (let i = 0; i < 1000; i += 1) {
    if (getPrefix(i) === prefix) {
      return i;
    }
  }
  return -1;
}

// When alwaysFixed is false, return up to 2 d.p. Used in credits.
// format(1234) => "1,234"
// format(1234.1) => "1,234.1"
// format(1234.1234) => "1,234.12"
// When alwaysFixed is true, always return 2 d.p. Used in multipliers and percentages.
// format(1234, true) => "1,234.00"
// format(1234.1, true) => "1,234.10"
// format(1234.1234, true) => "1,234.12"
// Shorten numbers above a magnitude of shortenThreshold.
// format(1234567, false, 9) => "1,234,567"
// format(1234567, false, 6) => "1.235M"
function format(num: number | null | undefined, alwaysFixed = false, shortenThreshold = 6): string {
  if (num === null) {
    return 'null';
  }
  if (typeof num === 'undefined') {
    return 'undefined';
  }

  const normalizedNum = Number(num);
  const safeNum = Number.isFinite(normalizedNum) ? normalizedNum : 0;
  let formattedNum: string;

  if (alwaysFixed) {
    formattedNum = safeNum.toFixed(2);
  } else {
    const magnitude = safeNum > 0 ? Math.floor(Math.log10(safeNum)) : 0;
    if (magnitude >= shortenThreshold && safeNum >= 1000) {
      const prefix = getPrefix(Math.floor(magnitude / 3) - 1);
      const magnitudeUsed = magnitude - (magnitude % 3);
      const numUsed = safeNum / 10 ** magnitudeUsed;
      return `${numUsed.toFixed(3)}${prefix}`;
    }
    const numStr = safeNum.toString();
    const decimalIndex = numStr.indexOf('.');

    if (decimalIndex === -1 || numStr.length - decimalIndex - 1 <= 2) {
      formattedNum = safeNum.toString();
    } else {
      formattedNum = safeNum.toFixed(2);
    }
  }

  return formattedNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Full comma-separated display without K/M/B shortening — used for hover titles.
function formatFull(num: number | null | undefined, alwaysFixed = false): string {
  if (num === null) {
    return 'null';
  }
  if (typeof num === 'undefined') {
    return 'undefined';
  }

  const normalizedNum = Number(num);
  const safeNum = Number.isFinite(normalizedNum) ? normalizedNum : 0;
  let formattedNum: string;

  if (alwaysFixed) {
    formattedNum = safeNum.toFixed(2);
  } else {
    const numStr = safeNum.toString();
    const decimalIndex = numStr.indexOf('.');

    if (decimalIndex === -1 || numStr.length - decimalIndex - 1 <= 2) {
      formattedNum = safeNum.toString();
    } else {
      formattedNum = safeNum.toFixed(2);
    }
  }

  return formattedNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormattedNumber {
  label: string;
  title?: string;
}

function formatHoverTitle(
  num: number | null | undefined,
  alwaysFixed = false,
  shortenThreshold = 6,
): string | undefined {
  if (num === null || typeof num === 'undefined') {
    return undefined;
  }
  const label = format(num, alwaysFixed, shortenThreshold);
  const full = formatFull(num, alwaysFixed);
  return label !== full ? full : undefined;
}

function formatDisplay(
  num: number | null | undefined,
  alwaysFixed = false,
  shortenThreshold = 6,
): FormattedNumber {
  const label = format(num, alwaysFixed, shortenThreshold);
  const title = formatHoverTitle(num, alwaysFixed, shortenThreshold);
  return title ? { label, title } : { label };
}

/** Round to 2 decimal places to avoid floating-point drift from chained multipliers. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function antiFormat(input: string): number {
  const cleanInput = input.replace(/,/g, '').trim();
  // pure numerical
  // eslint-disable-next-line no-restricted-globals
  if (!isNaN(cleanInput as any)) { // Number.isNan does not work here
    return parseFloat(cleanInput);
  }
  // Extract the numeric part and the prefix
  const match = cleanInput.match(/^([0-9.]+)([a-zA-Z]+)$/);
  if (!match) {
    return NaN; // Invalid input format
  }

  const number = parseFloat(match[1]);
  // Accept any casing for the suffix ("1k", "1K", "1qA" all valid) by
  // normalizing to the canonical Title-case form used by the prefix tables.
  // This is what NORMALIZE_AMOUNT_JS used to do client-side before POSTing.
  const rawSuf = match[2];
  const prefix = rawSuf.charAt(0).toUpperCase() + rawSuf.slice(1).toLowerCase();

  // Get the corresponding n using getNumberFromPrefix
  const n = getNumberFromPrefix(prefix);
  if (n === -1) {
    return NaN; // Invalid prefix
  }

  // Calculate the exponent from n
  const exponent = n * 3 + 3;
  return number * 10 ** exponent;
}

export {
  format,
  formatFull,
  formatDisplay,
  formatHoverTitle,
  antiFormat,
  getPrefix,
  getNumberFromPrefix,
  round2,
};
