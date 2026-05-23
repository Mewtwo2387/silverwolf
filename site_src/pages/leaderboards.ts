import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import type { LeaderboardResult } from '../bot-bridge';

const BOARD_OPTIONS: { value: string; label: string }[] = [
  { value: 'gambler', label: 'Gambler (all)' },
  { value: 'murder', label: 'Murder' },
  { value: 'nuggie', label: 'Nuggie' },
  { value: 'poop', label: 'Poop' },
];

const leaderboardsExtras = (nonce: string) => raw(`
<script nonce="${nonce}">
(() => {
  const sel = document.getElementById('board');
  const form = sel && sel.form;
  if (form) {
    // Preserve any non-form query params (e.g. ?theme=) across submission
    const params = new URLSearchParams(location.search);
    params.forEach((value, key) => {
      if (key === 'board') return;
      if (form.querySelector('input[name="' + key + '"]')) return;
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = key;
      hidden.value = value;
      form.appendChild(hidden);
    });
    sel.addEventListener('change', () => form.submit());
  }
})();
</script>
`);

export function LeaderboardsPage(opts: {
  selected?: string;
  result?: LeaderboardResult;
  error?: string;
  nonce: string;
  lv999?: boolean;
  user?: import('../components/navbar').NavUser | null;
}) {
  const {
    selected, result, error, nonce, lv999, user,
  } = opts;

  const options = BOARD_OPTIONS.map(
    (o) => html`<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>[${o.value.toUpperCase()}] ${o.label}</option>`,
  );

  const tableSection = (() => {
    if (error) return html`<p class="text-danger text-center font-mono my-8">${error}</p>`;
    if (!result) return html`<p class="text-fog-300 text-center font-mono my-8">&gt; SYSTEM STATUS: Awaiting query request...</p>`;
    if (result.rows.length === 0) return html`<p class="text-fog-300 text-center font-mono my-8">&gt; NO RECORDED DATA FOR: ${result.title}</p>`;
    return html`
      <h2 class="text-center font-mono text-lg tracking-wider text-accent mt-8 mb-4 uppercase">&gt; DATABASE: ${result.title}</h2>
      <div class="overflow-hidden border border-ink-600 rounded-xl bg-ink-800/35 backdrop-blur-md shadow-2xl relative">
        <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-accent to-accent-pale"></div>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-ink-900/80 border-b border-ink-600">
              <th class="py-3 px-4 font-mono text-xs tracking-wider text-accent-light uppercase">Rank</th>
              <th class="py-3 px-4 font-mono text-xs tracking-wider text-accent-light uppercase">User</th>
              <th class="py-3 px-4 font-mono text-xs tracking-wider text-accent-light uppercase text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            ${result.rows.map((row) => html`
              <tr class="border-b border-ink-600/30 hover:bg-ink-700/20 transition-colors">
                <td class="py-3 px-4">
                  ${(() => {
      if (row.rank === 1) return html`<span class="rank-podium rank-podium-1">1</span>`;
      if (row.rank === 2) return html`<span class="rank-podium rank-podium-2">2</span>`;
      if (row.rank === 3) return html`<span class="rank-podium rank-podium-3">3</span>`;
      return html`<span class="rank-podium rank-podium-normal">${row.rank}</span>`;
    })()}
                </td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    ${row.avatarURL
      ? html`<img src="${row.avatarURL}" alt="" class="w-8 h-8 rounded-full border border-ink-500 object-cover" />`
      : html`<div class="w-8 h-8 rounded-full bg-ink-600 border border-ink-500 flex items-center justify-center font-mono text-xs text-fog-400">?</div>`}
                    <span class="font-medium text-fog-100 hover:text-accent transition-colors">${row.username}</span>
                  </div>
                </td>
                <td class="py-3 px-4 font-mono text-right text-accent-light font-semibold">
                  ${row.valueTitle
      ? html`<span title="${row.valueTitle}">${row.valueLabel}</span>`
      : row.valueLabel}
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  })();

  const body = html`
    <h1 class="text-center">Leaderboards</h1>
    <div class="max-w-[400px] mx-auto my-6">
      <form method="get" action="/leaderboards" class="text-center p-5 bg-ink-800/40 border border-ink-600 rounded-xl backdrop-blur-md relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent to-accent-pale"></div>
        <label for="board" class="block font-mono text-xs tracking-widest text-accent-light uppercase mb-3">&gt; SYS.BOARD.QUERY</label>
        <div class="relative inline-block w-full">
          <select
            name="board"
            id="board"
            class="w-full py-2.5 px-4 text-sm bg-ink-900 text-fog-100 border border-ink-600 rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono"
          >
            <option value="" ${!selected ? 'selected' : ''}>— CHOOSE LEADERBOARD —</option>
            ${options}
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-accent">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <noscript><button type="submit" class="mt-3 btn-accent btn-sm font-mono">&gt; RUN QUERY</button></noscript>
      </form>
    </div>
    <div class="flex justify-center">
      <div class="min-w-[min(560px,100%)] overflow-x-auto">
        ${tableSection}
      </div>
    </div>
    ${leaderboardsExtras(nonce)}
  `;

  return Layout({
    title: 'Silverwolf — Leaderboards',
    active: 'leaderboards',
    body: body as unknown as HtmlEscapedString,
    nonce,
    lv999,
    user,
  });
}
