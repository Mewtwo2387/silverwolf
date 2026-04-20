import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

export function FlipPage(opts: { nonce: string }) {
  const { nonce } = opts;

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

  .flip-btn {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 1rem 2.5rem;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.1rem;
    box-shadow: 0 4px 0px #4a58e8;
    transition: all 0.1s;
  }
  .flip-btn:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0px #4a58e8;
  }
  .flip-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

    if (rand < 0.49) {
      result = 'Silver';
      animClass = 'flipping-heads';
    } else if (rand < 0.98) {
      result = 'Wolf';
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
        <div class="heads">Silver</div>
        <div class="tails">Wolf</div>
        <div class="side"></div>
      </div>
      <button id="flip-btn" class="flip-btn">FLIP COIN</button>
      <p class="text-fog-400 text-sm mt-4">50/50 for Silverwolf to give you head.</p>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Coin Flip',
    active: 'games',
    body: body as any,
    nonce,
  });
}
