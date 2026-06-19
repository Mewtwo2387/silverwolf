import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// Plane Sim — a fullscreen Three.js flight simulator (a Spitfire-ish prop
// fighter). The heavy lifting lives in the self-hosted, bundled
// `site_src/Assets/plane-sim.js` (built from plane-sim.src.js alongside app.js);
// this page just lays out the stage, the HUD, and the start overlay, then loads
// that module. Rendered with `fullscreen: true` so there's no navbar/footer —
// the canvas owns the viewport.
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

  /* Airspeed (left) + Altitude (right), vertically centred like a HUD tape. */
  .ps-airspeed { left: 1.1rem; top: 50%; transform: translateY(-50%); text-align: right; min-width: 96px; }
  .ps-altitude { right: 1.1rem; top: 50%; transform: translateY(-50%); text-align: left; min-width: 96px; }

  /* Throttle column, bottom-left. */
  .ps-throttle-box { left: 1.1rem; bottom: 1.1rem; display: flex; gap: 0.6rem; align-items: flex-end; }
  .ps-throttle-track {
    width: 14px; height: 96px; border-radius: 7px;
    background: color-mix(in oklab, var(--ink-700, #1a2230) 80%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent);
    position: relative; overflow: hidden;
  }
  #ps-throttle-fill {
    position: absolute; left: 0; right: 0; bottom: 0; height: 0%;
    background: linear-gradient(180deg, var(--accent, #22d3ff), color-mix(in oklab, var(--accent, #22d3ff) 40%, #1466ff));
    transition: height 0.1s linear;
  }
  .ps-throttle-box .ps-val { font-size: 1.2rem; }

  /* Heading + vertical speed, bottom-centre. */
  .ps-nav { left: 50%; bottom: 1.1rem; transform: translateX(-50%); display: flex; gap: 1.4rem; text-align: center; }
  .ps-nav .ps-val { font-size: 1.25rem; }

  /* Gear status, bottom-right above the controls hint. */
  .ps-gear-box { right: 1.1rem; bottom: 1.1rem; text-align: center; }
  #ps-gear { font-size: 1.05rem; font-weight: 800; color: var(--accent-light, #7fdfff); }
  #ps-gear.ps-warn-amber { color: #ffc24a; }

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

  /* Gun crosshair (fixed centre) + the virtual-stick reticle (tracks mouse). */
  .ps-center {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 26px; height: 26px; pointer-events: none; opacity: 0.8;
  }
  .ps-center::before, .ps-center::after {
    content: ''; position: absolute; background: var(--accent, #22d3ff); box-shadow: 0 0 6px var(--accent, #22d3ff);
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

  /* Stall + crash/border banners, top-centre. */
  .ps-stall, .ps-warning {
    position: absolute; left: 50%; transform: translateX(-50%); text-align: center;
    font-weight: 800; letter-spacing: 0.12em; opacity: 0; transition: opacity 0.15s;
  }
  .ps-stall { top: 8%; font-size: 1.4rem; color: #ff5d6c; text-shadow: 0 0 12px rgba(255, 93, 108, 0.7); }
  .ps-warning { top: 14%; font-size: 1.05rem; color: #ffc24a; text-shadow: 0 0 12px rgba(255, 194, 74, 0.6); }
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
    max-width: 540px; width: min(90vw, 540px); text-align: center;
    background: color-mix(in oklab, var(--ink-800, #0d1320) 80%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    border-radius: 1rem; padding: 1.6rem 1.8rem; backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }
  .ps-card h1 { margin: 0 0 0.3rem; color: var(--accent-light, #7fdfff); font-size: 1.7rem; }
  .ps-card .ps-sub { margin: 0 0 1.1rem; color: var(--fog-300, #b8c6cf); font-size: 0.9rem; }
  .ps-keys { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 0.9rem; text-align: left; margin: 0 auto 1.2rem; max-width: 420px; }
  .ps-keys dt { font-weight: 800; color: var(--accent-light, #7fdfff); }
  .ps-keys dd { margin: 0; color: var(--fog-200, #dfe9ef); font-size: 0.85rem; }
  .ps-key {
    display: inline-block; min-width: 1.5em; padding: 0.05em 0.4em; text-align: center;
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 40%, transparent);
    border-radius: 0.3rem; background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
  }
  .ps-go { margin-top: 0.4rem; font-size: 1.05rem; font-weight: 800; color: var(--accent, #22d3ff); animation: ps-pulse 1.6s ease-in-out infinite; }
  @keyframes ps-pulse { 50% { opacity: 0.5; } }

  @media (prefers-reduced-motion: reduce) {
    .ps-stall.ps-show, .ps-go { animation: none; }
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

        <!-- Airspeed (left) -->
        <div class="ps-panel ps-airspeed">
          <div class="ps-lbl">Airspeed</div>
          <div class="ps-val"><span id="ps-airspeed">0</span></div>
          <div class="ps-unit">KNOTS</div>
        </div>

        <!-- Altitude (right) -->
        <div class="ps-panel ps-altitude">
          <div class="ps-lbl">Altitude</div>
          <div class="ps-val"><span id="ps-altitude">0</span></div>
          <div class="ps-unit">FEET</div>
        </div>

        <!-- Throttle (bottom-left) -->
        <div class="ps-panel ps-throttle-box">
          <div class="ps-throttle-track"><div id="ps-throttle-fill"></div></div>
          <div>
            <div class="ps-lbl">Thr</div>
            <div class="ps-val" id="ps-throttle">0%</div>
          </div>
        </div>

        <!-- Heading + vertical speed (bottom-centre) -->
        <div class="ps-panel ps-nav">
          <div>
            <div class="ps-lbl">HDG</div>
            <div class="ps-val" id="ps-heading">000°</div>
          </div>
          <div>
            <div class="ps-lbl">VSI ft/min</div>
            <div class="ps-val" id="ps-vspeed">+0</div>
          </div>
        </div>

        <!-- Gear (bottom-right) -->
        <div class="ps-panel ps-gear-box">
          <div class="ps-lbl">Undercarriage</div>
          <div id="ps-gear">GEAR DN</div>
        </div>

        <!-- Centre crosshair + stick reticle -->
        <div class="ps-center"></div>
        <div id="ps-reticle"></div>

        <!-- Warnings -->
        <div class="ps-stall" id="ps-stall">STALL</div>
        <div class="ps-warning" id="ps-warning"></div>
      </div>

      <!-- Start overlay -->
      <div id="ps-overlay">
        <div class="ps-card">
          <h1>Plane Sim</h1>
          <p class="ps-sub">Take off from the demo airfield in a Spitfire-ish prop fighter. Build speed down the runway, then ease back to climb away.</p>
          <dl class="ps-keys">
            <dt><span class="ps-key">W</span> / <span class="ps-key">S</span></dt><dd>Throttle up / down</dd>
            <dt><span class="ps-key">A</span> / <span class="ps-key">D</span></dt><dd>Rudder (yaw left / right)</dd>
            <dt>Mouse</dt><dd>Pitch (up/down) &amp; roll (left/right)</dd>
            <dt><span class="ps-key">G</span></dt><dd>Raise / lower undercarriage (less drag up)</dd>
            <dt>Right-click</dt><dd>Fire guns (demo)</dd>
            <dt><span class="ps-key">Space</span></dt><dd>Respawn after a crash</dd>
          </dl>
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
