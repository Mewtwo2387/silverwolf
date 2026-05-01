import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';

export function PoopPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');

  const extras = raw(`
<style>
  .poop-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    margin-top: 2rem;
  }
  .scene {
    position: relative;
    width: 320px;
    height: 320px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .toilet {
    width: 220px;
    height: 220px;
    object-fit: contain;
    z-index: 1;
  }
  .poop {
    position: absolute;
    width: 90px;
    height: 90px;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    object-fit: contain;
    z-index: 2;
    transition: opacity 0.2s;
  }
  .poop.flushing {
    animation: flush 1.4s cubic-bezier(0.5, 0, 0.6, 1) forwards;
  }
  @keyframes flush {
    0% { transform: translate(-50%, 0) scale(1) rotate(0deg); opacity: 1; }
    40% { transform: translate(-50%, 80px) scale(0.7) rotate(180deg); opacity: 1; }
    80% { transform: translate(-50%, 130px) scale(0.2) rotate(720deg); opacity: 0.6; }
    100% { transform: translate(-50%, 150px) scale(0) rotate(900deg); opacity: 0; }
  }
  .toilet.shaking { animation: vibrate 0.45s linear; }
  @keyframes vibrate {
    0%   { transform: translate(0, 0); }
    20%  { transform: translate(-3px, 2px); }
    40%  { transform: translate(3px, -2px); }
    60%  { transform: translate(-2px, -2px); }
    80%  { transform: translate(2px, 2px); }
    100% { transform: translate(0, 0); }
  }

  .poop-form {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    width: 100%;
    max-width: 520px;
  }
  @media (max-width: 540px) {
    .poop-form { grid-template-columns: 1fr; }
  }
  .poop-form label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--fog-300);
  }
  .poop-form select,
  .poop-form input {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    color: var(--fog-100);
    font: inherit;
  }
  .poop-form select:focus,
  .poop-form input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .log-btn {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 2rem;
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
    box-shadow: 0 4px 0 #4a58e8;
    transition: transform 0.1s, box-shadow 0.1s, opacity 0.1s;
  }
  .log-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #4a58e8; }
  .log-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .poop-message {
    min-height: 1.5rem;
    font-weight: 600;
    color: var(--accent-light);
    text-align: center;
  }
  .poop-message.error { color: var(--danger); }

  .login-cta {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.5rem 2rem;
    text-align: center;
    color: var(--fog-200);
  }
  .login-cta a {
    color: var(--accent-light);
    font-weight: bold;
    text-decoration: none;
  }
  .login-cta a:hover { color: var(--accent); }
</style>
`);

  const loggedOut = !user;

  const formScript = raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};
  const form = document.getElementById('poop-form');
  const btn = document.getElementById('log-btn');
  const msg = document.getElementById('poop-message');
  const poop = document.getElementById('poop-svg');
  const toilet = document.getElementById('toilet-svg');

  function readField(name) {
    const el = form.elements.namedItem(name);
    if (!el) return null;
    const v = el.value;
    return v === '' ? null : v;
  }

  async function logPoop() {
    if (btn.disabled) return;
    btn.disabled = true;
    msg.classList.remove('error');
    msg.textContent = '';

    const body = {
      csrf,
      colour: readField('colour'),
      size: readField('size'),
      type: readField('type'),
      duration: (() => {
        const v = readField('duration');
        if (v === null) return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      })(),
    };

    let res;
    try {
      const r = await fetch('/games/poop/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      res = await r.json();
    } catch (err) {
      msg.classList.add('error');
      msg.textContent = 'Network error. Try again.';
      btn.disabled = false;
      return;
    }

    if (res.error) {
      msg.classList.add('error');
      msg.textContent = res.error === 'unauthenticated'
        ? 'You must log in.'
        : 'Failed to log: ' + res.error;
      btn.disabled = false;
      return;
    }

    if (res.count === null) {
      msg.classList.add('error');
      msg.textContent = 'Toilet has been choked! Are you okay? Might wanna check on that gut.';
      btn.disabled = false;
      return;
    }

    // Animate flush + reset
    poop.classList.remove('flushing');
    void poop.offsetWidth;
    poop.classList.add('flushing');
    setTimeout(() => { toilet.classList.add('shaking'); }, 700);
    setTimeout(() => { toilet.classList.remove('shaking'); }, 1150);

    setTimeout(() => {
      msg.textContent = "Flushed🚽! This is poop number " + res.count + ", keep poopin'! 💩";
      // Reset poop back to top for next round
      poop.classList.remove('flushing');
      // Clear inputs
      form.reset();
      btn.disabled = false;
    }, 1500);
  }

  btn.addEventListener('click', logPoop);
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Poop Log</h1>
    <p class="text-center text-fog-300 mb-4">Record a bathroom visit. Adds to your poop count and the leaderboard.</p>
    <div class="poop-container">
      <div class="scene">
        <img id="poop-svg" class="poop" src="/static/svg/pile-of-poo-svgrepo-com.svg" alt="poop" />
        <img id="toilet-svg" class="toilet" src="/static/svg/toilet-svgrepo-com.svg" alt="toilet" />
      </div>
      ${loggedOut
    ? html`<div class="login-cta">
            Log in with <a href="/auth/discord/login">Discord</a> to log a poop.
          </div>`
    : html`
            <form id="poop-form" class="poop-form" onsubmit="return false">
              <label>
                Colour
                <select name="colour">
                  <option value="">—</option>
                  <option value="brown">Brown</option>
                  <option value="dark-brown">Dark Brown</option>
                  <option value="yellow">Yellow</option>
                  <option value="green">Green</option>
                  <option value="black">Black</option>
                  <option value="red">Red</option>
                  <option value="holy">Holy</option>
                </select>
              </label>
              <label>
                Size
                <select name="size">
                  <option value="">—</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="omnipresent">Omnipresent</option>
                </select>
              </label>
              <label>
                Type
                <select name="type">
                  <option value="">—</option>
                  <option value="liquid">Liquid</option>
                  <option value="soft">Soft</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                  <option value="pellet">Pellet</option>
                  <option value="divine">Divine</option>
                </select>
              </label>
              <label>
                Duration (minutes)
                <input type="number" name="duration" min="1" max="120" placeholder="optional" />
              </label>
            </form>
            <button id="log-btn" class="log-btn">Log 💩</button>
          `}
      <div id="poop-message" class="poop-message"></div>
    </div>
    ${extras}
    ${loggedOut ? '' : formScript}
  `;

  return Layout({
    title: 'Silverwolf — Poop Log',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
