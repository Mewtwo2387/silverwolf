import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import type { ViewerSnapshot } from '../../multiplayer/battleships_rooms';
import { FLEET, SIZE } from '../../multiplayer/battleships';

// JSON.stringify escapes neither '<' nor '/', which would let a malicious
// username close the surrounding <script> tag. Escape '<' so the only way out
// of the inline block is the literal close tag we control.
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
  snapshot: ViewerSnapshot | null;
  roomMissing?: boolean;
  loginReturnPath: string;
}

export function BattleshipsMultiplayerRoomPage(opts: RoomPageOpts) {
  const {
    nonce, lv999, user, matchId, selfDiscordId, csrf,
    snapshot, roomMissing, loginReturnPath,
  } = opts;

  const styles = roomStyles();

  if (!user) {
    return Layout({
      title: 'Silverwolf — Battleships Match',
      active: 'games',
      body: html`
        ${styles}
        <h1 class="text-center">Battleships — Multiplayer</h1>
        <div class="bsmp-wrap">
          <div class="bsmp-panel" style="text-align:center;">
            <p class="bsmp-subtitle">Log In Required</p>
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              You need to be logged in with Discord to join this match.
            </p>
            <a href="/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}"
               class="bsmp-btn bsmp-loginbtn">[ Log in with Discord ]</a>
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
        <div class="bsmp-wrap">
          <div class="bsmp-panel" style="text-align:center;">
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              This room doesn't exist, was already played, or expired.
            </p>
            <a href="/games/battleships/multiplayer" class="bsmp-btn">[ Back to Lobby ]</a>
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
    <h1 class="text-center" style="margin-bottom: 0.25rem;">Battleships — Multiplayer</h1>
    <p class="text-center text-fog-300" style="margin-bottom: 1rem;">
      Match <code style="color: var(--accent-light);">${matchId.slice(0, 10)}…</code>
    </p>
    <div class="bsmp-wrap" id="bsmp-root">
      <div class="bsmp-panel" id="bsmp-view">
        <p style="text-align:center; color: var(--fog-300); margin: 0;">Connecting…</p>
      </div>
    </div>
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — Battleships Match',
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
  .bsmp-wrap { max-width: 1100px; margin: 1.5rem auto 0; display: flex; flex-direction: column; gap: 1.25rem; }
  .bsmp-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem; padding: 1.25rem;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .bsmp-subtitle {
    text-align: center; color: var(--fog-300); font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.18em; margin: 0 0 1rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .bsmp-btn {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent-pale) 10%, transparent));
    color: var(--accent-light); border: 1px solid var(--accent); border-radius: 4px;
    padding: 0.55rem 1.2rem; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; white-space: nowrap; box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, color 0.15s; text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.4rem;
  }
  .bsmp-btn:hover { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .bsmp-btn:active { transform: translateY(1px); }
  .bsmp-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
  .bsmp-btn.danger { color: var(--danger); border-color: var(--danger); box-shadow: 0 0 8px var(--danger-glow); }
  .bsmp-btn.danger:hover { color: #fff; box-shadow: 0 0 16px var(--danger-glow); }
  .bsmp-loginbtn { margin: 0.5rem auto 0; display: inline-flex; }

  .bsmp-players { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.75rem; }
  .bsmp-player {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.75rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent);
    border: 1px solid var(--ink-600); border-radius: 0.6rem; font-family: 'JetBrains Mono', monospace;
  }
  .bsmp-player.right { flex-direction: row-reverse; text-align: right; }
  .bsmp-player.you { border-color: color-mix(in oklab, var(--accent) 65%, transparent); box-shadow: 0 0 8px var(--glow-faint); }
  .bsmp-player.turn { border-color: var(--accent); box-shadow: 0 0 14px var(--glow-bright); }
  .bsmp-player.empty { opacity: 0.6; font-style: italic; color: var(--fog-400); }
  .bsmp-player.disconnected { border-style: dashed; opacity: 0.7; }
  .bsmp-avatar { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--accent); flex-shrink: 0; background: var(--ink-700); }
  .bsmp-avatar.placeholder { display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--fog-300); }
  .bsmp-pname { font-size: 0.85rem; color: var(--fog-100); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bsmp-vs { color: var(--fog-400); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; letter-spacing: 0.1em; text-align: center; }

  .bsmp-status {
    text-align: center; font-size: 1.05rem; font-weight: 600; color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace; margin: 0.75rem 0 0.25rem; min-height: 1.6rem;
  }
  .bsmp-status.win  { font-size: 1.7rem; font-weight: 800; color: #4ade80; }
  .bsmp-status.lose { font-size: 1.7rem; font-weight: 800; color: var(--danger); }
  .bsmp-status.warn { color: var(--danger); }
  .bsmp-timer { display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.3rem; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--fog-400); }
  .bsmp-timer .count { color: var(--accent-light); font-weight: 700; }
  .bsmp-timer.urgent .count { color: var(--danger); }

  /* ── Arena: fleet panels flank the boards (matches single-player) ── */
  .bsmp-arena { display: grid; grid-template-columns: 200px minmax(0, 1fr) 220px; gap: 1rem; align-items: start; margin-top: 0.75rem; }
  @media (max-width: 940px) {
    .bsmp-arena { grid-template-columns: 1fr 1fr; grid-template-areas: "board board" "foe tray"; }
    .bsmp-boards { grid-area: board; }
    .bsmp-side { grid-area: foe; }
    .bsmp-tray-panel { grid-area: tray; }
  }
  .bsmp-side, .bsmp-tray-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem; padding: 0.9rem;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .bsmp-side { border-color: color-mix(in oklab, var(--danger) 22%, var(--ink-600)); }
  .bsmp-side-title, .bsmp-tray-title {
    text-align: center; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em;
    margin: 0 0 0.6rem; font-family: 'JetBrains Mono', monospace;
  }
  .bsmp-side-title { color: var(--danger); }
  .bsmp-tray-title { color: var(--fog-300); }

  .bsmp-foe-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .bsmp-foe-ship {
    display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.5rem; border-radius: 0.5rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent); border: 1px solid var(--ink-600);
    transition: opacity 0.3s, filter 0.3s;
  }
  .bsmp-foe-ship .bsmp-foe-icon { flex: 0 0 auto; color: var(--fog-200); display: flex; }
  .bsmp-foe-ship .bsmp-foe-meta { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  .bsmp-foe-ship .bsmp-foe-name { font-size: 0.72rem; font-weight: 700; color: var(--fog-100); font-family: 'JetBrains Mono', monospace; }
  .bsmp-foe-ship .bsmp-foe-len { font-size: 0.6rem; color: var(--fog-400); font-family: 'JetBrains Mono', monospace; }
  .bsmp-foe-ship.downed { opacity: 0.4; filter: grayscale(1); }
  .bsmp-foe-ship.downed .bsmp-foe-name { text-decoration: line-through; color: var(--danger); }

  .bsmp-boards { display: flex; flex-direction: column; gap: 1rem; }
  .bsmp-board-block { display: flex; flex-direction: column; gap: 0.4rem; }
  .bsmp-board-label {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--fog-400);
    font-family: 'JetBrains Mono', monospace; display: flex; justify-content: space-between; align-items: center;
  }
  .bsmp-board-label .radar-tag { color: var(--accent-light); }
  .bsmp-board-label .home-tag { color: #4ade80; }
  .bsmp-board-shell {
    display: flex; justify-content: center; padding: 0.75rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 12%, var(--ink-600));
    border-radius: 0.8rem; overflow: auto;
  }
  .bsmp-grid {
    display: grid; gap: 3px; background: var(--ink-600); padding: 3px; border-radius: 0.5rem;
    border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent); touch-action: none; position: relative;
  }
  .bsmp-cell {
    background: var(--ink-900); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    border-radius: 4px; position: relative; user-select: none; transition: background 0.12s, box-shadow 0.12s;
    font-family: 'JetBrains Mono', monospace;
  }
  .bsmp-grid.radar .bsmp-cell { cursor: crosshair; }
  .bsmp-grid.radar.locked .bsmp-cell { cursor: default; }
  .bsmp-grid.radar .bsmp-cell:hover { background: color-mix(in oklab, var(--accent) 22%, var(--ink-900)); }
  .bsmp-grid.radar.locked .bsmp-cell:hover { background: var(--ink-900); }
  .bsmp-cell.ship { background: color-mix(in oklab, #5b6c7d 70%, var(--ink-900)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fog-200) 40%, transparent); }
  .bsmp-cell.ship.placing { cursor: grab; }
  .bsmp-cell.ship.placing:active { cursor: grabbing; }
  .bsmp-cell.hit::after, .bsmp-cell.miss::after { content: ''; position: absolute; border-radius: 50%; }
  .bsmp-cell.miss::after { width: 9px; height: 9px; background: color-mix(in oklab, var(--fog-300) 60%, transparent); box-shadow: 0 0 6px rgba(255,255,255,0.15); }
  .bsmp-cell.hit::after { width: 14px; height: 14px; background: radial-gradient(circle at 35% 35%, #ff8a5b, var(--danger)); box-shadow: 0 0 12px var(--danger-glow); }
  .bsmp-cell.hit { background: color-mix(in oklab, var(--danger) 22%, var(--ink-900)); }
  .bsmp-cell.sunk { background: color-mix(in oklab, var(--danger) 45%, var(--ink-900)) !important; box-shadow: inset 0 0 0 1px var(--danger); }
  .bsmp-cell.preview-ok  { background: color-mix(in oklab, #16a34a 60%, var(--ink-900)); box-shadow: inset 0 0 0 2px #4ade80; }
  .bsmp-cell.preview-bad { background: color-mix(in oklab, var(--danger) 55%, var(--ink-900)); box-shadow: inset 0 0 0 2px var(--danger); }
  .bsmp-cell-label { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.02em; opacity: 0.9; pointer-events: none; z-index: 1; }
  .bsmp-cell.hit .bsmp-cell-label, .bsmp-cell.miss .bsmp-cell-label { opacity: 0.25; }

  .bsmp-tray { display: flex; flex-direction: column; gap: 0.7rem; }
  .bsmp-tray-hint { font-size: 0.62rem; color: var(--fog-400); font-family: 'JetBrains Mono', monospace; line-height: 1.4; font-style: italic; margin-bottom: 0.2rem; }
  .bsmp-tray-ship {
    display: flex; flex-direction: column; gap: 0.3rem; padding: 0.5rem; border-radius: 0.5rem;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent); border: 1px solid var(--ink-600);
    cursor: grab; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.2s, transform 0.1s; touch-action: none;
  }
  .bsmp-tray-ship:hover { border-color: var(--accent); box-shadow: 0 0 10px var(--glow-faint); }
  .bsmp-tray-ship.dragging { opacity: 0.5; }
  .bsmp-tray-ship.placed { opacity: 0.55; filter: grayscale(0.35); }
  .bsmp-tray-ship.placed:hover { opacity: 0.9; }
  .bsmp-tray-ship-name { font-size: 0.68rem; font-weight: 700; color: var(--accent-light); font-family: 'JetBrains Mono', monospace; display: flex; justify-content: space-between; gap: 0.4rem; }
  .bsmp-tray-ship-name .placed-tag { color: var(--accent-light); font-size: 0.6rem; }
  .bsmp-hull-code { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.05em; }
  .bsmp-tray-shape { display: flex; }
  .bsmp-ready-row { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
  .bsmp-ready-row .bsmp-btn { justify-content: center; }

  .bsmp-drag-ghost { position: fixed; pointer-events: none; z-index: 9999; opacity: 0.85; transform: translate(-50%, -50%); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5)); }

  .bsmp-invite { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
  .bsmp-invite-url { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--fog-200); background: var(--ink-900); border: 1px solid var(--ink-600); border-radius: 0.4rem; padding: 0.45rem 0.6rem; max-width: 100%; overflow-x: auto; white-space: nowrap; }
  .bsmp-end-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem; margin-top: 0.75rem; }
  .bsmp-err-banner { margin-top: 0.5rem; text-align: center; color: var(--danger); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; min-height: 1.1rem; }

  @media (prefers-reduced-motion: reduce) { .bsmp-cell, .bsmp-foe-ship, .bsmp-tray-ship, .bsmp-btn { transition: none; } }
</style>
`);
}

function roomScript(nonce: string, ctx: {
  matchId: string;
  csrf: string;
  selfDiscordId: string;
  snapshot: ViewerSnapshot | null;
}) {
  return `
<script nonce="${nonce}">
(() => {
  'use strict';
  const CTX = {
    matchId: ${inlineJson(ctx.matchId)},
    csrf: ${inlineJson(ctx.csrf)},
    selfId: ${inlineJson(ctx.selfDiscordId)},
    initialSnapshot: ${inlineJson(ctx.snapshot)},
  };
  const FLEET = ${inlineJson(FLEET)};
  const SIZE = ${String(SIZE)};
  const CELLS = SIZE * SIZE;

  // Per-ship identity (mirrors single-player): side-profile silhouette, accent
  // colour and hull-class code so adjacent ships read apart on the board.
  const SHIP_META = {
    carrier:    { color: '#d4a84a', code: 'CV', kind: 'carrier' },
    battleship: { color: '#6ea8fe', code: 'BB', kind: 'warship' },
    cruiser:    { color: '#c084fc', code: 'CA', kind: 'warship' },
    submarine:  { color: '#2dd4bf', code: 'SS', kind: 'submarine' },
    destroyer:  { color: '#f472b6', code: 'DD', kind: 'warship' },
  };

  // SIDE-PROFILE ship silhouette (identical art to single-player).
  function shipSVG(type, len, cell, horizontal) {
    const L = len * cell, C = cell;
    const sw = Math.max(1, C * 0.05);
    const fill = '#9fb0c0', stroke = '#2b3a4a', dark = '#6b7785', accent = '#c9d3dc';
    const kind = (SHIP_META[type] && SHIP_META[type].kind) || 'warship';
    const base = C * 0.82, deck = C * 0.5;
    let inner = '';
    if (kind === 'submarine') {
      inner += '<rect x="' + (C * 0.12) + '" y="' + (C * 0.48) + '" rx="' + (C * 0.26) + '" ry="' + (C * 0.26) + '" width="' + (L - C * 0.24) + '" height="' + (C * 0.34) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<path d="M ' + (L * 0.42) + ' ' + (C * 0.5) + ' L ' + (L * 0.45) + ' ' + (C * 0.26) + ' L ' + (L * 0.57) + ' ' + (C * 0.26) + ' L ' + (L * 0.6) + ' ' + (C * 0.5) + ' Z" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<line x1="' + (L * 0.51) + '" y1="' + (C * 0.26) + '" x2="' + (L * 0.51) + '" y2="' + (C * 0.1) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else if (kind === 'carrier') {
      inner += '<path d="M ' + (C * 0.06) + ' ' + deck + ' L ' + (L - C * 0.06) + ' ' + deck + ' L ' + (L - C * 0.28) + ' ' + base + ' L ' + (C * 0.22) + ' ' + base + ' Z" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (C * 0.04) + '" y="' + (C * 0.4) + '" width="' + (L - C * 0.08) + '" height="' + (C * 0.12) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (L * 0.66) + '" y="' + (C * 0.22) + '" width="' + (C * 0.5) + '" height="' + (C * 0.2) + '" fill="' + accent + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else {
      inner += '<path d="M ' + (C * 0.06) + ' ' + deck + ' L ' + (L - C * 0.55) + ' ' + deck + ' L ' + (L - C * 0.06) + ' ' + (deck - C * 0.2) + ' L ' + (L - C * 0.06) + ' ' + deck + ' L ' + (L - C * 0.3) + ' ' + base + ' L ' + (C * 0.2) + ' ' + base + ' Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (L * 0.4) + '" y="' + (C * 0.28) + '" width="' + (L * 0.16) + '" height="' + (deck - C * 0.28) + '" fill="' + accent + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (L * 0.6) + '" y="' + (C * 0.34) + '" width="' + (C * 0.32) + '" height="' + (deck - C * 0.34) + '" fill="' + dark + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
      inner += '<rect x="' + (C * 0.26) + '" y="' + (deck - C * 0.13) + '" width="' + (C * 0.42) + '" height="' + (C * 0.13) + '" fill="' + dark + '"/>';
      inner += '<rect x="' + (L - C * 0.95) + '" y="' + (deck - C * 0.13) + '" width="' + (C * 0.42) + '" height="' + (C * 0.13) + '" fill="' + dark + '"/>';
      inner += '<line x1="' + (L * 0.48) + '" y1="' + (C * 0.28) + '" x2="' + (L * 0.48) + '" y2="' + (C * 0.08) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }
    if (horizontal) {
      return '<svg width="' + L + '" height="' + C + '" viewBox="0 0 ' + L + ' ' + C + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
    }
    return '<svg width="' + C + '" height="' + L + '" viewBox="0 0 ' + C + ' ' + L + '" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="rotate(90 ' + (C * 0.5) + ' ' + (C * 0.5) + ') translate(0 ' + (C * 0.5 - L * 0.5) + ')">' + inner + '</g></svg>';
  }

  const viewEl = document.getElementById('bsmp-view');
  if (!viewEl) return;

  let state = CTX.initialSnapshot;
  let ws = null;
  let wsRetryDelayMs = 1500;
  let wsClosedByServer = false;
  let serverError = null;
  let countdownTimer = null;

  // ── Local placement state (client-side until submitted) ──────────────────
  let playerBoard = new Array(CELLS).fill(null); // cell -> shipId | null
  let placements = {};                           // shipId -> { cells, orient, anchor }
  let placeSubmitted = false;
  // Live DOM refs for the placement home grid (drag hit-testing needs identity).
  let homeGrid = null, homeCells = [], trayEl = null;

  const idx = (r, c) => r * SIZE + c;
  const rowOf = (i) => Math.floor(i / SIZE);
  const colOf = (i) => i % SIZE;
  function shipDef(id) { return FLEET.find((s) => s.id === id) || null; }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'style') e.setAttribute('style', attrs[k]);
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
    }
    if (children != null) {
      const list = Array.isArray(children) ? children : [children];
      for (const child of list) { if (child == null || child === false) continue; e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child); }
    }
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ── WebSocket ────────────────────────────────────────────────────────────
  function openWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + location.host + '/games/battleships/multiplayer/ws/' + encodeURIComponent(CTX.matchId);
    let socket;
    try { socket = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
    ws = socket;
    socket.addEventListener('open', () => { wsRetryDelayMs = 1500; send({ type: 'join', csrf: CTX.csrf }); });
    socket.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg && msg.type === 'state' && msg.room) {
        serverError = null;
        state = msg.room;
        if (state.status !== 'placing') placeSubmitted = false;
        else if (state.youPlaced) placeSubmitted = true;
        render();
      } else if (msg && msg.type === 'error') { serverError = msg.code || 'unknown'; render(); }
    });
    socket.addEventListener('close', (ev) => {
      ws = null;
      if (ev.code === 1008 || ev.code === 1003 || ev.code === 1009) { wsClosedByServer = true; render(); return; }
      if (state && state.status === 'ended') return;
      scheduleRetry();
    });
  }
  function scheduleRetry() { setTimeout(openWS, wsRetryDelayMs); wsRetryDelayMs = Math.min(15000, wsRetryDelayMs * 2); }
  function send(payload) { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(payload)); return true; } catch { return false; } }

  function youAre() { return state ? state.you : null; }
  function myTurn() { const me = youAre(); return !!(state && state.status === 'active' && me && state.currentPlayer === me); }

  // ── Placement geometry ───────────────────────────────────────────────────
  function shipCells(anchor, orient, len) {
    const r = rowOf(anchor), c = colOf(anchor); const cells = [];
    for (let k = 0; k < len; k++) {
      const rr = orient === 'v' ? r + k : r, cc = orient === 'h' ? c + k : c;
      if (rr >= SIZE || cc >= SIZE) return null;
      cells.push(idx(rr, cc));
    }
    return cells;
  }
  function placementValid(cells, ignoreId) {
    if (!cells) return false;
    for (const ci of cells) { const occ = playerBoard[ci]; if (occ && occ !== ignoreId) return false; }
    return true;
  }
  function allPlaced() { return FLEET.every((s) => placements[s.id]); }
  function removePlacement(shipId) {
    if (!placements[shipId]) return;
    for (const ci of placements[shipId].cells) if (playerBoard[ci] === shipId) playerBoard[ci] = null;
    delete placements[shipId];
  }
  function placeFleetRandom() {
    for (let i = 0; i < CELLS; i++) playerBoard[i] = null;
    placements = {};
    for (const ship of FLEET) {
      let ok = false, guard = 0;
      while (!ok && guard++ < 500) {
        const orient = Math.random() < 0.5 ? 'h' : 'v';
        const anchor = Math.floor(Math.random() * CELLS);
        const cells = shipCells(anchor, orient, ship.len);
        if (placementValid(cells, null)) { for (const ci of cells) playerBoard[ci] = ship.id; placements[ship.id] = { cells, orient, anchor }; ok = true; }
      }
    }
  }

  // ── Drag & drop (pointer-based, touch-friendly; mirrors single-player) ────
  let drag = null;
  function attachTrayDrag(item, ship, placed) {
    item.addEventListener('pointerdown', (e) => {
      if (state.status !== 'placing' || state.youPlaced) return;
      e.preventDefault();
      const orient = placements[ship.id] ? placements[ship.id].orient : 'h';
      beginDrag(ship, orient, e, item, placed ? 'tray-placed' : 'tray');
    });
  }
  function beginDrag(ship, orient, e, sourceEl, origin) {
    drag = { ship, orient, moved: false, sourceEl, origin: origin || 'tray' };
    if (sourceEl) sourceEl.classList.add('dragging');
    const ghost = el('div', { class: 'bsmp-drag-ghost', html: shipSVG(ship.id, ship.len, 32, orient === 'h') });
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    moveGhost(e.clientX, e.clientY);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
  }
  function moveGhost(x, y) { if (drag && drag.ghost) { drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px'; } }
  function clearPreview() { for (const cell of homeCells) cell.classList.remove('preview-ok', 'preview-bad'); }
  function cellUnder(x, y) {
    const node = document.elementFromPoint(x, y);
    if (node && node.classList.contains('bsmp-cell') && node.parentElement === homeGrid) return parseInt(node.dataset.i, 10);
    return -1;
  }
  function onDragMove(e) {
    if (!drag) return;
    drag.moved = true; moveGhost(e.clientX, e.clientY); clearPreview();
    const anchor = cellUnder(e.clientX, e.clientY);
    if (anchor < 0) return;
    const cells = shipCells(anchor, drag.orient, drag.ship.len);
    const ok = placementValid(cells, drag.ship.id);
    if (cells) { for (const ci of cells) homeCells[ci].classList.add(ok ? 'preview-ok' : 'preview-bad'); }
    else homeCells[anchor].classList.add('preview-bad');
  }
  function onDragUp(e) {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    const d = drag; drag = null; clearPreview();
    if (d.ghost) d.ghost.remove();
    if (d.sourceEl) d.sourceEl.classList.remove('dragging');
    if (!d.moved) {
      if (d.origin === 'board') rotatePlaced(d.ship.id);
      else if (d.origin === 'tray-placed') { removePlacement(d.ship.id); render(); }
      return;
    }
    const anchor = cellUnder(e.clientX, e.clientY);
    if (anchor < 0) return;
    const cells = shipCells(anchor, d.orient, d.ship.len);
    if (!placementValid(cells, d.ship.id)) return;
    removePlacement(d.ship.id);
    for (const ci of cells) playerBoard[ci] = d.ship.id;
    placements[d.ship.id] = { cells, orient: d.orient, anchor };
    render();
  }
  function rotatePlaced(shipId) {
    const p = placements[shipId]; if (!p) return;
    const ship = shipDef(shipId), len = ship.len;
    const sorted = p.cells.slice().sort((a, b) => a - b);
    const pivot = sorted[Math.floor(len / 2)], off = Math.floor(len / 2);
    const newOrient = p.orient === 'h' ? 'v' : 'h';
    const baseR = rowOf(pivot) - (newOrient === 'v' ? off : 0);
    const baseC = colOf(pivot) - (newOrient === 'h' ? off : 0);
    for (const shift of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = baseR + (newOrient === 'v' ? shift : 0), c = baseC + (newOrient === 'h' ? shift : 0);
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
      const cells = shipCells(idx(r, c), newOrient, len);
      if (placementValid(cells, shipId)) {
        removePlacement(shipId);
        for (const ci of cells) playerBoard[ci] = shipId;
        placements[shipId] = { cells, orient: newOrient, anchor: idx(r, c) };
        render(); return;
      }
    }
  }

  // ── Board painting ───────────────────────────────────────────────────────
  // shipMap: cell -> shipId; shots: array of 'hit'|'miss'|null; sunkSet: Set of cells.
  function paintBoard(cells, shipMap, shots, sunkSet, placing) {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.className = 'bsmp-cell'; cell.innerHTML = ''; cell.style.outline = '';
      const shipId = shipMap[i];
      if (shipId && SHIP_META[shipId]) {
        const meta = SHIP_META[shipId];
        cell.classList.add('ship');
        if (placing) cell.classList.add('placing');
        cell.style.outline = '2px solid ' + meta.color; cell.style.outlineOffset = '-2px';
        const lab = el('span', { class: 'bsmp-cell-label' }); lab.textContent = meta.code; lab.style.color = meta.color;
        cell.appendChild(lab);
      }
      const shot = shots ? shots[i] : null;
      if (shot === 'hit') cell.classList.add('hit');
      else if (shot === 'miss') cell.classList.add('miss');
      if (sunkSet && sunkSet.has(i)) cell.classList.add('sunk');
    }
  }
  function shipMapFromList(ships) { const m = {}; for (const sh of (ships || [])) for (const c of sh.cells) m[c] = sh.id; return m; }
  function sunkCellSet(ships, fleetStatus) {
    const sunkIds = new Set((fleetStatus || []).filter((f) => f.sunk).map((f) => f.id));
    const set = new Set();
    for (const sh of (ships || [])) if (sunkIds.has(sh.id)) for (const c of sh.cells) set.add(c);
    return set;
  }

  function buildGrid(cellArr, radar, fireable) {
    const grid = el('div', { class: 'bsmp-grid' + (radar ? ' radar' : '') + (radar && !fireable ? ' locked' : '') });
    grid.style.gridTemplateColumns = 'repeat(' + SIZE + ', 32px)';
    cellArr.length = 0;
    for (let i = 0; i < CELLS; i++) {
      const cell = el('div', { class: 'bsmp-cell' }); cell.dataset.i = i;
      if (radar && fireable) { const ix = i; cell.addEventListener('click', () => { if (myTurn()) send({ type: 'fire', index: ix }); }); }
      grid.appendChild(cell); cellArr.push(cell);
    }
    return grid;
  }

  function boardBlock(label, tagClass, tagText, grid) {
    return el('div', { class: 'bsmp-board-block' }, [
      el('div', { class: 'bsmp-board-label' }, [el('span', null, label), el('span', { class: tagClass }, tagText)]),
      el('div', { class: 'bsmp-board-shell' }, grid),
    ]);
  }

  // ── Fleet status panels ──────────────────────────────────────────────────
  function fleetPanel(titleClass, title, entries) {
    const list = el('div', { class: 'bsmp-foe-list' });
    for (const e of (entries || [])) {
      const row = el('div', { class: 'bsmp-foe-ship' + (e.sunk ? ' downed' : '') }, [
        el('span', { class: 'bsmp-foe-icon', html: shipSVG(e.id, e.len, 13, true) }),
        el('div', { class: 'bsmp-foe-meta' }, [
          el('span', { class: 'bsmp-foe-name' }, e.name),
          el('span', { class: 'bsmp-foe-len' }, e.len + ' cells'),
        ]),
      ]);
      list.appendChild(row);
    }
    const panel = el('div', { class: 'bsmp-side' }, [el('p', { class: 'bsmp-side-title' }, title), list]);
    if (titleClass === 'mine') { panel.classList.remove('bsmp-side'); panel.classList.add('bsmp-tray-panel'); panel.firstChild.className = 'bsmp-tray-title'; }
    return panel;
  }

  // ── Tray (placement) ─────────────────────────────────────────────────────
  function buildTrayPanel() {
    const panel = el('div', { class: 'bsmp-tray-panel' });
    panel.appendChild(el('p', { class: 'bsmp-tray-title' }, 'Your Fleet'));
    panel.appendChild(el('p', { class: 'bsmp-tray-hint' }, 'Drag each ship onto your waters (green = ok, red = no room). Drag a placed ship to move it, tap it to rotate, or click its card here to recall it.'));
    trayEl = el('div', { class: 'bsmp-tray' });
    for (const ship of FLEET) {
      const placed = !!placements[ship.id];
      const item = el('div', { class: 'bsmp-tray-ship' + (placed ? ' placed' : '') });
      item.dataset.ship = ship.id;
      item.appendChild(el('div', { class: 'bsmp-tray-ship-name', html:
        '<span>' + ship.name + ' <span class="bsmp-hull-code" style="color:' + SHIP_META[ship.id].color + '">' + SHIP_META[ship.id].code + '</span></span>' +
        (placed ? '<span class="placed-tag">recall ⤺</span>' : '<span>' + ship.len + '×1</span>') }));
      item.appendChild(el('div', { class: 'bsmp-tray-shape', html: shipSVG(ship.id, ship.len, 22, true) }));
      attachTrayDrag(item, ship, placed);
      trayEl.appendChild(item);
    }
    panel.appendChild(trayEl);
    const controls = el('div', { class: 'bsmp-ready-row' });
    const row = el('div', { style: 'display:flex; gap:0.5rem;' });
    const randomBtn = el('button', { class: 'bsmp-btn', type: 'button', style: 'flex:1; justify-content:center;' }, '[ randomize ]');
    randomBtn.addEventListener('click', () => { placeFleetRandom(); render(); });
    const clearBtn = el('button', { class: 'bsmp-btn', type: 'button', style: 'flex:1; justify-content:center;' }, '[ clear ]');
    clearBtn.addEventListener('click', () => { for (let i = 0; i < CELLS; i++) playerBoard[i] = null; placements = {}; render(); });
    row.appendChild(randomBtn); row.appendChild(clearBtn);
    controls.appendChild(row);
    const ready = el('button', { class: 'bsmp-btn', type: 'button' }, '[ Ready — deploy fleet ]');
    ready.disabled = !allPlaced();
    ready.addEventListener('click', () => {
      if (!allPlaced()) return;
      const fleet = FLEET.map((s) => ({ id: s.id, cells: placements[s.id].cells }));
      placeSubmitted = true; send({ type: 'place', fleet }); render();
    });
    controls.appendChild(ready);
    panel.appendChild(controls);
    return panel;
  }

  // ── Players / status / timer ──────────────────────────────────────────────
  function avatarEl(p) {
    if (p && p.avatarURL) return el('img', { class: 'bsmp-avatar', src: p.avatarURL, alt: p.username, width: '34', height: '34' });
    return el('div', { class: 'bsmp-avatar placeholder' }, p && p.username ? p.username.charAt(0).toUpperCase() : '?');
  }
  function playerCard(p, sym, side) {
    const isYou = p && p.discordId === CTX.selfId;
    const isTurn = state.status === 'active' && state.currentPlayer === sym;
    const cls = ['bsmp-player', side === 'right' ? 'right' : '', isYou ? 'you' : '', isTurn ? 'turn' : '', (p && !p.connected) ? 'disconnected' : '', !p ? 'empty' : ''].filter(Boolean).join(' ');
    if (!p) return el('div', { class: cls }, [el('div', { class: 'bsmp-avatar placeholder' }, '?'), el('span', { class: 'bsmp-pname' }, 'waiting…')]);
    return el('div', { class: cls }, [avatarEl(p), el('span', { class: 'bsmp-pname' }, '@' + p.username + (isYou ? ' (you)' : ''))]);
  }
  function playersRow() { return el('div', { class: 'bsmp-players' }, [playerCard(state.players.X, 'X', 'left'), el('div', { class: 'bsmp-vs' }, 'vs'), playerCard(state.players.O, 'O', 'right')]); }

  function statusLine() {
    const me = youAre();
    if (state.status === 'waiting') return el('div', { class: 'bsmp-status' }, 'Waiting for an opponent to join…');
    if (state.status === 'placing') {
      if (state.youPlaced && !state.opponentPlaced) return el('div', { class: 'bsmp-status' }, 'Fleet deployed — waiting for opponent…');
      if (state.youPlaced && state.opponentPlaced) return el('div', { class: 'bsmp-status' }, 'Both fleets ready — starting…');
      return el('div', { class: 'bsmp-status' }, 'Deploy your fleet — drag ships onto your waters');
    }
    if (state.status === 'active') {
      const otherSym = me === 'X' ? 'O' : 'X', other = me ? state.players[otherSym] : null;
      if (other && !other.connected) return el('div', { class: 'bsmp-status warn' }, 'Opponent reconnecting…');
      if (me && state.currentPlayer === me) return el('div', { class: 'bsmp-status' }, 'Your turn — fire at the enemy waters');
      const w = state.players[state.currentPlayer];
      return el('div', { class: 'bsmp-status' }, 'Waiting for ' + (w ? '@' + w.username : 'opponent') + '…');
    }
    if (state.status === 'ended') {
      const r = state.result || {};
      if (me && r.winner === me) { const tail = r.reason === 'disconnect' ? ' (opponent disconnected)' : r.reason === 'forfeit' ? ' (opponent forfeited)' : ''; return el('div', { class: 'bsmp-status win' }, 'Victory!' + tail); }
      if (me && r.winner && r.winner !== me) { const tail = r.reason === 'disconnect' ? ' (you disconnected)' : r.reason === 'forfeit' ? ' (you forfeited)' : ''; return el('div', { class: 'bsmp-status lose' }, 'Defeat.' + tail); }
      if (r.winner == null) return el('div', { class: 'bsmp-status' }, 'Match ended.');
      const w = state.players[r.winner];
      return el('div', { class: 'bsmp-status win' }, (w ? '@' + w.username : r.winner) + ' wins');
    }
    return el('div', { class: 'bsmp-status' }, '');
  }
  function timerLine() {
    let deadline = null;
    if (state.status === 'active') deadline = state.turnDeadline;
    else if (state.status === 'placing' && !state.youPlaced) deadline = state.placeDeadline;
    if (!deadline) return null;
    const wrap = el('div', { class: 'bsmp-timer' });
    wrap.appendChild(el('span', null, state.status === 'placing' ? 'deploy timer' : 'turn timer'));
    const count = el('span', { class: 'count' }, '—'); wrap.appendChild(count);
    const tick = () => { const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); count.textContent = rem + 's'; if (rem <= 5) wrap.classList.add('urgent'); else wrap.classList.remove('urgent'); };
    tick(); if (countdownTimer) clearInterval(countdownTimer); countdownTimer = setInterval(tick, 250);
    return wrap;
  }

  function inviteBlock() {
    const url = location.origin + '/games/battleships/multiplayer/' + encodeURIComponent(CTX.matchId);
    const wrap = el('div', { class: 'bsmp-invite' });
    wrap.appendChild(el('div', { style: 'color: var(--fog-300); text-align:center;' }, 'Share this link with one other player:'));
    wrap.appendChild(el('div', { class: 'bsmp-invite-url' }, url));
    const copyBtn = el('button', { class: 'bsmp-btn', type: 'button' }, '[ copy link ]');
    copyBtn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); const prev = copyBtn.textContent; copyBtn.textContent = '[ copied! ]'; setTimeout(() => { copyBtn.textContent = prev; }, 1500); } catch { window.prompt('Copy this link:', url); } });
    wrap.appendChild(copyBtn); return wrap;
  }
  function endActions() {
    const me = youAre(); const wrap = el('div', { class: 'bsmp-end-actions' });
    if (me) {
      const meSlot = state.players[me];
      if (meSlot && meSlot.rematchAccepted) { const opp = state.players[me === 'X' ? 'O' : 'X']; wrap.appendChild(el('div', { style: 'flex-basis:100%; text-align:center; color: var(--fog-300); margin-bottom:0.25rem;' }, 'Waiting for ' + (opp ? '@' + opp.username : 'opponent') + ' to accept rematch…')); }
      else { const rematch = el('button', { class: 'bsmp-btn', type: 'button' }, '[ rematch ]'); rematch.addEventListener('click', () => send({ type: 'rematch_request' })); wrap.appendChild(rematch); }
    }
    wrap.appendChild(el('a', { href: '/games/battleships/multiplayer', class: 'bsmp-btn' }, '[ new room ]'));
    const leave = el('button', { class: 'bsmp-btn danger', type: 'button' }, '[ leave ]');
    leave.addEventListener('click', () => { send({ type: 'leave' }); setTimeout(() => { window.location.href = '/games/battleships/multiplayer'; }, 200); });
    wrap.appendChild(leave); return wrap;
  }

  // ── Arenas ────────────────────────────────────────────────────────────────
  function placementArena() {
    const arena = el('div', { class: 'bsmp-arena' });
    // Left: enemy fleet (all alive during placement) for layout parity.
    arena.appendChild(fleetPanel('foe', 'Enemy Fleet', state.enemyFleet));
    // Center: your home board (interactive).
    homeCells = [];
    homeGrid = buildGrid(homeCells, false, false);
    const boards = el('div', { class: 'bsmp-boards' }, [boardBlock('Your Waters', 'home-tag', 'deploy', homeGrid)]);
    arena.appendChild(boards);
    // Right: tray.
    arena.appendChild(buildTrayPanel());

    // Grab a placed ship off the board: drag to move, tap to rotate.
    homeGrid.addEventListener('pointerdown', (e) => {
      if (state.status !== 'placing' || state.youPlaced) return;
      const cell = e.target.closest('.bsmp-cell'); if (!cell) return;
      const shipId = playerBoard[parseInt(cell.dataset.i, 10)]; if (!shipId) return;
      e.preventDefault();
      beginDrag(shipDef(shipId), placements[shipId].orient, e, null, 'board');
    });

    paintBoard(homeCells, playerBoard, null, null, true);
    return arena;
  }

  function battleArena() {
    const me = youAre();
    const arena = el('div', { class: 'bsmp-arena' });
    arena.appendChild(fleetPanel('foe', 'Enemy Fleet', state.enemyFleet));

    const radarCells = []; const homeCells2 = [];
    const radarGrid = buildGrid(radarCells, true, myTurn());
    const homeG = buildGrid(homeCells2, false, false);
    const boards = el('div', { class: 'bsmp-boards' }, [
      boardBlock('Enemy Waters', 'radar-tag', 'radar', radarGrid),
      boardBlock('Your Waters', 'home-tag', 'fleet', homeG),
    ]);
    arena.appendChild(boards);

    // Right: your fleet status (was previously under the board).
    arena.appendChild(fleetPanel('mine', 'Your Fleet', state.yourFleet));

    // Paint radar: your shots + revealed (sunk / end) enemy ships.
    paintBoard(radarCells, shipMapFromList(state.enemyRevealed), state.yourShots,
      sunkCellSet(state.enemyRevealed, state.enemyFleet), false);
    // Paint home: your ships + incoming shots + your sunk ships.
    paintBoard(homeCells2, shipMapFromList(state.yourShips), state.yourIncoming,
      sunkCellSet(state.yourShips, state.yourFleet), false);
    return arena;
  }

  function renderError() {
    const codeMap = {
      room_full: 'This room is already full.', bad_csrf: 'Session expired. Reload the page.',
      auth_required: 'Authentication required. Reload the page.', room_not_found: 'This room no longer exists.',
      game_ended: 'This game has already ended.', rate_limited: "You're sending messages too quickly.", message_too_large: 'Message too large.',
    };
    const message = codeMap[serverError] || ('Server error: ' + serverError);
    clear(viewEl);
    viewEl.appendChild(el('p', { class: 'bsmp-subtitle' }, 'Error'));
    viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--danger); margin: 0 0 1rem;' }, message));
    viewEl.appendChild(el('div', { style: 'display:flex; justify-content:center; gap:0.6rem;' }, [el('a', { href: '/games/battleships/multiplayer', class: 'bsmp-btn' }, '[ back to lobby ]')]));
  }
  function friendlyErr(code) {
    if (code === 'already_shot') return 'You already fired there.';
    if (code === 'not_your_turn') return "It's not your turn.";
    if (typeof code === 'string' && code.indexOf('invalid_placement') === 0) return 'Invalid fleet placement — try again.';
    return code;
  }

  function render() {
    // Never tear down the DOM while a drag is mid-flight (it holds live refs).
    if (drag) return;
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (wsClosedByServer && serverError) { renderError(); return; }
    if (!state) { clear(viewEl); viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--fog-300); margin:0;' }, 'Connecting…')); return; }

    clear(viewEl);
    viewEl.appendChild(playersRow());
    const status = statusLine(); if (status) viewEl.appendChild(status);
    const t = timerLine(); if (t) viewEl.appendChild(t);

    if (state.status === 'waiting') {
      viewEl.appendChild(inviteBlock());
    } else if (state.status === 'placing') {
      if (state.youPlaced) viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--fog-300);' }, 'Your fleet is deployed. Waiting for your opponent to finish placing…'));
      else viewEl.appendChild(placementArena());
    } else {
      viewEl.appendChild(battleArena());
      if (state.status === 'ended') viewEl.appendChild(endActions());
    }

    if (serverError && !wsClosedByServer) viewEl.appendChild(el('div', { class: 'bsmp-err-banner' }, 'Server: ' + friendlyErr(serverError)));
  }

  // Seed a sensible default layout the first time we enter placement so the
  // board is never empty if the player just wants to randomize/tweak.
  render();
  openWS();

  let resizeRaf;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { if (state) render(); }); });
  window.addEventListener('beforeunload', () => { try { ws && ws.close(1000, 'unload'); } catch {} });
})();
</script>
`;
}
