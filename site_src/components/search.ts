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

const styles = raw(`
<style>
  /* Backdrop fills the viewport, blurs whatever is behind. Hidden via the
     [hidden] attribute by default so it doesn't intercept clicks. */
  .search-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    background: rgba(0, 0, 0, 0.45);
    -webkit-backdrop-filter: blur(6px) saturate(120%);
    backdrop-filter: blur(6px) saturate(120%);
    opacity: 0;
    transition: opacity 0.15s ease-out;
  }
  .search-overlay[hidden] { display: none; }
  .search-overlay.visible { opacity: 1; }

  /* Translucent themed glass card — matches the mobile dock vibe. Uses
     color-mix so the surface picks up the active theme's --ink-800. */
  .search-box {
    width: min(560px, 92vw);
    border-radius: 0.9rem;
    /* Match the site chrome (navbar, badges, kbd hints) which is all
       JetBrains Mono. Everything inside inherits this. */
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    background: color-mix(in oklab, var(--ink-800) 70%, transparent);
    -webkit-backdrop-filter: blur(22px) saturate(180%);
    backdrop-filter: blur(22px) saturate(180%);
    border: 1px solid color-mix(in oklab, var(--accent) 35%, var(--ink-600));
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 0 24px color-mix(in oklab, var(--accent) 18%, transparent);
    overflow: hidden;
    transform: translateY(-8px);
    transition: transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
  .search-overlay.visible .search-box { transform: translateY(0); }

  .search-input-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.9rem 1.1rem;
    border-bottom: 1px solid color-mix(in oklab, var(--ink-600) 80%, transparent);
  }
  .search-input-row svg {
    width: 20px;
    height: 20px;
    flex: none;
    color: var(--fog-300);
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    /* Theme-aware text color so flashbang stays readable. */
    color: var(--fog-100);
    font: inherit;
    font-size: 1rem;
    padding: 0.15rem 0;
  }
  .search-input::placeholder { color: var(--fog-400); }

  .search-hint {
    font-size: 0.7rem;
    color: var(--fog-400);
    border: 1px solid var(--ink-600);
    border-radius: 0.3rem;
    padding: 0.1rem 0.4rem;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Results list — cap height at ~10 rows; scroll past that. */
  .search-results {
    max-height: 420px;
    overflow-y: auto;
    padding: 0.35rem;
  }
  .search-results:empty + .search-empty { display: block; }

  .search-empty {
    display: none;
    padding: 1rem 1.2rem;
    color: var(--fog-400);
    font-size: 0.9rem;
  }
  .search-overlay[data-state="empty"] .search-empty { display: block; }
  .search-overlay[data-state="results"] .search-empty { display: none; }
  .search-overlay[data-state="idle"] .search-empty {
    display: block;
    color: var(--fog-400);
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.8rem;
    border-radius: 0.5rem;
    text-decoration: none;
    color: var(--fog-200);
    cursor: pointer;
    transition: background-color 0.1s, color 0.1s;
  }
  .search-result .titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .search-result .title {
    color: var(--fog-100);
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search-result .desc {
    color: var(--fog-400);
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search-result .group-tag {
    font-size: 0.7rem;
    color: var(--fog-400);
    border: 1px solid var(--ink-600);
    border-radius: 0.3rem;
    padding: 0.1rem 0.45rem;
    flex: none;
  }
  .search-result mark {
    background: color-mix(in oklab, var(--accent) 30%, transparent);
    color: var(--accent-light);
    border-radius: 0.2rem;
    padding: 0 1px;
  }
  .search-result.selected {
    background: color-mix(in oklab, var(--accent) 22%, transparent);
  }
  .search-result.selected .title { color: var(--fog-100); }
  .search-result.selected .group-tag {
    border-color: color-mix(in oklab, var(--accent) 55%, var(--ink-600));
    color: var(--accent-light);
  }
  .search-result:hover {
    background: color-mix(in oklab, var(--accent) 14%, transparent);
  }

  .search-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.45rem 0.9rem;
    border-top: 1px solid color-mix(in oklab, var(--ink-600) 80%, transparent);
    font-size: 0.72rem;
    color: var(--fog-400);
    gap: 0.5rem;
  }
  .search-footer kbd {
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid var(--ink-600);
    border-radius: 0.25rem;
    padding: 0.05rem 0.35rem;
    color: var(--fog-300);
  }
</style>
`);

const searchScript = (nonce: string, index: IndexEntry[]) => raw(`
<script nonce="${nonce}">
(function(){
  var INDEX = ${inlineJSON(index)};
  var overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  var input = overlay.querySelector('.search-input');
  var resultsEl = overlay.querySelector('.search-results');
  var emptyEl = overlay.querySelector('.search-empty');
  var box = overlay.querySelector('.search-box');

  var open = false;
  var selectedIdx = 0;
  var currentResults = [];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var i = lower.indexOf(q);
    if (i < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, i))
      + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>'
      + escapeHtml(text.slice(i + q.length));
  }

  // Scoring: title prefix > title substring > desc/keyword substring > nothing.
  // Lower numbers rank higher.
  function score(item, q) {
    var t = item.title.toLowerCase();
    var d = (item.desc || '').toLowerCase();
    var k = (item.keywords || '').toLowerCase();
    if (t === q) return 0;
    var ti = t.indexOf(q);
    if (ti === 0) return 1;
    if (ti > 0) return 10 + ti;
    if (d.indexOf(q) >= 0) return 100 + d.indexOf(q);
    if (k.indexOf(q) >= 0) return 200 + k.indexOf(q);
    return -1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) {
      // Empty query → show first 10 as a quick-nav menu.
      return INDEX.slice(0, 10).map(function(item) { return { item: item, s: 0 }; });
    }
    var out = [];
    for (var i = 0; i < INDEX.length; i++) {
      var s = score(INDEX[i], q);
      if (s >= 0) out.push({ item: INDEX[i], s: s });
    }
    out.sort(function(a, b) { return a.s - b.s; });
    return out.slice(0, 10);
  }

  function render() {
    var q = input.value.trim();
    currentResults = search(q);
    if (currentResults.length === 0) {
      resultsEl.innerHTML = '';
      overlay.setAttribute('data-state', 'empty');
      emptyEl.textContent = 'No results for "' + q + '"';
      return;
    }
    overlay.setAttribute('data-state', 'results');
    var html = '';
    for (var i = 0; i < currentResults.length; i++) {
      var item = currentResults[i].item;
      html += '<a class="search-result' + (i === selectedIdx ? ' selected' : '') + '" '
        + 'href="' + item.href + '" data-idx="' + i + '">'
        + '<div class="titles">'
        + '<span class="title">' + highlight(item.title, q) + '</span>'
        + (item.desc ? '<span class="desc">' + highlight(item.desc, q) + '</span>' : '')
        + '</div>'
        + '<span class="group-tag">' + escapeHtml(item.group) + '</span>'
        + '</a>';
    }
    resultsEl.innerHTML = html;
    // Wire click — let normal anchor navigation handle the rest, but close
    // the overlay first so it isn't visible during the page-load flash.
    resultsEl.querySelectorAll('.search-result').forEach(function(el) {
      el.addEventListener('mouseenter', function() {
        selectedIdx = parseInt(el.dataset.idx, 10);
        updateSelection();
      });
    });
  }

  function updateSelection() {
    var items = resultsEl.querySelectorAll('.search-result');
    items.forEach(function(el, i) {
      el.classList.toggle('selected', i === selectedIdx);
    });
    // Keep the selected item in view when navigating with arrows.
    var active = items[selectedIdx];
    if (active) {
      var r = active.getBoundingClientRect();
      var pr = resultsEl.getBoundingClientRect();
      if (r.bottom > pr.bottom) resultsEl.scrollTop += r.bottom - pr.bottom;
      else if (r.top < pr.top) resultsEl.scrollTop -= pr.top - r.top;
    }
  }

  function openPalette() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    selectedIdx = 0;
    input.value = '';
    render();
    // Let the browser commit the [hidden] removal before transitioning opacity.
    requestAnimationFrame(function() {
      overlay.classList.add('visible');
      input.focus();
    });
  }

  function closePalette() {
    if (!open) return;
    open = false;
    overlay.classList.remove('visible');
    setTimeout(function() {
      if (!open) overlay.hidden = true;
    }, 160);
  }

  function activate(idx) {
    var hit = currentResults[idx];
    if (!hit) return;
    var href = hit.item.href;
    // Preserve ?theme= if the user is on a non-default theme.
    try {
      var current = new URL(window.location.href);
      var t = current.searchParams.get('theme');
      if (t) {
        var u = new URL(href, window.location.origin);
        if (!u.searchParams.has('theme')) u.searchParams.set('theme', t);
        href = u.pathname + (u.search || '') + (u.hash || '');
      }
    } catch (e) {}
    closePalette();
    window.location.href = href;
  }

  // Global hotkey: cmd/ctrl + K. Also Esc to close.
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      open ? closePalette() : openPalette();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length) {
        selectedIdx = (selectedIdx + 1) % currentResults.length;
        updateSelection();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length) {
        selectedIdx = (selectedIdx - 1 + currentResults.length) % currentResults.length;
        updateSelection();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      activate(selectedIdx);
    }
  });

  input.addEventListener('input', function() {
    selectedIdx = 0;
    render();
  });

  // Click outside the box closes; clicks on .search-result navigate via href
  // but we intercept to keep theme + close behavior consistent.
  overlay.addEventListener('click', function(e) {
    var card = e.target.closest && e.target.closest('.search-result');
    if (card) {
      e.preventDefault();
      activate(parseInt(card.dataset.idx, 10));
      return;
    }
    if (!box.contains(e.target)) closePalette();
  });
})();
</script>
`);

const ICON_SEARCH = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="11" cy="11" r="7"/>'
    + '<path d="m20 20-3.5-3.5"/>'
    + '</svg>',
);

export function Search(nonce: string) {
  return html`
    ${styles}
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
    ${searchScript(nonce, buildIndex())}
  `;
}
