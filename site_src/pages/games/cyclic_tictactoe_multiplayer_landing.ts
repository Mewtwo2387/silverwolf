import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { SKILL_MIN_SIZE } from '../../multiplayer/cyclicTttSkills';

export interface ActiveRoomBrief {
  id: string;
  boardSize: number;
  status: 'waiting' | 'active' | 'ended';
  opponentUsername: string | null;
  youAreCreator: boolean;
  skillsEnabled: boolean;
}

export function CyclicTicTacToeMultiplayerLandingPage(opts: {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  csrf?: string | null;
  activeRooms?: ActiveRoomBrief[];
}) {
  const {
    nonce, lv999, user, csrf = null, activeRooms = [],
  } = opts;

  const loggedOut = !user;

  const styles = raw(`
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
  .cyc-mp-field { display: flex; flex-direction: column; gap: 0.5rem; }
  .cyc-mp-field label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--fog-400);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'JetBrains Mono', monospace;
  }
  .cyc-mp-range-row { display: flex; align-items: center; gap: 0.75rem; }
  .cyc-mp-range {
    flex: 1;
    height: 6px;
    background: var(--ink-600);
    border-radius: 999px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    outline: none;
  }
  .cyc-mp-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .cyc-mp-range::-moz-range-thumb {
    width: 16px; height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--glow-bright);
    cursor: pointer;
  }
  .cyc-mp-range-val {
    font-size: 1.25rem;
    font-weight: 800;
    width: 1.75rem;
    text-align: center;
    color: var(--accent-light);
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
  .cyc-mp-btn[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .cyc-mp-create-row {
    display: flex;
    justify-content: center;
    margin-top: 1.25rem;
  }
  .cyc-mp-err {
    margin-top: 0.75rem;
    text-align: center;
    color: var(--danger);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    min-height: 1.2rem;
  }
  .cyc-mp-rooms { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .cyc-mp-room {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    flex-wrap: wrap;
  }
  .cyc-mp-room-meta {
    flex: 1;
    min-width: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--fog-200);
  }
  .cyc-mp-room-meta .room-status {
    color: var(--accent-light);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    margin-right: 0.5rem;
  }
  .cyc-mp-empty {
    color: var(--fog-400);
    font-style: italic;
    text-align: center;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }
  .cyc-mp-rules {
    background: color-mix(in oklab, var(--ink-800) 35%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.6rem;
    padding: 0.9rem 1rem;
    text-align: center;
    color: var(--fog-300);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .cyc-mp-rules .accent { color: var(--accent-light); font-weight: 700; }
  .cyc-mp-loginbtn {
    margin: 0.5rem auto 0;
    display: block;
    width: fit-content;
  }
  .cyc-mp-skills-field { margin-top: 1rem; gap: 0.3rem; }
  .cyc-mp-skill-toggle {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--fog-200);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }
  .cyc-mp-skill-toggle input { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .cyc-mp-skill-toggle input:disabled { cursor: not-allowed; }
  .cyc-mp-skill-toggle:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
  .cyc-mp-skill-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    color: var(--fog-400);
    font-style: italic;
  }
  .room-skills {
    color: var(--accent-light);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid color-mix(in oklab, var(--accent) 45%, transparent);
    border-radius: 4px;
    padding: 0.05rem 0.35rem;
    margin-left: 0.4rem;
  }
</style>
`);

  const loginPanel = html`
    <div class="cyc-mp-panel">
      <p class="cyc-mp-subtitle">Multiplayer Lobby</p>
      <p style="text-align:center; color: var(--fog-300); margin: 0 0 1rem;">
        Multiplayer requires a Discord account so we can match you with the other player.
      </p>
      <a href="/auth/discord/login?return=%2Fgames%2Fcyclic-tictactoe%2Fmultiplayer" class="cyc-mp-btn cyc-mp-loginbtn">[ Log in with Discord ]</a>
    </div>
  `;

  const loggedInPanel = html`
    <div class="cyc-mp-panel">
      <p class="cyc-mp-subtitle">Create a Match</p>
      <div class="cyc-mp-field">
        <label for="cyc-mp-size">Grid &amp; Limit (n)</label>
        <div class="cyc-mp-range-row">
          <input type="range" id="cyc-mp-size" class="cyc-mp-range" min="3" max="15" value="3" aria-label="Grid size" />
          <span id="cyc-mp-size-val" class="cyc-mp-range-val">3</span>
        </div>
      </div>
      <div class="cyc-mp-field cyc-mp-skills-field">
        <label class="cyc-mp-skill-toggle" for="cyc-mp-skills">
          <input type="checkbox" id="cyc-mp-skills" disabled />
          <span>Enable Skills</span>
        </label>
        <span id="cyc-mp-skills-hint" class="cyc-mp-skill-hint">Skills unlock at ${String(SKILL_MIN_SIZE)}×${String(SKILL_MIN_SIZE)}+</span>
      </div>
      <div class="cyc-mp-create-row">
        <button id="cyc-mp-create" type="button" class="cyc-mp-btn">[ Create Room ]</button>
      </div>
      <div id="cyc-mp-err" class="cyc-mp-err" aria-live="polite"></div>
    </div>

    <div class="cyc-mp-panel">
      <p class="cyc-mp-subtitle">Your Active Rooms</p>
      ${activeRooms.length === 0
    ? html`<p class="cyc-mp-empty">No active rooms. Create one above and share the link.</p>`
    : html`
      <ul class="cyc-mp-rooms">
        ${activeRooms.map((r) => html`
          <li class="cyc-mp-room" data-room-id="${r.id}">
            <div class="cyc-mp-room-meta">
              <span class="room-status">${r.status}</span>
              n=${String(r.boardSize)}${r.skillsEnabled ? html`<span class="room-skills">skills</span>` : ''} ·
              ${r.opponentUsername
    ? html`vs @${r.opponentUsername}`
    : html`<span style="color: var(--fog-400)">waiting for opponent</span>`}
            </div>
            <a class="cyc-mp-btn" href="/games/cyclic-tictactoe/multiplayer/${r.id}">[ open ]</a>
            <button type="button" class="cyc-mp-btn cyc-mp-copy" data-room-id="${r.id}">[ copy link ]</button>
          </li>
        `)}
      </ul>
    `}
    </div>

    <div class="cyc-mp-rules">
      Standard cyclic rules — you keep up to <span class="accent">⌈1.5n⌉</span> marks; placing past the limit expires your oldest.
      Turns are limited to <span class="accent">25 seconds</span>. If your opponent disconnects, they have 30 seconds to reconnect before forfeiting.
      On <span class="accent">${String(SKILL_MIN_SIZE)}×${String(SKILL_MIN_SIZE)}+</span> boards you can enable <span class="accent">Skills</span> — an energy-fuelled deck of board-warping abilities to break stalemates.
    </div>
  `;

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const sizeRange = document.getElementById('cyc-mp-size');
  const sizeVal   = document.getElementById('cyc-mp-size-val');
  const createBtn = document.getElementById('cyc-mp-create');
  const errEl     = document.getElementById('cyc-mp-err');
  const skillsBox = document.getElementById('cyc-mp-skills');
  const skillsHint = document.getElementById('cyc-mp-skills-hint');
  if (!sizeRange || !sizeVal || !createBtn) return;
  const CSRF = ${JSON.stringify(csrf ?? '')};
  const SKILL_MIN = ${String(SKILL_MIN_SIZE)};

  function syncSkillGate() {
    if (!skillsBox) return;
    const ok = parseInt(sizeRange.value, 10) >= SKILL_MIN;
    skillsBox.disabled = !ok;
    if (!ok) skillsBox.checked = false;
    if (skillsHint) {
      skillsHint.textContent = ok
        ? (skillsBox.checked ? 'Board-warping abilities are on' : 'Optional — break defensive stalemates')
        : ('Skills unlock at ' + SKILL_MIN + '×' + SKILL_MIN + '+');
    }
  }

  sizeRange.addEventListener('input', () => { sizeVal.textContent = sizeRange.value; syncSkillGate(); });
  if (skillsBox) skillsBox.addEventListener('change', syncSkillGate);
  syncSkillGate();

  createBtn.addEventListener('click', async () => {
    errEl.textContent = '';
    createBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/cyclic-tictactoe/multiplayer/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, boardSize: parseInt(sizeRange.value, 10), skills: !!(skillsBox && skillsBox.checked && !skillsBox.disabled) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? ('Failed: ' + data.error) : 'Failed to create room.';
        createBtn.removeAttribute('disabled');
        return;
      }
      window.location.href = '/games/cyclic-tictactoe/multiplayer/' + encodeURIComponent(data.id);
    } catch (e) {
      errEl.textContent = 'Network error.';
      createBtn.removeAttribute('disabled');
    }
  });

  document.querySelectorAll('.cyc-mp-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-room-id');
      if (!id) return;
      const url = window.location.origin + '/games/cyclic-tictactoe/multiplayer/' + encodeURIComponent(id);
      try {
        await navigator.clipboard.writeText(url);
        const prev = btn.textContent;
        btn.textContent = '[ copied! ]';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch {
        // Fallback: open a prompt with the URL so the user can copy manually
        window.prompt('Copy this link:', url);
      }
    });
  });
})();
</script>
`);

  const body = html`
    ${styles}
    <h1 class="text-center">Cyclic Tic-Tac-Toe — Multiplayer</h1>
    <p class="text-center text-fog-300">Create a room, share the link, play someone else.</p>
    <div class="cyc-mp-wrap">
      ${loggedOut ? loginPanel : loggedInPanel}
    </div>
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Cyclic TTT Multiplayer',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
