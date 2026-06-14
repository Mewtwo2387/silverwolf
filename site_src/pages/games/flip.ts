import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { FLIP_HEAD_THRESHOLD, FLIP_TAIL_THRESHOLD } from '../../../utils/flip';

export function FlipPage(opts: { nonce: string; lv999?: boolean; user?: import('../../components/navbar').NavUser | null }) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .flip-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3rem;
    margin-top: 2rem;
  }
  .coin {
    width: 200px;
    height: 200px;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 1s;
  }
  .coin div {
    width: 100%;
    height: 100%;
    position: absolute;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
    font-weight: bold;
    backface-visibility: hidden;
    border: 8px solid var(--accent);
    box-shadow: 0 0 20px var(--glow-bright);
    background: var(--ink-800);
    color: var(--accent-light);
  }
  .coin .heads {
    transform: rotateY(0deg);
  }
  .coin .tails {
    transform: rotateY(180deg);
  }
  .coin .side {
    width: 20px;
    height: 200px;
    left: 90px;
    transform: rotateY(90deg);
    background: var(--accent);
    border: none;
    box-shadow: none;
  }

  @keyframes flip-heads {
    from { transform: rotateY(0); }
    to { transform: rotateY(1800deg); }
  }
  @keyframes flip-tails {
    from { transform: rotateY(0); }
    to { transform: rotateY(1980deg); }
  }
  @keyframes flip-side {
    from { transform: rotateY(0); }
    to { transform: rotateY(1890deg); }
  }

  .flipping-heads { animation: flip-heads 3s cubic-bezier(0.1, 0, 0.3, 1) forwards; }
  .flipping-tails { animation: flip-tails 3s cubic-bezier(0.1, 0, 0.3, 1) forwards; }
  .flipping-side { animation: flip-side 3s cubic-bezier(0.1, 0, 0.3, 1) forwards; }

  .result-text {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent-light);
    height: 2rem;
  }
</style>
<script nonce="${nonce}">
(() => {
  const coin = document.getElementById('coin');
  const btn = document.getElementById('flip-btn');
  const resultText = document.getElementById('result-text');

  let animating = false;

  btn.addEventListener('click', () => {
    if (animating) return;
    animating = true;
    btn.disabled = true;
    resultText.textContent = '';

    // Reset rotation first
    coin.style.transition = 'none';
    coin.style.transform = 'rotateY(0deg)';
    coin.classList.remove('flipping-heads', 'flipping-tails', 'flipping-side');

    // Force reflow
    void coin.offsetWidth;

    const rand = Math.random();
    let result = '';
    let animClass = '';

    if (rand < ${FLIP_HEAD_THRESHOLD}) {
      result = 'Head';
      animClass = 'flipping-heads';
    } else if (rand < ${FLIP_TAIL_THRESHOLD}) {
      result = 'Tail';
      animClass = 'flipping-tails';
    } else {
      result = 'SIDE?!';
      animClass = 'flipping-side';
    }

    coin.classList.add(animClass);

    setTimeout(() => {
      resultText.textContent = result;
      animating = false;
      btn.disabled = false;
    }, 3000);
  });
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Coin Flip</h1>
    <div class="flip-container">
      <div id="result-text" class="result-text"></div>
      <div id="coin" class="coin">
        <div class="heads">Heads</div>
        <div class="tails">Tails</div>
        <div class="side"></div>
      </div>
      <button id="flip-btn" class="btn-accent btn-lg">FLIP COIN</button>
      <p class="text-fog-400 text-sm mt-4">50/50 for Silverwolf to give you head.</p>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Coin Flip',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
