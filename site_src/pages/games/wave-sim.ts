import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// Wave Simulator — a standalone ocean sandbox. A real Gerstner (trochoidal)
// wave field you can dial in live, with a small boat floating on it under
// actual buoyancy. The 3D lives in the bundled site_src/Assets/wave-sim.js;
// the wave maths is shared with the CPU-side buoyancy via wave-field.js.
const WAVE_SIM_JS = path.resolve(import.meta.dir, '..', '..', 'Assets', 'wave-sim.js');

export function WaveSimPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
}) {
  const { nonce, lv999, user } = opts;

  const styles = raw(`
<style>
  #ws-stage { position: fixed; inset: 0; overflow: hidden; background: #0b1220; font-family: 'JetBrains Mono', monospace; }
  #ws-canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  #ws-canvas:active { cursor: grabbing; }

  .ws-topleft { position: absolute; top: 1rem; left: 1rem; z-index: 5; display: flex; gap: 0.5rem; }
  .ws-link {
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font-size: 0.8rem; text-decoration: none;
    color: var(--fog-200, #dfe9ef);
    background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent); border-radius: 0.5rem;
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ws-link:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }

  .ws-panel {
    position: absolute; top: 1rem; right: 1rem; z-index: 5; width: 268px; max-height: calc(100vh - 2rem);
    overflow-y: auto; padding: 0.9rem 1rem 1.1rem;
    color: var(--fog-200, #dfe9ef); font-size: 0.82rem;
    background: color-mix(in oklab, var(--ink-900, #06080f) 72%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 28%, transparent); border-radius: 0.75rem;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  }
  .ws-panel h1 { margin: 0 0 0.15rem; font-size: 1rem; color: var(--accent-light, #7fdfff); }
  .ws-panel .ws-sub { margin: 0 0 0.85rem; font-size: 0.68rem; color: var(--fog-400, #8aa0ad); line-height: 1.45; }
  .ws-group { margin-bottom: 0.95rem; }
  .ws-group > .ws-h { font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fog-400, #8aa0ad); margin-bottom: 0.45rem; }

  .ws-slider { display: flex; flex-direction: column; gap: 0.1rem; margin: 0.45rem 0; }
  .ws-slider .ws-sl-top { display: flex; justify-content: space-between; font-size: 0.72rem; }
  .ws-slider .ws-sl-top b { color: var(--accent-light, #7fdfff); font-weight: 500; }
  .ws-slider input[type=range] { width: 100%; accent-color: var(--accent, #22d3ff); }

  .ws-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.32rem 0; }
  .ws-row label { cursor: pointer; }
  .ws-row input[type=checkbox] { accent-color: var(--accent, #22d3ff); width: 15px; height: 15px; cursor: pointer; }

  .ws-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
  .ws-presets button {
    padding: 0.42rem 0.3rem; font: inherit; font-size: 0.78rem; cursor: pointer;
    color: var(--fog-200, #dfe9ef); background: color-mix(in oklab, var(--ink-700, #1a2230) 70%, transparent);
    border: 1px solid var(--ink-600, #2a3550); border-radius: 0.4rem; transition: all 0.15s;
  }
  .ws-presets button:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }
  .ws-presets button.active { background: color-mix(in oklab, var(--accent, #22d3ff) 18%, transparent); border-color: var(--accent, #22d3ff); color: var(--accent, #22d3ff); }

  .ws-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 0.6rem; font-size: 0.74rem; }
  .ws-stats span { color: var(--fog-400, #8aa0ad); }
  .ws-stats b { color: var(--accent-light, #7fdfff); font-weight: 500; float: right; }

  .ws-hint { position: absolute; bottom: 0.8rem; left: 50%; transform: translateX(-50%); z-index: 5;
    color: var(--fog-400, #8aa0ad); font-size: 0.74rem; pointer-events: none; }
  .ws-fps { position: absolute; top: 1rem; left: 50%; transform: translateX(-50%); z-index: 5;
    color: var(--fog-400, #8aa0ad); font-size: 0.72rem; pointer-events: none; }

  #ws-error { position: absolute; inset: 0; z-index: 6; display: none; align-items: center; justify-content: center;
    color: var(--fog-200, #dfe9ef); background: rgba(6,8,15,0.9); text-align: center; padding: 2rem; }

  @media (max-width: 640px) {
    .ws-panel { width: calc(100vw - 2rem); max-height: 48vh; }
  }
</style>
  `);

  const body = html`
    <div id="ws-stage">
      <canvas id="ws-canvas" aria-label="Ocean wave simulator"></canvas>

      <div class="ws-topleft">
        <a class="ws-link" href="/games/plane-sim">← Plane Sim</a>
        <a class="ws-link" href="/games">Games</a>
      </div>

      <div class="ws-fps"><span id="ws-fps">—</span> fps</div>

      <div class="ws-panel">
        <h1>Wave Simulator</h1>
        <p class="ws-sub">
          A deep-water Gerstner sea — the same wave field drives the surface and
          the boat's buoyancy, so the hull really is pushed by the water it sits in.
        </p>

        <div class="ws-group">
          <div class="ws-h">Sea state</div>
          <div class="ws-presets">
            <button type="button" data-preset="calm">Calm</button>
            <button type="button" data-preset="swell">Swell</button>
            <button type="button" data-preset="chop">Chop</button>
            <button type="button" data-preset="storm">Storm</button>
          </div>
        </div>

        <div class="ws-group">
          <div class="ws-h">Waves</div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Amplitude</span><b id="ws-amp-v">—</b></div>
            <input type="range" id="ws-amp" min="0" max="5" step="0.02" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Wavelength</span><b id="ws-len-s-v">—</b></div>
            <input type="range" id="ws-len-s" min="4" max="140" step="1" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Steepness</span><b id="ws-steep-v">—</b></div>
            <input type="range" id="ws-steep" min="0" max="1" step="0.01" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Wave trains</span><b id="ws-count-v">—</b></div>
            <input type="range" id="ws-count" min="1" max="8" step="1" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Octave falloff</span><b id="ws-falloff-v">—</b></div>
            <input type="range" id="ws-falloff" min="0.35" max="0.9" step="0.01" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Wind heading</span><b id="ws-wind-v">—</b></div>
            <input type="range" id="ws-wind" min="0" max="360" step="1" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Directional spread</span><b id="ws-spread-v">—</b></div>
            <input type="range" id="ws-spread" min="0" max="120" step="1" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Time scale</span><b id="ws-time-v">—</b></div>
            <input type="range" id="ws-time" min="0" max="3" step="0.02" />
          </div>
        </div>

        <div class="ws-group">
          <div class="ws-h">Measured sea</div>
          <div class="ws-stats">
            <div><span>Hs</span><b id="ws-hs">—</b></div>
            <div><span>Period</span><b id="ws-period">—</b></div>
            <div><span>Speed</span><b id="ws-speed">—</b></div>
            <div><span>λ</span><b id="ws-len">—</b></div>
          </div>
        </div>

        <div class="ws-group">
          <div class="ws-h">Boat</div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Buoyancy</span><b id="ws-buoy-v">—</b></div>
            <input type="range" id="ws-buoy" min="1" max="16" step="0.1" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Heave damping</span><b id="ws-drag-v">—</b></div>
            <input type="range" id="ws-drag" min="0" max="6" step="0.05" />
          </div>
          <div class="ws-slider">
            <div class="ws-sl-top"><span>Rotational damping</span><b id="ws-adrag-v">—</b></div>
            <input type="range" id="ws-adrag" min="0" max="8" step="0.05" />
          </div>
        </div>

        <div class="ws-group">
          <div class="ws-h">View</div>
          <div class="ws-row"><label for="ws-boat">Boat</label><input type="checkbox" id="ws-boat" /></div>
          <div class="ws-row"><label for="ws-probes">Buoyancy probes</label><input type="checkbox" id="ws-probes" /></div>
          <div class="ws-row"><label for="ws-detail">Ripple detail</label><input type="checkbox" id="ws-detail" /></div>
          <div class="ws-row"><label for="ws-wire">Wireframe</label><input type="checkbox" id="ws-wire" /></div>
          <div class="ws-row"><label for="ws-orbit">Auto-orbit</label><input type="checkbox" id="ws-orbit" /></div>
        </div>
      </div>

      <div class="ws-hint">drag to orbit · scroll to zoom · right-drag to pan</div>

      <div id="ws-error">
        <div>
          <h2>WebGL unavailable</h2>
          <p>Your browser or GPU can’t run 3D graphics, so the simulator can’t start.</p>
        </div>
      </div>
    </div>
    ${styles}
    <script type="module" nonce="${nonce}" src="/static/wave-sim.js?v=${assetVersion(WAVE_SIM_JS)}"></script>
  `;

  return Layout({
    title: 'Silverwolf — Wave Simulator',
    body: body as any,
    nonce,
    lv999,
    user,
    fullscreen: true,
  });
}
