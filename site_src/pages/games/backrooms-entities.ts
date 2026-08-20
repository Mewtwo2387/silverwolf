import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// The Backrooms — Entity Viewer. A turntable inspector for the three entities,
// the same idea as the Plane Sim model inspector: the page is only the shell
// (canvas, panel, dossier slot), and the 3D lives in the bundled
// site_src/Assets/backrooms-viewer.js, which imports the SAME entity classes,
// materials and world builder the game uses.
//
// Fully client-side, like the game itself: no endpoint, no account, and the
// chaser skin it displays is read from the same localStorage key the game
// writes — it never left the device to begin with.
const BACKROOMS_VIEWER_JS = path.resolve(import.meta.dir, '..', '..', 'Assets', 'backrooms-viewer.js');

export function BackroomsEntitiesPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
}) {
  const { nonce, lv999, user } = opts;

  const styles = raw(`
<style>
  #bv-stage { position: fixed; inset: 0; overflow: hidden; background: #1a160b;
    font-family: 'JetBrains Mono', monospace; color: #e8dfc4; }
  #bv-canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  #bv-canvas:active { cursor: grabbing; }

  .bv-topleft { position: absolute; top: 1rem; left: 1rem; z-index: 5; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .bv-link { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font-size: 0.8rem; text-decoration: none; color: #e8dfc4;
    background: rgba(12,10,5,0.66); border: 1px solid rgba(230,198,92,0.32);
    border-radius: 0.5rem; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
  .bv-link:hover { border-color: #e6c65c; color: #f6e9b4; }

  .bv-panel { position: absolute; top: 1rem; right: 1rem; z-index: 5; width: 288px;
    max-height: calc(100vh - 2rem); overflow-y: auto; padding: 0.9rem 1rem 1.1rem;
    font-size: 0.82rem; background: rgba(12,10,5,0.76);
    border: 1px solid rgba(230,198,92,0.3); border-radius: 0.75rem;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
  .bv-panel h1 { margin: 0 0 0.15rem; font-size: 1rem; color: #e6c65c; }
  .bv-panel .bv-sub { margin: 0 0 0.85rem; font-size: 0.68rem; color: rgba(232,223,196,0.6); }
  .bv-group { margin-bottom: 0.95rem; }
  .bv-h { font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(232,223,196,0.55); margin-bottom: 0.4rem; }
  .bv-h2 { margin-top: 0.9rem; }

  .bv-ents { display: grid; gap: 0.35rem; }
  .bv-ents button { padding: 0.45rem 0.5rem; font: inherit; font-size: 0.8rem; cursor: pointer;
    text-align: left; color: #e8dfc4; background: rgba(58,48,22,0.5);
    border: 1px solid rgba(230,198,92,0.22); border-radius: 0.4rem; transition: all 0.15s; }
  .bv-ents button:hover { border-color: #e6c65c; color: #f6e9b4; }
  .bv-ents button.bv-active { background: rgba(230,198,92,0.18); border-color: #e6c65c; color: #f6e9b4; }
  .bv-dims { margin-top: 0.5rem; font-size: 0.7rem; color: #e6c65c; }

  .bv-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.32rem 0; }
  .bv-row label { cursor: pointer; }
  .bv-row input[type=checkbox] { accent-color: #e6c65c; width: 15px; height: 15px; cursor: pointer; }
  .bv-slider { display: flex; flex-direction: column; gap: 0.15rem; margin: 0.45rem 0; }
  .bv-slider label { font-size: 0.72rem; cursor: pointer; }
  .bv-slider input[type=range] { width: 100%; accent-color: #e6c65c; }

  .bv-wide { width: 100%; margin-top: 0.35rem; padding: 0.42rem 0.4rem; font: inherit;
    font-size: 0.76rem; cursor: pointer; color: #f6e9b4; background: rgba(230,198,92,0.14);
    border: 1px solid rgba(230,198,92,0.35); border-radius: 0.4rem; transition: all 0.15s; }
  .bv-wide:hover { background: rgba(230,198,92,0.26); border-color: #e6c65c; }

  /* Dossier — filled in by the viewer module from the live entity tables. */
  .bv-name { margin: 0.15rem 0 0.1rem; font-size: 0.95rem; color: #e6c65c; }
  .bv-tag { margin: 0 0 0.5rem; font-size: 0.72rem; font-style: italic; color: rgba(232,223,196,0.72); }
  .bv-blurb { margin: 0 0 0.55rem; font-size: 0.74rem; line-height: 1.45; color: rgba(232,223,196,0.9); }
  .bv-line { margin: 0 0 0.45rem; font-size: 0.72rem; line-height: 1.45; color: rgba(232,223,196,0.82); }
  .bv-line b { display: block; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(232,223,196,0.5); margin-bottom: 0.1rem; }
  .bv-stat-row { display: flex; align-items: center; gap: 0.45rem; margin: 0.26rem 0; }
  .bv-stat-k { flex: 0 0 4.6rem; font-size: 0.64rem; letter-spacing: 0.05em;
    text-transform: uppercase; color: rgba(232,223,196,0.55); }
  .bv-stat-bar { flex: 1; height: 7px; border-radius: 4px; overflow: hidden; background: rgba(58,48,22,0.85); }
  .bv-stat-bar i { display: block; height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, rgba(230,198,92,0.45), #e6c65c); }
  .bv-stat-v { flex: 0 0 4.6rem; text-align: right; font-size: 0.68rem; color: #e6c65c; }
  .bv-src { margin: 0.6rem 0 0; font-size: 0.66rem; color: rgba(232,223,196,0.5); }
  .bv-src a { color: #e6c65c; text-decoration: none; border-bottom: 1px dotted rgba(230,198,92,0.4); }
  .bv-src a:hover { border-bottom-style: solid; }
  .bv-note { margin: 0.4rem 0 0; font-size: 0.64rem; line-height: 1.4; color: rgba(232,223,196,0.5); }

  .bv-hint { position: absolute; bottom: 0.8rem; left: 50%; transform: translateX(-50%); z-index: 5;
    color: rgba(232,223,196,0.55); font-size: 0.74rem; pointer-events: none; }

  #bv-error { position: absolute; inset: 0; z-index: 6; display: none; align-items: center;
    justify-content: center; background: rgba(12,10,5,0.92); text-align: center; padding: 2rem; }

  @media (max-width: 640px) {
    .bv-panel { width: calc(100vw - 2rem); max-height: 48vh; }
    .bv-hint { display: none; }
  }
</style>
  `);

  const body = html`
    <div id="bv-stage">
      <canvas id="bv-canvas" aria-label="Backrooms entity viewer"></canvas>

      <div class="bv-topleft">
        <a class="bv-link" href="/games/backrooms">← The Backrooms</a>
        <a class="bv-link" href="/games">Games</a>
      </div>

      <div class="bv-panel">
        <h1>Entity Viewer</h1>
        <p class="bv-sub">The same six things the game spawns — standing still, for once.</p>

        <div class="bv-group">
          <div class="bv-h">Entity</div>
          <div class="bv-ents">
            <button type="button" data-ent="chaser" class="bv-active">PNG chaser</button>
            <button type="button" data-ent="lifeform">Lifeform</button>
            <button type="button" data-ent="watcher">Entity 96</button>
          </div>
          <div class="bv-h bv-h2">Level 37 — the Poolrooms</div>
          <div class="bv-ents">
            <button type="button" data-ent="drowner">Drowner</button>
            <button type="button" data-ent="smiler">Smiler</button>
            <button type="button" data-ent="willo">Will o' Waves</button>
          </div>
          <div class="bv-dims" id="bv-dims">—</div>
        </div>

        <div class="bv-group" id="bv-info"></div>

        <div class="bv-group">
          <div class="bv-h">View</div>
          <div class="bv-row"><label for="bv-autorotate">Turntable</label><input type="checkbox" id="bv-autorotate" checked /></div>
          <div class="bv-row"><label for="bv-animate">Animate</label><input type="checkbox" id="bv-animate" checked /></div>
          <div class="bv-row"><label for="bv-scale">Human for scale (1.7 m)</label><input type="checkbox" id="bv-scale" /></div>
          <div class="bv-row"><label for="bv-wire">Wireframe</label><input type="checkbox" id="bv-wire" /></div>
          <div class="bv-row"><label for="bv-grid">Grid (studio only)</label><input type="checkbox" id="bv-grid" checked /></div>
          <button type="button" class="bv-wide" id="bv-backdrop">Backdrop: Level 0</button>
        </div>

        <div class="bv-group" id="bv-grp-chaser">
          <div class="bv-h">PNG chaser</div>
          <div class="bv-row"><label for="bv-billboard">Face the camera</label><input type="checkbox" id="bv-billboard" /></div>
          <p class="bv-note" id="bv-skin-note">Showing the built-in face.</p>
          <p class="bv-note">Turn the billboard off and let the turntable spin: it is one flat
            plane, which is exactly what a nextbot is.</p>
        </div>

        <div class="bv-group" id="bv-grp-lifeform" style="display:none">
          <div class="bv-h">Lifeform</div>
          <div class="bv-slider"><label for="bv-gait">Gait speed</label><input type="range" id="bv-gait" min="0" max="100" value="50" /></div>
          <p class="bv-note">It stoops because it does not fit: eleven feet of it under a 3.15 m ceiling.</p>
        </div>

        <div class="bv-group" id="bv-grp-watcher" style="display:none">
          <div class="bv-h">Entity 96</div>
          <div class="bv-slider"><label for="bv-charge">Beam charge</label><input type="range" id="bv-charge" min="0" max="100" value="0" /></div>
          <div class="bv-slider"><label for="bv-gait2">Gait speed</label><input type="range" id="bv-gait2" min="0" max="100" value="50" /></div>
          <p class="bv-note">Six legs of vein, worked in alternating tripods. It is an eye that walks.</p>
          <p class="bv-note">Full charge is what kills you in-game. Here it just points at nothing.</p>
        </div>

        <div class="bv-group" id="bv-grp-drowner" style="display:none">
          <div class="bv-h">Drowner</div>
          <div class="bv-slider"><label for="bv-gait3">Gait speed</label><input type="range" id="bv-gait3" min="0" max="100" value="50" /></div>
          <div class="bv-slider"><label for="bv-wade">Water depth</label><input type="range" id="bv-wade" min="0" max="100" value="0" /></div>
          <p class="bv-note">Push the depth up and watch the stride shorten and the arms come
            up: the drag is doing to it exactly what it does to you. Past waist height it
            switches to hauling itself along on the surface.</p>
          <p class="bv-note">The face is set well back in the hood. You are meant to have to
            get closer than you would like.</p>
        </div>

        <div class="bv-group" id="bv-grp-smiler" style="display:none">
          <div class="bv-h">Smiler</div>
          <div class="bv-slider"><label for="bv-glow">Glow</label><input type="range" id="bv-glow" min="0" max="100" value="70" /></div>
          <p class="bv-note">There is no body, and that is not a shortcut. Nobody in the source
            has ever established what the rest of one looks like — only the eyes and the
            teeth — so modelling anything behind them would be inventing it.</p>
          <p class="bv-note">Turn the glow down to see what it looks like from across a dark
            room, which is where you will actually meet one.</p>
        </div>

        <div class="bv-group" id="bv-grp-willo" style="display:none">
          <div class="bv-h">Will o' Waves</div>
          <div class="bv-slider"><label for="bv-hum">Humming</label><input type="range" id="bv-hum" min="0" max="100" value="0" /></div>
          <p class="bv-note">Fifty-four individuals in single file, each hung a fixed distance
            back along the leader's own track. The blue flash runs down the line rather than
            pulsing in unison — a shoal flashing as one body reads as one object.</p>
          <p class="bv-note">Hum at them and they brighten and close up, which is how you ask
            them for directions.</p>
        </div>

        <div class="bv-group">
          <button type="button" class="bv-wide" id="bv-reset">Reset</button>
        </div>
      </div>

      <div class="bv-hint">drag to orbit · scroll to zoom · right-drag to pan</div>

      <div id="bv-error">
        <div>
          <h2>WebGL unavailable</h2>
          <p>Your browser or GPU can’t run 3D graphics, so the viewer can’t start.</p>
        </div>
      </div>
    </div>
    ${styles}
    <script type="module" nonce="${nonce}" src="/static/backrooms-viewer.js?v=${assetVersion(BACKROOMS_VIEWER_JS)}"></script>
  `;

  return Layout({
    title: 'Silverwolf — Backrooms Entity Viewer',
    body: body as any,
    nonce,
    lv999,
    user,
    fullscreen: true,
  });
}
