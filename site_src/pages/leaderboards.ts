import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
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
    if (error) return html`<p class="text-danger text-center">${error}</p>`;
    if (!result) return html`<p class="text-fog-300 text-center">Select a leaderboard above.</p>`;
    if (result.rows.length === 0) return html`<p class="text-fog-300 text-center">No data yet for ${result.title}.</p>`;
    return html`
      <h2 class="text-center mt-8">${result.title}</h2>
      <table>
        <thead>
          <tr><th>#</th><th>User</th><th>Score</th></tr>
        </thead>
        <tbody>
          ${result.rows.map((row) => html`
            <tr>
              <td>${row.rank}</td>
              <td>
                <div class="flex items-center gap-2">
                  ${row.avatarURL
      ? html`<img src="${row.avatarURL}" alt="" class="w-6 h-6 rounded-full object-cover" />`
      : html`<div class="w-6 h-6 rounded-full bg-ink-500"></div>`}
                  <span>${row.username}</span>
                </div>
              </td>
              <td>${row.valueLabel}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  })();

  const body = html`
    <h1 class="text-center">Leaderboards</h1>
    <form method="get" action="/leaderboards" class="text-center my-6">
      <label for="board" class="block mb-2">View a leaderboard</label>
      <select
        name="board"
        id="board"
        onchange="this.form.submit()"
        class="py-[0.45rem] px-[0.7rem] text-base bg-ink-700 text-fog-100 border border-ink-500 rounded"
      >
        <option value="" ${!selected ? 'selected' : ''}>— choose —</option>
        ${options}
      </select>
      <noscript><button type="submit" class="ml-2">Go</button></noscript>
    </form>
    <div class="flex justify-center">
      <div class="min-w-[min(560px,100%)]">
        ${tableSection}
      </div>
    </div>
  `;

  return Layout({
    title: 'Silverwolf — Leaderboards',
    active: 'leaderboards',
    body: body as unknown as HtmlEscapedString,
  });
}
