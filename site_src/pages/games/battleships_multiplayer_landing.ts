import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';

export interface ActiveRoomBrief {
  id: string;
  status: 'waiting' | 'placing' | 'active' | 'ended';
  opponentUsername: string | null;
  youAreCreator: boolean;
}

export function BattleshipsMultiplayerLandingPage(opts: {
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
  .bsmp-wrap {
    max-width: 760px;
    margin: 1.5rem auto 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .bsmp-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    padding: 1.25rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .bsmp-subtitle {
    text-align: center;
    color: var(--fog-300);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0 0 1.25rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .bsmp-btn {
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
  .bsmp-btn:hover { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .bsmp-btn:active { transform: translateY(1px); }
  .bsmp-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
  .bsmp-create-row { display: flex; justify-content: center; }
  .bsmp-err {
    margin-top: 0.75rem;
    text-align: center;
    color: var(--danger);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    min-height: 1.2rem;
  }
  .bsmp-rooms { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .bsmp-room {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    flex-wrap: wrap;
  }
  .bsmp-room-meta {
    flex: 1;
    min-width: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--fog-200);
  }
  .bsmp-room-meta .room-status {
    color: var(--accent-light);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    margin-right: 0.5rem;
  }
  .bsmp-empty { color: var(--fog-400); font-style: italic; text-align: center; font-size: 0.9rem; margin: 0.5rem 0; }
  .bsmp-rules {
    background: color-mix(in oklab, var(--ink-800) 35%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.6rem;
    padding: 0.9rem 1rem;
    text-align: center;
    color: var(--fog-300);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .bsmp-rules .accent { color: var(--accent-light); font-weight: 700; }
  .bsmp-loginbtn { margin: 0.5rem auto 0; display: block; width: fit-content; }
</style>
`);

  const loginPanel = html`
    <div class="bsmp-panel">
      <p class="bsmp-subtitle">Multiplayer Lobby</p>
      <p style="text-align:center; color: var(--fog-300); margin: 0 0 1rem;">
        Multiplayer requires a Discord account so we can match you with the other player.
      </p>
      <a href="/auth/discord/login?return=%2Fgames%2Fbattleships%2Fmultiplayer" class="bsmp-btn bsmp-loginbtn">[ Log in with Discord ]</a>
    </div>
  `;

  const loggedInPanel = html`
    <div class="bsmp-panel">
      <p class="bsmp-subtitle">Create a Match</p>
      <p style="text-align:center; color: var(--fog-300); margin: 0 0 1.25rem;">
        Create a room, share the link, and you'll both place your fleets when your opponent joins.
      </p>
      <div class="bsmp-create-row">
        <button id="bsmp-create" type="button" class="bsmp-btn">[ Create Room ]</button>
      </div>
      <div id="bsmp-err" class="bsmp-err" aria-live="polite"></div>
    </div>

    <div class="bsmp-panel">
      <p class="bsmp-subtitle">Your Active Rooms</p>
      ${activeRooms.length === 0
    ? html`<p class="bsmp-empty">No active rooms. Create one above and share the link.</p>`
    : html`
      <ul class="bsmp-rooms">
        ${activeRooms.map((r) => html`
          <li class="bsmp-room" data-room-id="${r.id}">
            <div class="bsmp-room-meta">
              <span class="room-status">${r.status}</span>
              ${r.opponentUsername
    ? html`vs @${r.opponentUsername}`
    : html`<span style="color: var(--fog-400)">waiting for opponent</span>`}
            </div>
            <a class="bsmp-btn" href="/games/battleships/multiplayer/${r.id}">[ open ]</a>
            <button type="button" class="bsmp-btn bsmp-copy" data-room-id="${r.id}">[ copy link ]</button>
          </li>
        `)}
      </ul>
    `}
    </div>

    <div class="bsmp-rules">
      Standard rules — a fleet of <span class="accent">5 ships</span> (Carrier, Battleship, Cruiser, Submarine, Destroyer)
      on a <span class="accent">10×10</span> grid. You have <span class="accent">2 minutes</span> to deploy;
      unplaced ships are auto-positioned. Then take turns firing — first to sink the enemy fleet wins.
      Each shot has <span class="accent">30 seconds</span>; running the clock auto-fires a random shot.
      Disconnect for 30s and you forfeit.
    </div>
  `;

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const createBtn = document.getElementById('bsmp-create');
  const errEl     = document.getElementById('bsmp-err');
  if (!createBtn) return;
  const CSRF = ${JSON.stringify(csrf ?? '')};

  createBtn.addEventListener('click', async () => {
    errEl.textContent = '';
    createBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/battleships/multiplayer/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? ('Failed: ' + data.error) : 'Failed to create room.';
        createBtn.removeAttribute('disabled');
        return;
      }
      window.location.href = '/games/battleships/multiplayer/' + encodeURIComponent(data.id);
    } catch (e) {
      errEl.textContent = 'Network error.';
      createBtn.removeAttribute('disabled');
    }
  });

  document.querySelectorAll('.bsmp-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-room-id');
      if (!id) return;
      const url = window.location.origin + '/games/battleships/multiplayer/' + encodeURIComponent(id);
      try {
        await navigator.clipboard.writeText(url);
        const prev = btn.textContent;
        btn.textContent = '[ copied! ]';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch {
        window.prompt('Copy this link:', url);
      }
    });
  });
})();
</script>
`);

  const body = html`
    ${styles}
    <h1 class="text-center">Battleships — Multiplayer</h1>
    <p class="text-center text-fog-300">Create a room, share the link, sink someone else's fleet.</p>
    <div class="bsmp-wrap">
      ${loggedOut ? loginPanel : loggedInPanel}
    </div>
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Battleships Multiplayer',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
