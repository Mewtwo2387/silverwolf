import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

export function FortunePage(opts: { fortunes: string[]; nonce: string; lv999?: boolean }) {
  const { fortunes, nonce, lv999 } = opts;

  const extras = raw(`
<style>
  .fortune-scene {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2rem;
    gap: 1.5rem;
  }

  #cookie-container {
    position: relative;
    width: min(280px, 80vw);
    aspect-ratio: 1;
    cursor: pointer;
    user-select: none;
    /* visible so paper can peek out below */
    overflow: visible;
  }

  #fortune-svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* Paper slip hidden at rest */
  #paper-slip {
    opacity: 0;
  }

  @keyframes cookie-shake {
    0%   { transform: scale(1)    rotate(0deg); }
    18%  { transform: scale(1.07) rotate(-5deg); }
    35%  { transform: scale(1.10) rotate(5deg); }
    52%  { transform: scale(1.06) rotate(-3deg); }
    68%  { transform: scale(1.04) rotate(2deg); }
    82%  { transform: scale(1.02) rotate(-1deg); }
    100% { transform: scale(1)    rotate(0deg); }
  }

  #fortune-svg.shaking {
    animation: cookie-shake 0.55s ease-out forwards;
    transform-origin: center center;
  }

  /*
   * Fortune card: sits at bottom-right of the cookie (where the paper exits),
   * z-index above the SVG so it renders IN FRONT of the cookie.
   * Starts collapsed at transform-origin top-right (the exit point).
   */
  #fortune-card {
    position: absolute;
    right: 0;
    bottom: -2%;
    width: 62%;
    background: #f7f2e8;
    border: 1px solid #c9b98a;
    border-radius: 4px;
    padding: 0.9rem 1rem;
    box-sizing: border-box;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.85rem;
    color: #2a1a08;
    text-align: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    z-index: 3;

    /* hidden: collapsed upward from the exit point */
    transform-origin: top right;
    transform: scaleY(0);
    opacity: 0;
  }

  #fortune-card.appearing {
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                opacity 0.2s ease;
    transform: scaleY(1);
    opacity: 1;
  }

  #fortune-card.disappearing {
    transition: transform 0.25s ease-in, opacity 0.2s ease-in;
    transform: scaleY(0);
    opacity: 0;
  }

  .fortune-hint {
    text-align: center;
    max-width: 360px;
    font-size: 0.9rem;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.8rem 2rem;
    cursor: pointer;
    font-weight: bold;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
<script nonce="${nonce}">
(() => {
  const fortunes = ${JSON.stringify(fortunes).replace(/</g, '\\u003c')};

  const svg = document.getElementById('fortune-svg');

  // Wrap the last two SVG paths (paper slip) in a <g> for animation
  const allPaths = svg.querySelectorAll('path');
  const paperGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  paperGroup.id = 'paper-slip';
  const p1 = allPaths[allPaths.length - 2];
  const p2 = allPaths[allPaths.length - 1];
  p1.parentNode.insertBefore(paperGroup, p1);
  paperGroup.appendChild(p1);
  paperGroup.appendChild(p2);

  const card      = document.getElementById('fortune-card');
  const text      = document.getElementById('fortune-text');
  const btn       = document.getElementById('reset-btn');
  const container = document.getElementById('cookie-container');

  let busy   = false;
  let opened = false;

  function showSlip() {
    // Paper becomes visible and flies out downward, in front of cookie
    // (SVG render order already puts it above cookie body paths)
    paperGroup.style.transition = 'transform 0.35s cubic-bezier(0.22, 1.8, 0.44, 1), opacity 0.1s ease';
    paperGroup.style.opacity    = '1';
    paperGroup.style.transform  = 'translateY(22px)';
  }

  function hideSlip() {
    paperGroup.style.transition = 'opacity 0.15s ease';
    paperGroup.style.opacity    = '0';
    paperGroup.style.transform  = '';
  }

  function resetSlip() {
    paperGroup.style.transition = '';
    paperGroup.style.opacity    = '0';
    paperGroup.style.transform  = '';
  }

  function cycleFortunes(onDone) {
    let count = 0;
    const max = 15;
    const tick = () => {
      text.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
      count++;
      if (count < max) {
        setTimeout(tick, 80 + count * 18);
      } else {
        text.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
        onDone();
      }
    };
    tick();
  }

  container.addEventListener('click', () => {
    if (busy || opened) return;
    busy   = true;
    opened = true;

    // 1. Cookie shakes
    svg.classList.add('shaking');
    svg.addEventListener('animationend', () => svg.classList.remove('shaking'), { once: true });

    // 2. SVG paper slip flies out from the cookie, in front
    setTimeout(showSlip, 130);

    // 3. Fortune card snaps in on top, covering the slip
    setTimeout(() => {
      hideSlip();
      card.classList.remove('disappearing');
      card.classList.add('appearing');
    }, 310);

    // 4. Fortune text cycles
    setTimeout(() => {
      text.textContent = '...';
      cycleFortunes(() => { busy = false; });
    }, 600);
  });

  btn.addEventListener('click', () => {
    if (busy || !opened) return;
    busy = true;

    card.classList.remove('appearing');
    card.classList.add('disappearing');

    setTimeout(() => {
      card.classList.remove('disappearing');
      resetSlip();
      text.textContent = '...';
      opened = false;
      busy   = false;
    }, 350);
  });
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Fortune Cookie</h1>
    <div class="fortune-scene">
      <div id="cookie-container">
        <svg id="fortune-svg" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Fortune cookie">
          <path fill="#FCAB40" d="M15 22s-1.15 2.749-2.15 4.749s-1.666 5.227.325 6.245c3.033 1.553 8.578.574 11.825-.994c2.724-1.316 5.179-3.085 7-6c1.746-2.794 3-6 3-8s-.147-3.591-.862-5.71c-.53-1.57-1.392-3.463-2.94-5.077c-1.819-1.896-2.635-3.805-3.582-5.158C26.806.896 26 0 24 0s-7 3-10 4s-7 2-10 6s-3 8-3 10s.062 4.885 2 6c2.305 1.327 5.575-1.634 8.045-2.356C13.392 22.958 15 22 15 22z"></path>
          <path fill="#F4900C" d="M33.717 21.334s-2.613 3.554-4.048 4.478c-.774.498-1.62 1.01-2.703 1.515c-.694.324-3.792 1.55-4.621 1.805c-1.408.433-3.285.83-4.26.866c-.975.036-1.805-.004-3.223.179c-.872.112-2.156.615-2.192 1.193c-.036.578 1.011 1.625 3.105 1.733c2.094.108 5.997-.177 8.375-1.227c3.321-1.467 5.307-3.285 6.282-4.44c.974-1.156 2.707-4.008 3.285-6.102z"></path>
          <path fill="#BF6952" d="M33.717 21.334s-1.733 2.166-3.149 3.353c-.936.785-2.937 2.181-4.396 2.893c-1.48.722-4.315 1.651-6.318 1.949c-1.697.253-4.345.526-5.235.722c-.859.189-1.287.458-1.047.758c.362.452 1.236.34 2.563.172c3.114-.394 5.932-.988 8.337-1.977c2.457-1.011 4.876-2.274 5.851-3.43s2.35-2.455 3.394-4.44z"></path>
          <path fill="#F4900C" d="M22.85 3.969c-.681 1.36-2.713 4.517-3.85 6.426c-1.353 2.271-3.117 5.018-4.074 7.605c-.295.798-.935 3.768-.819 4.466c.56-.271.893-.466.893-.466s1.172-2.255 2.182-3.807c1.011-1.552 4.404-7.473 5.668-9.567c1.264-2.094 1.763-4.16 1.588-5.218c-.252-1.535-1.086-.441-1.588.561z"></path>
          <path fill="#BF6952" d="M22.886 5.738c-.714 1.489-2.711 4.657-3.637 6.426c-.926 1.769-3.42 6.148-4.413 8.664c-.177.449-.359.977-.43 1.489C14.819 22.11 15 22 15 22s1.172-2.255 2.182-3.807c1.011-1.552 4.404-7.473 5.668-9.567c.974-1.614 1.489-3.206 1.596-4.337c-.287-1.312-1.089.467-1.56 1.449z"></path>
          <path fill="#CCD6DD" d="M29.069 25.815c-.927.647-2.011 1.332-2.898 1.764c-1 .488-2.615 1.065-4.177 1.484l.001.003s2.491 5.527 5.969 6.769l6.068-5.855s-3.857-2.652-4.963-4.165z"></path>
          <path fill="#9AAAB4" d="M25.454 27.9a21.505 21.505 0 0 1-.841.33a31.476 31.476 0 0 1-.822.291l-.145.048a29.75 29.75 0 0 1-1.652.495l.001.003s.151.334.428.853c.71-.214 1.397-.448 2.049-.716c1.993-.82 3.946-1.805 5.139-2.765a6.037 6.037 0 0 1-.542-.624l-.002.002c-.212.148-.432.297-.657.446l-.155.101c-.176.115-.352.227-.53.338l-.208.129c-.167.101-.33.197-.493.291l-.205.118c-.223.124-.441.241-.647.341a13.28 13.28 0 0 1-.538.244l-.18.075z"></path>
        </svg>
        <div id="fortune-card">
          <div id="fortune-text">...</div>
        </div>
      </div>
      <p class="fortune-hint text-fog-300">Click the cookie to crack it open and reveal your fortune.</p>
      <button id="reset-btn" class="btn-primary">Get Another</button>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Fortune Cookie',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
  });
}
