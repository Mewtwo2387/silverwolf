import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

export function CyclicTicTacToePage(opts: { nonce: string; lv999?: boolean; user?: import('../../components/navbar').NavUser | null }) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .cyc-wrap {
    max-width: 760px;
    margin: 1.5rem auto 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Control panel — glassmorphic, matching the games-card aesthetic */
  .cyc-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    padding: 1.25rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .cyc-subtitle {
    text-align: center;
    color: var(--fog-300);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0 0 1.25rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    align-items: end;
  }
  @media (max-width: 620px) {
    .cyc-controls { grid-template-columns: 1fr; }
  }
  .cyc-reset-row {
    display: flex;
    justify-content: center;
    margin-top: 1.25rem;
  }
  .cyc-field { display: flex; flex-direction: column; gap: 0.5rem; }
  .cyc-field label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--fog-400);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-range-row { display: flex; align-items: center; gap: 0.75rem; }
  .cyc-range {
    flex: 1;
    height: 6px;
    background: var(--ink-600);
    border-radius: 999px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    outline: none;
  }
  .cyc-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .cyc-range::-moz-range-thumb {
    width: 16px; height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .cyc-range-val {
    font-size: 1.25rem;
    font-weight: 800;
    width: 1.75rem;
    text-align: center;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-select {
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    color: var(--fog-100);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cyc-select:focus { border-color: var(--accent); box-shadow: 0 0 8px var(--glow-faint); }
  .cyc-reset {
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
    transition: transform 0.1s, box-shadow 0.15s, color 0.15s, background-color 0.15s;
  }
  .cyc-reset:hover {
    color: #fff;
    box-shadow: 0 0 16px var(--glow-bright);
  }
  .cyc-reset:active { transform: translateY(1px); }

  .cyc-status {
    text-align: center;
    font-size: 1.25rem;
    font-weight: 600;
    min-height: 2rem;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    transition: color 0.2s;
  }
  .cyc-status.thinking { color: var(--danger); }
  .cyc-status.win  { font-size: 1.9rem; font-weight: 800; color: #4ade80; }
  .cyc-status.lose { font-size: 1.9rem; font-weight: 800; color: var(--danger); }
  .cyc-status.draw { font-size: 1.6rem; font-weight: 800; color: var(--fog-200); }

  .cyc-board-shell {
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 12%, var(--ink-600));
    border-radius: 1rem;
    overflow: auto;
  }
  .cyc-board {
    display: grid;
    gap: 4px;
    background: var(--ink-600);
    padding: 4px;
    border-radius: 0.6rem;
    border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent);
  }
  .cyc-cell {
    background: var(--ink-900);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    user-select: none;
    border-radius: 5px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s, transform 0.1s;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-cell:hover { background: var(--ink-700); }
  .cyc-cell .mark { animation: cyc-appear 0.3s ease-out; line-height: 1; }
  .cyc-cell .mark.x { color: var(--accent); text-shadow: 0 0 14px var(--glow-bright); }
  .cyc-cell .mark.o { color: var(--danger); text-shadow: 0 0 14px var(--danger-glow); }
  @keyframes cyc-appear { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* The mark that will vanish on the owner's next placement */
  .cyc-cell .mark.fading {
    opacity: 0.4;
    filter: grayscale(0.7) blur(0.6px);
    animation: cyc-blink 1.5s ease-in-out infinite;
  }
  @keyframes cyc-blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.12; } }

  .cyc-cell.win {
    background: color-mix(in oklab, #059669 70%, var(--ink-900)) !important;
    animation: cyc-pulse 1s ease-in-out infinite;
    z-index: 1;
  }
  @keyframes cyc-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

  .cyc-rule {
    background: color-mix(in oklab, var(--ink-800) 35%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.6rem;
    padding: 0.9rem 1rem;
    text-align: center;
    color: var(--fog-300);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .cyc-rule .lim { color: var(--accent-light); font-weight: 700; }
  .cyc-rule .nxt { color: var(--danger); font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .cyc-cell .mark, .cyc-cell .mark.fading, .cyc-cell.win { animation: none; }
  }
</style>
<script nonce="${nonce}">
(() => {
  let size = 3;
  let markLimit = 5;          // n-limit: each player keeps at most ceil(1.5 * n) marks
  let board = [];
  let gameActive = true;
  let currentPlayer = 'X';    // 'X' = you, 'O' = bot
  let difficulty = 'normal';
  let busy = false;           // locks input while the bot "thinks"

  // Per-player placement order, so we know which mark is oldest.
  const moveHistory = { X: [], O: [] };

  // Persistent cell elements + last-painted state, so moves update cells in
  // place instead of wiping the board (which collapses its height and yanks
  // the page scroll to the top).
  let cellEls = [];
  let rendered = [];

  // Higher = sloppier bot. xhard always plays the strongest move it finds.
  const RANDOM_CHANCE = { normal: 0.45, medium: 0.25, hard: 0.10, xhard: 0 };

  const boardEl    = document.getElementById('cyc-board');
  const shellEl    = document.getElementById('cyc-board-shell');
  const sizeRange  = document.getElementById('cyc-size');
  const sizeValue  = document.getElementById('cyc-size-val');
  const limitRule  = document.getElementById('cyc-limit-rule');
  const limitNext  = document.getElementById('cyc-limit-next');
  const diffSelect = document.getElementById('cyc-difficulty');
  const statusEl   = document.getElementById('cyc-status');
  const resetBtn   = document.getElementById('cyc-reset');

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'cyc-status' + (cls ? ' ' + cls : '');
  }

  function initGame() {
    size = parseInt(sizeRange.value, 10);
    markLimit = Math.ceil(1.5 * size);

    sizeValue.textContent = size;
    limitRule.textContent = markLimit;
    limitNext.textContent = markLimit + 1;
    difficulty = diffSelect.value;

    board = new Array(size * size).fill(null);
    moveHistory.X = [];
    moveHistory.O = [];

    gameActive = true;
    busy = false;
    currentPlayer = 'X';
    setStatus('Your turn (X)');
    buildBoard();
  }

  // Create the grid once (only when the size changes). Cells then persist.
  function buildBoard() {
    boardEl.innerHTML = '';
    cellEls = [];
    rendered = new Array(size * size).fill(undefined);
    boardEl.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';

    for (let i = 0; i < size * size; i++) {
      const cell = document.createElement('div');
      cell.className = 'cyc-cell';
      cell.addEventListener('click', () => handleCellClick(i));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
    layoutBoard();
    paintBoard();
  }

  // Size the cells to fit; safe to call on resize without rebuilding.
  function layoutBoard() {
    const avail = Math.min((shellEl.clientWidth || 520) - 32, 520);
    const cellSize = Math.max(28, Math.floor(avail / size) - 4);
    boardEl.style.gridTemplateColumns = 'repeat(' + size + ', ' + cellSize + 'px)';
    for (const cell of cellEls) {
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      cell.style.fontSize = Math.floor(cellSize * 0.55) + 'px';
    }
  }

  // What a cell should display right now: '' empty, 'X'/'O', or 'X!'/'O!' fading.
  function cellState(i) {
    const owner = board[i];
    if (!owner) return '';
    const hist = moveHistory[owner];
    const fading = hist.length === markLimit && hist[0] === i;
    return owner + (fading ? '!' : '');
  }

  // Update only the cells whose appearance changed — leaves the DOM (and the
  // page height / scroll position) stable, and avoids re-animating every mark.
  function paintBoard() {
    for (let i = 0; i < cellEls.length; i++) {
      const want = cellState(i);
      if (want === rendered[i]) continue;
      rendered[i] = want;
      const cell = cellEls[i];
      cell.innerHTML = '';
      cell.classList.remove('win');
      if (want) {
        const owner = want[0];
        const span = document.createElement('span');
        span.className = 'mark ' + (owner === 'X' ? 'x' : 'o');
        if (want.length > 1) span.classList.add('fading');
        span.textContent = owner;
        cell.appendChild(span);
      }
    }
  }

  function handleCellClick(index) {
    if (!gameActive || busy || board[index] || currentPlayer !== 'X') return;
    executeMove(index, 'X');
    if (gameActive) {
      busy = true;
      setStatus('Bot is calculating…', 'thinking');
      setTimeout(botMove, 550);
    }
  }

  function executeMove(index, player) {
    board[index] = player;
    moveHistory[player].push(index);

    // Cyclic rule: placing past the limit expires your oldest mark.
    if (moveHistory[player].length > markLimit) {
      const oldest = moveHistory[player].shift();
      board[oldest] = null;
    }

    paintBoard();

    const result = checkWin(board, size);
    if (result) { endGame(result); return; }
    if (!board.includes(null)) { endGame({ winner: null }); return; }

    currentPlayer = player === 'X' ? 'O' : 'X';
  }

  // A line is the full row / column / diagonal (need all n cells matching).
  function checkWin(b, s) {
    for (let r = 0; r < s; r++) {
      const start = r * s;
      const first = b[start];
      if (first) {
        let win = true; const line = [];
        for (let i = 0; i < s; i++) { line.push(start + i); if (b[start + i] !== first) { win = false; break; } }
        if (win) return { winner: first, line };
      }
    }
    for (let c = 0; c < s; c++) {
      const first = b[c];
      if (first) {
        let win = true; const line = [];
        for (let i = 0; i < s; i++) { line.push(i * s + c); if (b[i * s + c] !== first) { win = false; break; } }
        if (win) return { winner: first, line };
      }
    }
    let d1 = true, d2 = true; const l1 = [], l2 = [];
    for (let i = 0; i < s; i++) {
      l1.push(i * s + i);
      if (b[i * s + i] !== b[0]) d1 = false;
      l2.push(i * s + (s - 1 - i));
      if (b[i * s + (s - 1 - i)] !== b[s - 1]) d2 = false;
    }
    if (d1 && b[0]) return { winner: b[0], line: l1 };
    if (d2 && b[s - 1]) return { winner: b[s - 1], line: l2 };
    return null;
  }

  function botMove() {
    if (!gameActive) return;
    let move;
    if (Math.random() < (RANDOM_CHANCE[difficulty] || 0)) {
      const empty = board.map((v, i) => (v === null ? i : -1)).filter((v) => v !== -1);
      move = empty[Math.floor(Math.random() * empty.length)];
    } else {
      move = getBestMove();
    }
    busy = false;
    if (move !== undefined) {
      executeMove(move, 'O');
      if (gameActive) setStatus('Your turn (X)');
    }
  }

  function getBestMove() {
    const empty = board.map((v, i) => (v === null ? i : -1)).filter((v) => v !== -1);
    if (empty.length === 0) return undefined;

    // 1. Take an immediate win.
    for (const idx of empty) {
      const sim = board.slice(); sim[idx] = 'O';
      if (checkWin(sim, size)) return idx;
    }
    // 2. Block the player's immediate win.
    for (const idx of empty) {
      const sim = board.slice(); sim[idx] = 'X';
      if (checkWin(sim, size)) return idx;
    }
    // 3. Heuristic: centre bias + offense/defense line potential.
    let bestScore = -Infinity;
    let bestIdx = empty[0];
    for (const idx of empty) {
      const r = Math.floor(idx / size);
      const c = idx % size;
      let score = -(Math.abs(r - (size - 1) / 2) + Math.abs(c - (size - 1) / 2));
      score += evaluatePosition(idx, 'O') * 1.5;
      score += evaluatePosition(idx, 'X');
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    }
    return bestIdx;
  }

  function evaluatePosition(index, player) {
    let score = 0;
    const r = Math.floor(index / size);
    const c = index % size;
    const dirs = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
    for (const { dr, dc } of dirs) {
      let count = 0;
      for (let step = 1; step < size; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
        const v = board[nr * size + nc];
        if (v === player) count++;
        else if (v !== null) { count = -1; break; }
      }
      if (count !== -1) {
        for (let step = 1; step < size; step++) {
          const nr = r - dr * step, nc = c - dc * step;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
          const v = board[nr * size + nc];
          if (v === player) count++;
          else if (v !== null) { count = -1; break; }
        }
      }
      if (count !== -1) score += Math.pow(10, count);
    }
    return score;
  }

  function endGame(result) {
    gameActive = false;
    busy = false;
    if (result.winner === 'X') {
      setStatus('Victory!', 'win');
    } else if (result.winner === 'O') {
      setStatus('The bot wins!', 'lose');
    } else {
      setStatus('Stalemate — board is full', 'draw');
      return;
    }
    (result.line || []).forEach((idx) => {
      const cell = cellEls[idx];
      if (cell) cell.classList.add('win');
    });
  }

  // Live-update the label while dragging; rebuild the grid once on release.
  sizeRange.addEventListener('input', () => { sizeValue.textContent = sizeRange.value; });
  sizeRange.addEventListener('change', initGame);
  resetBtn.addEventListener('click', initGame);
  diffSelect.addEventListener('change', initGame);
  let resizeRaf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layoutBoard);
  });
  initGame();
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Cyclic Tic-Tac-Toe</h1>
    <p class="text-center text-fog-300">Win while your old pieces expire.</p>
    <div class="cyc-wrap">
      <div class="cyc-panel">
        <p class="cyc-subtitle">Old marks fade away</p>
        <div class="cyc-controls">
          <div class="cyc-field">
            <label for="cyc-size">Grid &amp; Limit (n)</label>
            <div class="cyc-range-row">
              <input type="range" id="cyc-size" class="cyc-range" min="3" max="15" value="3" aria-label="Grid size" />
              <span id="cyc-size-val" class="cyc-range-val">3</span>
            </div>
          </div>
          <div class="cyc-field">
            <label for="cyc-difficulty">Bot Intelligence</label>
            <select id="cyc-difficulty" class="cyc-select">
              <option value="normal">Normal (Casual)</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="xhard">X-Hard (Expert)</option>
            </select>
          </div>
        </div>
        <div class="cyc-reset-row">
          <button id="cyc-reset" class="cyc-reset" type="button">Reset Arena</button>
        </div>
      </div>

      <div id="cyc-status" class="cyc-status">Your turn (X)</div>

      <div id="cyc-board-shell" class="cyc-board-shell">
        <div id="cyc-board" class="cyc-board"></div>
      </div>

      <div class="cyc-rule">
        Rule: you may keep <span id="cyc-limit-rule" class="lim">5</span> marks (⌈1.5n⌉).
        Placing the <span id="cyc-limit-next" class="nxt">6th</span> expires your oldest mark.
      </div>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Cyclic Tic-Tac-Toe',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
