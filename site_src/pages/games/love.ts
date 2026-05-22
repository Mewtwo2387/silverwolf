import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

const HEART_SYMBOL = raw(`
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
  <defs>
    <symbol id="heart-symbol" viewBox="0 0 512 512">
      <path fill="#FFDCE1" d="M511.342,227.699c-0.794,3.498-2.481,6.843-5.115,9.645l-6.202,6.62l-220.396,235.17l-3.401,3.652l-0.014,0.014l-4.502,4.795c-4.126,4.39-9.687,6.606-15.262,6.606c-0.153,0-0.307-0.014-0.446-0.014c-0.153,0-0.307,0.014-0.46,0.014c-5.575,0-11.136-2.216-15.248-6.606l-2.342-2.495l-4.363-4.655L11.983,243.964l-6.202-6.62c-2.634-2.801-4.321-6.147-5.115-9.645c-0.697-2.676-0.864-5.547-0.418-8.446l2.676-17.102l14.76-94.288l1.84-11.763c0.028-0.139,0.07-0.265,0.098-0.404c0.836-6.091,4.335-11.763,10.035-15.136l12-7.122l75.138-44.531l13.603-8.07c2.565-1.519,5.324-2.425,8.098-2.76c4.85-0.794,9.993,0.098,14.481,2.927l5.993,3.777l76.295,48.085l20.739,13.074l21.074-13.283l77.842-49.075l0.098-0.056c1.352-0.85,2.774-1.505,4.237-2.021c6.481-4.376,15.164-4.934,22.342-0.669l14.955,8.864l73.716,43.695l12.084,7.164c5.701,3.373,9.185,9.046,10.035,15.136c0.014,0.139,0.056,0.265,0.084,0.404l1.826,11.694l14.774,94.358l2.676,17.102C512.206,222.152,512.025,225.023,511.342,227.699z"/>
      <path fill="#F4CED2" d="M511.342,227.699c-0.794,3.498-2.481,6.843-5.115,9.645l-6.202,6.62l-220.396,235.17l-3.401,3.652l-0.014,0.014l-4.502,4.795c-4.126,4.39-9.687,6.606-15.262,6.606c-0.153,0-0.307-0.014-0.446-0.014V85.939l21.074-13.283l77.842-49.075l0.098-0.056c1.352-0.85,2.774-1.505,4.237-2.021c6.481-4.376,15.164-4.934,22.342-0.669l14.955,8.864l73.716,43.695l12.084,7.164c5.701,3.373,9.185,9.046,10.035,15.136c0.014,0.139,0.056,0.265,0.084,0.404l1.826,11.694l14.774,94.358l2.676,17.102C512.206,222.152,512.025,225.023,511.342,227.699z"/>
      <path fill="#F5888E" d="M511.746,219.253l-2.676-17.102H381.233l113.062-94.358L492.47,96.1c-0.028-0.139-0.07-0.265-0.084-0.404c-0.85-6.091-4.335-11.763-10.035-15.136l-12.084-7.164l-109.62,91.487l35.903-135.181l-14.955-8.864c-7.178-4.265-15.861-3.707-22.342,0.669c-1.463,0.516-2.885,1.171-4.237,2.021l-0.098,0.056l-47.416,178.569h-29.715l-0.711-129.495l-21.074,13.283l-20.739-13.074l0.711,129.286h-29.896L158.97,24.781l-5.993-3.777c-4.488-2.829-9.631-3.721-14.481-2.927c-2.774,0.335-5.533,1.24-8.098,2.76l-13.603,8.07l36.266,136.533L41.656,73.437l-12,7.122c-5.701,3.373-9.199,9.046-10.035,15.136c-0.028,0.139-0.07,0.265-0.098,0.404l-1.84,11.763l114.177,94.288H2.924l-2.676,17.102c-0.446,2.899-0.279,5.77,0.418,8.446c0.794,3.498,2.481,6.843,5.115,9.645l6.202,6.62h161.928l61.242,230.585l-1.561,5.896l4.363,4.655l2.342,2.495c4.112,4.39,9.673,6.606,15.248,6.606c0.153,0,0.307-0.014,0.46-0.014c0.139,0,0.293,0.014,0.446,0.014c5.575,0,11.136-2.216,15.262-6.606l4.502-4.795l0.014-0.014l3.401-3.652l-1.213-4.599l61.228-230.571h160.381l6.202-6.62c2.634-2.801,4.321-6.147,5.115-9.645C512.025,225.023,512.206,222.152,511.746,219.253z M256.784,393.111l-0.781-2.941l-38.83-146.206h79.222L256.784,393.111z"/>
      <path fill="#F76976" d="M511.342,227.699c-0.794,3.498-2.481,6.843-5.115,9.645l-6.202,6.62H339.643l-61.228,230.571l1.213,4.599l-3.401,3.652l-0.014,0.014l-4.502,4.795c-4.126,4.39-9.687,6.606-15.262,6.606c-0.153,0-0.307-0.014-0.446-0.014V390.17l0.781,2.941l39.611-149.147h-40.391V85.939l21.074-13.283l0.711,129.495h29.715l47.416-178.569l0.098-0.056c1.352-0.85,2.774-1.505,4.237-2.021c6.481-4.376,15.164-4.934,22.342-0.669l14.955,8.864l-35.903,135.181l109.62-91.487l12.084,7.164c5.701,3.373,9.185,9.046,10.035,15.136c0.014,0.139,0.056,0.265,0.084,0.404l1.826,11.694l-113.062,94.358H509.07l2.676,17.102C512.206,222.152,512.025,225.023,511.342,227.699z"/>
    </symbol>
  </defs>
</svg>
`);

export function LovePage(opts: { nonce: string; lv999?: boolean; user?: import('../../components/navbar').NavUser | null }) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .love-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-top: 2rem;
  }
  .heart-area {
    position: relative;
    width: 240px;
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .heart-area > svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  #love-heart {
    transform-origin: center center;
    transition: opacity 0.1s ease;
  }

  /* ----- 60-80% : beating ----- */
  @keyframes heart-beat {
    0%, 60%, 100% { transform: scale(1); }
    18% { transform: scale(1.18); }
    36% { transform: scale(0.94); }
    50% { transform: scale(1.08); }
  }
  .heart-area.beating #love-heart {
    animation: heart-beat 0.85s ease-in-out infinite;
  }

  /* ----- crack overlay (40-60% slight, 20-40% larger) ----- */
  .crack-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
  }
  .crack-overlay path {
    fill: none;
    stroke: #1a0205;
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 1px rgba(0,0,0,0.4));
    stroke-dasharray: var(--len);
    stroke-dashoffset: var(--len);
  }
  .crack-overlay.cracking {
    opacity: 1;
  }
  .crack-overlay.cracking path {
    animation: crack-draw 0.45s ease-out forwards;
  }
  @keyframes crack-draw {
    to { stroke-dashoffset: 0; }
  }

  /* ----- shatter (<20%) ----- */
  .shatter-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .shard {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }
  .shard svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .shard-1 { clip-path: polygon(0% 0%, 50% 0%, 35% 50%, 0% 60%); }
  .shard-2 { clip-path: polygon(50% 0%, 100% 0%, 100% 35%, 65% 50%); }
  .shard-3 { clip-path: polygon(0% 60%, 35% 50%, 50% 100%, 0% 100%); }
  .shard-4 { clip-path: polygon(65% 50%, 100% 35%, 100% 100%, 50% 100%); }
  .shard-5 { clip-path: polygon(35% 50%, 65% 50%, 50% 100%); }
  .shard-6 { clip-path: polygon(35% 50%, 50% 0%, 65% 50%); }

  @keyframes shard-fly-1 { to { transform: translate(-180px, -130px) rotate(-240deg); opacity: 0; } }
  @keyframes shard-fly-2 { to { transform: translate(180px, -130px) rotate(240deg); opacity: 0; } }
  @keyframes shard-fly-3 { to { transform: translate(-200px, 110px) rotate(-180deg); opacity: 0; } }
  @keyframes shard-fly-4 { to { transform: translate(200px, 110px) rotate(180deg); opacity: 0; } }
  @keyframes shard-fly-5 { to { transform: translate(0, 220px) rotate(80deg); opacity: 0; } }
  @keyframes shard-fly-6 { to { transform: translate(0, -210px) rotate(-80deg); opacity: 0; } }

  .shatter-container.shattering .shard { opacity: 1; }
  .shatter-container.shattering .shard-1 { animation: shard-fly-1 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }
  .shatter-container.shattering .shard-2 { animation: shard-fly-2 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }
  .shatter-container.shattering .shard-3 { animation: shard-fly-3 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }
  .shatter-container.shattering .shard-4 { animation: shard-fly-4 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }
  .shatter-container.shattering .shard-5 { animation: shard-fly-5 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }
  .shatter-container.shattering .shard-6 { animation: shard-fly-6 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards; }

  .heart-area.shattered #love-heart { opacity: 0; }

  /* ----- message + inputs ----- */
  .love-message {
    text-align: center;
    font-size: 1rem;
    color: var(--fog-200);
    min-height: 3.4rem;
    max-width: 520px;
    line-height: 1.4;
  }
  .love-message strong {
    display: block;
    color: var(--accent-light);
    font-size: 1.35rem;
    margin-bottom: 0.3rem;
  }

  .love-inputs {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    max-width: 520px;
  }
  .love-inputs input {
    flex: 1;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.65rem 1rem;
    color: var(--fog-100);
    font-size: 0.95rem;
  }
  .love-inputs input:focus {
    outline: none;
    border-color: #f5888e;
  }

  .love-btn {
    --btn-color: #f76976;
    --btn-color-pale: #f5888e;
    --btn-color-light: #ffd2dc;
    --btn-glow-faint: rgba(247, 105, 118, 0.25);
    --btn-glow-bright: rgba(247, 105, 118, 0.55);

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
  .love-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, color-mix(in oklab, var(--btn-color) 25%, transparent), color-mix(in oklab, var(--btn-color-pale) 25%, transparent));
    color: #fff;
    border-color: var(--btn-color-light);
    box-shadow: 0 0 16px var(--btn-glow-bright), 0 0 4px var(--btn-color);
  }
  .love-btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 0 6px var(--btn-glow-faint);
  }
  .love-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--ink-500);
    background: transparent;
    color: var(--ink-500);
    box-shadow: none;
  }

  /* ----- >=80% : full-page magical heart trace ----- */
  .heart-trace-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    transition: opacity 0.5s ease;
  }
  .heart-trace-overlay svg.trace-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .trace-path {
    fill: none;
    stroke: url(#trace-gradient);
    stroke-width: 6;
    stroke-linecap: round;
    filter: drop-shadow(0 0 12px rgba(247, 105, 118, 0.85));
  }
  .heart-particle {
    position: fixed;
    pointer-events: none;
    color: #f76976;
    font-size: 1.1rem;
    transform: translate(-50%, -50%);
    text-shadow: 0 0 10px rgba(247, 105, 118, 0.9);
    will-change: transform, opacity;
    animation: particle-float 1.4s ease-out forwards;
  }
  @keyframes particle-float {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
    25%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, -60px))) scale(0.6); }
  }
</style>
<script nonce="${nonce}">
(() => {
  const heartArea       = document.getElementById('heart-area');
  const crackOverlay    = document.getElementById('crack-overlay');
  const shatterBox      = document.getElementById('shatter-container');
  const messageEl       = document.getElementById('love-message');
  const input1          = document.getElementById('love-input1');
  const input2          = document.getElementById('love-input2');
  const btn             = document.getElementById('love-calculate-btn');

  let activeOverlay = null;
  let runId = 0;

  function fnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function compute(a, b) {
    const sorted = [a.toLowerCase(), b.toLowerCase()].sort().join('');
    return fnv1a(sorted) % 101;
  }

  function phraseFor(p) {
    if (p <= 20) return 'Chances are low, but never zero!';
    if (p <= 40) return 'You might be better off as friends.';
    if (p <= 60) return "There's something there... maybe!";
    if (p <= 80) return "Looks like there's some potential!";
    return 'True love! Get ready for the wedding bells!';
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function clearAnimations() {
    runId++;
    heartArea.classList.remove('beating', 'shattered');
    crackOverlay.classList.remove('cracking');
    shatterBox.classList.remove('shattering');
    crackOverlay.querySelectorAll('path').forEach((p) => { p.style.display = ''; });
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
  }

  function showCracks(count) {
    const paths = crackOverlay.querySelectorAll('path');
    paths.forEach((p, i) => {
      p.style.display = i < count ? '' : 'none';
    });
    void crackOverlay.offsetWidth;
    crackOverlay.classList.add('cracking');
  }

  function shatter() {
    heartArea.classList.add('shattered');
    void shatterBox.offsetWidth;
    shatterBox.classList.add('shattering');
    const myRun = runId;
    setTimeout(() => {
      if (myRun !== runId) return;
      heartArea.classList.remove('shattered');
      shatterBox.classList.remove('shattering');
    }, 1600);
  }

  function beat() {
    heartArea.classList.add('beating');
  }

  function magicTrace() {
    const overlay = document.createElement('div');
    overlay.className = 'heart-trace-overlay';
    overlay.innerHTML = [
      '<svg class="trace-svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">',
      '<defs>',
      '<linearGradient id="trace-gradient" x1="0%" y1="0%" x2="100%" y2="0%">',
      '<stop offset="0%" stop-color="#f5888e"/>',
      '<stop offset="50%" stop-color="#f76976"/>',
      '<stop offset="100%" stop-color="#f5888e"/>',
      '</linearGradient>',
      '</defs>',
      '<path id="trace-left" class="trace-path" d="M 400 470 C 240 410, 130 310, 200 220 C 280 130, 380 200, 400 250"/>',
      '<path id="trace-right" class="trace-path" d="M 400 470 C 560 410, 670 310, 600 220 C 520 130, 420 200, 400 250"/>',
      '</svg>',
    ].join('');
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    const myRun = runId;

    const left  = overlay.querySelector('#trace-left');
    const right = overlay.querySelector('#trace-right');
    const lLen  = left.getTotalLength();
    const rLen  = right.getTotalLength();

    [left, right].forEach((p, i) => {
      const len = i === 0 ? lLen : rLen;
      p.style.strokeDasharray  = len;
      p.style.strokeDashoffset = len;
    });
    void overlay.offsetWidth;
    [left, right].forEach((p, i) => {
      const len = i === 0 ? lLen : rLen;
      p.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(0.4, 0, 0.2, 1)';
      p.style.strokeDashoffset = '0';
      void len; // referenced for clarity
    });

    const start    = performance.now();
    const duration = 2400;

    const tick = (now) => {
      if (myRun !== runId || activeOverlay !== overlay) return;
      const t   = Math.min(1, (now - start) / duration);
      const svg = overlay.querySelector('svg');
      const rect = svg.getBoundingClientRect();
      const sx = rect.width / 800;
      const sy = rect.height / 600;
      [[left, lLen], [right, rLen]].forEach(([p, len]) => {
        const pt = p.getPointAtLength(len * t);
        // Spawn 1-2 particles per frame per side along the trace.
        for (let k = 0; k < 2; k++) {
          const part = document.createElement('div');
          part.className = 'heart-particle';
          part.textContent = Math.random() < 0.5 ? '❤' : '♥';
          part.style.left = (rect.left + pt.x * sx + (Math.random() * 14 - 7)) + 'px';
          part.style.top  = (rect.top  + pt.y * sy + (Math.random() * 14 - 7)) + 'px';
          part.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
          part.style.setProperty('--dy', (-40 - Math.random() * 60) + 'px');
          part.style.fontSize = (0.8 + Math.random() * 0.9) + 'rem';
          document.body.appendChild(part);
          setTimeout(() => part.remove(), 1500);
        }
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    setTimeout(() => {
      if (myRun !== runId || activeOverlay !== overlay) return;
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (activeOverlay === overlay) {
          overlay.remove();
          activeOverlay = null;
        }
      }, 500);
    }, duration + 700);
  }

  function calculate() {
    const a = input1.value.trim();
    const b = input2.value.trim();
    if (!a || !b) {
      messageEl.innerHTML = 'Enter <em>both</em> names to test your compatibility.';
      return;
    }
    clearAnimations();
    const p = compute(a, b);
    messageEl.innerHTML =
      '<strong>' + escapeHTML(a) + ' ❤️ ' + escapeHTML(b) + ' — ' + p + '%</strong>'
      + escapeHTML(phraseFor(p));

    if (p < 20)      shatter();
    else if (p < 40) showCracks(3);
    else if (p < 60) showCracks(1);
    else if (p < 80) beat();
    else             magicTrace();
  }

  btn.addEventListener('click', calculate);
  [input1, input2].forEach((inp) => {
    inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculate(); });
  });
})();
</script>
  `);

  const body = html`
    ${HEART_SYMBOL}
    <h1 class="text-center">Love Calculator</h1>
    <div class="love-container">
      <div id="heart-area" class="heart-area">
        ${raw('<svg id="love-heart" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet"><use href="#heart-symbol" width="512" height="512"/></svg>')}
        ${raw(`<svg id="crack-overlay" class="crack-overlay" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
          <path style="--len: 540" d="M 256 70 L 230 140 L 280 200 L 240 260 L 290 320 L 250 380 L 256 440"/>
          <path style="--len: 280" d="M 195 130 L 220 180 L 175 240 L 210 290"/>
          <path style="--len: 280" d="M 320 130 L 295 200 L 340 260 L 305 320"/>
        </svg>`)}
        ${raw(`<div id="shatter-container" class="shatter-container">
          ${[1, 2, 3, 4, 5, 6].map((i) => `<div class="shard shard-${i}"><svg viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet"><use href="#heart-symbol" width="512" height="512"/></svg></div>`).join('')}
        </div>`)}
      </div>
      <div id="love-message" class="love-message">Enter two names below to test your compatibility.</div>
      <div class="love-inputs">
        <input type="text" id="love-input1" placeholder="Name 1" autocomplete="off" maxlength="80" />
        <input type="text" id="love-input2" placeholder="Name 2" autocomplete="off" maxlength="80" />
      </div>
      <button id="love-calculate-btn" class="love-btn">Calculate ❤️</button>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Love Calculator',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
