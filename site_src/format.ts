import { html } from 'hono/html';
import { formatDisplay } from '../utils/math';

/** Attach `{field}Label` and optional `{field}Title` to an API payload. */
type LabelFields<F extends string> = {
  [K in `${F}Label`]: string;
} & {
  [K in `${F}Title`]?: string;
};

export function applyNumLabel<O extends object, F extends string>(
  obj: O,
  field: F,
  num: number,
  alwaysFixed = false,
): O & LabelFields<F> {
  const { label, title } = formatDisplay(num, alwaysFixed);
  return {
    ...obj,
    [`${field}Label`]: label,
    ...(title ? { [`${field}Title`]: title } : {}),
  } as O & LabelFields<F>;
}

/** Server-rendered number with native hover tooltip when shortened. */
export function numSpan(num: number, alwaysFixed = false) {
  const { label, title } = formatDisplay(num, alwaysFixed);
  if (title) return html`<span title="${title}">${label}</span>`;
  return html`${label}`;
}

/** Like numSpan but with a literal suffix outside the formatted core (e.g. "x", "%"). */
export function numSpanSuffix(num: number, suffix: string, alwaysFixed = false) {
  const { label, title } = formatDisplay(num, alwaysFixed);
  if (title) return html`<span title="${title}${suffix}">${label}${suffix}</span>`;
  return html`${label}${suffix}`;
}

/** Client-side helpers for pages that render formatted numbers from API JSON. */
export const NUM_FMT_JS = `
function setFmtNum(el, label, title) {
  el.textContent = label;
  if (title) el.title = title; else el.removeAttribute('title');
}
function fmtNumSpan(label, title) {
  if (title) return '<span title="' + String(title).replace(/"/g, '&quot;') + '">' + label + '</span>';
  return label;
}
`;
