import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON, NORMALIZE_AMOUNT_JS, FORMAT_NUMBER_JS } from '../../inline';

export function BlackjackPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  const extras = raw(`
<style>
  .bj-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .bj-table {
    width: 100%;
    max-width: 640px;
    background: linear-gradient(180deg, #1f4030 0%, #102217 100%);
    border: 1px solid var(--ink-600);
    border-radius: 1rem;
    padding: 1.5rem 1rem;
    box-shadow: 0 8px 28px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .bj-side {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bj-side .label {
    font-size: 0.85rem;
    color: var(--fog-300);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .bj-hand {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-height: 120px;
    perspective: 800px;
  }
  .card {
    width: 80px;
    height: 112px;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
    transform: rotateY(180deg);
    will-change: transform;
  }
  .card.dealt-in {
    animation: dealIn 0.45s ease-out;
  }
  @keyframes dealIn {
    from { transform: translate(120px, -120px) rotate(15deg) rotateY(180deg); }
    to   { transform: translate(0, 0) rotate(0deg) rotateY(180deg); }
  }
  .card.revealed { transform: rotateY(0deg); }
  .card-face, .card-back {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    backface-visibility: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px 8px;
    border: 1px solid #ddd;
    background: #fff;
    color: #111;
  }
  .card-back {
    transform: rotateY(180deg);
    background:
      repeating-linear-gradient(45deg, #1c2440 0 6px, #2a3470 6px 12px);
    border-color: var(--accent);
    box-shadow: inset 0 0 8px rgba(0,0,0,0.3);
  }
  .card-face.red { color: #c0252e; }
  .card-face .corner-tl,
  .card-face .corner-br {
    font-weight: bold;
    font-size: 0.85rem;
    line-height: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .card-face .corner-br { transform: rotate(180deg); align-self: flex-end; }
  .card-face .pip {
    font-size: 1.6rem;
    text-align: center;
  }

  .bj-meta {
    display: flex;
    justify-content: space-between;
    color: var(--fog-200);
    font-size: 0.9rem;
  }
  .bj-meta .total { color: var(--accent-light); font-weight: bold; }

  .timer-bar {
    width: 100%;
    height: 6px;
    background: var(--ink-700);
    border-radius: 999px;
    overflow: hidden;
  }
  .timer-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-pale));
    width: 100%;
    transition: width 0.1s linear;
  }
  .timer-fill.warning { background: var(--danger); }

  .bj-controls {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .bj-btn { padding: 0.65rem 1.4rem; }
  .bj-btn.secondary {
    background: color-mix(in oklab, var(--ink-500) 10%, transparent);
    color: var(--fog-300);
    border: 1px solid var(--ink-500);
    box-shadow: none;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: transform 0.1s, box-shadow 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .bj-btn.secondary:not(:disabled):hover {
    background: color-mix(in oklab, var(--ink-500) 25%, transparent);
    color: var(--fog-100);
    border-color: var(--ink-400);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }
  .bj-btn.secondary:not(:disabled):active {
    transform: translateY(1px);
    box-shadow: none;
  }

  .bet-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 420px;
    margin: 0 auto;
  }
  .bet-row label {
    color: var(--fog-300);
    font-size: 0.85rem;
  }
  .bet-row input {
    width: 100%;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.6rem 0.9rem;
    color: var(--fog-100);
    font: inherit;
  }
  .bet-row input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .bet-row .bj-btn {
    width: 100%;
  }

  .result-banner {
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
  }
  .result-banner.win { border-color: #2ecc71; color: #7ee2a4; }
  .result-banner.loss { border-color: var(--danger); color: var(--danger); }
  .result-banner.tie { border-color: #ffd454; color: #ffd454; }
  .result-banner h2 { font-size: 1.2rem; margin: 0 0 0.4rem 0; font-weight: bold; }
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
  ${FORMAT_NUMBER_JS}
  const csrf = ${csrfJSON};
  const setupEl = document.getElementById('bj-setup');
  const tableEl = document.getElementById('bj-table');
  const dealerHand = document.getElementById('dealer-hand');
  const playerHand = document.getElementById('player-hand');
  const dealerTotalEl = document.getElementById('dealer-total');
  const playerTotalEl = document.getElementById('player-total');
  const betDisplayEl = document.getElementById('bet-display');
  const timerFill = document.getElementById('timer-fill');
  const hitBtn = document.getElementById('hit-btn');
  const standBtn = document.getElementById('stand-btn');
  const dealBtn = document.getElementById('deal-btn');
  const amountInput = document.getElementById('amount-input');
  const errorEl = document.getElementById('bj-error');
  const banner = document.getElementById('bj-banner');

  let timerHandle = null;
  let expiresAt = 0;

  const SUIT_RED = new Set(['♥', '♦']);

  function pip(value) { return value === '10' ? '10' : value; }

  function renderCard(card, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    if (opts && opts.dealt) wrap.classList.add('dealt-in');
    const isRed = SUIT_RED.has(card.suit);
    wrap.innerHTML = '<div class="card-back"></div>'
      + '<div class="card-face' + (isRed ? ' red' : '') + '">'
      + '<div class="corner-tl">' + pip(card.value) + '<span>' + card.suit + '</span></div>'
      + '<div class="pip">' + card.suit + '</div>'
      + '<div class="corner-br">' + pip(card.value) + '<span>' + card.suit + '</span></div>'
      + '</div>';
    return wrap;
  }

  function reveal(el, delay) {
    setTimeout(() => el.classList.add('revealed'), delay);
  }

  function clearHands() {
    dealerHand.innerHTML = '';
    playerHand.innerHTML = '';
  }

  function setError(msg) {
    errorEl.textContent = msg || '';
    errorEl.style.display = msg ? 'block' : 'none';
  }

  function showSetup() {
    setupEl.style.display = '';
    tableEl.style.display = 'none';
    banner.style.display = 'none';
    dealBtn.disabled = false;
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function showTable(amount) {
    setupEl.style.display = 'none';
    tableEl.style.display = '';
    banner.style.display = 'none';
    betDisplayEl.textContent = amount;
    hitBtn.disabled = false;
    standBtn.disabled = false;
  }

  function startTimer(targetExpiresAt) {
    expiresAt = targetExpiresAt;
    if (timerHandle) clearInterval(timerHandle);
    const total = 60_000;
    const tick = () => {
      const remaining = Math.max(0, expiresAt - Date.now());
      const pct = (remaining / total) * 100;
      timerFill.style.width = pct + '%';
      if (pct < 25) timerFill.classList.add('warning');
      else timerFill.classList.remove('warning');
      if (remaining <= 0) {
        clearInterval(timerHandle);
        timerHandle = null;
        // Fire a stand to finalize the loss server-side and pull the result.
        hitBtn.disabled = true;
        standBtn.disabled = true;
        autoFinalize();
      }
    };
    tick();
    timerHandle = setInterval(tick, 200);
  }

  async function autoFinalize() {
    try {
      const r = await fetch('/games/blackjack/stand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf }),
      });
      const data = await r.json();
      handleStandResult(data);
    } catch (e) {
      // server already expired the game and recorded the loss; show a generic loss
      showResult({ result: 'loss', message: 'Time ran out!' });
    }
  }

  function handleResponseError(data) {
    if (data && data.error) {
      const map = {
        unauthenticated: 'You must log in.',
        csrf: 'Session expired, refresh the page.',
        invalid: 'Invalid bet amount.',
        negative: 'You can\\'t bet debt.',
        poor: 'You don\\'t have enough credits.',
        infinity: 'Nice try cheater.',
        in_progress: 'You already have a game running.',
        no_game: 'No active game.',
        expired: 'Time ran out!',
        server: 'Server error, try again.',
      };
      setError(map[data.error] || ('Error: ' + data.error));
      return true;
    }
    return false;
  }

  async function deal() {
    setError('');
    const amount = normalizeAmount(amountInput.value);
    if (!amount) { setError('Enter a bet amount.'); return; }
    dealBtn.disabled = true;

    let data;
    try {
      const r = await fetch('/games/blackjack/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf, amount }),
      });
      data = await r.json();
    } catch (e) {
      setError('Network error.');
      dealBtn.disabled = false;
      return;
    }

    if (handleResponseError(data)) {
      dealBtn.disabled = false;
      return;
    }

    const d = data.data;
    showTable(format(d.amount));
    clearHands();
    // Player gets two face-up cards (dealt with stagger), dealer gets one face-up + one face-down.
    const p1 = renderCard(d.playerHand[0], { dealt: true });
    const p2 = renderCard(d.playerHand[1], { dealt: true });
    playerHand.append(p1, p2);
    reveal(p1, 200);
    reveal(p2, 500);
    const dUp = renderCard(d.dealerUpCard, { dealt: true });
    const dDown = renderCard({ suit: '?', value: '?' }, { dealt: true });
    dealerHand.append(dUp, dDown);
    reveal(dUp, 350);
    // dDown stays back

    playerTotalEl.textContent = d.playerTotal;
    dealerTotalEl.textContent = '?';

    startTimer(d.expiresAt);
  }

  async function hit() {
    if (hitBtn.disabled) return;
    hitBtn.disabled = true;
    standBtn.disabled = true;

    let data;
    try {
      const r = await fetch('/games/blackjack/hit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf }),
      });
      data = await r.json();
    } catch (e) {
      setError('Network error.');
      hitBtn.disabled = false;
      standBtn.disabled = false;
      return;
    }

    if (handleResponseError(data)) return;
    const d = data.data;
    const newCard = d.playerHand[d.playerHand.length - 1];
    const el = renderCard(newCard, { dealt: true });
    playerHand.append(el);
    reveal(el, 200);
    playerTotalEl.textContent = d.playerTotal;

    if (d.busted) {
      // Dealer hand was returned; reveal it for the result view.
      revealDealerHand(d.dealerHand);
      dealerTotalEl.textContent = d.dealerTotal;
      setTimeout(() => showResult(d), 700);
    } else {
      hitBtn.disabled = false;
      standBtn.disabled = false;
    }
  }

  async function stand() {
    if (standBtn.disabled) return;
    hitBtn.disabled = true;
    standBtn.disabled = true;

    let data;
    try {
      const r = await fetch('/games/blackjack/stand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf }),
      });
      data = await r.json();
    } catch (e) {
      setError('Network error.');
      hitBtn.disabled = false;
      standBtn.disabled = false;
      return;
    }

    if (handleResponseError(data)) return;
    handleStandResult(data);
  }

  function handleStandResult(data) {
    if (handleResponseError(data)) return;
    const d = data.data;
    revealDealerHand(d.dealerHand);
    dealerTotalEl.textContent = d.dealerTotal;
    setTimeout(() => showResult(d), 700 + 400 * Math.max(0, d.dealerHand.length - 2));
  }

  function revealDealerHand(cards) {
    if (!cards) return;
    // Replace dealer DOM with the full revealed hand (animate any extras).
    dealerHand.innerHTML = '';
    cards.forEach((card, i) => {
      const el = renderCard(card, { dealt: i >= 2 });
      dealerHand.append(el);
      reveal(el, 100 + i * 350);
    });
  }

  function showResult(d) {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    banner.style.display = '';
    banner.classList.remove('win', 'loss', 'tie');
    banner.classList.add(d.result || 'loss');
    let title = d.message || 'Game over';
    let sub = '';
    if (d.result === 'win') {
      sub = 'You won ' + (d.winnings != null ? format(d.winnings) : '') + ' mystic credits';
      if (d.streak) sub += ' • streak ' + d.streak;
    } else if (d.result === 'loss') {
      sub = 'You lost ' + (d.amount != null ? format(d.amount) : '') + ' mystic credits';
    } else if (d.result === 'tie') {
      sub = 'Push. Nothing happened to your bet.';
    }
    banner.innerHTML = '<h2>' + title + '</h2><div class="sub">' + sub + '</div>'
      + '<div style="margin-top:0.75rem"><button class="btn-accent bj-btn" id="play-again">Play again</button></div>';
    document.getElementById('play-again').addEventListener('click', showSetup);
  }

  if (dealBtn) dealBtn.addEventListener('click', deal);
  if (hitBtn) hitBtn.addEventListener('click', hit);
  if (standBtn) standBtn.addEventListener('click', stand);
  if (amountInput) amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') deal(); });
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Blackjack</h1>
    <p class="text-center text-fog-300 mb-4">Try to beat Silverwolf without going over 21.</p>
    <div class="bj-container">
      ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to play.</div>`
    : html`
            <div id="bj-error" class="result-banner loss" style="display:none"></div>
            <div id="bj-setup" class="bet-row">
              <label for="amount-input">Bet amount</label>
              <input id="amount-input" type="text" placeholder="amount (e.g. 1000 or 1k)" autocomplete="off" aria-label="Bet amount" />
              <button id="deal-btn" class="btn-accent bj-btn">Deal</button>
            </div>
            <div id="bj-table" class="bj-table" style="display:none">
              <div class="bj-side">
                <div class="bj-meta"><span class="label">Silverwolf</span><span>Total: <span id="dealer-total" class="total">?</span></span></div>
                <div id="dealer-hand" class="bj-hand"></div>
              </div>
              <div class="timer-bar"><div id="timer-fill" class="timer-fill"></div></div>
              <div class="bj-side">
                <div class="bj-meta"><span class="label">You — bet <span id="bet-display" class="total"></span></span><span>Total: <span id="player-total" class="total">?</span></span></div>
                <div id="player-hand" class="bj-hand"></div>
              </div>
              <div class="bj-controls">
                <button id="hit-btn" class="btn-accent bj-btn">Hit</button>
                <button id="stand-btn" class="btn-accent bj-btn secondary">Stand</button>
              </div>
            </div>
            <div id="bj-banner" class="result-banner" style="display:none"></div>
          `}
    </div>
    ${extras}
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Blackjack',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
