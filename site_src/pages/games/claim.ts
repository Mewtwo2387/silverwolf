import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';

export function ClaimPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  const extras = raw(`
<style>
  .claim-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .claim-display {
    width: 320px;
    height: 240px;
    background: var(--ink-900);
    border: 2px solid var(--ink-600);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .claim-display img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  }
  .claim-display.gold { border-color: #FFD700; box-shadow: 0 0 24px rgba(255, 215, 0, 0.5); }
  .claim-display.silver { border-color: #C0C0C0; box-shadow: 0 0 24px rgba(192, 192, 192, 0.45); }
  .claim-display.bronze { border-color: #CD7F32; box-shadow: 0 0 24px rgba(205, 127, 50, 0.45); }
  .claim-display.regular { border-color: #83F28F; box-shadow: 0 0 18px rgba(131, 242, 143, 0.4); }
  .claim-display.cooldown { border-color: #FF0000; box-shadow: 0 0 24px rgba(255, 0, 0, 0.45); }
  .claim-message {
    width: 100%;
    max-width: 520px;
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    color: var(--fog-200);
    min-height: 4rem;
  }
  .claim-message h2 {
    font-size: 1.05rem;
    margin: 0 0 0.4rem 0;
    font-weight: bold;
    color: var(--accent-light);
  }
  .claim-message.gold h2 { color: #FFD700; }
  .claim-message.silver h2 { color: #C0C0C0; }
  .claim-message.bronze h2 { color: #CD7F32; }
  .claim-message.regular h2 { color: #83F28F; }
  .claim-message.cooldown h2 { color: #FF6666; }
  .claim-message .sub { color: var(--fog-300); font-size: 0.9rem; }
  .claim-message .footer {
    color: var(--fog-400);
    font-size: 0.78rem;
    margin-top: 0.5rem;
  }
  .login-cta {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.5rem 2rem;
    text-align: center;
    color: var(--fog-200);
  }
  .login-cta a { color: var(--accent-light); font-weight: bold; text-decoration: none; }
  .login-cta a:hover { color: var(--accent); }
</style>
`);

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};
  const display = document.getElementById('claim-display');
  const displayImg = document.getElementById('claim-img');
  const btn = document.getElementById('claim-btn');
  const msg = document.getElementById('claim-message');

  const DEFAULT_IMG = '/static/game-dinonuggie.webp';

  function format(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    return Math.round(n).toLocaleString();
  }

  function setRarityClass(el, rarity) {
    el.classList.remove('gold', 'silver', 'bronze', 'regular', 'cooldown');
    if (rarity) el.classList.add(rarity);
  }

  function inferRarity(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('gold')) return 'gold';
    if (t.includes('silver')) return 'silver';
    if (t.includes('bronze')) return 'bronze';
    return 'regular';
  }

  async function claim() {
    btn.disabled = true;
    msg.innerHTML = '<h2>Claiming...</h2>';
    setRarityClass(msg, null);

    let data;
    try {
      const r = await fetch('/games/claim/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf }),
      });
      data = await r.json();
    } catch (e) {
      msg.innerHTML = '<h2>Network error.</h2>';
      btn.disabled = false;
      return;
    }

    if (data && data.error) {
      const map = {
        unauthenticated: 'You must log in.',
        csrf: 'Session expired, refresh the page.',
        server: 'Server error, try again.',
      };
      msg.innerHTML = '<h2>' + (map[data.error] || ('Error: ' + data.error)) + '</h2>';
      btn.disabled = false;
      return;
    }

    const d = data.data;
    if (d.status === 'cooldown') {
      displayImg.src = d.gifUrl;
      setRarityClass(display, 'cooldown');
      setRarityClass(msg, 'cooldown');
      msg.innerHTML = '<h2>' + d.title + '</h2>'
        + '<div class="sub">You can claim your next nuggie in ' + d.hoursRemaining + ' hours.</div>';
    } else if (d.status === 'broken_streak') {
      displayImg.src = DEFAULT_IMG;
      setRarityClass(display, 'regular');
      setRarityClass(msg, 'regular');
      msg.innerHTML = '<h2>' + format(d.amount) + ' dinonuggies claimed!</h2>'
        + '<div class="sub">You now have ' + format(d.previousDinonuggies + d.amount)
        + ' dinonuggies. You broke your streak of ' + d.previousStreak + ' days.</div>';
    } else if (d.status === 'success') {
      displayImg.src = d.webImageUrl || d.imageUrl || DEFAULT_IMG;
      const rarity = inferRarity(d.title);
      setRarityClass(display, rarity);
      setRarityClass(msg, rarity);
      msg.innerHTML = '<h2>' + d.title + '</h2>'
        + '<div class="sub">You now have ' + format(d.previousDinonuggies + d.amount)
        + ' dinonuggies. You are on a streak of ' + (d.previousStreak + 1) + ' days.</div>'
        + '<div class="footer">' + d.footer + '</div>';
    }
    btn.disabled = false;
  }

  btn.addEventListener('click', claim);
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Claim</h1>
    <p class="text-center text-fog-300 mb-4">claim yer dinonuggies</p>
    <div class="claim-container">
      ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to claim.</div>`
    : html`
            <div id="claim-display" class="claim-display">
              <img id="claim-img" src="/static/game-dinonuggie.webp" alt="dinonuggie" />
            </div>
            <button id="claim-btn" class="btn-accent">claim</button>
            <div id="claim-message" class="claim-message">
              <h2>Press claim to receive your daily dinonuggies.</h2>
            </div>
          `}
    </div>
    ${extras}
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Claim',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
