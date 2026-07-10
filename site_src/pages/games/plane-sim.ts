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

  /* Enemy health bars floating over the bandits in the 3D view. */
  .ps-ebar { display: none; position: absolute; width: 54px; transform: translate(-50%, -100%); text-align: center; }
  .ps-ebar-track {
    height: 5px; border-radius: 3px; overflow: hidden;
    background: rgba(8, 20, 26, 0.65); border: 1px solid rgba(255, 93, 108, 0.55);
  }
  .ps-ebar-fill { height: 100%; width: 100%; background: #ff8f5a; transition: width 0.12s linear; }
  .ps-ebar-label { margin-top: 2px; font-size: 0.55rem; letter-spacing: 0.06em; color: #ffb3ab; }

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

  /* Loading screen: opaque from first paint, faded out by the game module
     once the first frame has rendered. */
  #ps-load {
    position: absolute; inset: 0; z-index: 8;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
    background: #06080f; transition: opacity 0.45s ease;
  }
  #ps-load.ps-fade { opacity: 0; pointer-events: none; }
  #ps-load.ps-hidden { display: none; }
  .ps-load-title { font-size: 2rem; font-weight: 800; letter-spacing: 0.12em; color: var(--accent-light, #7fdfff); }
  .ps-load-sub { font-size: 0.78rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fog-400, #8aa0ad); }
  .ps-load-bar {
    width: min(320px, 70vw); height: 4px; border-radius: 2px; overflow: hidden;
    position: relative; background: #1a2230;
  }
  .ps-load-bar::after {
    content: ''; position: absolute; left: -40%; top: 0; bottom: 0; width: 40%; border-radius: 2px;
    background: var(--accent, #22d3ff); animation: ps-load-sweep 1.1s ease-in-out infinite;
  }
  @keyframes ps-load-sweep { to { left: 100%; } }

  /* Hangar (plane select): a see-through layer over the live 3D turntable.
     Only its panels take pointer events; the backdrop stays transparent. */
  #ps-menu { position: absolute; inset: 0; z-index: 7; pointer-events: none; }
  #ps-menu.ps-hidden { display: none; }
  .ps-menu-title {
    position: absolute; top: 1.15rem; left: 50%; transform: translateX(-50%);
    padding: 0.4rem 1rem; border-radius: 0.5rem; white-space: nowrap;
    font-size: 0.8rem; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--accent-light, #7fdfff);
    background: color-mix(in oklab, var(--ink-900, #06080f) 55%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ps-menu-plate {
    position: absolute; bottom: 4.6rem; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 0.9rem; pointer-events: auto;
  }
  .ps-arrow {
    cursor: pointer; width: 54px; height: 54px; border-radius: 50%;
    font-size: 1.7rem; line-height: 1; font-family: 'JetBrains Mono', monospace;
    color: var(--accent-light, #7fdfff);
    background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 40%, transparent);
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ps-arrow:hover { border-color: var(--accent, #22d3ff); background: color-mix(in oklab, var(--ink-800, #0d1320) 80%, transparent); }
  #ps-menu-name {
    min-width: 15ch; text-align: center; font-size: 1.3rem; font-weight: 800;
    letter-spacing: 0.08em; color: var(--fog-100, #eef4f7);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
  }
  .ps-menu-stats {
    position: absolute; right: 1.2rem; top: 50%; transform: translateY(-50%);
    width: min(320px, 86vw); pointer-events: auto; text-align: left;
    background: color-mix(in oklab, var(--ink-800, #0d1320) 82%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    border-radius: 0.9rem; padding: 1rem 1.1rem;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .ps-mdesc { font-size: 0.78rem; line-height: 1.45; color: var(--fog-300, #b8c6cf); margin: 0.15rem 0 0.8rem; }
  .ps-mbar { display: grid; grid-template-columns: 6.2rem 1fr; align-items: center; gap: 0.6rem; margin: 0.32rem 0; }
  .ps-mbar-l { font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fog-400, #8aa0ad); text-align: right; }
  .ps-mbar-t { height: 7px; border-radius: 4px; overflow: hidden; background: color-mix(in oklab, var(--ink-700, #1a2230) 85%, transparent); border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 20%, transparent); }
  .ps-mbar-f { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #1fa3c9, var(--accent, #22d3ff)); }
  .ps-mchips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 0.2rem; }
  .ps-mchips span {
    font-size: 0.66rem; letter-spacing: 0.08em; padding: 0.22rem 0.5rem; border-radius: 0.35rem;
    color: var(--accent-light, #7fdfff);
    background: color-mix(in oklab, var(--ink-900, #06080f) 65%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 25%, transparent);
  }
  .ps-menu-continue { width: 100%; margin-top: 0.9rem; }
  .ps-menu-keys {
    position: absolute; bottom: 1.15rem; left: 50%; transform: translateX(-50%);
    max-width: 92vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 0.68rem; letter-spacing: 0.06em; color: var(--fog-400, #8aa0ad);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
  }
  #ps-menu .ps-corner-hint { position: absolute; }

  /* Map select: modal card over a dark veil. */
  #ps-map-menu {
    position: absolute; inset: 0; z-index: 7; cursor: auto;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 40%, rgba(6, 8, 15, 0.55), rgba(6, 8, 15, 0.9));
  }
  #ps-map-menu.ps-hidden { display: none; }
  #ps-map-menu .ps-card { pointer-events: auto; }
  .ps-map-tile {
    display: flex; gap: 1rem; align-items: center; text-align: left; cursor: pointer;
    padding: 0.7rem 0.85rem; border-radius: 0.8rem; margin: 0.4rem 0 0.9rem;
    background: color-mix(in oklab, var(--ink-900, #06080f) 55%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent);
  }
  .ps-map-tile.ps-active { border-color: var(--accent, #22d3ff); box-shadow: 0 0 24px rgba(34, 211, 255, 0.22); }
  .ps-map-svg { width: 148px; height: 96px; border-radius: 0.5rem; flex: none; }
  .ps-map-name { font-size: 1rem; font-weight: 800; color: var(--fog-100, #eef4f7); margin: 0 0 0.25rem; }
  .ps-map-desc { font-size: 0.76rem; line-height: 1.45; color: var(--fog-300, #b8c6cf); margin: 0; }
  .ps-menu-row { display: flex; gap: 0.6rem; justify-content: center; }
  .ps-back-btn {
    margin-top: 0.9rem; padding: 0.45rem 1.1rem; font-size: 0.95rem; font-weight: 800;
    cursor: pointer; font-family: 'JetBrains Mono', monospace;
    color: var(--fog-200, #dfe9ef);
    background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 30%, transparent); border-radius: 0.5rem;
  }
  .ps-back-btn:hover { border-color: var(--accent, #22d3ff); color: var(--accent-light, #7fdfff); }

  /* While a menu is up: give the cursor back and hide the flight HUD. */
  #ps-stage.ps-in-menu { cursor: auto; }
  #ps-stage.ps-in-menu .ps-hud, #ps-stage.ps-in-menu #ps-damage { display: none; }
  .ps-card {
    max-width: 560px; width: min(90vw, 560px); text-align: center;
    background: color-mix(in oklab, var(--ink-800, #0d1320) 80%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 35%, transparent);
    border-radius: 1rem; padding: 1.6rem 1.8rem; backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }
  .ps-card h1 { margin: 0 0 0.3rem; color: var(--accent-light, #7fdfff); font-size: 1.7rem; }
  .ps-card .ps-sub { margin: 0 0 1.1rem; color: var(--fog-300, #b8c6cf); font-size: 0.9rem; }
  .ps-key {
    display: inline-block; min-width: 1.5em; padding: 0.05em 0.4em; text-align: center;
    border: 1px solid color-mix(in oklab, var(--accent, #22d3ff) 40%, transparent);
    border-radius: 0.3rem; background: color-mix(in oklab, var(--ink-900, #06080f) 60%, transparent);
  }
  /* Difficulty picker (map select + pause menu). */
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

  /* End screen (victory / defeat): same card chrome, click or SPACE to fly again. */
  #ps-end {
    position: absolute; inset: 0; z-index: 6; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 40%, rgba(6, 8, 15, 0.6), rgba(6, 8, 15, 0.92));
  }
  #ps-end.ps-hidden { display: none; }
  #ps-end .ps-card { pointer-events: auto; max-width: 460px; }
  #ps-end.ps-win .ps-card { border-color: color-mix(in oklab, #ffd24a 55%, transparent); box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255, 210, 74, 0.18); }
  #ps-end.ps-lose .ps-card { border-color: color-mix(in oklab, #ff5d6c 50%, transparent); box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255, 93, 108, 0.16); }
  .ps-end-icon { font-size: 2.6rem; line-height: 1; margin-bottom: 0.3rem; }
  #ps-end.ps-win #ps-end-title { color: #ffd24a; }
  #ps-end.ps-lose #ps-end-title { color: #ff5d6c; }
  .ps-end-stats {
    display: grid; grid-template-columns: auto auto; gap: 0.35rem 1.2rem; justify-content: center;
    margin: 0.2rem auto 1.1rem; font-size: 0.86rem;
  }
  .ps-end-stats dt { color: var(--fog-400, #8aa0ad); text-align: right; letter-spacing: 0.04em; }
  .ps-end-stats dd { margin: 0; color: var(--fog-100, #eef4f7); font-weight: 700; text-align: left; }

  /* Pause menu (ESC): same chrome as the start overlay, hosts the settings. */
  #ps-pause {
    position: absolute; inset: 0; z-index: 5; cursor: auto;
    display: flex; align-items: center; justify-content: center;
    background: rgba(6, 8, 15, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  #ps-pause.ps-hidden { display: none; }
  #ps-pause .ps-card { pointer-events: auto; }
  .ps-set-row {
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
    justify-content: center; margin: 0.55rem 0;
  }
  .ps-set-lbl {
    min-width: 5.5rem; text-align: right; font-size: 0.68rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--fog-400, #8aa0ad);
  }
  #ps-vol { width: 180px; accent-color: var(--accent, #22d3ff); cursor: pointer; }
  .ps-resume-btn {
    margin-top: 0.9rem; padding: 0.45rem 1.4rem; font-size: 0.95rem; font-weight: 800;
    cursor: pointer; font-family: 'JetBrains Mono', monospace;
    color: var(--ink-900, #06080f); background: var(--accent, #22d3ff);
    border: 1px solid var(--accent, #22d3ff); border-radius: 0.5rem;
  }
  .ps-resume-btn:hover { filter: brightness(1.15); }

  @media (prefers-reduced-motion: reduce) {
    .ps-stall.ps-show, .ps-load-bar::after, .ps-gear-transit .ps-gear-lamps span { animation: none; }
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
        <!-- Minimap (top-left, circular, heading-up) -->
        <div class="ps-panel ps-map-wrap">
          <canvas id="ps-map" width="150" height="150"></canvas>
        </div>

        <!-- Enemy health bars (positioned by the game each frame) -->
        <div id="ps-ebars"></div>

        <!-- Combat status (top-centre): bandits-down board + hull HP -->
        <div class="ps-panel ps-combat">
          <div class="ps-lbl">Bandits down</div>
          <div class="ps-val"><span id="ps-kills">0 / 3</span></div>
          <div class="ps-hp-track"><div id="ps-hp-fill"></div></div>
          <div class="ps-unit">HULL <span id="ps-hp">100</span> &middot; <span id="ps-diff">REGULAR</span></div>
          <div class="ps-unit"><span id="ps-plane-label">SPITFIRE</span></div>
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

      <!-- Loading screen (hidden by the game once the first frame renders) -->
      <div id="ps-load">
        <div class="ps-load-title">PLANE SIM</div>
        <div class="ps-load-bar"></div>
        <div class="ps-load-sub">Spooling up the Merlin…</div>
      </div>

      <!-- Hangar: 3D plane select (arrows cycle, stats on the right) -->
      <div id="ps-menu" class="ps-hidden">
        <div class="ps-menu-title">Hangar — choose your fighter</div>
        <div class="ps-menu-stats">
          <div class="ps-lbl">Aircraft</div>
          <div id="ps-mstats"></div>
          <button type="button" class="ps-resume-btn ps-menu-continue" id="ps-continue">Continue ▸</button>
        </div>
        <div class="ps-menu-plate">
          <button type="button" class="ps-arrow" data-mprev aria-label="Previous aircraft">‹</button>
          <div id="ps-menu-name">SPITFIRE</div>
          <button type="button" class="ps-arrow" data-mnext aria-label="Next aircraft">›</button>
        </div>
        <div class="ps-menu-keys">◄ ► cycle &middot; Mouse: point to fly &middot; RMB fire &middot; W/S throttle &middot; A/D rudder &middot; G gear &middot; ESC pause</div>
      </div>

      <!-- Sortie: map select + briefing -->
      <div id="ps-map-menu" class="ps-hidden">
        <div class="ps-card">
          <h1>Sortie</h1>
          <p class="ps-sub">Select a map, set the opposition, and go hunt the bandits. Watch your hull — they shoot back.</p>
          <div class="ps-map-tile ps-active" id="ps-map-coastal">
            <svg class="ps-map-svg" viewBox="0 0 148 96" role="img" aria-label="Coastal Airfield map preview">
              <rect width="148" height="96" rx="6" fill="#22381f"/>
              <path d="M0 66 Q 22 52 44 62 T 96 60 T 148 70 L 148 96 L 0 96 Z" fill="#173f4e"/>
              <ellipse cx="104" cy="30" rx="22" ry="12" fill="#1c4a5c"/>
              <path d="M14 44 l8 -12 8 12 Z M30 40 l7 -10 7 10 Z" fill="#3d5940"/>
              <path d="M22 30 l5 -8 5 8 Z" fill="#7e8b90"/>
              <rect x="58" y="38" width="44" height="7" rx="1.6" transform="rotate(-18 80 41)" fill="#5a6068"/>
              <rect x="60" y="52" width="16" height="8" rx="1.5" transform="rotate(-18 68 56)" fill="#6d5f4b"/>
              <circle cx="120" cy="78" r="2.4" fill="#d9a52e"/>
            </svg>
            <div>
              <p class="ps-map-name">Coastal Airfield</p>
              <p class="ps-map-desc">A 12&nbsp;km box of mountains, lakes and one very homely airstrip. Bandits prowl the valley.</p>
            </div>
          </div>
          <div class="ps-diff-row">
            <span class="ps-diff-lbl">Bandit skill</span>
            <button type="button" class="ps-diff-btn" data-diff="easy">Rookie</button>
            <button type="button" class="ps-diff-btn" data-diff="normal">Regular</button>
            <button type="button" class="ps-diff-btn" data-diff="hard">Ace</button>
          </div>
          <div class="ps-diff-row">
            <span class="ps-diff-lbl">Bandits</span>
            <button type="button" class="ps-diff-btn" data-count="1">1</button>
            <button type="button" class="ps-diff-btn" data-count="2">2</button>
            <button type="button" class="ps-diff-btn" data-count="3">3</button>
            <button type="button" class="ps-diff-btn" data-count="4">4</button>
            <button type="button" class="ps-diff-btn" data-count="5">5</button>
          </div>
          <p class="ps-hint">Bandits fly a mix of all three types with their real quirks. Lower skill also means <strong>your guns hit harder</strong>. Switch skill anytime with <span class="ps-key">1</span> <span class="ps-key">2</span> <span class="ps-key">3</span>.</p>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-menuback>‹ Hangar</button>
            <button type="button" class="ps-resume-btn" id="ps-takeoff">Take off ▸</button>
          </div>
        </div>
      </div>

      <!-- End screen (victory / shot-down / crash) -->
      <div id="ps-end" class="ps-hidden">
        <div class="ps-card">
          <div id="ps-end-icon" class="ps-end-icon">🏆</div>
          <h1 id="ps-end-title">Victory</h1>
          <p class="ps-sub" id="ps-end-sub">All bandits downed.</p>
          <dl class="ps-end-stats" id="ps-end-stats"></dl>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-hangar>‹ Hangar</button>
            <button type="button" class="ps-resume-btn" id="ps-end-again">Fly again (Space)</button>
          </div>
        </div>
      </div>

      <!-- Pause menu (ESC) -->
      <div id="ps-pause" class="ps-hidden">
        <div class="ps-card">
          <h1>Paused</h1>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Volume</span>
            <input id="ps-vol" type="range" min="0" max="100" value="50" aria-label="Sound volume">
          </div>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Camera</span>
            <button type="button" class="ps-diff-btn" data-cam="close">Close</button>
            <button type="button" class="ps-diff-btn" data-cam="medium">Medium</button>
            <button type="button" class="ps-diff-btn" data-cam="far">Far</button>
          </div>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Aircraft</span>
            <button type="button" class="ps-diff-btn" data-plane="spitfire">Spitfire</button>
            <button type="button" class="ps-diff-btn" data-plane="p51">P-51</button>
            <button type="button" class="ps-diff-btn" data-plane="zero">Zero</button>
          </div>
          <p class="ps-hint ps-plane-desc"></p>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Bandit skill</span>
            <button type="button" class="ps-diff-btn" data-diff="easy">Rookie</button>
            <button type="button" class="ps-diff-btn" data-diff="normal">Regular</button>
            <button type="button" class="ps-diff-btn" data-diff="hard">Ace</button>
          </div>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Bandits</span>
            <button type="button" class="ps-diff-btn" data-count="1">1</button>
            <button type="button" class="ps-diff-btn" data-count="2">2</button>
            <button type="button" class="ps-diff-btn" data-count="3">3</button>
            <button type="button" class="ps-diff-btn" data-count="4">4</button>
            <button type="button" class="ps-diff-btn" data-count="5">5</button>
          </div>
          <p class="ps-hint">Bandit count applies when the fight (re)starts. Lower skill = tougher bullets for you, sloppier aim for them.</p>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Speed</span>
            <button type="button" class="ps-diff-btn" data-uspeed="kn">Knots</button>
            <button type="button" class="ps-diff-btn" data-uspeed="mph">mph</button>
            <button type="button" class="ps-diff-btn" data-uspeed="kmh">km/h</button>
          </div>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Altitude</span>
            <button type="button" class="ps-diff-btn" data-ualt="ft">Feet</button>
            <button type="button" class="ps-diff-btn" data-ualt="m">Metres</button>
          </div>
          <div class="ps-set-row">
            <span class="ps-set-lbl">Distance</span>
            <button type="button" class="ps-diff-btn" data-udist="m">m</button>
            <button type="button" class="ps-diff-btn" data-udist="ft">ft</button>
            <button type="button" class="ps-diff-btn" data-udist="km">km</button>
            <button type="button" class="ps-diff-btn" data-udist="mi">mi</button>
          </div>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-hangar>‹ Hangar</button>
            <button type="button" class="ps-resume-btn" id="ps-resume">Resume (ESC)</button>
          </div>
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
