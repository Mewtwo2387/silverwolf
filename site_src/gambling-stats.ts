import type { Silverwolf } from '../classes/silverwolf';
import { formatDisplay } from '../utils/math';
import { numSpan } from './format';
import { html } from 'hono/html';

export type GamblingPageStats = {
  credits: number;
  creditsLabel: string;
  creditsTitle?: string;
  streak?: number;
};

export type GamblingStreakAttr = 'blackjackStreak' | 'rouletteStreak';

export const GAMBLING_STATS_CSS = `
  .gamble-stats {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin: 0 auto 1.25rem;
    max-width: 480px;
  }
  .gamble-stat {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    text-align: center;
    min-width: 7rem;
  }
  .gamble-stat .label {
    display: block;
    font-size: 0.75rem;
    color: var(--fog-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .gamble-stat .value {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--accent-light);
    font-variant-numeric: tabular-nums;
  }
`;

export async function fetchGamblingPageStats(
  silverwolf: Silverwolf,
  userId: string,
  streakAttr?: GamblingStreakAttr,
): Promise<GamblingPageStats> {
  const credits = await silverwolf.db.user.getUserAttr(userId, 'credits');
  const fmt = formatDisplay(credits);
  const stats: GamblingPageStats = {
    credits,
    creditsLabel: fmt.label,
    ...(fmt.title ? { creditsTitle: fmt.title } : {}),
  };
  if (streakAttr) {
    stats.streak = await silverwolf.db.user.getUserAttr(userId, streakAttr);
  }
  return stats;
}

export function renderGambleStatsBar(
  stats: GamblingPageStats,
  opts?: { showStreak?: boolean },
) {
  const showStreak = opts?.showStreak ?? stats.streak !== undefined;
  return html`
    <div class="gamble-stats">
      <div class="gamble-stat">
        <span class="label">Balance</span>
        <span id="gamble-balance" class="value">${numSpan(stats.credits, true)}</span>
      </div>
      ${showStreak ? html`
        <div class="gamble-stat">
          <span class="label">Streak</span>
          <span id="gamble-streak" class="value">${stats.streak ?? 0}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/** Client-side helpers to refresh balance/streak after each play. */
export const GAMBLING_STATS_JS = `
function updateGambleStats(d) {
  if (!d || !d.creditsLabel) return;
  var bal = document.getElementById('gamble-balance');
  if (bal) setFmtNum(bal, d.creditsLabel, d.creditsTitle);
  var streakEl = document.getElementById('gamble-streak');
  if (streakEl && d.streak !== undefined && d.streak !== null) streakEl.textContent = d.streak;
}
function initGambleStats(stats) {
  updateGambleStats(stats);
}
`;
