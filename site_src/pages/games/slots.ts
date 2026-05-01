import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';

export function SlotsPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  const extras = raw(`
<style>
  .slots-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .slots-machine {
    background: linear-gradient(180deg, #c0252e 0%, #7e1820 100%);
    padding: 1rem;
    border-radius: 1rem;
    border: 4px solid #4a0d12;
    box-shadow: 0 8px 28px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.4);
  }
  .reels {
    display: flex;
    gap: 0.5rem;
    background: #111;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }
  .reel {
    width: 70px;
    height: 210px;
    overflow: hidden;
    position: relative;
    perspective: 600px;
    background: var(--ink-900);
    border-radius: 0.4rem;
    border: 1px solid var(--ink-600);
  }
  .reel::before, .reel::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 30px;
    z-index: 2;
    pointer-events: none;
  }
  .reel::before { top: 0; background: linear-gradient(180deg, var(--ink-900), transparent); }
  .reel::after { bottom: 0; background: linear-gradient(0deg, var(--ink-900), transparent); }
  .strip {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    transform: translateY(0);
    will-change: transform;
  }
  .strip.spinning { transition: transform var(--spin-duration, 2s) cubic-bezier(0.18, 0.7, 0.16, 1); }
  .symbol {
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fog-100);
    font-size: 2rem;
    line-height: 1;
  }
  .symbol img { width: 48px; height: 48px; object-fit: contain; }

  .slots-form {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    max-width: 420px;
  }
  .slots-form input {
    flex: 1;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.6rem 0.9rem;
    color: var(--fog-100);
  }
  .roll-btn {
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
  .roll-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #4a58e8; }
  .roll-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .result-banner {
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    width: 100%;
    max-width: 540px;
    display: none;
  }
  .result-banner.win { border-color: #2ecc71; color: #7ee2a4; }
  .result-banner.loss { border-color: var(--danger); color: var(--danger); }
  .result-banner h2 { font-size: 1.1rem; margin: 0 0 0.4rem 0; font-weight: bold; }
  .result-banner .sub { color: var(--fog-300); font-size: 0.9rem; }
  .result-banner img { width: 24px; height: 24px; vertical-align: middle; object-fit: contain; }

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

  // Render 5 empty reels with placeholder strips. The script will populate
  // them with filler symbols and animate to the server-supplied 3-symbol stop
  // position.
  const reelsHTML = Array.from({ length: 5 }, (_, j) => `
    <div class="reel" data-reel="${j}">
      <div class="strip"></div>
    </div>
  `).join('');

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};
  const rollBtn = document.getElementById('roll-btn');
  const amountInput = document.getElementById('amount-input');
  const banner = document.getElementById('result-banner');
  const reels = Array.from(document.querySelectorAll('.reel'));
  const SYMBOL_HEIGHT = 70;

  let spinning = false;
  // Filler pool: populated from the server result on each spin so the rolling
  // strips show the same Discord emotes the result will land on (no unicode
  // fallback emojis — those don't match the season's skin).
  let fillerPool = [];

  function symbolHTML(emote) {
    if (!emote) return '<div class="symbol"></div>';
    if (typeof emote === 'string') {
      return '<div class="symbol">' + escape(emote) + '</div>';
    }
    const e = emote.emote || '';
    const m = e.match(/^<a?:[\\w-]+:(\\d+)>$/);
    if (m) {
      return '<div class="symbol"><img src="https://cdn.discordapp.com/emojis/' + m[1] + '.png" alt="" loading="lazy" /></div>';
    }
    return '<div class="symbol">' + escape(e) + '</div>';
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function buildStrip(reelIdx, reelStop) {
    // reelStop = [topSymbol, middleSymbol, bottomSymbol] for this reel
    // Strip layout (top → bottom): N filler symbols, then the 3 stop symbols.
    // We translate the strip up so the 3 stop symbols sit centered in the visible area.
    const FILLER_COUNT = 24 + reelIdx * 4; // staggered length per reel
    const out = [];
    const pool = fillerPool.length > 0 ? fillerPool : reelStop;
    for (let k = 0; k < FILLER_COUNT; k += 1) {
      out.push(symbolHTML(pool[Math.floor(Math.random() * pool.length)]));
    }
    out.push(symbolHTML(reelStop[0]));
    out.push(symbolHTML(reelStop[1]));
    out.push(symbolHTML(reelStop[2]));
    return { html: out.join(''), totalCount: FILLER_COUNT + 3 };
  }

  function setBanner(state, html) {
    // Use 'block' explicitly: setting '' would clear the inline style and
    // fall back to the CSS display:none rule, hiding the banner.
    banner.style.display = 'block';
    banner.classList.remove('win', 'loss');
    banner.classList.add(state);
    banner.innerHTML = html;
  }

  function clearBanner() { banner.style.display = 'none'; banner.innerHTML = ''; }

  function emoteToInline(emote) {
    if (typeof emote === 'string') return escape(emote);
    const e = emote.emote || '';
    const m = e.match(/^<a?:[\\w-]+:(\\d+)>$/);
    if (m) return '<img src="https://cdn.discordapp.com/emojis/' + m[1] + '.png" alt="" />';
    return escape(e);
  }

  function renderResultMessage(message, results) {
    // Replace each Discord emoji shortcode in the message with its CDN image.
    const escaped = message.replace(/<a?:[\\w-]+:(\\d+)>/g, (_, id) => '<img src="https://cdn.discordapp.com/emojis/' + id + '.png" alt="" />');
    return escaped;
  }

  function handleErrorCode(code) {
    const map = {
      unauthenticated: 'You must log in.',
      csrf: 'Session expired, refresh the page.',
      invalid: 'Invalid bet amount.',
      negative: "You can't bet debt.",
      poor: "You don't have enough credits.",
      infinity: 'Nice try cheater.',
      server: 'Server error, try again.',
    };
    setBanner('loss', '<h2>' + (map[code] || ('Error: ' + code)) + '</h2>');
  }

  async function roll() {
    if (spinning) return;
    spinning = true;
    rollBtn.disabled = true;
    clearBanner();

    const amount = amountInput.value.trim();
    if (!amount) { setBanner('loss', '<h2>Enter a bet amount.</h2>'); spinning = false; rollBtn.disabled = false; return; }

    // Kick off a quick "pre-spin" so reels start moving immediately while
    // the network round-trip happens. We restart the animation properly
    // once the server result is in.
    reels.forEach((r) => {
      const strip = r.querySelector('.strip');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
    });

    let data;
    try {
      const r = await fetch('/games/slots/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf, amount }),
      });
      data = await r.json();
    } catch (e) {
      setBanner('loss', '<h2>Network error.</h2>');
      spinning = false;
      rollBtn.disabled = false;
      return;
    }

    if (data.error) {
      handleErrorCode(data.error);
      spinning = false;
      rollBtn.disabled = false;
      return;
    }

    const d = data.data;
    // d.results is [row0, row1, row2], each an array of 5 emote objects.
    // Reel j's stop column is [d.results[0][j], d.results[1][j], d.results[2][j]].
    // Pool the 15 result symbols for the rolling fillers — keeps the spin
    // visually consistent with the season's Discord emotes.
    fillerPool = [].concat(d.results[0], d.results[1], d.results[2]);
    const stopDelays = [1700, 2100, 2500, 2900, 3300];

    reels.forEach((reelEl, j) => {
      const strip = reelEl.querySelector('.strip');
      const stopCol = [d.results[0][j], d.results[1][j], d.results[2][j]];
      const built = buildStrip(j, stopCol);
      strip.innerHTML = built.html;
      // Total strip height in px:
      const stripHeight = built.totalCount * SYMBOL_HEIGHT;
      // We want the 3 stop symbols (last 3 in strip) centered around the middle symbol
      // sitting at y = SYMBOL_HEIGHT (middle row of the 3-row visible window).
      // The middle stop symbol is at index (total - 2). Its top in the strip = (total - 2) * SYMBOL_HEIGHT.
      // We want that to land at SYMBOL_HEIGHT in the viewport, so translate = -(((total - 2) * SYMBOL_HEIGHT) - SYMBOL_HEIGHT).
      const middleIdx = built.totalCount - 2;
      const translate = -(middleIdx - 1) * SYMBOL_HEIGHT;

      // Reset position instantly: park the strip so the stop symbols sit
      // below the visible window, then animate up to the final position.
      strip.classList.remove('spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(' + (translate + stripHeight - SYMBOL_HEIGHT * 3) + 'px)';
      // Force reflow so the parked position is committed before we re-enable transitions.
      void strip.offsetWidth;
      strip.style.transition = '';
      strip.style.setProperty('--spin-duration', (stopDelays[j] / 1000) + 's');
      strip.classList.add('spinning');
      strip.style.transform = 'translateY(' + translate + 'px)';
    });

    const totalWait = Math.max(...stopDelays) + 200;
    setTimeout(() => {
      // Render the final message; preserve Discord emoji rendering.
      const inline = renderResultMessage(d.isWin ? d.winMessage : d.loseMessage, d.results);
      const headline = d.isWin
        ? 'You won ' + Number(d.winnings).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' mystic credits'
        : 'You lost ' + Number(d.amount).toLocaleString() + ' mystic credits';
      setBanner(d.isWin ? 'win' : 'loss', '<h2>' + headline + '</h2><div class="sub">' + inline + '</div>');
      spinning = false;
      rollBtn.disabled = false;
    }, totalWait);
  }

  rollBtn.addEventListener('click', roll);
  amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') roll(); });
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Slots</h1>
    <p class="text-center text-fog-300 mb-4">Pull the lever and watch your mystic credits disappear in style.</p>
    <div class="slots-container">
      <div class="slots-machine">
        <div class="reels">
          ${raw(reelsHTML)}
        </div>
      </div>
      ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to play.</div>`
    : html`
            <form class="slots-form" onsubmit="return false">
              <label for="amount-input" class="sr-only">Bet amount</label>
              <input id="amount-input" type="text" placeholder="amount (e.g. 1000 or 1k)" autocomplete="off" aria-label="Bet amount" />
              <button id="roll-btn" type="button" class="roll-btn">Roll</button>
            </form>
          `}
      <div id="result-banner" class="result-banner"></div>
    </div>
    ${extras}
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Slots',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
