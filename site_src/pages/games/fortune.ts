import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

export function FortunePage(opts: { fortunes: string[]; nonce: string }) {
  const { fortunes, nonce } = opts;

  const extras = raw(`
<style>
  .fortune-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    margin-top: 2rem;
  }
  .cookie-wrap {
    width: 200px;
    height: 150px;
    position: relative;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .cookie-wrap:active {
    transform: scale(0.95);
  }
  .cookie-part {
    position: absolute;
    width: 100px;
    height: 150px;
    background: #e3c48d;
    border: 4px solid #c4a46d;
    border-radius: 50% 10% 10% 50%;
    box-shadow: inset -10px 0 10px rgba(0,0,0,0.1);
  }
  .cookie-left {
    left: 0;
    transform-origin: right center;
  }
  .cookie-right {
    right: 0;
    transform-origin: left center;
    transform: scaleX(-1);
  }
  
  @keyframes crack-left {
    0% { transform: rotate(0); }
    100% { transform: rotate(-20deg) translateX(-20px); }
  }
  @keyframes crack-right {
    0% { transform: scaleX(-1) rotate(0); }
    100% { transform: scaleX(-1) rotate(-20deg) translateX(-20px); }
  }

  .cracked .cookie-left { animation: crack-left 0.5s forwards; }
  .cracked .cookie-right { animation: crack-right 0.5s forwards; }

  .fortune-paper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    width: 250px;
    background: white;
    padding: 1rem;
    border: 1px solid #ddd;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    color: #333;
    font-family: 'Courier New', Courier, monospace;
    text-align: center;
    z-index: -1;
    transition: transform 0.5s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .cracked .fortune-paper {
    transform: translate(-50%, -50%) scale(1);
    z-index: 10;
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
  const fortunes = ${JSON.stringify(fortunes)};
  const wrap = document.getElementById('cookie-wrap');
  const paper = document.getElementById('fortune-text');
  const btn = document.getElementById('reset-btn');

  let animating = false;

  const openCookie = () => {
    if (animating || wrap.classList.contains('cracked')) return;
    animating = true;
    wrap.classList.add('cracked');

    let count = 0;
    const maxCount = 15;
    
    const tick = () => {
      paper.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
      count++;
      
      if (count < maxCount) {
        const delay = 100 + (count * 20); // slow down
        setTimeout(tick, delay);
      } else {
        paper.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
        animating = false;
      }
    };
    
    setTimeout(tick, 500); // wait for crack animation
  };

  wrap.addEventListener('click', openCookie);
  btn.addEventListener('click', () => {
    wrap.classList.remove('cracked');
    paper.textContent = '...';
  });
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Fortune Cookie</h1>
    <div class="fortune-container">
      <div id="cookie-wrap" class="cookie-wrap">
        <div class="cookie-part cookie-left"></div>
        <div class="cookie-part cookie-right"></div>
        <div class="fortune-paper">
          <div id="fortune-text">...</div>
        </div>
      </div>
      <p class="text-fog-300 text-center max-w-[400px]">Click the cookie to reveal your fortune. How desperate are you to munch virtual fortune cookies?</p>
      <button id="reset-btn" class="btn-primary">Get Another</button>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Fortune Cookie',
    active: 'games',
    body: body as any,
    nonce,
  });
}
