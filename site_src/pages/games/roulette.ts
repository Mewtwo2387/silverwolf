import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON, NORMALIZE_AMOUNT_JS } from '../../inline';

export function RoulettePage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  // Build the wheel server-side. 37 numbers, drawn around a circle. Colors
  // are baked into a conic-gradient so each segment forms a thick wedge from
  // the hub outward (matches the casino-wheel look in the games tile SVG).
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const SEG_DEG = 360 / 37;
  const HALF_SEG = SEG_DEG / 2;
  const COLOR_HEX = { red: '#c0252e', black: '#1a1a1a', green: '#2ecc71' } as const;
  const labels: { n: number; angle: number; color: 'red' | 'black' | 'green' }[] = [];
  const stops: string[] = [];
  for (let i = 0; i < 37; i += 1) {
    const angle = i * SEG_DEG;
    let color: 'green' | 'red' | 'black' = 'black';
    if (i === 0) color = 'green';
    else if (RED.has(i)) color = 'red';
    labels.push({ n: i, angle, color });
    const start = (i * SEG_DEG).toFixed(4);
    const end = ((i + 1) * SEG_DEG).toFixed(4);
    stops.push(`${COLOR_HEX[color]} ${start}deg ${end}deg`);
  }
  // `from -HALF_SEG` so segment 0 is centered at the top (under the pointer)
  // instead of starting at its leading edge there.
  const conicGradient = `conic-gradient(from -${HALF_SEG.toFixed(4)}deg, ${stops.join(', ')})`;
  // Radial layer sits on top of the conic (first listed = top in CSS background
  // shorthand) so the brown disk masks the inner part of the wedges.
  const wheelBg = `radial-gradient(circle at center, #2a1a0c 0%, #5a3517 38%, transparent 46%), ${conicGradient}`;
  const labelsHTML = labels.map((l) => `
    <div class="seg" style="transform: rotate(${l.angle}deg) translateY(-128px);">
      <span style="transform: rotate(${-l.angle}deg);">${l.n}</span>
    </div>
  `).join('');

  const extras = raw(`
<style>
  .roul-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .wheel-stage {
    position: relative;
    width: 320px;
    height: 320px;
  }
  .wheel-pointer {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-top: 22px solid var(--accent);
    z-index: 3;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }
  .wheel {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 6px solid #8c5a23;
    box-shadow: 0 0 24px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.4);
    transition: transform 4.2s cubic-bezier(0.18, 0.68, 0.16, 1);
    will-change: transform;
  }
  .wheel-hub {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100px;
    height: 100px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #d4a04a, #6e4612);
    border: 3px solid #8c5a23;
    z-index: 2;
  }
  .seg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 24px;
    height: 18px;
    margin: -9px 0 0 -12px;
    transform-origin: center center;
    color: white;
    font-weight: bold;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-shadow: 0 1px 2px rgba(0,0,0,0.7);
    pointer-events: none;
  }

  .roul-form {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
    width: 100%;
    max-width: 540px;
  }
  @media (max-width: 540px) {
    .roul-form { grid-template-columns: 1fr; }
  }
  .roul-form label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--fog-300); }
  .roul-form input, .roul-form select {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    color: var(--fog-100);
    font: inherit;
  }
  .roul-form input:focus, .roul-form select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .result-banner {
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    width: 100%;
    max-width: 540px;
    min-height: 0;
    display: none;
  }
  .result-banner.win { border-color: #2ecc71; color: #7ee2a4; }
  .result-banner.loss { border-color: var(--danger); color: var(--danger); }
  .result-banner h2 { font-size: 1.15rem; margin: 0 0 0.4rem 0; font-weight: bold; }
  .result-banner .sub { color: var(--fog-300); font-size: 0.9rem; }

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
  ${NORMALIZE_AMOUNT_JS}
  const csrf = ${csrfJSON};
  const wheel = document.getElementById('wheel');
  const spinBtn = document.getElementById('spin-btn');
  const amountInput = document.getElementById('amount-input');
  const betTypeSel = document.getElementById('bet-type');
  const betValueInput = document.getElementById('bet-value');
  const banner = document.getElementById('result-banner');

  const SEGMENT = 360 / 37;
  let baseRotation = 0;
  let spinning = false;

  function toggleBetValue() {
    const isNumber = betTypeSel.value === 'number';
    betValueInput.parentElement.style.display = isNumber ? '' : 'none';
  }
  betTypeSel.addEventListener('change', toggleBetValue);
  toggleBetValue();

  function setBanner(state, title, sub) {
    // Use 'block' explicitly: setting '' would clear the inline style and
    // fall back to the CSS display:none rule, hiding the banner.
    banner.style.display = 'block';
    banner.classList.remove('win', 'loss');
    banner.classList.add(state);
    banner.innerHTML = '<h2>' + title + '</h2><div class="sub">' + sub + '</div>';
  }

  function clearBanner() { banner.style.display = 'none'; banner.innerHTML = ''; }

  function handleErrorCode(code) {
    const map = {
      unauthenticated: 'You must log in.',
      csrf: 'Session expired, refresh the page.',
      invalid: 'Invalid bet amount.',
      negative: "You can't bet debt.",
      poor: "You don't have enough credits.",
      infinity: 'Nice try cheater.',
      invalid_bet_value: 'Invalid bet value. Numbers must be 0-36.',
      server: 'Server error, try again.',
    };
    setBanner('loss', 'Error', map[code] || ('Error: ' + code));
  }

  async function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    clearBanner();

    const amount = normalizeAmount(amountInput.value);
    const betType = betTypeSel.value;
    let betValue = null;
    if (betType === 'number') {
      const v = betValueInput.value.trim();
      if (!v) { setBanner('loss', 'Invalid', 'Enter a number 0-36'); spinning = false; spinBtn.disabled = false; return; }
      const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 0 || n > 36) { setBanner('loss', 'Invalid', 'Number must be 0-36'); spinning = false; spinBtn.disabled = false; return; }
      betValue = n;
    }
    if (!amount) { setBanner('loss', 'Invalid', 'Enter a bet amount.'); spinning = false; spinBtn.disabled = false; return; }

    let data;
    try {
      const r = await fetch('/games/roulette/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf, amount, betType, betValue }),
      });
      data = await r.json();
    } catch (e) {
      setBanner('loss', 'Network error', 'Try again.');
      spinning = false;
      spinBtn.disabled = false;
      return;
    }

    if (data.error) {
      handleErrorCode(data.error);
      spinning = false;
      spinBtn.disabled = false;
      return;
    }

    const d = data.data;
    // Compute target: each label is at (n * SEGMENT) clockwise from top.
    // To bring number N under the top pointer we rotate by (- n * SEGMENT) mod 360.
    const turns = 6;
    const land = ((360 - d.wheelResult * SEGMENT) % 360 + 360) % 360;
    const newRotation = baseRotation + (turns * 360) + (land - (baseRotation % 360));
    baseRotation = newRotation;
    wheel.style.transform = 'rotate(' + newRotation + 'deg)';

    setTimeout(() => {
      const colorWord = d.color.charAt(0).toUpperCase() + d.color.slice(1);
      const title = d.isWin
        ? 'You won ' + Number(d.winnings).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' mystic credits'
        : 'You lost ' + Number(d.amount).toLocaleString() + ' mystic credits';
      const sub = 'Wheel landed on ' + d.wheelResult + ' (' + colorWord + '). Streak: ' + d.streak;
      setBanner(d.isWin ? 'win' : 'loss', title, sub);
      spinning = false;
      spinBtn.disabled = false;
    }, 4300);
  }

  spinBtn.addEventListener('click', spin);
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Roulette</h1>
    <p class="text-center text-fog-300 mb-4">Bet on a number, color, or parity. Pray.</p>
    <div class="roul-container">
      <div class="wheel-stage">
        <div class="wheel-pointer"></div>
        <div id="wheel" class="wheel" style="background: ${wheelBg};">
          ${raw(labelsHTML)}
        </div>
        <div class="wheel-hub"></div>
      </div>
      ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to play.</div>`
    : html`
            <form class="roul-form" onsubmit="return false">
              <label>
                Amount
                <input id="amount-input" type="text" placeholder="e.g. 1000 or 1k" autocomplete="off" />
              </label>
              <label>
                Bet type
                <select id="bet-type">
                  <option value="number">Number</option>
                  <option value="red">Red</option>
                  <option value="black">Black</option>
                  <option value="green">Green</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </label>
              <label>
                Number (0–36)
                <input id="bet-value" type="number" min="0" max="36" placeholder="0" />
              </label>
            </form>
            <button id="spin-btn" class="btn-accent">Spin</button>
          `}
      <div id="result-banner" class="result-banner"></div>
    </div>
    ${extras}
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Roulette',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
