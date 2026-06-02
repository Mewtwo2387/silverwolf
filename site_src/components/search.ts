import { html, raw } from 'hono/html';
import { GAMES } from '../pages/games';
import { inlineJSON } from '../inline';

type IndexEntry = { title: string; href: string; group: string; desc?: string; keywords?: string };

// Top-level pages: navbar destinations + the logged-in dashboard. Small and
// stable enough to keep inline — extracting from routes/pages.ts would create
// a circular import (routes → layout → search).
const PAGES: IndexEntry[] = [
  {
    title: 'About', href: '/about', group: 'Pages', desc: 'About Silverwolf', keywords: 'home info silverwolf',
  },
  {
    title: 'Leaderboards', href: '/leaderboards', group: 'Pages', desc: 'Top players by category', keywords: 'rank top scores',
  },
  {
    title: 'Birthdays', href: '/birthdays', group: 'Pages', desc: 'Server birthdays by month', keywords: 'bday calendar',
  },
  {
    title: 'Games', href: '/games', group: 'Pages', desc: 'All games', keywords: 'play arcade',
  },
  {
    title: 'Dashboard', href: '/me', group: 'Pages', desc: 'Your profile and stats', keywords: 'profile me account',
  },
];

// Mirror of LeaderboardKind in routes/pages.ts. Two short arrays in two files
// is cheaper than the import refactor needed to share them.
const LEADERBOARDS: Array<{ kind: string; keywords: string }> = [
  { kind: 'gambler', keywords: 'casino chips' },
  { kind: 'murder', keywords: 'kills' },
  { kind: 'nuggie', keywords: 'dinonuggie' },
  { kind: 'poop', keywords: 'bathroom' },
];

// GAMES uses lowercase names (matches the game-card display); for search
// results we want title-cased labels. A few names need overrides because their
// canonical casing isn't recoverable from "awdangit" / "fakequote" / "ai slop".
const GAME_TITLE_OVERRIDES: Record<string, string> = {
  awdangit: 'AwDangIt',
  fakequote: 'FakeQuote',
  'ai slop': 'AI Slop',
};

function prettifyGameName(name: string): string {
  if (GAME_TITLE_OVERRIDES[name]) return GAME_TITLE_OVERRIDES[name];
  return name
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Built lazily because `search.ts` is imported by `components/layout.ts`,
// which is in turn imported by `pages/games.ts` (where GAMES lives). Building
// at module load would dereference GAMES mid-cycle; building at render time
// runs after every module has finished evaluating.
function buildIndex(): IndexEntry[] {
  return [
    ...PAGES,
    ...LEADERBOARDS.map((b) => ({
      title: `${b.kind[0].toUpperCase()}${b.kind.slice(1)} Leaderboard`,
      href: `/leaderboards?board=${b.kind}`,
      group: 'Leaderboards',
      keywords: b.keywords,
    })),
    ...GAMES.map((g) => ({
      title: prettifyGameName(g.name),
      href: g.href,
      group: 'Games',
      desc: g.info,
    })),
  ];
}

const ICON_SEARCH = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="11" cy="11" r="7"/>'
    + '<path d="m20 20-3.5-3.5"/>'
    + '</svg>',
);

export function Search() {
  // The search index is emitted as a non-executed JSON data island (read by
  // /static/app.js). type="application/json" isn't subject to CSP script-src, so
  // it needs no nonce, and the heavy palette logic now lives in the cached app.js.
  return html`
    <div id="search-overlay" class="search-overlay" hidden role="dialog" aria-label="Site search" data-state="idle">
      <div class="search-box" role="combobox" aria-expanded="true">
        <div class="search-input-row">
          ${ICON_SEARCH}
          <input class="search-input" type="text" placeholder="Search pages, games, leaderboards…" autocomplete="off" spellcheck="false" aria-label="Search" />
          <span class="search-hint">esc</span>
        </div>
        <div class="search-results" role="listbox"></div>
        <div class="search-empty">Type to search…</div>
        <div class="search-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>⌘</kbd>/<kbd>ctrl</kbd>+<kbd>K</kbd> toggle</span>
        </div>
      </div>
    </div>
    <script type="application/json" id="search-index">${raw(inlineJSON(buildIndex()))}</script>
  `;
}
