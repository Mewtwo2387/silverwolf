/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import type { TcgRoomSnapshot } from '../../multiplayer/tcgRooms';
import type { TcgRoster } from './tcg_battle_landing';

function inlineJson(v: unknown): string {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c');
}
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

export interface TcgRoomPageOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  matchId: string;
  selfDiscordId: string | null;
  csrf: string | null;
  snapshot: TcgRoomSnapshot | null;
  roomMissing?: boolean;
  loginReturnPath: string;
}

export interface TcgJoinPageOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  matchId: string;
  csrf: string | null;
  roster: TcgRoster[];
  deckLegal: boolean;
}

interface NoticeOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  title: string;
  bodyHtml: ReturnType<typeof html>;
}

function notice(opts: NoticeOpts) {
  return Layout({
    title: `Silverwolf — ${opts.title}`,
    active: 'games',
    body: html`
      ${battleStyles()}
      <h1 class="text-center">${opts.title}</h1>
      <div class="tcg-room-wrap">
        <div class="tcg-panel" style="text-align:center;">
          ${opts.bodyHtml}
        </div>
      </div>
    ` as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

/** Team-picker shown to a second player opening a PvP lobby link. */
export function TcgBattleJoinPage(opts: TcgJoinPageOpts) {
  const {
    nonce, lv999, user, matchId, csrf, roster, deckLegal,
  } = opts;
  const options = roster.map((r) => `<option value="${escapeAttr(r.value)}">${escapeText(r.name)}</option>`).join('');
  const firstThree = roster.slice(0, 3).map((r) => r.value);
  const script = raw(joinScript(nonce, { csrf: csrf ?? '', matchId, defaults: firstThree }));

  const body = html`
    ${battleStyles()}
    <h1 class="text-center" style="margin-bottom:0.25rem;">Join TCG Battle</h1>
    <p class="text-center text-fog-300" style="margin-bottom:1rem;">Pick your team of three to join this match.</p>
    <div class="tcg-room-wrap">
      <div class="tcg-panel">
        <div class="tcg-field">
          <label>Your Team</label>
          <div class="tcg-team">
            ${[0, 1, 2].map((i) => raw(`<select class="tcg-select" id="tcg-join-${i}" aria-label="Team slot ${i + 1}">${options}</select>`))}
          </div>
        </div>
        <div class="tcg-field">
          <label>Deck</label>
          <div class="tcg-deck-row">
            <span class="tcg-badge ${deckLegal ? 'legal' : 'illegal'}">${deckLegal ? 'legal deck' : 'illegal deck'}</span>
            <a href="/games/tcg/deck" class="tcg-btn">[ edit deck ]</a>
          </div>
          ${deckLegal ? '' : html`<p class="tcg-warn">Your saved deck isn't legal — fix it before joining.</p>`}
        </div>
        <div class="tcg-create-row">
          <button id="tcg-join" type="button" class="tcg-btn" ${deckLegal ? '' : 'disabled'}>[ Join Battle ]</button>
        </div>
        <div id="tcg-join-err" class="tcg-err" aria-live="polite"></div>
      </div>
    </div>
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — Join TCG Battle',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

export function TcgBattleRoomPage(opts: TcgRoomPageOpts) {
  const {
    nonce, lv999, user, matchId, selfDiscordId, csrf, snapshot, roomMissing, loginReturnPath,
  } = opts;

  if (!user) {
    return notice({
      nonce,
      lv999,
      user,
      title: 'Log In Required',
      bodyHtml: html`
        <p style="color: var(--fog-300); margin: 0 0 1rem;">Log in with Discord to view this battle.</p>
        <a href="/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}" class="tcg-btn">[ Log in with Discord ]</a>
      `,
    });
  }

  if (roomMissing) {
    return notice({
      nonce,
      lv999,
      user,
      title: 'Battle Not Found',
      bodyHtml: html`
        <p style="color: var(--fog-300); margin: 0 0 1rem;">This battle doesn't exist, already ended, or expired.</p>
        <a href="/games/tcg" class="tcg-btn">[ Back to Lobby ]</a>
      `,
    });
  }

  const script = raw(roomScript(nonce, {
    matchId, csrf: csrf ?? '', selfDiscordId: selfDiscordId ?? '', snapshot,
  }));

  const body = html`
    ${battleStyles()}
    <h1 class="text-center" style="margin-bottom:0.25rem;">TCG Battle</h1>
    <p class="text-center text-fog-300" style="margin-bottom:1rem;">
      Match <code style="color: var(--accent-light);">${matchId.slice(0, 10)}…</code>
    </p>
    <div class="tcg-room-wrap" id="tcg-root">
      <div class="tcg-panel" id="tcg-view">
        <p style="text-align:center; color: var(--fog-300); margin: 0;">Connecting…</p>
      </div>
    </div>
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — TCG Battle',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

function battleStyles() {
  return raw(`
<style>
  .tcg-room-wrap { max-width: 1080px; margin: 1.25rem auto 0; display: flex; flex-direction: column; gap: 1rem; }
  .tcg-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem; padding: 1rem 1.25rem;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .tcg-subtitle { text-align: center; color: var(--fog-300); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.18em; margin: 0 0 1rem; font-family: 'JetBrains Mono', monospace; }
  .tcg-btn {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent-pale) 10%, transparent));
    color: var(--accent-light); border: 1px solid var(--accent); border-radius: 4px;
    padding: 0.55rem 1.1rem; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;
    box-shadow: 0 0 8px var(--glow-faint); transition: transform 0.1s, box-shadow 0.15s, color 0.15s;
  }
  .tcg-btn:hover { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .tcg-btn:active { transform: translateY(1px); }
  .tcg-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
  .tcg-btn.danger { color: var(--danger); border-color: var(--danger); box-shadow: 0 0 8px var(--danger-glow); }
  .tcg-btn.danger:hover { color: #fff; box-shadow: 0 0 16px var(--danger-glow); }

  .tcg-field { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
  .tcg-field > label { font-size: 0.7rem; font-weight: 700; color: var(--fog-400); text-transform: uppercase; letter-spacing: 0.06em; font-family: 'JetBrains Mono', monospace; }
  .tcg-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  @media (max-width: 520px) { .tcg-team { grid-template-columns: 1fr; } }
  .tcg-select { width: 100%; padding: 0.5rem; background: var(--ink-900); color: var(--fog-100); border: 1px solid var(--ink-600); border-radius: 0.4rem; font: inherit; font-size: 0.85rem; }
  .tcg-deck-row { display: flex; align-items: center; gap: 0.6rem; }
  .tcg-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid var(--ink-600); color: var(--fog-300); }
  .tcg-badge.legal { color: #4ade80; border-color: color-mix(in oklab, #4ade80 50%, transparent); }
  .tcg-badge.illegal { color: var(--danger); border-color: color-mix(in oklab, var(--danger) 50%, transparent); }
  .tcg-warn { color: var(--danger); font-size: 0.8rem; margin: 0.25rem 0 0; }
  .tcg-create-row { display: flex; justify-content: center; margin-top: 1rem; }
  .tcg-err { margin-top: 0.6rem; text-align: center; color: var(--danger); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; min-height: 1.1rem; }

  /* Players header */
  .tcg-players { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.75rem; }
  .tcg-player { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.7rem; background: color-mix(in oklab, var(--ink-900) 50%, transparent); border: 1px solid var(--ink-600); border-radius: 0.6rem; font-family: 'JetBrains Mono', monospace; }
  .tcg-player.right { flex-direction: row-reverse; text-align: right; }
  .tcg-player.you { border-color: color-mix(in oklab, var(--accent) 65%, transparent); box-shadow: 0 0 8px var(--glow-faint); }
  .tcg-player.turn { border-color: var(--accent); box-shadow: 0 0 14px var(--glow-bright); }
  .tcg-player.empty { opacity: 0.6; font-style: italic; color: var(--fog-400); }
  .tcg-player.disc { border-style: dashed; opacity: 0.7; }
  .tcg-avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--accent); flex-shrink: 0; background: var(--ink-700); }
  .tcg-avatar.ph { display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--fog-300); font-size: 0.9rem; }
  .tcg-pname { font-size: 0.85rem; color: var(--fog-100); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tcg-vs { color: var(--fog-400); font-size: 0.85rem; letter-spacing: 0.1em; text-align: center; font-family: 'JetBrains Mono', monospace; }

  .tcg-status { text-align: center; font-size: 1.05rem; font-weight: 600; color: var(--accent-light); font-family: 'JetBrains Mono', monospace; margin: 0.6rem 0 0.2rem; min-height: 1.6rem; }
  .tcg-status.win { font-size: 1.6rem; font-weight: 800; color: #4ade80; }
  .tcg-status.lose { font-size: 1.6rem; font-weight: 800; color: var(--danger); }
  .tcg-status.draw { font-size: 1.4rem; font-weight: 800; color: var(--fog-200); }
  .tcg-status.warn { color: var(--danger); }
  .tcg-timer { display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.3rem; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: var(--fog-400); }
  .tcg-timer .count { color: var(--accent-light); font-weight: 700; }
  .tcg-timer.urgent .count { color: var(--danger); }

  /* Board rows of character cards */
  .tcg-board { display: flex; flex-direction: column; gap: 0.8rem; margin-top: 0.6rem; }
  .tcg-row { display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; }
  .tcg-char {
    position: relative; width: 150px; max-width: 30vw; border-radius: 0.6rem; overflow: hidden;
    border: 2px solid var(--ink-600); background: var(--ink-900); cursor: default; flex: 0 0 auto;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .tcg-char .art { width: 100%; aspect-ratio: 1080 / 1920; object-fit: cover; display: block; }
  .tcg-char.active { border-color: var(--accent); box-shadow: 0 0 16px var(--glow-bright); }
  .tcg-char.focus { border-color: var(--accent-light); box-shadow: 0 0 14px var(--glow-bright); }
  .tcg-char.targetable { cursor: crosshair; border-color: var(--danger); box-shadow: 0 0 12px var(--danger-glow); }
  .tcg-char.targetable.ally { border-color: #4ade80; box-shadow: 0 0 12px rgba(74,222,128,0.5); }
  .tcg-char.ko { filter: grayscale(0.85) brightness(0.6); }
  .tcg-char.clickme { cursor: pointer; }
  .tcg-char-top {
    position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
    padding: 3px 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.66rem; font-weight: 700;
    background: linear-gradient(180deg, rgba(0,0,0,0.8), transparent);
  }
  .tcg-char-name { color: #fff; text-shadow: 0 1px 3px #000; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tcg-char-energy { color: #ffe08a; text-shadow: 0 1px 3px #000; }
  .tcg-char-bottom { position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 5px 5px; background: linear-gradient(0deg, rgba(0,0,0,0.85), transparent); }
  .tcg-hp-bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.18); overflow: hidden; border: 1px solid rgba(0,0,0,0.5); }
  .tcg-hp-fill { height: 100%; background: linear-gradient(90deg, #4ade80, #22d3ee); transition: width 0.3s ease; }
  .tcg-hp-fill.low { background: linear-gradient(90deg, #f87171, #fb923c); }
  .tcg-hp-text { font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; color: #fff; text-shadow: 0 1px 2px #000; text-align: center; margin-top: 1px; }
  .tcg-effects { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 3px; justify-content: center; }
  .tcg-eff { font-size: 0.56rem; padding: 0 3px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; line-height: 1.4; }
  .tcg-eff.buff { background: color-mix(in oklab, #4ade80 30%, transparent); color: #d1fae5; border: 1px solid color-mix(in oklab, #4ade80 50%, transparent); }
  .tcg-eff.debuff { background: color-mix(in oklab, var(--danger) 30%, transparent); color: #fee2e2; border: 1px solid color-mix(in oklab, var(--danger) 50%, transparent); }
  .tcg-ko-badge { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: var(--danger); font-size: 0.9rem; text-shadow: 0 1px 4px #000; }

  /* Controls */
  .tcg-controls { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.4rem; }
  .tcg-arm-hint { text-align: center; font-size: 0.78rem; color: var(--accent-light); font-family: 'JetBrains Mono', monospace; min-height: 1.1rem; }
  .tcg-skill-list { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
  .tcg-skill {
    text-align: left; min-width: 180px; max-width: 240px; flex: 1 1 180px;
    background: color-mix(in oklab, var(--ink-900) 50%, transparent); border: 1px solid var(--ink-600);
    border-radius: 0.5rem; padding: 0.4rem 0.55rem; color: var(--fog-200); font: inherit; cursor: pointer;
    display: flex; flex-direction: column; gap: 0.12rem; transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .tcg-skill:not(:disabled):hover { border-color: var(--accent); box-shadow: 0 0 10px var(--glow-faint); }
  .tcg-skill:not(:disabled):active { transform: translateY(1px); }
  .tcg-skill:disabled { opacity: 0.5; cursor: not-allowed; }
  .tcg-skill.armed { border-color: var(--accent); box-shadow: 0 0 14px var(--glow-bright); }
  .tcg-skill .sk-name { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: 0.78rem; color: var(--fog-100); }
  .tcg-skill .sk-cat { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .tcg-skill .sk-cat.normal { color: var(--fog-400); }
  .tcg-skill .sk-cat.charged { color: #67c7ff; }
  .tcg-skill .sk-cat.ultimate { color: #ff8a80; }
  .tcg-skill .sk-dmg { color: var(--accent-light); font-weight: 800; }
  .tcg-skill .sk-desc { font-size: 0.64rem; color: var(--fog-400); line-height: 1.3; }
  .tcg-skill .sk-reason { font-size: 0.6rem; color: var(--danger); font-style: italic; }

  .tcg-hand { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }
  .tcg-hand-card {
    width: 88px; border-radius: 0.4rem; overflow: hidden; border: 1px solid var(--ink-600);
    background: var(--ink-900); cursor: pointer; position: relative; flex: 0 0 auto;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .tcg-hand-card:hover { border-color: var(--accent); transform: translateY(-3px); }
  .tcg-hand-card.armed { border-color: var(--accent); box-shadow: 0 0 14px var(--glow-bright); }
  .tcg-hand-card img { width: 100%; aspect-ratio: 1080 / 1920; object-fit: cover; display: block; }
  .tcg-hand-empty { color: var(--fog-400); font-style: italic; font-size: 0.82rem; }

  .tcg-actionbar { display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; }
  .tcg-log { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column-reverse; gap: 0.15rem; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: var(--fog-300); }
  .tcg-log div { line-height: 1.35; }
  .tcg-section-title { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--fog-400); margin: 0 0 0.3rem; font-family: 'JetBrains Mono', monospace; }
  .tcg-invite { display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
  .tcg-invite-url { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--fog-200); background: var(--ink-900); border: 1px solid var(--ink-600); border-radius: 0.4rem; padding: 0.4rem 0.6rem; max-width: 100%; overflow-x: auto; white-space: nowrap; }
  .tcg-end-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem; margin-top: 0.6rem; }
  .tcg-sp { display: flex; justify-content: center; gap: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--fog-300); margin-top: 0.2rem; }
  .tcg-sp b { color: var(--accent-light); }
  @media (prefers-reduced-motion: reduce) { .tcg-hp-fill { transition: none; } }
</style>
`);
}

function joinScript(nonce: string, ctx: { csrf: string; matchId: string; defaults: string[] }) {
  return `
<script nonce="${nonce}">
(() => {
  const CSRF = ${inlineJson(ctx.csrf)};
  const MATCH = ${inlineJson(ctx.matchId)};
  const DEFAULTS = ${inlineJson(ctx.defaults)};
  const joinBtn = document.getElementById('tcg-join');
  const errEl = document.getElementById('tcg-join-err');
  const selects = [0, 1, 2].map((i) => document.getElementById('tcg-join-' + i));
  if (!joinBtn) return;
  selects.forEach((s, i) => { if (s && DEFAULTS[i]) s.value = DEFAULTS[i]; });
  joinBtn.addEventListener('click', async () => {
    if (joinBtn.hasAttribute('disabled')) return;
    errEl.textContent = '';
    const team = selects.map((s) => s ? s.value : '');
    if (team.some((t) => !t)) { errEl.textContent = 'Pick three characters.'; return; }
    joinBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/tcg/' + encodeURIComponent(MATCH) + '/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? data.error : 'Failed to join.';
        joinBtn.removeAttribute('disabled');
        return;
      }
      window.location.href = '/games/tcg/' + encodeURIComponent(MATCH);
    } catch (e) {
      errEl.textContent = 'Network error.';
      joinBtn.removeAttribute('disabled');
    }
  });
})();
</script>
`;
}

function roomScript(nonce: string, ctx: {
  matchId: string;
  csrf: string;
  selfDiscordId: string;
  snapshot: TcgRoomSnapshot | null;
}) {
  return `
<script nonce="${nonce}">
(() => {
  const CTX = {
    matchId: ${inlineJson(ctx.matchId)},
    csrf: ${inlineJson(ctx.csrf)},
    selfId: ${inlineJson(ctx.selfDiscordId)},
    initial: ${inlineJson(ctx.snapshot)},
  };

  const viewEl = document.getElementById('tcg-view');
  if (!viewEl) return;

  let state = CTX.initial;            // TcgRoomSnapshot | null
  let ws = null;
  let wsRetryDelayMs = 1500;
  let wsClosedByServer = false;
  let serverError = null;
  let countdownTimer = null;
  let focusSlot = null;               // focused own-team slot for the skill panel
  let armedSkill = null;              // { slot, index, targetKind }
  let armedItem = null;               // hand slotId
  const logLines = [];
  let lastLogSig = '';

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      const list = Array.isArray(children) ? children : [children];
      for (const c of list) { if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    }
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function openWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + location.host + '/games/tcg/ws/' + encodeURIComponent(CTX.matchId);
    let socket;
    try { socket = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
    ws = socket;
    socket.addEventListener('open', () => { wsRetryDelayMs = 1500; send({ type: 'join', csrf: CTX.csrf }); });
    socket.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg && msg.type === 'state' && msg.room) { serverError = null; ingest(msg.room); render(); }
      else if (msg && msg.type === 'error') { serverError = msg.code || 'unknown'; render(); }
    });
    socket.addEventListener('close', (ev) => {
      ws = null;
      if (ev.code === 1008 || ev.code === 1003) { wsClosedByServer = true; render(); return; }
      if (state && state.status === 'ended') return;
      scheduleRetry();
    });
  }
  function scheduleRetry() { setTimeout(openWS, wsRetryDelayMs); wsRetryDelayMs = Math.min(15000, wsRetryDelayMs * 2); }
  function send(p) { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(p)); return true; } catch { return false; } }

  function ingest(room) {
    state = room;
    const b = room.battle;
    if (b && b.lastActionLog && b.lastActionLog.length) {
      const sig = b.currentTurn + '|' + b.lastActionLog.join('\\u241f');
      if (sig !== lastLogSig) { lastLogSig = sig; for (const ln of b.lastActionLog) logLines.push(ln); if (logLines.length > 200) logLines.splice(0, logLines.length - 200); }
    }
    // Reset stale selections if it's not actionable.
    if (!myTurn()) { armedSkill = null; armedItem = null; }
  }

  function mySide() { return state ? state.yourSide : null; }
  function oppSide() { const s = mySide(); return s === 'p1' ? 'p2' : 'p1'; }
  function myTurn() {
    const b = state && state.battle;
    return !!(b && state.status === 'active' && mySide() && b.currentPlayer === mySide());
  }

  // ── pieces ──────────────────────────────────────────────────────────────
  function avatarEl(p) {
    if (p && p.avatarURL) return el('img', { class: 'tcg-avatar', src: p.avatarURL, alt: p.username, width: '32', height: '32' });
    const letter = p && p.username ? p.username.charAt(0).toUpperCase() : '?';
    return el('div', { class: 'tcg-avatar ph' }, letter);
  }
  function playerCard(p, side, align) {
    const b = state.battle;
    const isYou = p && p.discordId === CTX.selfId;
    const isTurn = b && state.status === 'active' && b.currentPlayer === side;
    const cls = ['tcg-player', align === 'right' ? 'right' : '', isYou ? 'you' : '', isTurn ? 'turn' : '', (p && !p.connected) ? 'disc' : '', !p ? 'empty' : ''].filter(Boolean).join(' ');
    if (!p) return el('div', { class: cls }, [el('div', { class: 'tcg-avatar ph' }, '?'), el('span', { class: 'tcg-pname' }, 'waiting…'), el('span', null, side.toUpperCase())]);
    return el('div', { class: cls }, [avatarEl(p), el('span', { class: 'tcg-pname' }, '@' + p.username + (isYou ? ' (you)' : '')), el('span', { style: 'color:var(--fog-400);font-size:0.7rem;' }, side.toUpperCase())]);
  }
  function playersRow() {
    return el('div', { class: 'tcg-players' }, [playerCard(state.players.p1, 'p1', 'left'), el('div', { class: 'tcg-vs' }, 'vs'), playerCard(state.players.p2, 'p2', 'right')]);
  }

  function charCard(ch, side) {
    const mine = side === mySide();
    const b = state.battle;
    const isActiveSlot = b.currentPlayer === side && b.activeSlot === ch.slot && !ch.isKnockedOut;
    const cls = ['tcg-char'];
    if (isActiveSlot) cls.push('active');
    if (ch.isKnockedOut) cls.push('ko');
    if (mine && focusSlot === ch.slot) cls.push('focus');

    // Targeting affordances
    let targetable = false;
    if (armedSkill && myTurn() && !ch.isKnockedOut) {
      if (armedSkill.targetKind === 'opponent' && !mine) { targetable = true; cls.push('targetable'); }
      else if (armedSkill.targetKind === 'ally' && mine) { targetable = true; cls.push('targetable', 'ally'); }
    }
    if (armedItem != null && myTurn() && mine && !ch.isKnockedOut) { targetable = true; cls.push('targetable', 'ally'); }
    if (mine && !ch.isKnockedOut && !targetable) cls.push('clickme');

    const card = el('div', { class: cls.join(' ') });
    const img = el('img', { class: 'art', src: '/static/tcg/char/' + encodeURIComponent(ch.slug) + '.png', alt: ch.name, loading: 'lazy', decoding: 'async' });
    card.appendChild(img);

    card.appendChild(el('div', { class: 'tcg-char-top' }, [
      el('span', { class: 'tcg-char-name' }, ch.name),
      el('span', { class: 'tcg-char-energy' }, '\\u26a1' + ch.energy),
    ]));

    const bottom = el('div', { class: 'tcg-char-bottom' });
    const pct = Math.max(0, Math.min(100, Math.round((100 * ch.currentHp) / Math.max(1, ch.maxHp))));
    const bar = el('div', { class: 'tcg-hp-bar' });
    const fill = el('div', { class: 'tcg-hp-fill' + (pct <= 30 ? ' low' : '') });
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    bottom.appendChild(bar);
    bottom.appendChild(el('div', { class: 'tcg-hp-text' }, ch.currentHp + ' / ' + ch.maxHp));
    if (ch.effects && ch.effects.length) {
      const fx = el('div', { class: 'tcg-effects' });
      for (const e of ch.effects.slice(0, 6)) {
        const dur = e.duration < 999 ? ' ' + e.duration : '';
        fx.appendChild(el('span', { class: 'tcg-eff ' + (e.positive ? 'buff' : 'debuff'), title: e.name + ': ' + e.description }, e.name + dur));
      }
      bottom.appendChild(fx);
    }
    card.appendChild(bottom);
    if (ch.isKnockedOut) card.appendChild(el('div', { class: 'tcg-ko-badge' }, 'KO'));

    card.addEventListener('click', () => onCharClick(ch, side, mine));
    return card;
  }

  function rowFor(side) {
    const team = state.battle.teams[side] || [];
    return el('div', { class: 'tcg-row' }, team.map((ch) => charCard(ch, side)));
  }

  function onCharClick(ch, side, mine) {
    if (!myTurn()) return;
    // Targeting an armed skill.
    if (armedSkill) {
      if (armedSkill.targetKind === 'opponent' && !mine && !ch.isKnockedOut) {
        send({ type: 'use_skill', charIndex: armedSkill.slot, skillIndex: armedSkill.index, target: ch.slot });
        armedSkill = null; render(); return;
      }
      if (armedSkill.targetKind === 'ally' && mine && !ch.isKnockedOut) {
        send({ type: 'use_skill', charIndex: armedSkill.slot, skillIndex: armedSkill.index, target: ch.slot });
        armedSkill = null; render(); return;
      }
    }
    // Applying an armed item to own character.
    if (armedItem != null && mine && !ch.isKnockedOut) {
      send({ type: 'use_item', handSlotId: armedItem, charIndex: ch.slot });
      armedItem = null; render(); return;
    }
    // Otherwise: focus own living character to show its skills.
    if (mine && !ch.isKnockedOut) { focusSlot = ch.slot; armedSkill = null; render(); }
  }

  function skillPanel() {
    const side = mySide();
    const team = state.battle.teams[side] || [];
    let slot = focusSlot;
    if (slot == null || !team[slot] || team[slot].isKnockedOut) {
      // Default to the active slot if alive, else first living ally.
      const act = state.battle.activeSlot;
      if (team[act] && !team[act].isKnockedOut) slot = act;
      else { const liv = team.find((c) => !c.isKnockedOut); slot = liv ? liv.slot : null; }
    }
    focusSlot = slot;
    if (slot == null) return null;
    const ch = team[slot];
    const wrap = el('div', { class: 'tcg-controls' });
    wrap.appendChild(el('p', { class: 'tcg-section-title' }, 'Skills — ' + ch.name + ' (slot ' + ch.slot + ')'));
    const list = el('div', { class: 'tcg-skill-list' });
    for (const sk of ch.skills) {
      const btn = el('button', { type: 'button', class: 'tcg-skill' + (armedSkill && armedSkill.slot === ch.slot && armedSkill.index === sk.index ? ' armed' : '') }, [
        el('span', { class: 'sk-name' }, [
          el('span', null, sk.name),
          el('span', { class: 'sk-dmg' }, sk.damageText && sk.damageText !== '--' ? sk.damageText : ''),
        ]),
        el('span', { class: 'sk-cat ' + sk.category }, sk.category + costLabel(sk)),
        el('span', { class: 'sk-desc' }, sk.description),
        (!sk.available && sk.reason) ? el('span', { class: 'sk-reason' }, sk.reason) : null,
      ]);
      btn.disabled = !(myTurn() && sk.available);
      btn.addEventListener('click', () => onSkillClick(ch.slot, sk));
      list.appendChild(btn);
    }
    wrap.appendChild(list);
    const hint = el('div', { class: 'tcg-arm-hint' });
    if (armedSkill) hint.textContent = 'Select a ' + (armedSkill.targetKind === 'ally' ? 'friendly' : 'enemy') + ' target.';
    else if (armedItem != null) hint.textContent = 'Select one of your characters to receive the item.';
    wrap.appendChild(hint);
    return wrap;
  }

  function costLabel(sk) {
    if (sk.category === 'ultimate' && sk.energyCost > 0) return ' · ' + sk.energyCost + '\\u26a1';
    if (sk.category === 'charged' && sk.spCost > 0) return ' · ' + sk.spCost + ' SP';
    if (sk.category === 'normal' && sk.spGranted > 0) return ' · +' + sk.spGranted + ' SP';
    return '';
  }

  function onSkillClick(slot, sk) {
    if (!myTurn() || !sk.available) return;
    armedItem = null;
    if (sk.needsTarget) {
      if (armedSkill && armedSkill.slot === slot && armedSkill.index === sk.index) armedSkill = null;
      else armedSkill = { slot, index: sk.index, targetKind: sk.targetKind };
      render();
      return;
    }
    armedSkill = null;
    send({ type: 'use_skill', charIndex: slot, skillIndex: sk.index, target: null });
  }

  function handTray() {
    const hand = (state.battle.hand) || [];
    const wrap = el('div', { class: 'tcg-controls' });
    wrap.appendChild(el('p', { class: 'tcg-section-title' }, 'Your Hand (' + hand.length + ')'));
    if (hand.length === 0) { wrap.appendChild(el('div', { class: 'tcg-hand-empty' }, 'No item cards in hand.')); return wrap; }
    const row = el('div', { class: 'tcg-hand' });
    for (const card of hand) {
      const c = el('div', { class: 'tcg-hand-card' + (armedItem === card.slotId ? ' armed' : ''), title: card.name + ' — ' + card.description }, [
        el('img', { src: '/static/tcg/item/' + encodeURIComponent(card.id) + '.png', alt: card.name, loading: 'lazy', decoding: 'async' }),
      ]);
      c.addEventListener('click', () => {
        if (!myTurn()) return;
        armedSkill = null;
        armedItem = (armedItem === card.slotId) ? null : card.slotId;
        render();
      });
      row.appendChild(c);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function spLine() {
    const b = state.battle;
    return el('div', { class: 'tcg-sp' }, [
      el('span', null, ['P1 SP ', el('b', null, b.sides.p1.skillPoints + '/' + b.sides.p1.skillPointsCap)]),
      el('span', null, ['Round ', el('b', null, String(b.currentTurn))]),
      el('span', null, ['P2 SP ', el('b', null, b.sides.p2.skillPoints + '/' + b.sides.p2.skillPointsCap)]),
    ]);
  }

  function actionBar() {
    const bar = el('div', { class: 'tcg-actionbar' });
    const end = el('button', { type: 'button', class: 'tcg-btn' }, '[ end turn ]');
    end.disabled = !myTurn();
    end.addEventListener('click', () => { armedSkill = null; armedItem = null; send({ type: 'end_turn' }); });
    bar.appendChild(end);
    const leave = el('button', { type: 'button', class: 'tcg-btn danger' }, '[ leave ]');
    leave.addEventListener('click', () => { send({ type: 'leave' }); setTimeout(() => { window.location.href = '/games/tcg'; }, 200); });
    bar.appendChild(leave);
    return bar;
  }

  function statusLine() {
    const b = state.battle;
    if (state.status === 'lobby') return el('div', { class: 'tcg-status' }, state.mode === 'pvp' ? 'Waiting for an opponent to join…' : 'Setting up…');
    if (state.status === 'active') {
      if (myTurn()) return el('div', { class: 'tcg-status' }, 'Your turn');
      const opp = state.players[oppSide()];
      if (opp && !opp.connected) return el('div', { class: 'tcg-status warn' }, 'Opponent reconnecting…');
      return el('div', { class: 'tcg-status' }, 'Waiting for opponent…');
    }
    if (state.status === 'ended') {
      const r = state.result || {};
      if (r.winner === 'draw' || r.winner == null) return el('div', { class: 'tcg-status draw' }, r.winner === 'draw' ? 'Draw!' : 'Battle ended');
      const won = r.winner === mySide();
      const tail = r.reason === 'timeout' ? ' (timeout)' : r.reason === 'disconnect' ? ' (disconnect)' : r.reason === 'forfeit' ? ' (forfeit)' : '';
      if (state.mode === 'solo') return el('div', { class: 'tcg-status win' }, (r.winner.toUpperCase()) + ' wins' + tail);
      return won ? el('div', { class: 'tcg-status win' }, 'Victory!' + tail) : el('div', { class: 'tcg-status lose' }, 'Defeat.' + tail);
    }
    return null;
  }

  function timerLine() {
    if (state.status !== 'active' || !state.turnDeadline) return null;
    const wrap = el('div', { class: 'tcg-timer' });
    wrap.appendChild(el('span', null, 'turn timer'));
    const count = el('span', { class: 'count' }, '—');
    wrap.appendChild(count);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
      count.textContent = remaining + 's';
      wrap.classList.toggle('urgent', remaining <= 10);
    };
    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 250);
    return wrap;
  }

  function inviteBlock() {
    const url = location.origin + '/games/tcg/' + encodeURIComponent(CTX.matchId);
    const wrap = el('div', { class: 'tcg-invite' });
    wrap.appendChild(el('div', { style: 'color: var(--fog-300); text-align:center;' }, 'Share this link with your opponent:'));
    wrap.appendChild(el('div', { class: 'tcg-invite-url' }, url));
    const copy = el('button', { class: 'tcg-btn', type: 'button' }, '[ copy link ]');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); const p = copy.textContent; copy.textContent = '[ copied! ]'; setTimeout(() => { copy.textContent = p; }, 1500); }
      catch { window.prompt('Copy this link:', url); }
    });
    wrap.appendChild(copy);
    return wrap;
  }

  function endActions() {
    const wrap = el('div', { class: 'tcg-end-actions' });
    const me = mySide() ? state.players[mySide()] : null;
    if (state.mode === 'solo' || (me && !me.rematchAccepted)) {
      const rematch = el('button', { class: 'tcg-btn', type: 'button' }, '[ rematch ]');
      rematch.addEventListener('click', () => send({ type: 'rematch_request' }));
      wrap.appendChild(rematch);
    } else if (me && me.rematchAccepted) {
      wrap.appendChild(el('div', { style: 'flex-basis:100%; text-align:center; color: var(--fog-300);' }, 'Waiting for opponent to accept rematch…'));
    }
    wrap.appendChild(el('a', { href: '/games/tcg', class: 'tcg-btn' }, '[ new battle ]'));
    const leave = el('button', { class: 'tcg-btn danger', type: 'button' }, '[ leave ]');
    leave.addEventListener('click', () => { send({ type: 'leave' }); setTimeout(() => { window.location.href = '/games/tcg'; }, 200); });
    wrap.appendChild(leave);
    return wrap;
  }

  function logPanel() {
    if (logLines.length === 0) return null;
    const panel = el('div', { class: 'tcg-panel' });
    panel.appendChild(el('p', { class: 'tcg-section-title' }, 'Battle Log'));
    const logEl = el('div', { class: 'tcg-log' });
    // column-reverse: newest first visually; iterate normally.
    for (let i = logLines.length - 1; i >= 0; i--) logEl.appendChild(el('div', null, logLines[i]));
    panel.appendChild(logEl);
    return panel;
  }

  function renderError() {
    const codeMap = {
      not_a_player: 'You are not a participant in this battle.',
      bad_csrf: 'Session expired. Reload the page.',
      auth_required: 'Authentication required. Reload the page.',
      room_not_found: 'This battle no longer exists.',
      rate_limited: "You're sending actions too quickly.",
    };
    clear(viewEl);
    viewEl.appendChild(el('p', { class: 'tcg-subtitle' }, 'Error'));
    viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--danger); margin: 0 0 1rem;' }, codeMap[serverError] || ('Server error: ' + serverError)));
    viewEl.appendChild(el('div', { style: 'display:flex; justify-content:center;' }, el('a', { href: '/games/tcg', class: 'tcg-btn' }, '[ back to lobby ]')));
  }

  function render() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (wsClosedByServer && serverError) { renderError(); return; }
    if (!state) { clear(viewEl); viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--fog-300); margin:0;' }, 'Connecting…')); return; }

    clear(viewEl);
    viewEl.appendChild(playersRow());
    const st = statusLine(); if (st) viewEl.appendChild(st);
    const t = timerLine(); if (t) viewEl.appendChild(t);

    if (state.status === 'lobby') {
      if (state.mode === 'pvp') viewEl.appendChild(inviteBlock());
      // refresh the root panel container
      const extra = logPanel(); attachExtra(extra);
      return;
    }

    if (state.battle) {
      // Opponent team on top, your team on the bottom (your-perspective board).
      const board = el('div', { class: 'tcg-board' }, [rowFor(oppSide()), rowFor(mySide())]);
      viewEl.appendChild(board);
      viewEl.appendChild(spLine());

      if (state.status === 'active') {
        const sp = skillPanel(); if (sp) viewEl.appendChild(sp);
        viewEl.appendChild(handTray());
        viewEl.appendChild(actionBar());
      } else if (state.status === 'ended') {
        viewEl.appendChild(endActions());
      }
    }

    if (serverError) viewEl.appendChild(el('div', { class: 'tcg-err' }, 'Server: ' + serverError));

    attachExtra(logPanel());
  }

  // Keep the battle log in its own panel below the main view.
  let extraPanel = null;
  function attachExtra(node) {
    const root = document.getElementById('tcg-root');
    if (extraPanel && extraPanel.parentNode) extraPanel.parentNode.removeChild(extraPanel);
    extraPanel = node;
    if (root && node) root.appendChild(node);
  }

  render();
  openWS();

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { armedSkill = null; armedItem = null; render(); } });
  window.addEventListener('beforeunload', () => { try { ws && ws.close(1000, 'unload'); } catch {} });
})();
</script>
`;
}
