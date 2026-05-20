import { html, raw } from 'hono/html';
import { Layout } from '../components/layout';

const GAMES = [
  {
    name: '8ball',
    href: '/games/8ball',
    info: 'Ask the magic 8-ball a question and let fate decide.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/pool-8-ball-svgrepo-com.svg',
  },
  {
    name: 'flip',
    href: '/games/flip',
    info: 'Flip a virtual coin. Will it be heads, tails, or... side?',
    imageType: 'coin' as const,
  },
  {
    name: 'fortune',
    href: '/games/fortune',
    info: 'Munch on a virtual fortune cookie to see what the future holds.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/fortune-cookie-svgrepo-com.svg',
  },
  {
    name: 'love',
    href: '/games/love',
    info: 'Calculate your compatibility or incompatibility with someone.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/love-heart-svgrepo-com.svg',
  },
  {
    name: 'blackjack',
    href: '/games/blackjack',
    info: 'Bet your mystic credits on a classic game of 21 against Silverwolf.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/poker-svgrepo-com.svg',
  },
  {
    name: 'roulette',
    href: '/games/roulette',
    info: 'Spin the wheel. Bet on numbers, colors, or odds and pray.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/roulette-casino-svgrepo-com.svg',
  },
  {
    name: 'slots',
    href: '/games/slots',
    info: 'Pull the lever and watch your mystic credits disappear in style.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/slots-svgrepo-com.svg',
  },
  {
    name: 'poop',
    href: '/games/poop',
    info: 'Log a bathroom visit and contribute to the leaderboard.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/pile-of-poo-svgrepo-com.svg',
  },
  {
    name: 'claim',
    href: '/games/claim',
    info: 'claim yer dinonuggies',
    imageType: 'img' as const,
    imageSrc: '/static/game-dinonuggie.webp',
  },
  {
    name: 'dinonuggie_upgrades',
    href: '/games/dinonuggie-upgrades',
    info: 'a hub for eating and upgrading',
    imageType: 'composite' as const,
    imageSrc: '/static/game-dinonuggie.webp',
    overlaySrc: '/static/svg/wrench-screwdriver-svgrepo-com.svg',
  },
  {
    name: 'awdangit',
    href: '/games/awdangit',
    info: '99% chance to earn $1M, 1% chance to become a girl.',
    imageType: 'img' as const,
    imageSrc: '/static/game-awdangit.jpeg',
  },
  {
    name: 'fakequote',
    href: '/games/fakequote',
    info: 'create your very real totally accurate quotes!',
    imageType: 'img' as const,
    imageSrc: '/static/game-fakequote.webp',
  },
  {
    name: 'ai slop',
    href: '/games/ai-slop',
    info: 'chat with ai slop or something idk',
    imageType: 'ai-slop' as const,
  },
];

const styles = raw(`
<style>
  .games-header {
    position: relative;
    margin-bottom: 1.5rem;
  }
  .games-header h1 { margin: 0 0 0.25rem 0; }
  .games-header p { margin: 0; }

  .layout-switcher {
    position: absolute;
    top: 0;
    right: 0;
  }
  @media (max-width: 700px) {
    .layout-switcher {
      position: static;
      display: flex;
      justify-content: flex-end;
      margin-top: 0.75rem;
    }
  }

  .layout-switcher-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    color: var(--fog-200);
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    transition: border-color 0.2s, color 0.2s;
  }
  .layout-switcher-btn:hover {
    border-color: var(--accent);
    color: var(--accent-light);
  }
  .layout-switcher-btn svg { width: 18px; height: 18px; }
  .layout-switcher-btn .chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
  }
  .layout-switcher.open .layout-switcher-btn .chevron {
    transform: rotate(180deg);
  }

  .layout-switcher-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    right: 0;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    padding: 0.25rem;
    display: none;
    flex-direction: column;
    min-width: 170px;
    z-index: 10;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .layout-switcher.open .layout-switcher-menu { display: flex; }
  .layout-switcher-menu button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.35rem;
    color: var(--fog-200);
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
  }
  .layout-switcher-menu button:hover {
    background: var(--ink-700, #1e2030);
    color: var(--accent-light);
  }
  .layout-switcher-menu button.active {
    background: var(--ink-700, #1e2030);
    color: var(--accent);
  }
  .layout-switcher-menu button svg { width: 16px; height: 16px; flex-shrink: 0; }

  .games-grid {
    display: grid;
    /* minmax(0, 1fr) — the 0 minimum lets columns shrink past their content's
       intrinsic min-width, which is what stops long words ("Silverwolf",
       fixed-width children like .mini-coin-wrap) from blowing out the row
       on narrower tablet/smart-display widths. */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
  }
  .games-grid.grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .games-grid.list-view {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 700px) {
    .games-grid,
    .games-grid.grid-4 { grid-template-columns: minmax(0, 1fr); }
  }
  @media (min-width: 701px) and (max-width: 1000px) {
    .games-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .games-grid.grid-4 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  .game-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  }
  .game-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.45);
    border-color: var(--accent);
    background: var(--ink-700, #1e2030);
  }

  .card-image {
    aspect-ratio: 1 / 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink-900);
    overflow: hidden;
  }
  .card-image img {
    width: 70%;
    height: 70%;
    object-fit: contain;
  }

  .card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .card-body h2 {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--accent-light);
    margin: 0;
    transition: color 0.2s;
  }
  .game-card:hover .card-body h2 {
    color: var(--accent);
  }
  .card-body p {
    font-size: 0.85rem;
    color: var(--fog-200);
    margin: 0;
  }

  /* 4x4 grid: tighter padding so smaller cards don't feel cramped */
  .games-grid.grid-4 .card-body { padding: 0.9rem; }
  .games-grid.grid-4 .card-body h2 { font-size: 1rem; }
  .games-grid.grid-4 .card-body p { font-size: 0.8rem; }

  /* List view: horizontal layout with small icon and truncated description */
  .games-grid.list-view .game-card {
    flex-direction: row;
    align-items: stretch;
  }
  .games-grid.list-view .game-card:hover {
    transform: translateY(-2px);
  }
  .games-grid.list-view .card-image {
    width: 88px;
    height: 88px;
    flex-shrink: 0;
    aspect-ratio: 1 / 1;
  }
  .games-grid.list-view .card-image img {
    width: 70%;
    height: 70%;
  }
  .games-grid.list-view .card-body {
    flex: 1;
    min-width: 0;
    padding: 0.75rem 1rem;
    justify-content: center;
    gap: 0.2rem;
  }
  .games-grid.list-view .card-body h2 { font-size: 1rem; }
  .games-grid.list-view .card-body p {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .games-grid.list-view .mini-coin-wrap {
    width: 64px;
    height: 64px;
  }
  .games-grid.list-view .mini-face { font-size: 0.6rem; border-width: 3px; }

  /* Composite icon: base image with svg overlay in bottom-left corner */
  .composite-icon {
    position: relative;
    width: 70%;
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .composite-icon .base {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .composite-icon .overlay {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 38%;
    height: 38%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
  }

  /* AI Slop card: thin-stroke node graph rotating over a morphing gradient blob.
     The graph rotates as a whole (so the connecting lines stay connected to
     their nodes), and each outer node also wiggles within a tiny orbit for an
     "alive" / data-flow feel. The blob behind uses theme-aware gradient
     colours so it adapts to flashbang/blackout themes. */
  /* Width comes from the parent .card-image, height from aspect-ratio — using
     percentage height instead breaks in browsers that don't resolve % height
     against an aspect-ratio'd parent (Safari, some Chromium configs), which
     was collapsing the wrap to 0 and hiding the SVG entirely. */
  .ai-slop-wrap {
    width: 78%;
    aspect-ratio: 1 / 1;
    position: relative;
    display: block;
  }
  .ai-slop-wrap::before {
    content: '';
    position: absolute;
    inset: 6%;
    background: radial-gradient(circle at 32% 28%, var(--accent) 0%, var(--accent-pale) 45%, transparent 75%);
    filter: blur(14px);
    opacity: 0.55;
    border-radius: 50% 60% 45% 55% / 55% 45% 60% 50%;
    animation: ai-slop-blob 9s ease-in-out infinite;
    z-index: 0;
    pointer-events: none;
  }
  @keyframes ai-slop-blob {
    0%, 100% { border-radius: 50% 60% 45% 55% / 55% 45% 60% 50%; transform: scale(1) rotate(0deg); }
    33%      { border-radius: 65% 40% 55% 45% / 45% 60% 40% 60%; transform: scale(1.06) rotate(45deg); }
    66%      { border-radius: 45% 55% 65% 40% / 60% 50% 45% 55%; transform: scale(0.96) rotate(-30deg); }
  }
  .ai-slop-svg {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
    animation: ai-slop-spin 16s linear infinite;
    overflow: visible;
  }
  @keyframes ai-slop-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .ai-slop-svg .ln {
    stroke: var(--accent-light);
    stroke-width: 1.2;
    fill: none;
    opacity: 0.55;
  }
  .ai-slop-svg .node {
    stroke: var(--accent-light);
    stroke-width: 1.4;
    fill: var(--ink-900);
  }
  .ai-slop-svg .core {
    fill: var(--accent-light);
    stroke: var(--accent);
    stroke-width: 1.2;
    animation: ai-slop-pulse 2.4s ease-in-out infinite;
  }
  @keyframes ai-slop-pulse {
    0%, 100% { r: 4.6; opacity: 0.9; }
    50%      { r: 5.6; opacity: 1; }
  }
  /* Per-node orbit wiggle — each node has a different phase + path so they
     drift independently. transform-origin uses the node centre so the
     rotation pivots locally. */
  .ai-slop-svg .n1 { transform-origin: 34.52px 11.43px; animation: ai-slop-orbit-a 3.6s ease-in-out infinite; }
  .ai-slop-svg .n2 { transform-origin: 53.63px 31.6px;  animation: ai-slop-orbit-b 4.2s ease-in-out infinite; }
  .ai-slop-svg .n3 { transform-origin: 34.52px 50.57px; animation: ai-slop-orbit-a 3.9s ease-in-out infinite reverse; }
  .ai-slop-svg .n4 { transform-origin: 15.16px 42.03px; animation: ai-slop-orbit-b 4.5s ease-in-out infinite reverse; }
  .ai-slop-svg .n5 { transform-origin: 15.16px 19.27px; animation: ai-slop-orbit-a 4.1s ease-in-out infinite; }
  @keyframes ai-slop-orbit-a {
    0%, 100% { transform: translate(0, 0); }
    25%      { transform: translate(2.4px, -1.6px); }
    50%      { transform: translate(0, -2.6px); }
    75%      { transform: translate(-2.4px, -1.6px); }
  }
  @keyframes ai-slop-orbit-b {
    0%, 100% { transform: translate(0, 0); }
    25%      { transform: translate(-2px, 1.8px); }
    50%      { transform: translate(0, 2.8px); }
    75%      { transform: translate(2px, 1.8px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-slop-svg,
    .ai-slop-svg .core,
    .ai-slop-svg .n1, .ai-slop-svg .n2, .ai-slop-svg .n3, .ai-slop-svg .n4, .ai-slop-svg .n5,
    .ai-slop-wrap::before { animation: none; }
  }

  /* Mini spinning coin for the flip card */
  .mini-coin-wrap {
    width: 120px;
    height: 120px;
    perspective: 400px;
  }
  .mini-coin {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    animation: mini-spin 5s linear infinite;
  }
  @keyframes mini-spin {
    from { transform: rotateY(0deg); }
    to   { transform: rotateY(360deg); }
  }
  .mini-face {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: bold;
    backface-visibility: hidden;
    border: 5px solid var(--accent);
    box-shadow: 0 0 16px var(--glow-bright);
    background: var(--ink-800);
    color: var(--accent-light);
  }
  .mini-face.tails {
    transform: rotateY(180deg);
  }

</style>
`);

const ICON_GRID_3 = raw('<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>');
const ICON_GRID_4 = raw('<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3"  y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="13" y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="18" y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="13" y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="18" y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="13" width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="13" width="3.5" height="3.5" rx="0.6"/><rect x="13" y="13" width="3.5" height="3.5" rx="0.6"/><rect x="18" y="13" width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="18" width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="18" width="3.5" height="3.5" rx="0.6"/><rect x="13" y="18" width="3.5" height="3.5" rx="0.6"/><rect x="18" y="18" width="3.5" height="3.5" rx="0.6"/></svg>');
const ICON_LIST = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="0.6" fill="currentColor"/><circle cx="4.5" cy="12" r="0.6" fill="currentColor"/><circle cx="4.5" cy="18" r="0.6" fill="currentColor"/></svg>');
const ICON_CHEVRON = raw('<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');

function CoinImage() {
  return html`
    <div class="mini-coin-wrap">
      <div class="mini-coin">
        <div class="mini-face">Silver</div>
        <div class="mini-face tails">Wolf</div>
      </div>
    </div>
  `;
}

// AI Slop card thumbnail — see the .ai-slop-* CSS block above. Strokes use
// var(--accent-light), the blob behind uses var(--accent) / var(--accent-pale)
// gradient, so the whole thing adapts to dark/flashbang/blackout themes.
function AiSlopImage() {
  return raw(`
    <div class="ai-slop-wrap" aria-hidden="true">
      <svg class="ai-slop-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
        <line class="ln" x1="20.17" y1="16.3"  x2="28.9"  y2="12.93" />
        <line class="ln" x1="38.6"  y1="15.59" x2="49.48" y2="27.52" />
        <line class="ln" x1="50.07" y1="36.2"  x2="38.67" y2="46.49" />
        <line class="ln" x1="18.36" y1="24.13" x2="30.91" y2="46.01" />
        <line class="ln" x1="20.31" y1="44.74" x2="28.7"  y2="48.63" />
        <line class="ln" x1="17.34" y1="36.63" x2="31.37" y2="16.32" />
        <line class="ln" x1="20.52" y1="21.55" x2="30.34" y2="27.1"  />
        <line class="ln" x1="39.22" y1="29.8"  x2="47.81" y2="30.45" />
        <line class="ln" x1="34.51" y1="33.98" x2="34.52" y2="44.74" />
        <circle class="node n1" cx="34.52" cy="11.43" r="5.4" />
        <circle class="node n2" cx="53.63" cy="31.6"  r="5.4" />
        <circle class="node n3" cx="34.52" cy="50.57" r="5.4" />
        <circle class="node n4" cx="15.16" cy="42.03" r="5.4" />
        <circle class="node n5" cx="15.16" cy="19.27" r="5.4" />
        <circle class="core"     cx="34.51" cy="29.27" r="4.6" />
      </svg>
    </div>
  `);
}

const layoutScript = (nonce: string) => raw(`
<script nonce="${nonce}">
(function(){
  var KEY = 'games-layout';
  var VALID = ['grid-3', 'grid-4', 'list-view'];
  var grid = document.querySelector('.games-grid');
  var switcher = document.querySelector('.layout-switcher');
  if (!grid || !switcher) return;
  var btn = switcher.querySelector('.layout-switcher-btn');
  var menu = switcher.querySelector('.layout-switcher-menu');
  var btnIcon = btn.querySelector('.btn-icon');
  var btnLabel = btn.querySelector('.btn-label');
  var options = menu.querySelectorAll('button[data-layout]');

  function apply(layout) {
    grid.classList.remove('grid-3', 'grid-4', 'list-view');
    if (layout !== 'grid-3') grid.classList.add(layout);
    options.forEach(function(o) {
      o.classList.toggle('active', o.dataset.layout === layout);
    });
    var active = menu.querySelector('button[data-layout="' + layout + '"]');
    if (active && btnIcon && btnLabel) {
      var srcIcon = active.querySelector('svg');
      var srcLabel = active.querySelector('.label');
      if (srcIcon) btnIcon.innerHTML = srcIcon.outerHTML;
      if (srcLabel) btnLabel.textContent = srcLabel.textContent;
    }
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (VALID.indexOf(saved) === -1) saved = 'grid-3';
  apply(saved);

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    switcher.classList.toggle('open');
  });
  options.forEach(function(o) {
    o.addEventListener('click', function() {
      var layout = o.dataset.layout;
      try { localStorage.setItem(KEY, layout); } catch (e) {}
      apply(layout);
      switcher.classList.remove('open');
    });
  });
  document.addEventListener('click', function(e) {
    if (!switcher.contains(e.target)) switcher.classList.remove('open');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') switcher.classList.remove('open');
  });
})();
</script>
`);

export function GamesPage(opts: { nonce: string; lv999?: boolean; user?: import('../components/navbar').NavUser | null }) {
  const body = html`
    ${styles}
    <div class="games-header">
      <h1 class="text-center">Games</h1>
      <p class="text-center text-fog-300">Choose a game to play!</p>
      <div class="layout-switcher">
        <button class="layout-switcher-btn" type="button" aria-haspopup="true" aria-label="Change layout">
          <span class="btn-icon">${ICON_GRID_3}</span>
          <span class="btn-label">Grid 3×3</span>
          ${ICON_CHEVRON}
        </button>
        <div class="layout-switcher-menu" role="menu">
          <button type="button" data-layout="grid-3" role="menuitem">
            ${ICON_GRID_3}<span class="label">Grid 3×3</span>
          </button>
          <button type="button" data-layout="grid-4" role="menuitem">
            ${ICON_GRID_4}<span class="label">Grid 4×4</span>
          </button>
          <button type="button" data-layout="list-view" role="menuitem">
            ${ICON_LIST}<span class="label">List</span>
          </button>
        </div>
      </div>
    </div>
    <div class="games-grid">
      ${GAMES.map(
    (game) => html`
          <a href="${game.href}" class="game-card">
            <div class="card-image">
              ${(() => {
    if (game.imageType === 'coin') return CoinImage();
    if (game.imageType === 'ai-slop') return AiSlopImage();
    if (game.imageType === 'composite') {
      return html`<div class="composite-icon">
              <img class="base" src="${(game as any).imageSrc}" alt="${game.name}" />
              <img class="overlay" src="${(game as any).overlaySrc}" alt="" />
            </div>`;
    }
    return html`<img src="${(game as any).imageSrc}" alt="${game.name}" />`;
  })()}
            </div>
            <div class="card-body">
              <h2>${game.name}</h2>
              <p>${game.info}</p>
            </div>
          </a>
        `,
  )}
    </div>
    ${layoutScript(opts.nonce)}
  `;

  return Layout({
    title: 'Silverwolf — Games',
    active: 'games',
    body: body as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}
