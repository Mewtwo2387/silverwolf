/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define, no-nested-ternary */
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';

export interface TcgRoster {
  value: string;
  name: string;
}

export interface TcgActiveRoomBrief {
  id: string;
  mode: 'pvp' | 'solo';
  status: 'lobby' | 'active' | 'ended';
  opponentUsername: string | null;
  youAreCreator: boolean;
}

export interface TcgLandingOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  csrf: string | null;
  roster: TcgRoster[];
  deckLegal: boolean;
  activeRooms: TcgActiveRoomBrief[];
  loginReturnPath: string;
}

function inlineJson(v: unknown): string {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c');
}

export function TcgBattleLandingPage(opts: TcgLandingOpts) {
  const {
    nonce, lv999, user, csrf, roster, deckLegal, activeRooms, loginReturnPath,
  } = opts;

  const styles = landingStyles();

  if (!user) {
    return Layout({
      title: 'Silverwolf — TCG Battle',
      active: 'games',
      body: html`
        ${styles}
        <h1 class="text-center">TCG Battle</h1>
        <div class="tcg-wrap">
          <div class="tcg-panel" style="text-align:center;">
            <p class="tcg-subtitle">Log In Required</p>
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              TCG battles need a Discord account for matchmaking and your saved deck.
            </p>
            <a href="/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}" class="tcg-btn">[ Log in with Discord ]</a>
          </div>
        </div>
      ` as any,
      nonce,
      lv999,
      user,
    });
  }

  const options = roster.map((r) => `<option value="${escapeAttr(r.value)}">${escapeText(r.name)}</option>`).join('');
  const firstThree = roster.slice(0, 3).map((r) => r.value);

  const script = raw(landingScript(nonce, { csrf: csrf ?? '', defaults: firstThree }));

  const body = html`
    ${styles}
    <h1 class="text-center" style="margin-bottom:0.25rem;">TCG Battle</h1>
    <p class="text-center text-fog-300" style="margin-bottom:1rem;">Pick a team of three, then battle a friend or practice solo.</p>
    <div class="tcg-wrap">
      <div class="tcg-panel">
        <p class="tcg-subtitle">Create a Battle</p>

        <div class="tcg-field">
          <label>Mode</label>
          <div class="tcg-modes" id="tcg-modes">
            <button type="button" class="tcg-mode active" data-mode="pvp">PvP (invite link)</button>
            <button type="button" class="tcg-mode" data-mode="solo">Solo practice</button>
          </div>
        </div>

        <div class="tcg-field">
          <label>Your Team</label>
          <div class="tcg-team">
            ${[0, 1, 2].map((i) => raw(`<select class="tcg-select" id="tcg-char-${i}" aria-label="Team slot ${i + 1}">${options}</select>`))}
          </div>
        </div>

        <div class="tcg-field">
          <label>Deck</label>
          <div class="tcg-deck-row">
            <span id="tcg-deck-badge" class="tcg-badge ${deckLegal ? 'legal' : 'illegal'}">${deckLegal ? 'legal deck' : 'illegal deck'}</span>
            <a href="/games/tcg/deck" class="tcg-btn">[ edit deck ]</a>
          </div>
          ${deckLegal ? '' : html`<p class="tcg-warn">Your saved deck isn't legal — fix it before battling.</p>`}
        </div>

        <div class="tcg-create-row">
          <button id="tcg-create" type="button" class="tcg-btn" ${deckLegal ? '' : 'disabled'}>[ Create Battle ]</button>
        </div>
        <div id="tcg-err" class="tcg-err" aria-live="polite"></div>
      </div>

      <div class="tcg-panel">
        <p class="tcg-subtitle">Your Active Battles</p>
        ${activeRooms.length === 0
    ? html`<p class="tcg-empty">No active battles. Create one above.</p>`
    : html`
      <ul class="tcg-rooms">
        ${activeRooms.map((r) => html`
          <li class="tcg-room">
            <div class="tcg-room-meta">
              <span class="room-status">${r.status}</span>
              <span class="room-mode">${r.mode}</span> ·
              ${r.opponentUsername
    ? html`vs @${r.opponentUsername}`
    : (r.mode === 'pvp' ? html`<span style="color:var(--fog-400)">waiting for opponent</span>` : html`<span style="color:var(--fog-400)">solo</span>`)}
            </div>
            <a class="tcg-btn" href="/games/tcg/${r.id}">[ open ]</a>
            ${r.mode === 'pvp' && r.status === 'lobby'
    ? html`<button type="button" class="tcg-btn tcg-copy" data-room-id="${r.id}">[ copy link ]</button>`
    : ''}
          </li>
        `)}
      </ul>
    `}
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

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

function landingStyles() {
  return raw(`
<style>
  .tcg-wrap { max-width: 760px; margin: 1.5rem auto 0; display: flex; flex-direction: column; gap: 1.25rem; }
  .tcg-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem; padding: 1.25rem;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .tcg-subtitle {
    text-align: center; color: var(--fog-300); font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.18em; margin: 0 0 1.25rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .tcg-field { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
  .tcg-field > label {
    font-size: 0.7rem; font-weight: 700; color: var(--fog-400);
    text-transform: uppercase; letter-spacing: 0.06em; font-family: 'JetBrains Mono', monospace;
  }
  .tcg-modes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tcg-mode {
    flex: 1; min-width: 140px; padding: 0.55rem 0.75rem; cursor: pointer;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid var(--ink-600); border-radius: 0.5rem; color: var(--fog-200);
    font: inherit; font-size: 0.85rem; font-weight: 600; transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .tcg-mode.active { border-color: var(--accent); color: var(--accent-light); box-shadow: 0 0 10px var(--glow-faint); }
  .tcg-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  @media (max-width: 520px) { .tcg-team { grid-template-columns: 1fr; } }
  .tcg-select {
    width: 100%; padding: 0.5rem; background: var(--ink-900); color: var(--fog-100);
    border: 1px solid var(--ink-600); border-radius: 0.4rem; font: inherit; font-size: 0.85rem;
  }
  .tcg-deck-row { display: flex; align-items: center; gap: 0.6rem; }
  .tcg-badge {
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700;
    padding: 0.2rem 0.55rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;
    border: 1px solid var(--ink-600); color: var(--fog-300);
  }
  .tcg-badge.legal { color: #4ade80; border-color: color-mix(in oklab, #4ade80 50%, transparent); }
  .tcg-badge.illegal { color: var(--danger); border-color: color-mix(in oklab, var(--danger) 50%, transparent); }
  .tcg-warn { color: var(--danger); font-size: 0.8rem; margin: 0.25rem 0 0; }
  .tcg-btn {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent-pale) 10%, transparent));
    color: var(--accent-light); border: 1px solid var(--accent); border-radius: 4px;
    padding: 0.6rem 1.4rem; font: inherit; font-size: 0.9rem; font-weight: 700;
    cursor: pointer; white-space: nowrap; text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, color 0.15s;
  }
  .tcg-btn:hover { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .tcg-btn:active { transform: translateY(1px); }
  .tcg-btn[disabled] { opacity: 0.55; cursor: not-allowed; }
  .tcg-create-row { display: flex; justify-content: center; margin-top: 1rem; }
  .tcg-err { margin-top: 0.75rem; text-align: center; color: var(--danger); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; min-height: 1.2rem; }
  .tcg-rooms { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .tcg-room {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; flex-wrap: wrap;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent); border: 1px solid var(--ink-600); border-radius: 0.5rem;
  }
  .tcg-room-meta { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--fog-200); }
  .tcg-room-meta .room-status { color: var(--accent-light); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.1em; margin-right: 0.4rem; }
  .tcg-room-meta .room-mode { color: var(--fog-400); text-transform: uppercase; font-size: 0.66rem; }
  .tcg-empty { color: var(--fog-400); font-style: italic; text-align: center; font-size: 0.9rem; margin: 0.5rem 0; }
</style>
`);
}

function landingScript(nonce: string, ctx: { csrf: string; defaults: string[] }) {
  return `
<script nonce="${nonce}">
(() => {
  const CSRF = ${inlineJson(ctx.csrf)};
  const DEFAULTS = ${inlineJson(ctx.defaults)};
  let mode = 'pvp';

  const modesEl = document.getElementById('tcg-modes');
  const createBtn = document.getElementById('tcg-create');
  const errEl = document.getElementById('tcg-err');
  const selects = [0, 1, 2].map((i) => document.getElementById('tcg-char-' + i));
  if (!createBtn) return;

  // Sensible default: distinct first three characters.
  selects.forEach((sel, i) => { if (sel && DEFAULTS[i]) sel.value = DEFAULTS[i]; });

  if (modesEl) {
    modesEl.querySelectorAll('.tcg-mode').forEach((b) => {
      b.addEventListener('click', () => {
        mode = b.getAttribute('data-mode') || 'pvp';
        modesEl.querySelectorAll('.tcg-mode').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
  }

  createBtn.addEventListener('click', async () => {
    if (createBtn.hasAttribute('disabled')) return;
    errEl.textContent = '';
    const team = selects.map((s) => s ? s.value : '');
    if (team.some((t) => !t)) { errEl.textContent = 'Pick three characters.'; return; }
    createBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/tcg/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, mode, team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? data.error : 'Failed to create battle.';
        createBtn.removeAttribute('disabled');
        return;
      }
      window.location.href = '/games/tcg/' + encodeURIComponent(data.id);
    } catch (e) {
      errEl.textContent = 'Network error.';
      createBtn.removeAttribute('disabled');
    }
  });

  document.querySelectorAll('.tcg-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-room-id');
      if (!id) return;
      const url = window.location.origin + '/games/tcg/' + encodeURIComponent(id);
      try {
        await navigator.clipboard.writeText(url);
        const prev = btn.textContent;
        btn.textContent = '[ copied! ]';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch { window.prompt('Copy this link:', url); }
    });
  });
})();
</script>
`;
}
