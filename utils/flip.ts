// Coin flip outcomes shared by the Discord `/flip` command and the web flip
// page. The bot historically used two `Math.random()` calls which slightly
// skewed the distribution — this single-roll implementation matches what the
// web client does and gives the intended 49 / 49 / 2 split.

export type FlipOutcome = 'head' | 'tail' | 'side';

// Cumulative thresholds: roll < HEAD_MAX → head, < TAIL_MAX → tail, else side.
export const FLIP_HEAD_THRESHOLD = 0.49;
export const FLIP_TAIL_THRESHOLD = 0.98;

export function flipCoin(): FlipOutcome {
  const r = Math.random();
  if (r < FLIP_HEAD_THRESHOLD) return 'head';
  if (r < FLIP_TAIL_THRESHOLD) return 'tail';
  return 'side';
}
