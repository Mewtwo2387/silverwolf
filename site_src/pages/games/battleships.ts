import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

export function BattleshipsPage(opts: { nonce: string; lv999?: boolean; user?: import('../../components/navbar').NavUser | null }) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .bs-wrap {
    max-width: 1100px;
    margin: 1.5rem auto 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Shared panel look (matches other game pages) ───────────── */
  .bs-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    padding: 1.25rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .bs-subtitle {
    text-align: center;
    color: var(--fog-300);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0 0 1.25rem;
    font-family: 'JetBrains Mono', monospace;
  }

  /* ── Settings screen ────────────────────────────────────────── */
  .bs-settings { max-width: 560px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .bs-field { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
  .bs-field > label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--fog-400);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'JetBrains Mono', monospace;
  }
  .bs-range-row { min-width: 0; }
  .bs-range {
    display: block;
    /* Inset the track by the thumb radius (8px) so the thumb's 4 stops land
       exactly on the centres of the 4 equal-width tick columns below. */
    width: calc(75% + 16px);
    margin: 0 calc(12.5% - 8px);
    height: 6px;
    background: var(--ink-600);
    border-radius: 999px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    outline: none;
  }
  .bs-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .bs-range::-moz-range-thumb {
    width: 16px; height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .bs-diff-val {
    font-size: 1.3rem;
    font-weight: 800;
    text-align: center;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 0.7rem;
  }
  .bs-diff-ticks {
    display: flex;
    font-size: 0.6rem;
    color: var(--fog-400);
    font-family: 'JetBrains Mono', monospace;
    margin-top: 0.4rem;
  }
  .bs-diff-ticks span { flex: 1 1 0; text-align: center; transition: color 0.15s; }
  .bs-diff-ticks span.active { color: var(--accent-light); font-weight: 700; }
  .bs-diff-desc {
    margin-top: 0.9rem;
    text-align: center;
    color: var(--fog-300);
    font-size: 0.8rem;
    min-height: 1.2rem;
  }

  .bs-btn {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent-pale) 10%, transparent));
    color: var(--accent-light);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 0.6rem 1.4rem;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, color 0.15s, opacity 0.15s;
  }
  .bs-btn:hover:not([disabled]) { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .bs-btn:active:not([disabled]) { transform: translateY(1px); }
  .bs-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .bs-btn-row { display: flex; justify-content: center; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }

  .bs-status {
    text-align: center;
    font-size: 1.2rem;
    font-weight: 600;
    min-height: 1.8rem;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    transition: color 0.2s;
  }
  .bs-status.thinking { color: var(--danger); }
  .bs-status.win  { font-size: 1.7rem; font-weight: 800; color: #4ade80; }
  .bs-status.lose { font-size: 1.7rem; font-weight: 800; color: var(--danger); }

  /* ── Arena layout: foe-status | boards | fleet tray ─────────── */
  .bs-arena {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr) 220px;
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 940px) {
    /* Boards on top (full width); the two panels share a half/half row below. */
    .bs-arena {
      grid-template-columns: 1fr 1fr;
      grid-template-areas: "board board" "foe tray";
    }
    .bs-boards { grid-area: board; }
    .bs-side { grid-area: foe; }
    .bs-tray-panel { grid-area: tray; }
  }

  .bs-side, .bs-tray-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    padding: 0.9rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .bs-side { border-color: color-mix(in oklab, var(--danger) 22%, var(--ink-600)); }
  .bs-side-title, .bs-tray-title {
    text-align: center;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0 0 0.6rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .bs-side-title { color: var(--danger); }
  .bs-tray-title { color: var(--fog-300); }

  /* Foe fleet status list (left) — only shows alive / downed */
  .bs-foe-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .bs-foe-ship {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent);
    border: 1px solid var(--ink-600);
    transition: opacity 0.3s, filter 0.3s;
  }
  .bs-foe-ship .bs-foe-icon { flex: 0 0 auto; color: var(--fog-200); display: flex; }
  .bs-foe-ship .bs-foe-meta { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  .bs-foe-ship .bs-foe-name {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--fog-100);
    font-family: 'JetBrains Mono', monospace;
  }
  .bs-foe-ship .bs-foe-len { font-size: 0.6rem; color: var(--fog-400); font-family: 'JetBrains Mono', monospace; }
  .bs-foe-ship.downed {
    opacity: 0.4;
    filter: grayscale(1);
  }
  .bs-foe-ship.downed .bs-foe-name { text-decoration: line-through; color: var(--danger); }

  /* ── Boards ─────────────────────────────────────────────────── */
  .bs-boards { display: flex; flex-direction: column; gap: 1rem; }
  .bs-board-block { display: flex; flex-direction: column; gap: 0.4rem; }
  .bs-board-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--fog-400);
    font-family: 'JetBrains Mono', monospace;
    display: flex; justify-content: space-between; align-items: center;
  }
  .bs-board-label .bs-radar-tag { color: var(--accent-light); }
  .bs-board-label .bs-home-tag { color: #4ade80; }

  .bs-board-shell {
    display: flex;
    justify-content: center;
    padding: 0.75rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 12%, var(--ink-600));
    border-radius: 0.8rem;
    overflow: auto;
  }
  .bs-grid {
    display: grid;
    gap: 3px;
    background: var(--ink-600);
    padding: 3px;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent);
    touch-action: none;
    position: relative;
  }
  .bs-cell {
    background: var(--ink-900);
    width: 32px; height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    position: relative;
    user-select: none;
    transition: background 0.12s, box-shadow 0.12s;
    font-family: 'JetBrains Mono', monospace;
  }
  /* radar (opponent) cells are clickable to fire */
  .bs-grid.radar .bs-cell { cursor: crosshair; }
  .bs-grid.radar.locked .bs-cell { cursor: default; }
  .bs-grid.radar .bs-cell:hover { background: color-mix(in oklab, var(--accent) 22%, var(--ink-900)); }
  .bs-grid.radar.locked .bs-cell:hover { background: var(--ink-900); }

  /* ship segment on the home board */
  .bs-cell.ship {
    background: color-mix(in oklab, #5b6c7d 70%, var(--ink-900));
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fog-200) 40%, transparent);
  }
  .bs-cell.ship.placing { cursor: grab; }
  .bs-cell.ship.placing:active { cursor: grabbing; }

  /* shot results */
  .bs-cell.hit::after,
  .bs-cell.miss::after {
    content: '';
    position: absolute;
    border-radius: 50%;
  }
  .bs-cell.miss::after {
    width: 9px; height: 9px;
    background: color-mix(in oklab, var(--fog-300) 60%, transparent);
    box-shadow: 0 0 6px rgba(255,255,255,0.15);
  }
  .bs-cell.hit::after {
    width: 14px; height: 14px;
    background: radial-gradient(circle at 35% 35%, #ff8a5b, var(--danger));
    box-shadow: 0 0 12px var(--danger-glow);
  }
  .bs-cell.hit { background: color-mix(in oklab, var(--danger) 22%, var(--ink-900)); }
  .bs-cell.sunk {
    background: color-mix(in oklab, var(--danger) 45%, var(--ink-900)) !important;
    box-shadow: inset 0 0 0 1px var(--danger);
  }

  /* placement preview highlights */
  .bs-cell.preview-ok  { background: color-mix(in oklab, #16a34a 60%, var(--ink-900)); box-shadow: inset 0 0 0 2px #4ade80; }
  .bs-cell.preview-bad { background: color-mix(in oklab, var(--danger) 55%, var(--ink-900)); box-shadow: inset 0 0 0 2px var(--danger); }

  /* ── Fleet tray (right) ─────────────────────────────────────── */
  .bs-tray { display: flex; flex-direction: column; gap: 0.7rem; }
  .bs-tray-hint {
    font-size: 0.62rem;
    color: var(--fog-400);
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.4;
    font-style: italic;
    margin-bottom: 0.2rem;
  }
  .bs-tray-ship {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent);
    border: 1px solid var(--ink-600);
    cursor: grab;
    transition: border-color 0.15s, box-shadow 0.15s, opacity 0.2s, transform 0.1s;
    touch-action: none;
  }
  .bs-tray-ship:hover { border-color: var(--accent); box-shadow: 0 0 10px var(--glow-faint); }
  .bs-tray-ship.dragging { opacity: 0.5; }
  .bs-tray-ship.placed { opacity: 0.55; filter: grayscale(0.35); }
  .bs-tray-ship.placed:hover { opacity: 0.9; }
  .bs-tray-ship-name {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    display: flex; justify-content: space-between; gap: 0.4rem;
  }
  .bs-tray-ship-name .bs-placed-tag { color: var(--accent-light); font-size: 0.6rem; }
  .bs-hull-code { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.05em; }
  .bs-tray-shape { display: flex; }

  /* hull-class code rendered on each occupied home cell */
  .bs-cell-label {
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    opacity: 0.9;
    pointer-events: none;
    z-index: 1;
  }
  .bs-cell.hit .bs-cell-label, .bs-cell.miss .bs-cell-label { opacity: 0.25; }

  .bs-drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.85;
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
  }

  .bs-hidden { display: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .bs-cell, .bs-foe-ship, .bs-tray-ship { transition: none; }
  }
</style>
<script nonce="${nonce}">
(() => {
  'use strict';
  const SIZE = 10;
  // Classic fleet. id is stable; svg is a top-down silhouette scaled to length.
  const FLEET = [
    { id: 'carrier',   name: 'Carrier',    len: 5 },
    { id: 'battleship',name: 'Battleship', len: 4 },
    { id: 'cruiser',   name: 'Cruiser',    len: 3 },
    { id: 'submarine', name: 'Submarine',  len: 3 },
    { id: 'destroyer', name: 'Destroyer',  len: 2 },
  ];
  const DIFFS = ['easy', 'medium', 'hard', 'impossible'];
  const DIFF_DESC = {
    easy: 'Fires at random. A relaxed cruise.',
    medium: 'Chases your ships once it lands a hit.',
    hard: 'Hunts efficiently with a checkerboard search.',
    impossible: 'Targets the statistically most likely cell every shot.',
  };

  // Per-ship identity: silhouette type, accent colour and hull-class code.
  const SHIP_META = {
    carrier:    { color: '#d4a84a', code: 'CV', kind: 'carrier' },
    battleship: { color: '#6ea8fe', code: 'BB', kind: 'warship' },
    cruiser:    { color: '#c084fc', code: 'CA', kind: 'warship' },
    submarine:  { color: '#2dd4bf', code: 'SS', kind: 'submarine' },
    destroyer:  { color: '#f472b6', code: 'DD', kind: 'warship' },
  };

  // Draw a SIDE-PROFILE ship silhouette spanning a length-by-1 footprint.
  // Drawn horizontally (bow to the right); rotated 90° for the vertical case.
  function shipSVG(type, len, cell, horizontal) {
    const L = len * cell, C = cell;
    const sw = Math.max(1, C * 0.05);
    const fill = '#9fb0c0', stroke = '#2b3a4a', dark = '#6b7785', accent = '#c9d3dc';
    const kind = (SHIP_META[type] && SHIP_META[type].kind) || 'warship';
    const base = C * 0.82;     // waterline
    const deck = C * 0.5;      // main deck height
    let inner = '';

    if (kind === 'submarine') {
      inner += '<rect x="' + (C * 0.12) + '" y="' + (C * 0.48) + '" rx="' + (C * 0.26) + '" ry="' + (C * 0.26) +
        '" width="' + (L - C * 0.24) + '" height="' + (C * 0.34) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<path d="M ' + (L * 0.42) + ' ' + (C * 0.5) + ' L ' + (L * 0.45) + ' ' + (C * 0.26) +
        ' L ' + (L * 0.57) + ' ' + (C * 0.26) + ' L ' + (L * 0.6) + ' ' + (C * 0.5) +
        ' Z" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<line x1="' + (L * 0.51) + '" y1="' + (C * 0.26) + '" x2="' + (L * 0.51) + '" y2="' + (C * 0.1) +
        '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else if (kind === 'carrier') {
      // hull
      inner += '<path d="M ' + (C * 0.06) + ' ' + deck + ' L ' + (L - C * 0.06) + ' ' + deck +
        ' L ' + (L - C * 0.28) + ' ' + base + ' L ' + (C * 0.22) + ' ' + base + ' Z" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      // flat flight deck
      inner += '<rect x="' + (C * 0.04) + '" y="' + (C * 0.4) + '" width="' + (L - C * 0.08) + '" height="' + (C * 0.12) +
        '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      // island
      inner += '<rect x="' + (L * 0.66) + '" y="' + (C * 0.22) + '" width="' + (C * 0.5) + '" height="' + (C * 0.2) +
        '" fill="' + accent + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else {
      // generic warship: hull with raised bow at right + superstructure, funnel, turrets, mast
      inner += '<path d="M ' + (C * 0.06) + ' ' + deck +
        ' L ' + (L - C * 0.55) + ' ' + deck +
        ' L ' + (L - C * 0.06) + ' ' + (deck - C * 0.2) +
        ' L ' + (L - C * 0.06) + ' ' + deck +
        ' L ' + (L - C * 0.3) + ' ' + base +
        ' L ' + (C * 0.2) + ' ' + base + ' Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (L * 0.4) + '" y="' + (C * 0.28) + '" width="' + (L * 0.16) + '" height="' + (deck - C * 0.28) +
        '" fill="' + accent + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (L * 0.6) + '" y="' + (C * 0.34) + '" width="' + (C * 0.32) + '" height="' + (deck - C * 0.34) +
        '" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (C * 0.26) + '" y="' + (deck - C * 0.13) + '" width="' + (C * 0.42) + '" height="' + (C * 0.13) + '" fill="' + dark + '"/>';
      inner += '<rect x="' + (L - C * 0.95) + '" y="' + (deck - C * 0.13) + '" width="' + (C * 0.42) + '" height="' + (C * 0.13) + '" fill="' + dark + '"/>';
      inner += '<line x1="' + (L * 0.48) + '" y1="' + (C * 0.28) + '" x2="' + (L * 0.48) + '" y2="' + (C * 0.08) +
        '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }

    if (horizontal) {
      return '<svg class="bs-tray-shape-svg" width="' + L + '" height="' + C + '" viewBox="0 0 ' + L + ' ' + C + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
    }
    // vertical: rotate the same drawing 90° about its own centre
    return '<svg class="bs-tray-shape-svg" width="' + C + '" height="' + L + '" viewBox="0 0 ' + C + ' ' + L + '" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="rotate(90 ' + (C * 0.5) + ' ' + (C * 0.5) + ') translate(0 ' + (C * 0.5 - L * 0.5) + ')">' + inner + '</g></svg>';
  }

  // ── State ─────────────────────────────────────────────────────
  let difficulty = 'medium';
  let phase = 'settings';        // 'settings' | 'placing' | 'playing' | 'over'
  let playerBoard = [];          // SIZE*SIZE: null or shipId
  let aiBoard = [];              // SIZE*SIZE: null or shipId
  let playerShots = [];          // shots WE fired onto aiBoard: 'hit' | 'miss' | undefined
  let aiShots = [];              // shots AI fired onto playerBoard
  let placements = {};           // shipId -> { cells:[], orient:'h'|'v', anchor }
  let busy = false;

  // AI targeting memory
  let aiQueue = [];              // candidate indices to try next (target mode)
  let aiHitsOnPlayer = [];       // indices currently hit but not part of a sunk ship

  // ── DOM ───────────────────────────────────────────────────────
  const settingsEl = document.getElementById('bs-settings');
  const arenaEl    = document.getElementById('bs-arena');
  const diffRange  = document.getElementById('bs-diff');
  const diffVal    = document.getElementById('bs-diff-val');
  const diffDesc   = document.getElementById('bs-diff-desc');
  const diffTicks  = document.getElementById('bs-diff-ticks');
  const startBtn   = document.getElementById('bs-start');
  const statusEl   = document.getElementById('bs-status');
  const radarGrid  = document.getElementById('bs-radar');
  const homeGrid   = document.getElementById('bs-home');
  const trayEl     = document.getElementById('bs-tray');
  const foeListEl  = document.getElementById('bs-foe-list');
  const fireBtnRow = document.getElementById('bs-game-controls');
  const startBattleBtn = document.getElementById('bs-start-battle');
  const randomBtn  = document.getElementById('bs-random');
  const newGameBtn = document.getElementById('bs-newgame');
  let radarCells = [];
  let homeCells = [];

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'bs-status' + (cls ? ' ' + cls : '');
  }

  const idx = (r, c) => r * SIZE + c;
  const rowOf = (i) => Math.floor(i / SIZE);
  const colOf = (i) => i % SIZE;

  // cells a ship would occupy from an anchor, given orientation & length
  function shipCells(anchor, orient, len) {
    const r = rowOf(anchor), c = colOf(anchor);
    const cells = [];
    for (let k = 0; k < len; k++) {
      const rr = orient === 'v' ? r + k : r;
      const cc = orient === 'h' ? c + k : c;
      if (rr >= SIZE || cc >= SIZE) return null;   // out of bounds
      cells.push(idx(rr, cc));
    }
    return cells;
  }

  // valid if in-bounds and none of the cells overlap another ship (excluding self)
  function placementValid(cells, board, ignoreId) {
    if (!cells) return false;
    for (const ci of cells) {
      const occ = board[ci];
      if (occ && occ !== ignoreId) return false;
    }
    return true;
  }

  // ── Build grids ───────────────────────────────────────────────
  function buildGrid(gridEl, cellArr, isRadar) {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = 'repeat(' + SIZE + ', 32px)';
    cellArr.length = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'bs-cell';
      cell.dataset.i = i;
      if (isRadar) cell.addEventListener('click', () => onRadarClick(i));
      gridEl.appendChild(cell);
      cellArr.push(cell);
    }
  }

  // ── Settings ──────────────────────────────────────────────────
  function syncDiff() {
    const di = parseInt(diffRange.value, 10);
    difficulty = DIFFS[di] || 'medium';
    diffVal.textContent = difficulty;
    diffDesc.textContent = DIFF_DESC[difficulty];
    if (diffTicks) {
      for (const tick of diffTicks.querySelectorAll('span')) {
        tick.classList.toggle('active', parseInt(tick.dataset.d, 10) === di);
      }
    }
  }
  diffRange.addEventListener('input', syncDiff);
  startBtn.addEventListener('click', startPlacement);
  randomBtn.addEventListener('click', randomizePlayerFleet);
  startBattleBtn.addEventListener('click', beginBattle);
  newGameBtn.addEventListener('click', backToSettings);

  function backToSettings() {
    phase = 'settings';
    settingsEl.classList.remove('bs-hidden');
    arenaEl.classList.add('bs-hidden');
    fireBtnRow.classList.add('bs-hidden');
    setStatus('');
  }

  // ── Placement phase ───────────────────────────────────────────
  function startPlacement() {
    syncDiff();
    phase = 'placing';
    playerBoard = new Array(SIZE * SIZE).fill(null);
    aiBoard = new Array(SIZE * SIZE).fill(null);
    playerShots = new Array(SIZE * SIZE).fill(undefined);
    aiShots = new Array(SIZE * SIZE).fill(undefined);
    placements = {};
    aiQueue = [];
    aiHitsOnPlayer = [];
    busy = false;

    settingsEl.classList.add('bs-hidden');
    arenaEl.classList.remove('bs-hidden');
    fireBtnRow.classList.remove('bs-hidden');

    buildGrid(radarGrid, radarCells, true);
    buildGrid(homeGrid, homeCells, false);
    radarGrid.classList.add('locked');           // no firing until battle starts

    placeAIFleet();
    buildTray();
    buildFoeList();
    paintHome();
    updateStartBattle();
    setStatus('Deploy your fleet — drag ships onto the lower grid. Drag to move, tap to rotate.');
  }

  function updateStartBattle() {
    const allPlaced = FLEET.every((s) => placements[s.id]);
    startBattleBtn.disabled = !allPlaced;
    startBattleBtn.classList.toggle('bs-hidden', phase !== 'placing');
    randomBtn.classList.toggle('bs-hidden', phase !== 'placing');
    newGameBtn.classList.toggle('bs-hidden', phase === 'placing');
  }

  // ── AI fleet placement (random, non-overlapping) ──────────────
  function placeFleetOn(board) {
    for (const ci in board) board[ci] = null;
    for (const ship of FLEET) {
      let placed = false, guard = 0;
      while (!placed && guard++ < 500) {
        const orient = Math.random() < 0.5 ? 'h' : 'v';
        const anchor = Math.floor(Math.random() * SIZE * SIZE);
        const cells = shipCells(anchor, orient, ship.len);
        if (placementValid(cells, board, null)) {
          for (const ci of cells) board[ci] = ship.id;
          placed = true;
        }
      }
    }
  }
  function placeAIFleet() { placeFleetOn(aiBoard); }

  function randomizePlayerFleet() {
    if (phase !== 'placing') return;
    placeFleetOn(playerBoard);
    placements = {};
    // recover placement metadata from the board
    for (const ship of FLEET) {
      const cells = [];
      for (let i = 0; i < playerBoard.length; i++) if (playerBoard[i] === ship.id) cells.push(i);
      cells.sort((a, b) => a - b);
      const orient = (cells.length > 1 && cells[1] === cells[0] + 1) ? 'h' : 'v';
      placements[ship.id] = { cells, orient, anchor: cells[0] };
    }
    buildTray();
    paintHome();
    updateStartBattle();
  }

  // ── Tray ──────────────────────────────────────────────────────
  function buildTray() {
    trayEl.innerHTML = '';
    for (const ship of FLEET) {
      const placed = !!placements[ship.id];
      const orient = placed ? placements[ship.id].orient : 'h';
      const item = document.createElement('div');
      item.className = 'bs-tray-ship' + (placed ? ' placed' : '');
      item.dataset.ship = ship.id;
      const nm = document.createElement('div');
      nm.className = 'bs-tray-ship-name';
      nm.innerHTML = '<span>' + ship.name + ' <span class="bs-hull-code" style="color:' + SHIP_META[ship.id].color + '">' + SHIP_META[ship.id].code + '</span></span>' +
        (placed ? '<span class="bs-placed-tag">recall ⤺</span>' : '<span>' + ship.len + '×1</span>');
      const shape = document.createElement('div');
      shape.className = 'bs-tray-shape';
      shape.innerHTML = shipSVG(ship.id, ship.len, 22, true);
      item.appendChild(nm);
      item.appendChild(shape);
      attachTrayDrag(item, ship, placed);
      trayEl.appendChild(item);
    }
  }

  // ── Foe status list (left) ────────────────────────────────────
  function buildFoeList() {
    foeListEl.innerHTML = '';
    for (const ship of FLEET) {
      const row = document.createElement('div');
      row.className = 'bs-foe-ship';
      row.dataset.ship = ship.id;
      const ic = document.createElement('span');
      ic.className = 'bs-foe-icon';
      ic.innerHTML = shipSVG(ship.id, ship.len, 13, true);
      const meta = document.createElement('div');
      meta.className = 'bs-foe-meta';
      meta.innerHTML = '<span class="bs-foe-name">' + ship.name + '</span>' +
        '<span class="bs-foe-len">' + ship.len + ' cells</span>';
      row.appendChild(ic);
      row.appendChild(meta);
      foeListEl.appendChild(row);
    }
  }

  function markFoeDowned(shipId) {
    const row = foeListEl.querySelector('[data-ship="' + shipId + '"]');
    if (row) row.classList.add('downed');
  }

  // ── Painting ──────────────────────────────────────────────────
  function paintHome() {
    for (let i = 0; i < homeCells.length; i++) {
      const cell = homeCells[i];
      cell.className = 'bs-cell';
      cell.innerHTML = '';
      cell.style.outline = '';
      const shipId = playerBoard[i];
      if (shipId) {
        const meta = SHIP_META[shipId];
        cell.classList.add('ship');
        if (phase === 'placing') cell.classList.add('placing');
        // distinct coloured outline + hull-class code so adjacent ships read apart
        cell.style.outline = '2px solid ' + meta.color;
        cell.style.outlineOffset = '-2px';
        const lab = document.createElement('span');
        lab.className = 'bs-cell-label';
        lab.textContent = meta.code;
        lab.style.color = meta.color;
        cell.appendChild(lab);
      }
      const shot = aiShots[i];
      if (shot === 'hit') cell.classList.add('hit');
      else if (shot === 'miss') cell.classList.add('miss');
    }
    // sunk styling for player ships
    if (phase === 'playing' || phase === 'over') {
      for (const ship of FLEET) {
        const cells = [];
        for (let i = 0; i < playerBoard.length; i++) if (playerBoard[i] === ship.id) cells.push(i);
        if (cells.length && cells.every((ci) => aiShots[ci] === 'hit')) {
          for (const ci of cells) homeCells[ci].classList.add('sunk');
        }
      }
    }
  }

  function paintRadar() {
    for (let i = 0; i < radarCells.length; i++) {
      const cell = radarCells[i];
      cell.className = 'bs-cell';
      const shot = playerShots[i];
      if (shot === 'hit') cell.classList.add('hit');
      else if (shot === 'miss') cell.classList.add('miss');
    }
    // sunk styling once a foe ship is fully revealed
    for (const ship of FLEET) {
      const cells = [];
      for (let i = 0; i < aiBoard.length; i++) if (aiBoard[i] === ship.id) cells.push(i);
      if (cells.length && cells.every((ci) => playerShots[ci] === 'hit')) {
        for (const ci of cells) radarCells[ci].classList.add('sunk');
      }
    }
  }

  // ── Drag & drop placement (pointer-based, works on touch) ─────
  let drag = null;   // { ship, orient, ghost, fromCells, moved }

  function attachTrayDrag(item, ship, placed) {
    item.addEventListener('pointerdown', (e) => {
      if (phase !== 'placing') return;
      e.preventDefault();
      const orient = placements[ship.id] ? placements[ship.id].orient : 'h';
      beginDrag(ship, orient, e, item, placed ? 'tray-placed' : 'tray');
    });
  }

  function beginDrag(ship, orient, e, sourceEl, origin) {
    drag = { ship, orient, moved: false, sourceEl, origin: origin || 'tray' };
    if (sourceEl) sourceEl.classList.add('dragging');
    const ghost = document.createElement('div');
    ghost.className = 'bs-drag-ghost';
    ghost.innerHTML = shipSVG(ship.id, ship.len, 32, orient === 'h');
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    moveGhost(e.clientX, e.clientY);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
  }

  function moveGhost(x, y) {
    if (drag && drag.ghost) { drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px'; }
  }

  function clearPreview() {
    for (const cell of homeCells) cell.classList.remove('preview-ok', 'preview-bad');
  }

  function cellUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el && el.classList.contains('bs-cell') && el.parentElement === homeGrid) {
      return parseInt(el.dataset.i, 10);
    }
    return -1;
  }

  function onDragMove(e) {
    if (!drag) return;
    drag.moved = true;
    moveGhost(e.clientX, e.clientY);
    clearPreview();
    const anchor = cellUnder(e.clientX, e.clientY);
    if (anchor < 0) return;
    const cells = shipCells(anchor, drag.orient, drag.ship.len);
    const ok = placementValid(cells, playerBoard, drag.ship.id);
    if (cells) {
      for (const ci of cells) homeCells[ci].classList.add(ok ? 'preview-ok' : 'preview-bad');
    } else {
      // partly out of bounds: flag the anchor red
      homeCells[anchor].classList.add('preview-bad');
    }
  }

  function onDragUp(e) {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    const d = drag;
    drag = null;
    clearPreview();
    if (d.ghost) d.ghost.remove();
    if (d.sourceEl) d.sourceEl.classList.remove('dragging');
    if (!d.moved) {
      // A tap (no drag): rotate a board ship, or recall a deployed ship from its tray card.
      if (d.origin === 'board') rotatePlaced(d.ship.id);
      else if (d.origin === 'tray-placed') {
        removePlacement(d.ship.id);
        buildTray();
        paintHome();
        updateStartBattle();
        setStatus('Recalled the ' + d.ship.name + ' — drag it back out when ready.');
      }
      return;
    }
    const anchor = cellUnder(e.clientX, e.clientY);
    if (anchor < 0) return;
    const cells = shipCells(anchor, d.orient, d.ship.len);
    if (!placementValid(cells, playerBoard, d.ship.id)) return;
    // commit: remove any previous placement of this ship, then set
    removePlacement(d.ship.id);
    for (const ci of cells) playerBoard[ci] = d.ship.id;
    placements[d.ship.id] = { cells, orient: d.orient, anchor };
    buildTray();
    paintHome();
    updateStartBattle();
    setStatus(allPlaced() ? 'Fleet ready — press Start Battle.' : 'Deploy your fleet — drag ships onto the lower grid.');
  }

  function removePlacement(shipId) {
    if (!placements[shipId]) return;
    for (const ci of placements[shipId].cells) if (playerBoard[ci] === shipId) playerBoard[ci] = null;
    delete placements[shipId];
  }

  function allPlaced() { return FLEET.every((s) => placements[s.id]); }

  // Grab a placed ship straight off your board: drag to reposition, tap to rotate.
  homeGrid.addEventListener('pointerdown', (e) => {
    if (phase !== 'placing') return;
    const cell = e.target.closest('.bs-cell');
    if (!cell) return;
    const shipId = playerBoard[parseInt(cell.dataset.i, 10)];
    if (!shipId) return;
    e.preventDefault();
    const ship = FLEET.find((s) => s.id === shipId);
    beginDrag(ship, placements[shipId].orient, e, null, 'board');
  });

  // Rotate a placed ship about its CENTRE, nudging it sideways to fit if needed.
  function rotatePlaced(shipId) {
    const p = placements[shipId];
    if (!p) return;
    const ship = FLEET.find((s) => s.id === shipId);
    const len = ship.len;
    const sorted = p.cells.slice().sort((a, b) => a - b);
    const pivot = sorted[Math.floor(len / 2)];   // centre cell (upper-mid for even lengths)
    const off = Math.floor(len / 2);
    const newOrient = p.orient === 'h' ? 'v' : 'h';
    const baseR = rowOf(pivot) - (newOrient === 'v' ? off : 0);
    const baseC = colOf(pivot) - (newOrient === 'h' ? off : 0);
    // Try the centred anchor first, then shift both directions to find a fit.
    for (const shift of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = baseR + (newOrient === 'v' ? shift : 0);
      const c = baseC + (newOrient === 'h' ? shift : 0);
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
      const cells = shipCells(idx(r, c), newOrient, len);
      if (placementValid(cells, playerBoard, shipId)) {
        removePlacement(shipId);
        for (const ci of cells) playerBoard[ci] = shipId;
        placements[shipId] = { cells, orient: newOrient, anchor: idx(r, c) };
        buildTray();
        paintHome();
        return;
      }
    }
    setStatus('Can\\'t rotate there — no room.', 'thinking');
    setTimeout(() => { if (phase === 'placing') setStatus('Deploy your fleet — drag ships onto the lower grid.'); }, 1200);
  }

  // ── Battle ────────────────────────────────────────────────────
  function beginBattle() {
    if (!allPlaced()) return;
    phase = 'playing';
    radarGrid.classList.remove('locked');
    startBattleBtn.classList.add('bs-hidden');
    randomBtn.classList.add('bs-hidden');
    newGameBtn.classList.remove('bs-hidden');
    paintHome();   // drop the 'placing' affordance
    setStatus('Battle stations! Click the radar to fire.');
  }

  function onRadarClick(i) {
    if (phase !== 'playing' || busy) return;
    if (playerShots[i] !== undefined) return;    // already fired here
    const shipId = aiBoard[i];
    playerShots[i] = shipId ? 'hit' : 'miss';
    paintRadar();
    if (shipId && shipSunk(aiBoard, playerShots, shipId)) {
      markFoeDowned(shipId);
    }
    if (fleetSunk(aiBoard, playerShots)) {
      endGame(true);
      return;
    }
    setStatus(shipId ? 'Direct hit!' : 'Splash — a miss.');
    // AI's turn
    busy = true;
    setStatus(shipId ? 'Direct hit! Enemy returning fire…' : 'Miss. Enemy returning fire…', 'thinking');
    setTimeout(aiTurn, 650);
  }

  function shipSunk(board, shots, shipId) {
    for (let i = 0; i < board.length; i++) if (board[i] === shipId && shots[i] !== 'hit') return false;
    return true;
  }
  function fleetSunk(board, shots) {
    for (let i = 0; i < board.length; i++) if (board[i] && shots[i] !== 'hit') return false;
    return true;
  }

  // ── AI turn / targeting ───────────────────────────────────────
  function aiTurn() {
    if (phase !== 'playing') return;
    const target = pickAITarget();
    const shipId = playerBoard[target];
    aiShots[target] = shipId ? 'hit' : 'miss';

    if (shipId) {
      aiHitsOnPlayer.push(target);
      if (shipSunk(playerBoard, aiShots, shipId)) {
        // ship sunk: clear the working hit list & queue for that ship
        aiHitsOnPlayer = aiHitsOnPlayer.filter((ci) => playerBoard[ci] !== shipId);
        aiQueue = [];
      } else {
        enqueueNeighbours(target);
      }
    }
    paintHome();

    if (fleetSunk(playerBoard, aiShots)) { endGame(false); return; }

    busy = false;
    setStatus(shipId ? 'The enemy hit your fleet! Fire back.' : 'Enemy missed. Your move.');
  }

  function enqueueNeighbours(i) {
    const r = rowOf(i), c = colOf(i);
    const cand = [];
    // if we have 2+ collinear hits, prefer extending that line
    if (aiHitsOnPlayer.length >= 2) {
      const rows = new Set(aiHitsOnPlayer.map(rowOf));
      const cols = new Set(aiHitsOnPlayer.map(colOf));
      if (rows.size === 1) {
        const rr = rowOf(aiHitsOnPlayer[0]);
        const cs = aiHitsOnPlayer.map(colOf).sort((a, b) => a - b);
        cand.push(idx(rr, cs[0] - 1), idx(rr, cs[cs.length - 1] + 1));
      } else if (cols.size === 1) {
        const cc = colOf(aiHitsOnPlayer[0]);
        const rs = aiHitsOnPlayer.map(rowOf).sort((a, b) => a - b);
        cand.push(idx(rs[0] - 1, cc), idx(rs[rs.length - 1] + 1, cc));
      }
    }
    if (!cand.length) {
      cand.push(idx(r - 1, c), idx(r + 1, c), idx(r, c - 1), idx(r, c + 1));
    }
    for (const ci of cand) {
      if (ci < 0 || ci >= SIZE * SIZE) continue;
      // guard against row-wrap on horizontal neighbours
      const same = (Math.abs(rowOf(ci) - rowOf(i)) + Math.abs(colOf(ci) - colOf(i))) <= aiHitsOnPlayer.length + 1;
      if (!same) continue;
      if (aiShots[ci] === undefined && !aiQueue.includes(ci)) aiQueue.push(ci);
    }
  }

  function untried() {
    const a = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (aiShots[i] === undefined) a.push(i);
    return a;
  }

  function pickAITarget() {
    const free = untried();
    // target mode: consume queued neighbours first (all but easy)
    if (difficulty !== 'easy') {
      while (aiQueue.length) {
        const t = aiQueue.shift();
        if (aiShots[t] === undefined) return t;
      }
    }
    if (difficulty === 'impossible') return probabilityTarget(free);
    if (difficulty === 'hard') {
      // checkerboard hunt: only fire on parity cells while searching
      const parity = free.filter((i) => (rowOf(i) + colOf(i)) % 2 === 0);
      const pool = parity.length ? parity : free;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // easy & medium: random search
    return free[Math.floor(Math.random() * free.length)];
  }

  // Impossible: score each free cell by how many ways a remaining ship fits over it.
  function probabilityTarget(free) {
    const lens = remainingShipLengths();
    const heat = new Array(SIZE * SIZE).fill(0);
    for (const len of lens) {
      // horizontal & vertical placements that don't cross a known miss
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          // horizontal
          if (c + len <= SIZE) {
            let ok = true; const cells = [];
            for (let k = 0; k < len; k++) { const ci = idx(r, c + k); if (aiShots[ci] === 'miss') { ok = false; break; } cells.push(ci); }
            if (ok) { const w = cells.some((ci) => aiShots[ci] === 'hit') ? 6 : 1; for (const ci of cells) if (aiShots[ci] === undefined) heat[ci] += w; }
          }
          // vertical
          if (r + len <= SIZE) {
            let ok = true; const cells = [];
            for (let k = 0; k < len; k++) { const ci = idx(r + k, c); if (aiShots[ci] === 'miss') { ok = false; break; } cells.push(ci); }
            if (ok) { const w = cells.some((ci) => aiShots[ci] === 'hit') ? 6 : 1; for (const ci of cells) if (aiShots[ci] === undefined) heat[ci] += w; }
          }
        }
      }
    }
    let best = free[0], bestV = -1;
    for (const i of free) if (heat[i] > bestV) { bestV = heat[i]; best = i; }
    return best;
  }

  function remainingShipLengths() {
    return FLEET.filter((s) => !shipSunk(playerBoard, aiShots, s.id)).map((s) => s.len);
  }

  // ── End ───────────────────────────────────────────────────────
  function endGame(playerWon) {
    phase = 'over';
    busy = false;
    radarGrid.classList.add('locked');
    revealAIFleet();
    if (playerWon) setStatus('Victory — the enemy fleet is sunk! ⚓', 'win');
    else setStatus('Defeat — your fleet has been destroyed.', 'lose');
    updateStartBattle();
  }

  function revealAIFleet() {
    for (let i = 0; i < aiBoard.length; i++) {
      if (aiBoard[i] && playerShots[i] !== 'hit') radarCells[i].classList.add('ship');
    }
  }

  // ── Boot ──────────────────────────────────────────────────────
  buildGrid(radarGrid, radarCells, true);
  buildGrid(homeGrid, homeCells, false);
  syncDiff();
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Battleships</h1>
    <p class="text-center text-fog-300">Deploy your fleet and sink the AI before it sinks you.</p>

    <div class="bs-wrap">
      <!-- Settings screen -->
      <div id="bs-settings" class="bs-panel bs-settings">
        <p class="bs-subtitle">Prepare for battle</p>
        <div class="bs-field">
          <label for="bs-diff">AI Difficulty</label>
          <div class="bs-range-row">
            <input type="range" id="bs-diff" class="bs-range" min="0" max="3" step="1" value="1" aria-label="AI difficulty" />
          </div>
          <div id="bs-diff-ticks" class="bs-diff-ticks">
            <span data-d="0">Easy</span><span data-d="1">Medium</span><span data-d="2">Hard</span><span data-d="3">Impossible</span>
          </div>
          <div id="bs-diff-val" class="bs-diff-val">Medium</div>
          <p id="bs-diff-desc" class="bs-diff-desc"></p>
        </div>
        <div class="bs-btn-row">
          <button id="bs-start" class="bs-btn" type="button">Start Game</button>
        </div>
      </div>

      <!-- Status line -->
      <div id="bs-status" class="bs-status"></div>

      <!-- Arena -->
      <div id="bs-arena" class="bs-arena bs-hidden">
        <!-- Left: enemy fleet status -->
        <div class="bs-side" aria-label="Enemy fleet status">
          <p class="bs-side-title">Enemy Fleet</p>
          <div id="bs-foe-list" class="bs-foe-list"></div>
        </div>

        <!-- Middle: the two boards -->
        <div class="bs-boards">
          <div class="bs-board-block">
            <div class="bs-board-label"><span>Radar — Enemy Waters</span><span class="bs-radar-tag">fire here ⌖</span></div>
            <div class="bs-board-shell">
              <div id="bs-radar" class="bs-grid radar locked"></div>
            </div>
          </div>
          <div class="bs-board-block">
            <div class="bs-board-label"><span>Your Waters</span><span class="bs-home-tag">your fleet</span></div>
            <div class="bs-board-shell">
              <div id="bs-home" class="bs-grid"></div>
            </div>
          </div>
        </div>

        <!-- Right: fleet tray -->
        <div class="bs-tray-panel" aria-label="Your fleet">
          <p class="bs-tray-title">Your Fleet</p>
          <p class="bs-tray-hint">Drag each ship onto your waters (green = ok, red = no room). Drag a placed ship to move it, tap it to rotate, or click its card here to recall it.</p>
          <div id="bs-tray" class="bs-tray"></div>
        </div>
      </div>

      <!-- Game controls -->
      <div id="bs-game-controls" class="bs-btn-row bs-hidden">
        <button id="bs-random" class="bs-btn" type="button">Randomise</button>
        <button id="bs-start-battle" class="bs-btn" type="button" disabled>Start Battle</button>
        <button id="bs-newgame" class="bs-btn bs-hidden" type="button">New Game</button>
      </div>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Battleships',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
