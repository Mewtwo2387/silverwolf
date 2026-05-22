import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';

export function AwdangitPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .awdangit-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .awdangit-machine {
    background: linear-gradient(180deg, #c0252e 0%, #7e1820 100%);
    padding: 1rem;
    border-radius: 1rem;
    border: 4px solid #4a0d12;
    box-shadow: 0 8px 28px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.4);
    transform-origin: center center;
  }
  .awdangit-machine.shake-loss {
    animation: aw-shake-side 0.8s ease-in-out;
  }
  .awdangit-machine.shake-win {
    animation: aw-shake-rot 1.2s ease-in-out;
  }
  @keyframes aw-shake-side {
    0%, 100% { transform: translateX(0); }
    10% { transform: translateX(-14px); }
    20% { transform: translateX(12px); }
    30% { transform: translateX(-10px); }
    40% { transform: translateX(9px); }
    50% { transform: translateX(-7px); }
    60% { transform: translateX(6px); }
    70% { transform: translateX(-4px); }
    80% { transform: translateX(3px); }
    90% { transform: translateX(-2px); }
  }
  @keyframes aw-shake-rot {
    0%   { transform: scale(1)    rotate(0deg); }
    15%  { transform: scale(1.1)  rotate(-6deg); }
    30%  { transform: scale(1.12) rotate(6deg); }
    45%  { transform: scale(1.12) rotate(-5deg); }
    60%  { transform: scale(1.1)  rotate(4deg); }
    75%  { transform: scale(1.1)  rotate(-3deg); }
    90%  { transform: scale(1.08) rotate(2deg); }
    100% { transform: scale(1)    rotate(0deg); }
  }
  .reels {
    display: flex;
    gap: 0.5rem;
    background: #111;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }
  .reel {
    width: 90px;
    height: 90px;
    overflow: hidden;
    position: relative;
    background: var(--ink-900);
    border-radius: 0.4rem;
    border: 1px solid var(--ink-600);
  }
  .reel::before, .reel::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 14px;
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
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .symbol img { width: 64px; height: 64px; object-fit: contain; }

  .gamble-btn {
    --btn-color: #FFCC4D;
    --btn-color-pale: #F4900C;
    --btn-color-light: #FFE8B6;
    --btn-glow-faint: rgba(255, 204, 77, 0.25);
    --btn-glow-bright: rgba(255, 204, 77, 0.55);

    background: linear-gradient(135deg, color-mix(in oklab, var(--btn-color) 8%, transparent), color-mix(in oklab, var(--btn-color-pale) 8%, transparent));
    color: var(--btn-color);
    border: 1px solid var(--btn-color);
    border-radius: 4px;
    padding: 0.7rem 1.6rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 8px var(--btn-glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, opacity 0.1s, background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .gamble-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, color-mix(in oklab, var(--btn-color) 25%, transparent), color-mix(in oklab, var(--btn-color-pale) 25%, transparent));
    color: #fff;
    border-color: var(--btn-color-light);
    box-shadow: 0 0 16px var(--btn-glow-bright), 0 0 4px var(--btn-color);
  }
  .gamble-btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 0 6px var(--btn-glow-faint);
  }
  .gamble-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--ink-500);
    background: transparent;
    color: var(--ink-500);
    box-shadow: none;
  }

  .result-banner {
    text-align: center;
    padding: 1rem 1.4rem;
    border-radius: 0.75rem;
    background: var(--ink-800);
    border: 2px solid var(--ink-600);
    width: 100%;
    max-width: 540px;
    display: none;
  }
  .result-banner.money {
    border-color: #FFCC4D;
    color: #FFE8B6;
    box-shadow: 0 0 24px rgba(255, 204, 77, 0.45);
  }
  .result-banner.money h2 { color: #FFD983; text-shadow: 0 0 12px rgba(244, 144, 12, 0.6); }
  .result-banner.girl {
    border-color: #f76976;
    color: #ffd2dc;
    box-shadow: 0 0 24px rgba(247, 105, 118, 0.55);
  }
  .result-banner.girl h2 { color: #f76976; text-shadow: 0 0 12px rgba(247, 105, 118, 0.7); }
  .result-banner h2 { font-size: 1.3rem; margin: 0 0 0.4rem 0; font-weight: bold; }
  .result-banner .sub { font-size: 0.95rem; opacity: 0.92; }

  .coin-rain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  }
  .rain-coin {
    position: absolute;
    top: -60px;
    will-change: transform;
    animation: coin-fall linear forwards;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
  }
  @keyframes coin-fall {
    0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0.85; }
  }
</style>
  `);

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const machine = document.getElementById('awdangit-machine');
  const rollBtn = document.getElementById('gamble-btn');
  const banner = document.getElementById('result-banner');
  const reels = Array.from(document.querySelectorAll('.reel'));
  const SYMBOL_HEIGHT = 90;
  const COIN_SVG = '/static/svg/coin-svgrepo-com.svg';
  const HEART_SVG = '/static/svg/love-heart-svgrepo-com.svg';
  // Coin appears multiple times so the spinning blur skews toward the most-common
  // outcome — feels right because money lands 99% of the time.
  const FILLER_SVGS = [
    COIN_SVG, COIN_SVG, COIN_SVG,
    '/static/svg/pool-8-ball-svgrepo-com.svg',
    '/static/svg/fortune-cookie-svgrepo-com.svg',
    '/static/svg/poker-svgrepo-com.svg',
    '/static/svg/pile-of-poo-svgrepo-com.svg',
    '/static/svg/roulette-casino-svgrepo-com.svg',
    '/static/svg/slots-svgrepo-com.svg',
    '/static/svg/toilet-svgrepo-com.svg',
  ];

  let spinning = false;
  let activeRain = null;

  function symbolHTML(src) {
    return '<div class="symbol"><img src="' + src + '" alt="" loading="lazy" /></div>';
  }

  function buildStrip(reelIdx, stopSrc) {
    const FILLER_COUNT = 24 + reelIdx * 4;
    const out = [];
    for (let k = 0; k < FILLER_COUNT; k += 1) {
      out.push(symbolHTML(FILLER_SVGS[Math.floor(Math.random() * FILLER_SVGS.length)]));
    }
    out.push(symbolHTML(stopSrc));
    return { html: out.join(''), totalCount: FILLER_COUNT + 1 };
  }

  function clearBanner() {
    banner.style.display = 'none';
    banner.classList.remove('money', 'girl');
    banner.innerHTML = '';
  }

  function setBanner(state, headline, sub) {
    banner.style.display = 'block';
    banner.classList.remove('money', 'girl');
    banner.classList.add(state);
    banner.innerHTML = '<h2>' + headline + '</h2><div class="sub">' + sub + '</div>';
  }

  function rainCoins() {
    if (activeRain) activeRain.remove();
    const wrap = document.createElement('div');
    wrap.className = 'coin-rain';
    document.body.appendChild(wrap);
    activeRain = wrap;
    const total = 90;
    for (let i = 0; i < total; i += 1) {
      const c = document.createElement('img');
      c.className = 'rain-coin';
      c.src = COIN_SVG;
      c.alt = '';
      const left = Math.random() * 100;
      const dur = 2.2 + Math.random() * 2.6;
      const delay = Math.random() * 1.8;
      const size = 18 + Math.random() * 24;
      c.style.left = left + 'vw';
      c.style.width = size + 'px';
      c.style.height = size + 'px';
      c.style.animationDuration = dur + 's';
      c.style.animationDelay = delay + 's';
      wrap.appendChild(c);
    }
    setTimeout(() => {
      if (activeRain === wrap) {
        wrap.remove();
        activeRain = null;
      }
    }, 6500);
  }

  function gamble() {
    if (spinning) return;
    spinning = true;
    rollBtn.disabled = true;
    clearBanner();
    machine.classList.remove('shake-loss', 'shake-win');
    if (activeRain) { activeRain.remove(); activeRain = null; }

    const isGirl = Math.random() < 0.01;
    const stopSrc = isGirl ? HEART_SVG : COIN_SVG;
    const stopDelays = [1700, 2300, 2900];

    reels.forEach((reelEl, j) => {
      const strip = reelEl.querySelector('.strip');
      const built = buildStrip(j, stopSrc);
      strip.innerHTML = built.html;
      // Land on the last symbol (the stop) — translate so it sits at y=0 in the viewport.
      const translate = -(built.totalCount - 1) * SYMBOL_HEIGHT;

      strip.classList.remove('spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      void strip.offsetWidth;
      strip.style.transition = '';
      strip.style.setProperty('--spin-duration', (stopDelays[j] / 1000) + 's');
      strip.classList.add('spinning');
      strip.style.transform = 'translateY(' + translate + 'px)';
    });

    const totalWait = Math.max.apply(null, stopDelays) + 200;
    setTimeout(() => {
      if (isGirl) {
        machine.classList.add('shake-win');
        setBanner('girl', 'Congrats!', 'You became a girl!');
      } else {
        machine.classList.add('shake-loss');
        setBanner('money', 'Aw, dang it!', 'You won $1,000,000!');
        rainCoins();
      }
      spinning = false;
      rollBtn.disabled = false;
    }, totalWait);
  }

  rollBtn.addEventListener('click', gamble);
})();
</script>
  `);

  const reelsHTML = Array.from({ length: 3 }, (_, j) => `
    <div class="reel" data-reel="${j}">
      <div class="strip"></div>
    </div>
  `).join('');

  const body = html`
    <h1 class="text-center">Aw, dang it!</h1>
    <p class="text-center text-fog-300 mb-4">99% chance to earn $1M, 1% chance to become a girl.</p>
    <div class="awdangit-container">
      <div id="awdangit-machine" class="awdangit-machine">
        <div class="reels">
          ${raw(reelsHTML)}
        </div>
      </div>
      <button id="gamble-btn" type="button" class="gamble-btn">Let's go gambling!</button>
      <div id="result-banner" class="result-banner"></div>
    </div>
    ${extras}
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — Aw, dang it!',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
