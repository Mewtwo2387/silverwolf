import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import type { RoomSnapshot } from '../../multiplayer/cyclic_tictactoe_rooms';

// JSON.stringify escapes neither '<' nor '/', which would let a malicious
// username close the surrounding <script> tag. Escape '<' to < so the
// only way out of the inline block is via the literal close tag we wrote.
function inlineJson(v: unknown): string {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c');
}

/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
export interface RoomPageOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  matchId: string;
  selfDiscordId: string | null;
  csrf: string | null;
  snapshot: RoomSnapshot | null;
  roomMissing?: boolean;
  loginReturnPath: string;
}

export function CyclicTicTacToeMultiplayerRoomPage(opts: RoomPageOpts) {
  const {
    nonce, lv999, user, matchId, selfDiscordId, csrf,
    snapshot, roomMissing, loginReturnPath,
  } = opts;

  const styles = roomStyles();

  if (!user) {
    return Layout({
      title: 'Silverwolf — Multiplayer Match',
      active: 'games',
      body: html`
        ${styles}
        <h1 class="text-center">Cyclic Tic-Tac-Toe — Multiplayer</h1>
        <div class="cyc-mp-wrap">
          <div class="cyc-mp-panel" style="text-align:center;">
            <p class="cyc-mp-subtitle">Log In Required</p>
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              You need to be logged in with Discord to join this match.
            </p>
            <a href="/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}"
               class="cyc-mp-btn cyc-mp-loginbtn">[ Log in with Discord ]</a>
          </div>
        </div>
      ` as any,
      nonce,
      lv999,
      user,
    });
  }

  if (roomMissing) {
    return Layout({
      title: 'Silverwolf — Match Not Found',
      active: 'games',
      body: html`
        ${styles}
        <h1 class="text-center">Match Not Found</h1>
        <div class="cyc-mp-wrap">
          <div class="cyc-mp-panel" style="text-align:center;">
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              This room doesn't exist, was already played, or expired.
            </p>
            <a href="/games/cyclic-tictactoe/multiplayer" class="cyc-mp-btn">[ Back to Lobby ]</a>
          </div>
        </div>
      ` as any,
      nonce,
      lv999,
      user,
    });
  }

  const script = raw(roomScript(nonce, {
    matchId,
    csrf: csrf ?? '',
    selfDiscordId: selfDiscordId ?? '',
    snapshot,
  }));

  const body = html`
    ${styles}
    <h1 class="text-center" style="margin-bottom: 0.25rem;">Cyclic Tic-Tac-Toe — Multiplayer</h1>
    <p class="text-center text-fog-300" style="margin-bottom: 1rem;">
      Match <code style="color: var(--accent-light);">${matchId.slice(0, 10)}…</code>
    </p>
    <div class="cyc-mp-wrap" id="cyc-mp-root">
      <div class="cyc-mp-panel" id="cyc-mp-view">
        <p style="text-align:center; color: var(--fog-300); margin: 0;">Connecting…</p>
      </div>
    </div>
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — Multiplayer Match',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

function roomStyles() {
  return raw(`
<style>
  .cyc-mp-wrap {
    max-width: 760px;
    margin: 1.5rem auto 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .cyc-mp-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    padding: 1.25rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .cyc-mp-subtitle {
    text-align: center;
    color: var(--fog-300);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0 0 1.25rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-mp-btn {
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .cyc-mp-btn:hover {
    color: #fff;
    box-shadow: 0 0 16px var(--glow-bright);
  }
  .cyc-mp-btn:active { transform: translateY(1px); }
  .cyc-mp-btn[disabled] { opacity: 0.55; cursor: not-allowed; }
  .cyc-mp-btn.danger {
    color: var(--danger);
    border-color: var(--danger);
    box-shadow: 0 0 8px var(--danger-glow);
  }
  .cyc-mp-btn.danger:hover { color: #fff; box-shadow: 0 0 16px var(--danger-glow); }
  .cyc-mp-loginbtn { margin: 0.5rem auto 0; display: inline-flex; }

  .cyc-mp-players {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .cyc-mp-player {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.6rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-mp-player.right { flex-direction: row-reverse; text-align: right; }
  .cyc-mp-player.you { border-color: color-mix(in oklab, var(--accent) 65%, transparent); box-shadow: 0 0 8px var(--glow-faint); }
  .cyc-mp-player.turn {
    border-color: var(--accent);
    box-shadow: 0 0 14px var(--glow-bright);
  }
  .cyc-mp-player.empty { opacity: 0.6; font-style: italic; color: var(--fog-400); }
  .cyc-mp-player.disconnected { border-style: dashed; opacity: 0.7; }
  .cyc-mp-avatar { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--accent); flex-shrink: 0; background: var(--ink-700); }
  .cyc-mp-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: var(--fog-300);
    font-size: 0.95rem;
  }
  .cyc-mp-pname { font-size: 0.9rem; color: var(--fog-100); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cyc-mp-sym {
    font-weight: 800;
    font-size: 1.4rem;
    line-height: 1;
    padding: 0 0.35rem;
  }
  .cyc-mp-sym.x { color: var(--accent); text-shadow: 0 0 10px var(--glow-bright); }
  .cyc-mp-sym.o { color: var(--danger); text-shadow: 0 0 10px var(--danger-glow); }
  .cyc-mp-vs {
    color: var(--fog-400);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-align: center;
  }

  .cyc-mp-status {
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    margin: 0.75rem 0 0.25rem;
    min-height: 1.7rem;
  }
  .cyc-mp-status.win  { font-size: 1.8rem; font-weight: 800; color: #4ade80; }
  .cyc-mp-status.lose { font-size: 1.8rem; font-weight: 800; color: var(--danger); }
  .cyc-mp-status.draw { font-size: 1.5rem; font-weight: 800; color: var(--fog-200); }
  .cyc-mp-status.warn { color: var(--danger); }

  .cyc-mp-timer {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.4rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--fog-400);
  }
  .cyc-mp-timer .count {
    color: var(--accent-light);
    font-weight: 700;
  }
  .cyc-mp-timer.urgent .count { color: var(--danger); }

  .cyc-mp-board-shell {
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 12%, var(--ink-600));
    border-radius: 1rem;
    overflow: auto;
  }
  .cyc-mp-board {
    display: grid;
    gap: 4px;
    background: var(--ink-600);
    padding: 4px;
    border-radius: 0.6rem;
    border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent);
  }
  .cyc-mp-cell {
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
  .cyc-mp-cell.disabled { cursor: not-allowed; }
  .cyc-mp-cell:not(.disabled):hover { background: var(--ink-700); }
  .cyc-mp-cell .mark { animation: cyc-mp-appear 0.3s ease-out; line-height: 1; }
  .cyc-mp-cell .mark.x { color: var(--accent); text-shadow: 0 0 14px var(--glow-bright); }
  .cyc-mp-cell .mark.o { color: var(--danger); text-shadow: 0 0 14px var(--danger-glow); }
  @keyframes cyc-mp-appear { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .cyc-mp-cell .mark.fading {
    opacity: 0.4;
    filter: grayscale(0.7) blur(0.6px);
    animation: cyc-mp-blink 1.5s ease-in-out infinite;
  }
  @keyframes cyc-mp-blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.12; } }
  .cyc-mp-cell.win {
    background: color-mix(in oklab, #059669 70%, var(--ink-900)) !important;
    animation: cyc-mp-pulse 1s ease-in-out infinite;
    z-index: 1;
  }
  @keyframes cyc-mp-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

  .cyc-mp-invite {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  .cyc-mp-invite-url {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--fog-200);
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 0.4rem;
    padding: 0.45rem 0.6rem;
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }

  .cyc-mp-end-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }

  .cyc-mp-err-banner {
    margin-top: 0.5rem;
    text-align: center;
    color: var(--danger);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    min-height: 1.1rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .cyc-mp-cell .mark, .cyc-mp-cell .mark.fading, .cyc-mp-cell.win { animation: none; }
  }
</style>
`);
}

function roomScript(nonce: string, ctx: {
  matchId: string;
  csrf: string;
  selfDiscordId: string;
  snapshot: RoomSnapshot | null;
}) {
  return `
<script nonce="${nonce}">
(() => {
  const CTX = {
    matchId: ${inlineJson(ctx.matchId)},
    csrf: ${inlineJson(ctx.csrf)},
    selfId: ${inlineJson(ctx.selfDiscordId)},
    initialSnapshot: ${inlineJson(ctx.snapshot)},
  };

  const viewEl = document.getElementById('cyc-mp-view');
  if (!viewEl) return;

  let state = CTX.initialSnapshot; // RoomSnapshot | null
  let ws = null;
  let wsRetryDelayMs = 1500;
  let wsClosedByServer = false;
  let serverError = null;
  let countdownTimer = null;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'style') e.setAttribute('style', attrs[k]);
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
    }
    if (children != null) {
      const list = Array.isArray(children) ? children : [children];
      for (const child of list) {
        if (child == null || child === false) continue;
        e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    }
    return e;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function openWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + location.host + '/games/cyclic-tictactoe/multiplayer/ws/' + encodeURIComponent(CTX.matchId);
    let socket;
    try { socket = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
    ws = socket;
    socket.addEventListener('open', () => {
      wsRetryDelayMs = 1500;
      send({ type: 'join', csrf: CTX.csrf });
    });
    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg && msg.type === 'state' && msg.room) {
        serverError = null;
        state = msg.room;
        render();
      } else if (msg && msg.type === 'error') {
        serverError = msg.code || 'unknown';
        render();
      }
    });
    socket.addEventListener('close', (ev) => {
      ws = null;
      // 1008 closures are server policy decisions (room_full, bad_csrf, etc.).
      // Don't auto-reconnect — show the error.
      if (ev.code === 1008 || ev.code === 1003) {
        wsClosedByServer = true;
        render();
        return;
      }
      if (state && state.status === 'ended') return; // no need to reconnect
      scheduleRetry();
    });
  }

  function scheduleRetry() {
    setTimeout(openWS, wsRetryDelayMs);
    wsRetryDelayMs = Math.min(15_000, wsRetryDelayMs * 2);
  }

  function send(payload) {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(payload)); return true; } catch { return false; }
  }

  function youAre() {
    if (!state || !CTX.selfId) return null;
    if (state.players.X && state.players.X.discordId === CTX.selfId) return 'X';
    if (state.players.O && state.players.O.discordId === CTX.selfId) return 'O';
    return null;
  }

  function opponentOf(sym) {
    if (!state) return null;
    const other = sym === 'X' ? 'O' : 'X';
    return state.players[other];
  }

  // ── Sub-renderers ───────────────────────────────────────────────────────
  function renderError() {
    const codeMap = {
      room_full: 'This room is already full.',
      self_play: 'You can\\'t play yourself — open the link from a different account.',
      bad_csrf: 'Session expired. Reload the page.',
      auth_required: 'Authentication required. Reload the page.',
      room_not_found: 'This room no longer exists.',
      game_ended: 'This game has already ended.',
      rate_limited: 'You\\'re sending messages too quickly.',
    };
    const message = codeMap[serverError] || ('Server error: ' + serverError);
    clear(viewEl);
    viewEl.appendChild(el('p', { class: 'cyc-mp-subtitle' }, 'Error'));
    viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--danger); margin: 0 0 1rem;' }, message));
    viewEl.appendChild(el('div', { style: 'display:flex; justify-content:center; gap: 0.6rem;' }, [
      el('a', { href: '/games/cyclic-tictactoe/multiplayer', class: 'cyc-mp-btn' }, '[ back to lobby ]'),
    ]));
  }

  function avatarEl(p) {
    if (p && p.avatarURL) {
      return el('img', { class: 'cyc-mp-avatar', src: p.avatarURL, alt: p.username, width: '36', height: '36' });
    }
    const letter = p && p.username ? p.username.charAt(0).toUpperCase() : '?';
    return el('div', { class: 'cyc-mp-avatar placeholder' }, letter);
  }

  function playerCard(p, sym, side) {
    const isYou = p && p.discordId === CTX.selfId;
    const isTurn = state && state.status === 'active' && state.currentPlayer === sym;
    const disconnected = p && !p.connected;
    const cls = [
      'cyc-mp-player',
      side === 'right' ? 'right' : '',
      isYou ? 'you' : '',
      isTurn ? 'turn' : '',
      disconnected ? 'disconnected' : '',
      !p ? 'empty' : '',
    ].filter(Boolean).join(' ');
    if (!p) {
      return el('div', { class: cls }, [
        el('div', { class: 'cyc-mp-avatar placeholder' }, '?'),
        el('span', { class: 'cyc-mp-pname' }, 'waiting…'),
        el('span', { class: 'cyc-mp-sym ' + sym.toLowerCase() }, sym),
      ]);
    }
    return el('div', { class: cls }, [
      avatarEl(p),
      el('span', { class: 'cyc-mp-pname' }, '@' + p.username + (isYou ? ' (you)' : '')),
      el('span', { class: 'cyc-mp-sym ' + sym.toLowerCase() }, sym),
    ]);
  }

  function playersRow() {
    return el('div', { class: 'cyc-mp-players' }, [
      playerCard(state.players.X, 'X', 'left'),
      el('div', { class: 'cyc-mp-vs' }, 'vs'),
      playerCard(state.players.O, 'O', 'right'),
    ]);
  }

  function boardEl() {
    const n = state.boardSize;
    const me = youAre();
    const myTurn = state.status === 'active' && me && state.currentPlayer === me;
    const shell = el('div', { class: 'cyc-mp-board-shell' });
    const board = el('div', { class: 'cyc-mp-board' });
    const cells = [];
    for (let i = 0; i < n * n; i++) {
      const cell = el('div', { class: 'cyc-mp-cell' + (myTurn ? '' : ' disabled') });
      const owner = state.board[i];
      if (owner) {
        const isFading = state.history[owner].length >= state.markLimit && state.history[owner][0] === i;
        const span = el('span', { class: 'mark ' + owner.toLowerCase() + (isFading ? ' fading' : '') }, owner);
        cell.appendChild(span);
      }
      if (state.result && state.result.line && state.result.line.indexOf(i) !== -1) {
        cell.classList.add('win');
      }
      if (myTurn && !owner) {
        cell.addEventListener('click', () => send({ type: 'move', index: i }));
      }
      board.appendChild(cell);
      cells.push(cell);
    }
    shell.appendChild(board);
    // Size cells once the shell is attached; clientWidth is 0 before mount.
    requestAnimationFrame(() => {
      const avail = Math.min((shell.clientWidth || 520) - 32, 520);
      const cellSize = Math.max(28, Math.floor(avail / n) - 4);
      board.style.gridTemplateColumns = 'repeat(' + n + ', ' + cellSize + 'px)';
      const fontPx = Math.floor(cellSize * 0.55) + 'px';
      for (const c of cells) {
        c.style.width = cellSize + 'px';
        c.style.height = cellSize + 'px';
        c.style.fontSize = fontPx;
      }
    });
    return shell;
  }

  function statusLine() {
    const me = youAre();
    if (state.status === 'waiting') {
      if (me === 'X') return el('div', { class: 'cyc-mp-status' }, 'Waiting for opponent to join…');
      return el('div', { class: 'cyc-mp-status' }, 'Lobby — waiting for opponent');
    }
    if (state.status === 'active') {
      const cur = state.currentPlayer;
      const otherSym = me === 'X' ? 'O' : 'X';
      const other = me ? state.players[otherSym] : null;
      if (other && !other.connected) {
        return el('div', { class: 'cyc-mp-status warn' }, 'Opponent reconnecting…');
      }
      if (me && cur === me) {
        return el('div', { class: 'cyc-mp-status' }, 'Your turn (' + me + ')');
      }
      if (me) {
        // Waiting on whoever's turn it currently is — which, when it's not
        // mine, is necessarily my opponent.
        const waitingFor = state.players[cur];
        const name = waitingFor ? '@' + waitingFor.username : 'opponent';
        return el('div', { class: 'cyc-mp-status' }, 'Waiting for ' + name + '…');
      }
      return el('div', { class: 'cyc-mp-status' }, 'Spectating — ' + cur + '\\'s turn');
    }
    if (state.status === 'ended') {
      const r = state.result || {};
      if (r.winner == null) {
        const reason = r.reason === 'disconnect' ? 'Match ended — both players left.' : 'Stalemate — board is full';
        return el('div', { class: 'cyc-mp-status draw' }, reason);
      }
      if (me && r.winner === me) {
        const tail = r.reason === 'timeout' ? ' (opponent timed out)'
          : r.reason === 'disconnect' ? ' (opponent disconnected)'
          : r.reason === 'forfeit' ? ' (opponent forfeited)' : '';
        return el('div', { class: 'cyc-mp-status win' }, 'Victory!' + tail);
      }
      if (me) {
        const tail = r.reason === 'timeout' ? ' (you timed out)'
          : r.reason === 'disconnect' ? ' (you disconnected)'
          : r.reason === 'forfeit' ? ' (you forfeited)' : '';
        return el('div', { class: 'cyc-mp-status lose' }, 'Defeat.' + tail);
      }
      const winnerSlot = state.players[r.winner];
      const name = winnerSlot ? '@' + winnerSlot.username : r.winner;
      return el('div', { class: 'cyc-mp-status win' }, name + ' wins');
    }
    return el('div', { class: 'cyc-mp-status' }, '');
  }

  function timerLine() {
    if (state.status !== 'active' || !state.turnDeadline) return null;
    const wrap = el('div', { class: 'cyc-mp-timer' });
    const label = el('span', null, 'turn timer');
    const count = el('span', { class: 'count' }, '—');
    wrap.appendChild(label);
    wrap.appendChild(count);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
      count.textContent = remaining + 's';
      if (remaining <= 5) wrap.classList.add('urgent');
      else wrap.classList.remove('urgent');
    };
    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 250);
    return wrap;
  }

  function inviteBlock() {
    const url = location.origin + '/games/cyclic-tictactoe/multiplayer/' + encodeURIComponent(CTX.matchId);
    const wrap = el('div', { class: 'cyc-mp-invite' });
    wrap.appendChild(el('div', { style: 'color: var(--fog-300); text-align:center;' }, 'Share this link with one other player:'));
    wrap.appendChild(el('div', { class: 'cyc-mp-invite-url' }, url));
    const copyBtn = el('button', { class: 'cyc-mp-btn', type: 'button' }, '[ copy link ]');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        const prev = copyBtn.textContent;
        copyBtn.textContent = '[ copied! ]';
        setTimeout(() => { copyBtn.textContent = prev; }, 1500);
      } catch {
        window.prompt('Copy this link:', url);
      }
    });
    wrap.appendChild(copyBtn);
    return wrap;
  }

  function endActions() {
    const me = youAre();
    const wrap = el('div', { class: 'cyc-mp-end-actions' });
    if (me) {
      const meSlot = state.players[me];
      if (meSlot && meSlot.rematchAccepted) {
        const opp = state.players[me === 'X' ? 'O' : 'X'];
        const oppName = opp ? '@' + opp.username : 'opponent';
        wrap.appendChild(el('div', { style: 'flex-basis: 100%; text-align:center; color: var(--fog-300); margin-bottom: 0.25rem;' },
          'Waiting for ' + oppName + ' to accept rematch…'));
      } else {
        const rematch = el('button', { class: 'cyc-mp-btn', type: 'button' }, '[ rematch ]');
        rematch.addEventListener('click', () => send({ type: 'rematch_request' }));
        wrap.appendChild(rematch);
      }
    }
    const newRoom = el('a', {
      href: '/games/cyclic-tictactoe/multiplayer',
      class: 'cyc-mp-btn',
    }, '[ new room ]');
    wrap.appendChild(newRoom);
    const leave = el('button', { class: 'cyc-mp-btn danger', type: 'button' }, '[ leave ]');
    leave.addEventListener('click', () => {
      send({ type: 'leave' });
      setTimeout(() => { window.location.href = '/games/cyclic-tictactoe/multiplayer'; }, 200);
    });
    wrap.appendChild(leave);
    return wrap;
  }

  // ── Top-level render ────────────────────────────────────────────────────
  function render() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (wsClosedByServer && serverError) { renderError(); return; }
    if (!state) {
      clear(viewEl);
      viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--fog-300); margin: 0;' }, 'Connecting…'));
      return;
    }

    clear(viewEl);
    viewEl.appendChild(playersRow());

    const status = statusLine();
    if (status) viewEl.appendChild(status);

    const t = timerLine();
    if (t) viewEl.appendChild(t);

    if (state.status === 'waiting') {
      // Only the seated player(s) see the invite. Visitors who haven't been
      // seated yet will auto-seat on WS join via the server.
      viewEl.appendChild(inviteBlock());
    } else {
      viewEl.appendChild(boardEl());
    }

    if (state.status === 'ended') {
      viewEl.appendChild(endActions());
    }

    if (serverError) {
      viewEl.appendChild(el('div', { class: 'cyc-mp-err-banner' }, 'Server: ' + serverError));
    }
  }

  // First paint from server snapshot (or "connecting" if absent).
  render();
  openWS();

  // Re-layout the board on resize so cells fit.
  let resizeRaf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (state && (state.status === 'active' || state.status === 'ended')) render();
    });
  });

  // Best-effort: tell the server we're leaving on tab close so the
  // disconnect-grace-period starts immediately rather than waiting for the WS
  // close to be detected.
  window.addEventListener('beforeunload', () => {
    try { ws && ws.close(1000, 'unload'); } catch {}
  });
})();
</script>
`;
}
