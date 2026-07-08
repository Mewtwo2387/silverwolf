import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// Plane Sim — a fullscreen Three.js flight simulator (a Spitfire-ish prop
// fighter). The heavy lifting lives in the self-hosted, bundled
// `site_src/Assets/plane-sim.js` (built from plane-sim.src.js alongside app.js);
// this page just lays out the stage, the HUD (an analogue instrument cluster
// drawn by the game onto #ps-gauges), and the start overlay, then loads that
// module. Rendered with `fullscreen: true` so there's no navbar/footer — the
// canvas owns the viewport.
const PLANE_SIM_JS = path.resolve(import.meta.dir, '..', '..', 'Assets', 'plane-sim.js');

export function PlaneSimPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
}) {
  const { nonce, lv999, user } = opts;

  const styles = raw(`
<style>
  #ps-stage {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #06080f;
    cursor: none;
    font-family: 'JetBrains Mono', monospace;
    user-select: none;
    -webkit-user-select: none;
  }
  #ps-canvas { display: block; width: 100%; height: 100%; }

  /* All HUD chrome sits in a non-interactive overlay above the canvas. */
  .ps-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: var(--accent-light, #7fdfff);
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.7);
    z-index: 2;
  }
  .ps-panel {
    position: absolute;
    background: color-mix(in oklab, var(--ink-900, #06080f) 55%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    border-radius: 0.6rem;
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    padding: 0.5rem 0.7rem;
  }
  .ps-lbl { font-size: 0.58rem; letter-spacing: 0.14em; color: var(--fog-400, #8aa0ad); text-transform: uppercase; }
  .ps-val { font-size: 1.9rem; font-weight: 800; line-height: 1; color: var(--accent-light, #7fdfff); }
  .ps-unit { font-size: 0.62rem; letter-spacing: 0.12em; color: var(--fog-300, #b8c6cf); }

  /* Instrument cluster (bottom-centre): the game draws six analogue gauges —
     airspeed, horizon, altimeter, climb, heading, throttle — on this canvas. */
  .ps-gauges-wrap {
    left: 50%; bottom: 0.8rem; transform: translateX(-50%);
    padding: 0.35rem 0.5rem 0.15rem;
    border-radius: 0.9rem;
    max-width: 96vw;
  }
  #ps-gauges {
    display: block;
    width: min(696px, 92vw);
    aspect-ratio: 696 / 128;
  }

  /* Circular minimap, top-left. */
  .ps-map-wrap {
    left: 1.1rem; top: 1.1rem; width: 150px; height: 150px; padding: 0; border-radius: 50%;
    overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  #ps-map { width: 100%; height: 100%; }
  .ps-map-n {
    position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
    font-size: 0.6rem; font-weight: 800; color: var(--fog-200, #dfe9ef);
  }

  /* Combat status (top-centre): bandits-down board + hull HP bar. */
  .ps-combat { left: 50%; top: 1.1rem; transform: translateX(-50%); text-align: center; min-width: 134px; }
  .ps-combat .ps-val { font-size: 1.5rem; }
  .ps-hp-track {
    width: 134px; height: 8px; border-radius: 4px; margin: 0.4rem auto 0.2rem; overflow: hidden;
    background: color-mix(in oklab, var(--ink-700, #1a2230) 80%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent);
  }
  #ps-hp-fill { height: 100%; width: 100%; background: #37d67a; transition: width 0.15s linear, background 0.15s linear; }

  /* Undercarriage lamps (bottom-right): three greens = down and locked. */
  .ps-gear-box { right: 1.1rem; bottom: 1.1rem; text-align: center; }
  #ps-gear { font-size: 0.95rem; font-weight: 800; color: var(--accent-light, #7fdfff); }
  #ps-gear.ps-warn-amber { color: #ffc24a; }
  .ps-gear-lamps { display: flex; gap: 6px; justify-content: center; margin-top: 0.35rem; }
  .ps-gear-lamps span {
    width: 10px; height: 10px; border-radius: 50%;
    background: #2a3140; border: 1px solid #3a4356;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .ps-gear-down .ps-gear-lamps span { background: #37d67a; box-shadow: 0 0 7px #37d67a; }
  .ps-gear-transit .ps-gear-lamps span { background: #ffc24a; box-shadow: 0 0 7px #ffc24a; animation: ps-blink 0.7s steps(2, start) infinite; }

  /* Red screen pulse when the player takes a hit. */
  #ps-damage {
    position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
    background: radial-gradient(ellipse at center, transparent 38%, rgba(255, 28, 28, 0.6) 100%);
    transition: opacity 0.09s linear;
  }

  /* Gun crosshair (fixed centre) + the mouse aim-point reticle. */
  .ps-center {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 26px; height: 26px; pointer-events: none; opacity: 0.8;
  }
  .ps-center::before, .ps-center::after {
    content: ''; position: absolute; background: var(--accent, #22d3ff); box-shadow: 0 0 6px var(--accent, #22d3ff);
  }
  /* Pipper turns red when a bandit is in the gun line. */
  #ps-pipper.ps-lock::before, #ps-pipper.ps-lock::after {
    background: #ff5d6c; box-shadow: 0 0 9px #ff5d6c;
  }
  .ps-center::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
  .ps-center::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }
  #ps-reticle {
    position: absolute; left: 50%; top: 50%; width: 40px; height: 40px;
    margin: -20px 0 0 -20px; border: 2px solid color-mix(in oklab, var(--accent, #22d3ff) 70%, transparent);
    border-radius: 50%; pointer-events: none;
  }
  #ps-reticle::after {
    content: ''; position: absolute; left: 50%; top: 50%; width: 5px; height: 5px;
    margin: -2.5px 0 0 -2.5px; border-radius: 50%; background: var(--accent-light, #7fdfff);
  }

  /* Lead pipper: shoot HERE to hit the crossing bandit. */
  #ps-lead {
    display: none; position: absolute; width: 14px; height: 14px;
    margin: -7px 0 0 -7px; pointer-events: none;
    border: 2px solid #ffe04a; transform: rotate(45deg);
    box-shadow: 0 0 8px rgba(255, 224, 74, 0.8);
  }
  #ps-lead.ps-lead-close { border-color: #ff8f5a; box-shadow: 0 0 10px rgba(255, 143, 90, 0.9); }

  /* Stall + crash/border banners, top-centre. */
  .ps-stall, .ps-warning {
    position: absolute; left: 50%; transform: translateX(-50%); text-align: center;
    font-weight: 800; letter-spacing: 0.12em; opacity: 0; transition: opacity 0.15s;
  }
  .ps-stall { top: 16%; font-size: 1.4rem; color: #ff5d6c; text-shadow: 0 0 12px rgba(255, 93, 108, 0.7); }
  .ps-warning { top: 22%; font-size: 1.05rem; color: #ffc24a; text-shadow: 0 0 12px rgba(255, 194, 74, 0.6); }
  .ps-stall.ps-show { opacity: 1; animation: ps-blink 0.6s steps(2, start) infinite; }
  .ps-warning.ps-show { opacity: 1; }
  @keyframes ps-blink { 50% { opacity: 0.25; } }

  /* Always-available exit (there's no navbar in fullscreen mode). */
  .ps-corner {
    position: absolute; right: 1.1rem; top: 1.1rem; z-index: 4; display: flex; gap: 0.5rem;
  }
  .ps-exit {
    pointer-events: auto;
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font-size: 0.8rem; text-decoration: none;
    color: var(--fog-200, #dfe9ef); font-family: 'JetBrains Mono', monospace;
    background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent); border-radius: 0.5rem;
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ps-exit:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }

  /* Start overlay. */
  #ps-overlay {
    position: absolute; inset: 0; z-index: 3; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 40%, rgba(6, 8, 15, 0.55), rgba(6, 8, 15, 0.9));
  }
  #ps-overlay.ps-hidden { display: none; }
  .ps-card {
    max-width: 560px; width: min(90vw, 560px); text-align: center;
    background: color-mix(in oklab, var(--ink-800, #0d1320) 80%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    border-radius: 1rem; padding: 1.6rem 1.8rem; backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }
  .ps-card h1 { margin: 0 0 0.3rem; color: var(--accent-light, #7fdfff); font-size: 1.7rem; }
  .ps-card .ps-sub { margin: 0 0 1.1rem; color: var(--fog-300, #b8c6cf); font-size: 0.9rem; }
  .ps-keys { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 0.9rem; text-align: left; margin: 0 auto 1.2rem; max-width: 440px; }
  .ps-keys dt { font-weight: 800; color: var(--accent-light, #7fdfff); }
  .ps-keys dd { margin: 0; color: var(--fog-200, #dfe9ef); font-size: 0.85rem; }
  .ps-key {
    display: inline-block; min-width: 1.5em; padding: 0.05em 0.4em; text-align: center;
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 40%, transparent);
    border-radius: 0.3rem; background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
  }
  .ps-go { margin-top: 0.4rem; font-size: 1.05rem; font-weight: 800; color: var(--accent, #22d3ff); animation: ps-pulse 1.6s ease-in-out infinite; }
  @keyframes ps-pulse { 50% { opacity: 0.5; } }

  /* Difficulty picker on the start overlay. */
  .ps-diff-row { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; margin: 0.2rem 0 0.5rem; }
  .ps-diff-lbl { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fog-400, #8aa0ad); }
  .ps-diff-btn {
    pointer-events: auto; cursor: pointer; font-family: 'JetBrains Mono', monospace;
    padding: 0.3rem 0.75rem; font-size: 0.82rem; border-radius: 0.4rem; color: var(--fog-200, #dfe9ef);
    background: color-mix(in oklab, var(--ink-900, #06080f) 55%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent);
  }
  .ps-diff-btn:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }
  .ps-diff-btn.ps-diff-active {
    color: var(--ink-900, #06080f); font-weight: 800;
    background: var(--accent, #22d3ff); border-color: var(--accent, #22d3ff);
  }
  .ps-hint { margin: 0 0 0.2rem; font-size: 0.74rem; line-height: 1.4; color: var(--fog-400, #8aa0ad); }

  @media (prefers-reduced-motion: reduce) {
    .ps-stall.ps-show, .ps-go, .ps-gear-transit .ps-gear-lamps span { animation: none; }
  }
  @media (max-width: 600px) {
    .ps-val { font-size: 1.4rem; }
    .ps-map-wrap { width: 110px; height: 110px; }
  }
</style>
  `);

  const body = html`
    <div id="ps-stage">
      <canvas id="ps-canvas" aria-label="Plane Sim flight simulator"></canvas>
      <div id="ps-damage"></div>

      <div class="ps-corner">
        <a class="ps-exit" href="/games/plane-sim/inspect">🔧 Inspect models</a>
        <a class="ps-exit" href="/games">← Games</a>
      </div>

      <div class="ps-hud" aria-hidden="true">
        <!-- Minimap (top-left, circular) -->
        <div class="ps-panel ps-map-wrap">
          <canvas id="ps-map" width="150" height="150"></canvas>
          <span class="ps-map-n">N</span>
        </div>

        <!-- Combat status (top-centre): bandits-down board + hull HP -->
        <div class="ps-panel ps-combat">
          <div class="ps-lbl">Bandits down</div>
          <div class="ps-val"><span id="ps-kills">0 / 3</span></div>
          <div class="ps-hp-track"><div id="ps-hp-fill"></div></div>
          <div class="ps-unit">HULL <span id="ps-hp">100</span> &middot; <span id="ps-diff">REGULAR</span></div>
        </div>

        <!-- Analogue instrument cluster (bottom-centre), drawn by the game -->
        <div class="ps-panel ps-gauges-wrap">
          <canvas id="ps-gauges"></canvas>
        </div>

        <!-- Undercarriage lamps (bottom-right) -->
        <div class="ps-panel ps-gear-box" id="ps-gear-box">
          <div class="ps-lbl">Undercarriage</div>
          <div id="ps-gear">GEAR DOWN</div>
          <div class="ps-gear-lamps"><span></span><span></span><span></span></div>
        </div>

        <!-- Centre crosshair + aim reticle + lead pipper -->
        <div class="ps-center" id="ps-pipper"></div>
        <div id="ps-reticle"></div>
        <div id="ps-lead"></div>

        <!-- Warnings -->
        <div class="ps-stall" id="ps-stall">STALL</div>
        <div class="ps-warning" id="ps-warning"></div>
      </div>

      <!-- Start overlay -->
      <div id="ps-overlay">
        <div class="ps-card">
          <h1>Plane Sim</h1>
          <p class="ps-sub">Take off, climb over the valley and hunt down the <strong>3 bandits</strong> prowling a 12&nbsp;km box of mountains and lakes. Watch your hull — they shoot back.</p>
          <dl class="ps-keys">
            <dt>Mouse</dt><dd><strong>Point where you want to fly</strong> — the plane banks &amp; turns there itself</dd>
            <dt>Right-click</dt><dd>Fire guns — put the crosshair on the <strong>◇ lead marker</strong> to connect</dd>
            <dt><span class="ps-key">W</span> / <span class="ps-key">S</span></dt><dd>Throttle up / down</dd>
            <dt><span class="ps-key">A</span> / <span class="ps-key">D</span></dt><dd>Rudder (fine aim &amp; taxi steering)</dd>
            <dt><span class="ps-key">G</span></dt><dd>Raise / lower undercarriage (less drag up)</dd>
            <dt><span class="ps-key">M</span></dt><dd>Mute engine &amp; gun sound</dd>
            <dt><span class="ps-key">Space</span></dt><dd>Restart after a crash, shoot-down or win</dd>
          </dl>
          <div class="ps-diff-row">
            <span class="ps-diff-lbl">Bandit skill</span>
            <button type="button" class="ps-diff-btn" data-diff="easy">Rookie</button>
            <button type="button" class="ps-diff-btn" data-diff="normal">Regular</button>
            <button type="button" class="ps-diff-btn" data-diff="hard">Ace</button>
          </div>
          <p class="ps-hint">They turn-fight but <strong>break off</strong> if you press them. Switch skill anytime with <span class="ps-key">1</span> <span class="ps-key">2</span> <span class="ps-key">3</span>.</p>
          <div class="ps-go">▸ Click to fly</div>
        </div>
      </div>
    </div>
    ${styles}
    <script type="module" nonce="${nonce}" src="/static/plane-sim.js?v=${assetVersion(PLANE_SIM_JS)}"></script>
  `;

  return Layout({
    title: 'Silverwolf — Plane Sim',
    body: body as any,
    nonce,
    lv999,
    user,
    fullscreen: true,
  });
}
