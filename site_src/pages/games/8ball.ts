import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { inlineJSON } from '../../inline';

export function EightBallPage(opts: { normal: string[]; savage: string[]; nonce: string; lv999?: boolean; user?: import('../../components/navbar').NavUser | null }) {
  const {
    normal, savage, nonce, lv999, user,
  } = opts;

  const extras = raw(`
<style>
  .eightball-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    margin-top: 2rem;
  }
  .eightball-sphere {
    width: 280px;
    height: 280px;
    background: radial-gradient(circle at 30% 30%, #444, #111);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
  }
  .eightball-inner {
    width: 140px;
    height: 140px;
    background: #050505;
    border: 4px solid #1a1a1a;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 1rem;
    color: #00ffff;
    font-size: 0.9rem;
    font-weight: bold;
    text-transform: uppercase;
    transition: color 0.3s;
  }
  .eightball-inner.savage {
    color: #ff0000;
  }
  .input-group {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    max-width: 500px;
  }
  .input-group input {
    flex: 1;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.6rem 1rem;
    color: var(--fog-100);
  }
  @keyframes shake {
    0% { transform: translate(0, 0); }
    10% { transform: translate(-5px, -5px); }
    20% { transform: translate(5px, 5px); }
    30% { transform: translate(-5px, 5px); }
    40% { transform: translate(5px, -5px); }
    50% { transform: translate(-5px, -5px); }
    60% { transform: translate(5px, 5px); }
    70% { transform: translate(-5px, 5px); }
    80% { transform: translate(5px, -5px); }
    90% { transform: translate(-5px, -5px); }
    100% { transform: translate(0, 0); }
  }
  .shaking {
    animation: shake 0.5s infinite;
  }
</style>
<script nonce="${nonce}">
(() => {
  const normal = ${inlineJSON(normal)};
  const savage = ${inlineJSON(savage)};
  const btn = document.getElementById('ask-btn');
  const input = document.getElementById('question-input');
  const inner = document.getElementById('eightball-text');
  const sphere = document.getElementById('eightball-sphere');

  let animating = false;

  const ask = () => {
    if (animating || !input.value.trim()) return;
    animating = true;
    btn.disabled = true;
    sphere.classList.add('shaking');
    inner.textContent = '...';

    const isSavage = Math.random() < 0.2; // roughly simulate savage chance or just random
    const responses = isSavage ? savage : normal;
    if (isSavage) inner.classList.add('savage');
    else inner.classList.remove('savage');

    let count = 0;
    const maxCount = 20;
    
    const tick = () => {
      const pool = Math.random() < 0.5 ? normal : savage;
      inner.textContent = pool[Math.floor(Math.random() * pool.length)];
      count++;
      
      if (count < maxCount) {
        const delay = 80 + (count * 10); // slow down
        setTimeout(tick, delay);
      } else {
        sphere.classList.remove('shaking');
        const finalAnswer = responses[Math.floor(Math.random() * responses.length)];
        inner.textContent = finalAnswer;
        animating = false;
        btn.disabled = false;
      }
    };
    
    setTimeout(tick, 80);
  };

  btn.addEventListener('click', ask);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') ask(); });
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Magic 8-Ball</h1>
    <div class="eightball-container">
      <div id="eightball-sphere" class="eightball-sphere">
        <div id="eightball-text" class="eightball-inner">ASK A QUESTION</div>
      </div>
      <div class="input-group">
        <input type="text" id="question-input" aria-label="Ask a yes or no question" placeholder="Will I ever touch grass?" />
        <button id="ask-btn" class="btn-accent btn-sm">Ask</button>
      </div>
      <p class="text-fog-400 text-sm mt-4">The combined magic 8-ball sees all.</p>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — 8-Ball',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
