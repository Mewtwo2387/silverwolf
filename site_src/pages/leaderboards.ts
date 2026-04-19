import { html } from 'hono/html';
import { Layout } from '../components/layout';
import type { LeaderboardResult } from '../bot-bridge';

const BOARD_OPTIONS: { value: string; label: string }[] = [
  { value: 'gambler', label: 'Gambler (all)' },
  { value: 'murder', label: 'Murder' },
  { value: 'nuggie', label: 'Nuggie' },
  { value: 'poop', label: 'Poop' },
];

export function LeaderboardsPage(opts: {
  selected?: string;
  result?: LeaderboardResult;
  error?: string;
}) {
  const { selected, result, error } = opts;

  const options = BOARD_OPTIONS.map(
    (o) => html`<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`,
  );

  const tableSection = (() => {
    if (error) return html`<p style="color:#f87171; text-align:center;">${error}</p>`;
    if (!result) return html`<p style="color:#8b8c95; text-align:center;">Select a leaderboard above.</p>`;
    if (result.rows.length === 0) return html`<p style="color:#8b8c95; text-align:center;">No data yet for ${result.title}.</p>`;
    return html`
      <h2 style="text-align:center; margin-top:2rem;">${result.title}</h2>
      <table>
        <thead>
          <tr><th>#</th><th>User ID</th><th>Score</th></tr>
        </thead>
        <tbody>
          ${result.rows.map((row) => html`
            <tr>
              <td>${row.rank}</td>
              <td><code>${row.id}</code></td>
              <td>${row.valueLabel}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  })();

  const body = html`
    <h1 style="text-align:center;">Leaderboards</h1>
    <form method="get" action="/leaderboards" style="text-align:center; margin:1.5rem 0;">
      <label for="board" style="display:block; margin-bottom:0.5rem;">View a leaderboard</label>
      <select name="board" id="board" onchange="this.form.submit()" style="padding:0.45rem 0.7rem; font-size:1rem; background:#1a1b23; color:#e6e6e9; border:1px solid #2a2b33; border-radius:4px;">
        <option value="" ${!selected ? 'selected' : ''}>— choose —</option>
        ${options}
      </select>
      <noscript><button type="submit" style="margin-left:0.5rem;">Go</button></noscript>
    </form>
    <div style="display:flex; justify-content:center;">
      <div style="min-width:min(560px, 100%);">
        ${tableSection}
      </div>
    </div>
  `;

  return Layout({ title: 'Silverwolf — Leaderboards', active: 'leaderboards', body });
}
