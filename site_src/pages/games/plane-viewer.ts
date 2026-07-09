import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// Plane Sim — Model Inspector. A standalone turntable viewer for the Plane Sim
// 3D assets (the aircraft + scenery), so the models can be examined and iterated
// on outside the game and exported (.glb/.obj/.png) for tools like Blender. The
// 3D lives in the bundled site_src/Assets/plane-viewer.js, which imports the
// same shared builders the game uses (plane-sim-models.js).
const PLANE_VIEWER_JS = path.resolve(import.meta.dir, '..', '..', 'Assets', 'plane-viewer.js');

export function PlaneViewerPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
}) {
  const { nonce, lv999, user } = opts;

  const styles = raw(`
<style>
  #pv-stage { position: fixed; inset: 0; overflow: hidden; background: #10141c; font-family: 'JetBrains Mono', monospace; }
  #pv-canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  #pv-canvas:active { cursor: grabbing; }

  .pv-topleft { position: absolute; top: 1rem; left: 1rem; z-index: 5; display: flex; gap: 0.5rem; }
  .pv-link {
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font-size: 0.8rem; text-decoration: none;
    color: var(--fog-200, #dfe9ef);
    background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent); border-radius: 0.5rem;
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .pv-link:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }

  .pv-panel {
    position: absolute; top: 1rem; right: 1rem; z-index: 5; width: 244px; max-height: calc(100vh - 2rem);
    overflow-y: auto; padding: 0.9rem 1rem 1.1rem;
    color: var(--fog-200, #dfe9ef); font-size: 0.82rem;
    background: color-mix(in oklab, var(--ink-900, #06080f) 70%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 28%, transparent); border-radius: 0.75rem;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  }
  .pv-panel h1 { margin: 0 0 0.15rem; font-size: 1rem; color: var(--accent-light, #7fdfff); }
  .pv-panel .pv-sub { margin: 0 0 0.85rem; font-size: 0.68rem; color: var(--fog-400, #8aa0ad); }
  .pv-group { margin-bottom: 0.9rem; }
  .pv-group > .pv-h { font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fog-400, #8aa0ad); margin-bottom: 0.4rem; }

  .pv-models { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
  .pv-models button {
    padding: 0.4rem 0.3rem; font: inherit; font-size: 0.78rem; cursor: pointer;
    color: var(--fog-200, #dfe9ef); background: color-mix(in oklab, var(--ink-700, #1a2230) 70%, transparent);
    border: 1px solid var(--ink-600, #2a3550); border-radius: 0.4rem; transition: all 0.15s;
  }
  .pv-models button:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }
  .pv-models button.active { background: color-mix(in oklab, var(--accent, #22d3ff) 18%, transparent); border-color: var(--accent, #22d3ff); color: var(--accent, #22d3ff); }

  .pv-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.3rem 0; }
  .pv-row label { cursor: pointer; }
  .pv-row input[type=checkbox] { accent-color: var(--accent, #22d3ff); width: 15px; height: 15px; cursor: pointer; }
  .pv-slider { display: flex; flex-direction: column; gap: 0.15rem; margin: 0.45rem 0; }
  .pv-slider .pv-sl-top { display: flex; justify-content: space-between; font-size: 0.72rem; }
  .pv-slider input[type=range] { width: 100%; accent-color: var(--accent, #22d3ff); }

  .pv-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
  .pv-btns button, .pv-wide {
    padding: 0.42rem 0.4rem; font: inherit; font-size: 0.76rem; cursor: pointer;
    color: var(--fog-100, #eef4f7); background: color-mix(in oklab, var(--accent, #22d3ff) 14%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent); border-radius: 0.4rem; transition: all 0.15s;
  }
  .pv-btns button:hover, .pv-wide:hover { background: color-mix(in oklab, var(--accent, #22d3ff) 26%, transparent); border-color: var(--accent, #22d3ff); }
  .pv-wide { width: 100%; margin-top: 0.35rem; }

  .pv-dims { margin-top: 0.5rem; font-size: 0.7rem; color: var(--accent-light, #7fdfff); }
  .pv-hint { position: absolute; bottom: 0.8rem; left: 50%; transform: translateX(-50%); z-index: 5;
    color: var(--fog-400, #8aa0ad); font-size: 0.74rem; font-family: 'JetBrains Mono', monospace; pointer-events: none; }

  #pv-error { position: absolute; inset: 0; z-index: 6; display: none; align-items: center; justify-content: center;
    color: var(--fog-200, #dfe9ef); background: rgba(6,8,15,0.9); text-align: center; padding: 2rem; }

  @media (max-width: 600px) {
    .pv-panel { width: calc(100vw - 2rem); max-height: 46vh; }
  }
</style>
  `);

  const body = html`
    <div id="pv-stage">
      <canvas id="pv-canvas" aria-label="3D model inspector"></canvas>

      <div class="pv-topleft">
        <a class="pv-link" href="/games/plane-sim">← Plane Sim</a>
        <a class="pv-link" href="/games">Games</a>
      </div>

      <div class="pv-panel">
        <h1>Model Inspector</h1>
        <p class="pv-sub">Same models the game flies — inspect &amp; export.</p>

        <div class="pv-group">
          <div class="pv-h">Model</div>
          <div class="pv-models">
            <button type="button" data-model="aircraft" class="active">Spitfire</button>
            <button type="button" data-model="p51">P-51</button>
            <button type="button" data-model="zero">Zero</button>
            <button type="button" data-model="tree">Tree</button>
            <button type="button" data-model="hangar">Hangar</button>
            <button type="button" data-model="tower">Tower</button>
          </div>
          <div class="pv-dims" id="pv-dims">—</div>
        </div>

        <div class="pv-group">
          <div class="pv-h">View</div>
          <div class="pv-row"><label for="pv-autorotate">Auto-rotate</label><input type="checkbox" id="pv-autorotate" checked /></div>
          <div class="pv-row"><label for="pv-wire">Wireframe</label><input type="checkbox" id="pv-wire" /></div>
          <div class="pv-row"><label for="pv-spin">Spin propeller</label><input type="checkbox" id="pv-spin" checked /></div>
          <div class="pv-row"><label for="pv-grid">Grid</label><input type="checkbox" id="pv-grid" checked /></div>
          <button type="button" class="pv-wide" id="pv-bg">BG: Dark</button>
        </div>

        <div class="pv-group" id="pv-surfaces">
          <div class="pv-h">Control surfaces</div>
          <div class="pv-slider">
            <div class="pv-sl-top"><span>Aileron</span></div>
            <input type="range" id="pv-ail" min="-40" max="40" value="0" />
          </div>
          <div class="pv-slider">
            <div class="pv-sl-top"><span>Elevator</span></div>
            <input type="range" id="pv-elev" min="-40" max="40" value="0" />
          </div>
          <div class="pv-slider">
            <div class="pv-sl-top"><span>Rudder</span></div>
            <input type="range" id="pv-rud" min="-40" max="40" value="0" />
          </div>
          <div class="pv-slider">
            <div class="pv-sl-top"><span>Undercarriage (0 = up)</span></div>
            <input type="range" id="pv-gear" min="0" max="100" value="100" />
          </div>
        </div>

        <div class="pv-group">
          <div class="pv-h">Export</div>
          <div class="pv-btns">
            <button type="button" id="pv-glb">.glb</button>
            <button type="button" id="pv-obj">.obj</button>
            <button type="button" id="pv-png">.png</button>
            <button type="button" id="pv-reset">Reset</button>
          </div>
        </div>
      </div>

      <div class="pv-hint">drag to orbit · scroll to zoom · right-drag to pan</div>

      <div id="pv-error">
        <div>
          <h2>WebGL unavailable</h2>
          <p>Your browser or GPU can’t run 3D graphics, so the inspector can’t start.</p>
        </div>
      </div>
    </div>
    ${styles}
    <script type="module" nonce="${nonce}" src="/static/plane-viewer.js?v=${assetVersion(PLANE_VIEWER_JS)}"></script>
  `;

  return Layout({
    title: 'Silverwolf — Plane Sim Model Inspector',
    body: body as any,
    nonce,
    lv999,
    user,
    fullscreen: true,
  });
}
