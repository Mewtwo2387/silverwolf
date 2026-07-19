import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';
import { inlineJSON } from '../../inline';

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
  stats?: unknown; // Plane Sim achievement stat blob (null when logged out)
  csrf?: string | null;
}) {
  const {
    nonce, lv999, user, stats = null, csrf = null,
  } = opts;

  // Boot payload for the Achievements tab: whether the visitor is logged in
  // (achievements only track with an account), their CSRF token for posting
  // gameplay events, and their current stats. A non-executable JSON island
  // (inlineJSON escapes "<") the game module reads once at start.
  const achBoot = raw(inlineJSON({ loggedIn: !!user, csrf: csrf || null, stats }));

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

    /* --- Game menu theme ---------------------------------------------------
       The HUD keeps the site's cyan instrument look (see the .ps-panel /
       .ps-combat / gauge rules below — untouched). Everything the pilot clicks
       BETWEEN flights — the hangar, briefing modals, pause menu, medals — wears
       its own warm military-aviation skin instead: gunmetal plates, brass trim
       and stencilled type, so the menus feel like a squadron ready-room rather
       than the rest of the website. These vars drive only that menu chrome. */
    --ps-brass: #d9a441;
    --ps-brass-hi: #f2cf72;
    --ps-brass-dim: #9c7529;
    --ps-brass-deep: #7c5c1e;
    --ps-plate: #14170f;      /* warm gunmetal, near-black olive */
    --ps-plate-2: #232619;    /* raised plate face */
    --ps-plate-3: #2c3021;    /* hover / active plate */
    --ps-edge: rgba(217, 164, 65, 0.30);
    --ps-edge-soft: rgba(217, 164, 65, 0.16);
    --ps-edge-strong: rgba(217, 164, 65, 0.72);
    --ps-parch: #ece5d0;      /* warm off-white body text */
    --ps-parch-dim: #b0a888;  /* muted khaki label text */
    --ps-ink: #14100a;        /* dark ink on brass fills */
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

  /* Tiny FPS readout in the extreme top-left corner (above the minimap).
     Lives outside .ps-hud so it stays visible in the hangar/map menus too. */
  #ps-fps {
    position: absolute; top: 0.2rem; left: 0.45rem; z-index: 3;
    font-size: 0.6rem; letter-spacing: 0.08em; pointer-events: none;
    color: var(--fog-400, #8aa0ad); text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
  }

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

  /* Ocean-mission objective strip, just under the top-centre combat panel. */
  #ps-objective {
    position: absolute; left: 50%; bottom: 18.5%; transform: translateX(-50%); z-index: 3;
    text-align: center; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
    color: #8fe4ff; text-shadow: 0 0 10px rgba(0, 0, 0, 0.8); pointer-events: none;
    white-space: nowrap; text-transform: uppercase;
  }
  #ps-objective:empty { display: none; }

  /* Tutorial prompt (top-centre, under the combat board's spot). */
  #ps-tut {
    left: 50%; top: 7.6rem; transform: translateX(-50%); text-align: center;
    max-width: min(560px, 92vw); pointer-events: none;
  }
  #ps-tut-text { margin-top: 0.3rem; font-size: 0.95rem; font-weight: 700; color: var(--fog-100, #eef4f7); line-height: 1.4; }
  #ps-tut-barwrap { margin-top: 0.45rem; height: 7px; border-radius: 99px; background: rgba(255,255,255,0.12); overflow: hidden; }
  #ps-tut-bar { width: 0%; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #37b6ff, #6fe3ff); transition: width 90ms linear; }
  #ps-tut-bar.ps-tut-bar-full { background: linear-gradient(90deg, #35d07f, #7df0b0); }

  /* Stunt score strip (top-centre, where the combat board usually sits). */
  #ps-stunt { left: 50%; top: 1.1rem; transform: translateX(-50%); text-align: center; display: flex; gap: 1.3rem; }
  #ps-stunt > div { min-width: 4.6rem; }
  #ps-stunt .ps-val { font-size: 1.5rem; }

  /* Always-available exit (there's no navbar in fullscreen mode). */
  .ps-corner {
    position: absolute; right: 1.1rem; top: 1.1rem; z-index: 4; display: flex; gap: 0.5rem;
  }
  .ps-exit {
    pointer-events: auto;
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font-size: 0.72rem; text-decoration: none;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ps-parch); font-family: 'JetBrains Mono', monospace;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 82%, transparent), color-mix(in oklab, var(--ps-plate) 82%, transparent));
    border: 1px solid var(--ps-edge); border-radius: 0.35rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ps-exit:hover { border-color: var(--ps-edge-strong); color: var(--ps-brass-hi); }

  /* Loading screen: opaque from first paint, faded out by the game module
     once the first frame has rendered. */
  #ps-load {
    position: absolute; inset: 0; z-index: 8;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
    background: #06080f; transition: opacity 0.45s ease;
  }
  #ps-load.ps-fade { opacity: 0; pointer-events: none; }
  #ps-load.ps-hidden { display: none; }
  .ps-load-title {
    font-size: 2.1rem; font-weight: 800; letter-spacing: 0.34em; text-indent: 0.34em;
    text-transform: uppercase;
    background: linear-gradient(180deg, var(--ps-brass-hi), var(--ps-brass) 55%, var(--ps-brass-dim));
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  }
  .ps-load-sub { font-size: 0.78rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ps-parch-dim); }
  .ps-load-bar {
    width: min(320px, 70vw); height: 4px; border-radius: 2px; overflow: hidden;
    position: relative; background: #221f14;
  }
  .ps-load-bar::after {
    content: ''; position: absolute; left: -40%; top: 0; bottom: 0; width: 40%; border-radius: 2px;
    background: var(--ps-brass); animation: ps-load-sweep 1.1s ease-in-out infinite;
  }
  @keyframes ps-load-sweep { to { left: 100%; } }

  /* Hangar (plane select): a see-through layer over the live 3D turntable.
     Only its panels take pointer events; the backdrop stays transparent. */
  #ps-menu { position: absolute; inset: 0; z-index: 7; pointer-events: none; }
  #ps-menu.ps-hidden { display: none; }
  .ps-menu-title {
    position: absolute; top: 1.15rem; left: 50%; transform: translateX(-50%);
    padding: 0.4rem 1.1rem; border-radius: 0.4rem; white-space: nowrap;
    font-size: 0.8rem; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--ps-brass-hi);
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 78%, transparent), color-mix(in oklab, var(--ps-plate) 82%, transparent));
    border: 1px solid var(--ps-edge);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  }
  .ps-menu-plate {
    position: absolute; bottom: 4.6rem; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 0.9rem; pointer-events: auto;
  }
  .ps-arrow {
    cursor: pointer; width: 54px; height: 54px; border-radius: 50%;
    font-size: 1.7rem; line-height: 1; font-family: 'JetBrains Mono', monospace;
    color: var(--ps-brass-hi);
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 82%, transparent), color-mix(in oklab, var(--ps-plate) 85%, transparent));
    border: 1px solid var(--ps-edge);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
    transition: border-color 0.15s, background 0.15s;
  }
  .ps-arrow:hover { border-color: var(--ps-edge-strong); background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-3) 88%, transparent), color-mix(in oklab, var(--ps-plate-2) 90%, transparent)); }
  #ps-menu-name {
    min-width: 15ch; text-align: center; font-size: 1.3rem; font-weight: 800;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--ps-parch);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.85);
  }
  .ps-menu-stats {
    position: absolute; right: 1.2rem; top: 50%; transform: translateY(-50%);
    width: min(320px, 86vw); pointer-events: auto; text-align: left;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 88%, transparent), color-mix(in oklab, var(--ps-plate) 92%, transparent));
    border: 1px solid var(--ps-edge);
    border-radius: 0.6rem; padding: 1rem 1.1rem;
    box-shadow: 0 18px 46px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  .ps-menu-stats .ps-lbl { color: var(--ps-parch-dim); }
  .ps-mdesc { font-size: 0.78rem; line-height: 1.45; color: var(--ps-parch); margin: 0.15rem 0 0.8rem; }
  .ps-mbar { display: grid; grid-template-columns: 6.2rem 1fr; align-items: center; gap: 0.6rem; margin: 0.32rem 0; }
  .ps-mbar-l { font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ps-parch-dim); text-align: right; }
  .ps-mbar-t { height: 7px; border-radius: 4px; overflow: hidden; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--ps-edge-soft); }
  .ps-mbar-f { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--ps-brass-dim), var(--ps-brass-hi)); }
  .ps-mchips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 0.2rem; }
  .ps-mchips span {
    font-size: 0.66rem; letter-spacing: 0.08em; padding: 0.22rem 0.5rem; border-radius: 0.3rem;
    color: var(--ps-brass-hi);
    background: color-mix(in oklab, var(--ps-plate) 70%, transparent);
    border: 1px solid var(--ps-edge);
  }
  .ps-menu-continue { width: 100%; margin-top: 0.9rem; }
  .ps-menu-keys {
    position: absolute; bottom: 1.15rem; left: 50%; transform: translateX(-50%);
    max-width: 92vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: 0.68rem; letter-spacing: 0.06em; color: var(--ps-parch-dim);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
  }
  #ps-menu .ps-corner-hint { position: absolute; }

  /* Mode / chapter select screens: modal card over a dark veil. */
  .ps-modal {
    position: absolute; inset: 0; z-index: 7; cursor: auto;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 40%, rgba(6, 8, 15, 0.55), rgba(6, 8, 15, 0.9));
  }
  .ps-modal.ps-hidden { display: none; }
  .ps-modal .ps-card { pointer-events: auto; max-height: 92vh; overflow-y: auto; }
  /* Big emoji block standing in for a preview image on mode/chapter tiles. */
  .ps-tile-ico {
    flex: none; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
    font-size: 2rem; border-radius: 0.45rem;
    background: color-mix(in oklab, var(--ps-brass) 12%, transparent);
    border: 1px solid var(--ps-edge);
  }
  .ps-map-tile:hover { border-color: var(--ps-edge-strong); background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-3) 70%, transparent), color-mix(in oklab, var(--ps-plate-2) 74%, transparent)); }
  .ps-map-tile {
    display: flex; gap: 1rem; align-items: center; text-align: left; cursor: pointer;
    padding: 0.7rem 0.85rem; border-radius: 0.5rem; margin: 0.4rem 0 0.9rem;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 60%, transparent), color-mix(in oklab, var(--ps-plate) 66%, transparent));
    border: 1px solid var(--ps-edge-soft);
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .ps-map-tile.ps-active { border-color: var(--ps-edge-strong); box-shadow: 0 0 22px rgba(217, 164, 65, 0.18), inset 0 0 0 1px var(--ps-edge-soft); }
  .ps-map-svg { width: 148px; height: 96px; border-radius: 0.4rem; flex: none; }
  .ps-map-name { font-size: 1rem; font-weight: 800; letter-spacing: 0.04em; color: var(--ps-parch); margin: 0 0 0.25rem; }
  .ps-map-desc { font-size: 0.76rem; line-height: 1.45; color: var(--ps-parch-dim); margin: 0; }
  .ps-menu-row { display: flex; gap: 0.6rem; justify-content: center; }
  .ps-back-btn {
    margin-top: 0.9rem; padding: 0.45rem 1.1rem; font-size: 0.82rem; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; font-family: 'JetBrains Mono', monospace;
    color: var(--ps-parch);
    background: linear-gradient(180deg, var(--ps-plate-2), var(--ps-plate));
    border: 1px solid var(--ps-edge); border-radius: 0.35rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .ps-back-btn:hover { border-color: var(--ps-edge-strong); color: var(--ps-brass-hi); background: linear-gradient(180deg, var(--ps-plate-3), var(--ps-plate-2)); }

  /* While a menu is up: give the cursor back and hide the flight HUD. */
  #ps-stage.ps-in-menu { cursor: auto; }
  #ps-stage.ps-in-menu .ps-hud, #ps-stage.ps-in-menu #ps-damage { display: none; }
  .ps-card {
    max-width: 560px; width: min(90vw, 560px); text-align: center; position: relative;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 88%, transparent), color-mix(in oklab, var(--ps-plate) 93%, transparent));
    border: 1px solid var(--ps-edge);
    border-radius: 0.55rem; padding: 1.6rem 1.8rem; backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 22px 64px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  /* A brass hairline just inside the card edge — a ready-room briefing board. */
  .ps-card::before {
    content: ''; position: absolute; inset: 0.32rem; border-radius: 0.4rem;
    border: 1px solid var(--ps-edge-soft); pointer-events: none;
  }
  .ps-card > * { position: relative; }
  .ps-card h1 {
    margin: 0 0 0.3rem; font-size: 1.55rem; font-weight: 800;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ps-brass-hi); text-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
  }
  .ps-card .ps-sub { margin: 0 0 1.1rem; color: var(--ps-parch-dim); font-size: 0.9rem; }
  .ps-key {
    display: inline-block; min-width: 1.5em; padding: 0.05em 0.4em; text-align: center;
    color: var(--ps-parch);
    border: 1px solid var(--ps-edge);
    border-radius: 0.25rem; background: color-mix(in oklab, var(--ps-plate) 70%, transparent);
  }
  /* Difficulty picker (map select + pause menu). */
  .ps-diff-row { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; margin: 0.2rem 0 0.5rem; }
  .ps-diff-lbl { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ps-parch-dim); }
  .ps-diff-btn {
    pointer-events: auto; cursor: pointer; font-family: 'JetBrains Mono', monospace;
    padding: 0.3rem 0.8rem; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase;
    border-radius: 0.3rem; color: var(--ps-parch);
    background: linear-gradient(180deg, var(--ps-plate-2), var(--ps-plate));
    border: 1px solid var(--ps-edge);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .ps-diff-btn:hover { border-color: var(--ps-edge-strong); color: var(--ps-brass-hi); }
  .ps-diff-btn.ps-diff-active {
    color: var(--ps-ink); font-weight: 800;
    background: linear-gradient(180deg, var(--ps-brass-hi), var(--ps-brass) 55%, var(--ps-brass-dim));
    border-color: var(--ps-brass-deep);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 3px rgba(0, 0, 0, 0.22);
  }
  .ps-hint { margin: 0 0 0.2rem; font-size: 0.74rem; line-height: 1.4; color: var(--ps-parch-dim); }

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
  .ps-end-stats dt { color: var(--ps-parch-dim); text-align: right; letter-spacing: 0.04em; }
  .ps-end-stats dd { margin: 0; color: var(--ps-parch); font-weight: 700; text-align: left; }

  /* Pause / settings menu (ESC or the ⚙ button). z-index above the hangar
     plate (7) and toasts (9) so it always sits on top — clicking the dark
     backdrop or the ✕ closes it, so a menu can never get stranded on screen. */
  #ps-pause {
    position: absolute; inset: 0; z-index: 12; cursor: auto;
    display: flex; align-items: center; justify-content: center;
    background: rgba(6, 8, 15, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  #ps-pause.ps-hidden { display: none; }
  #ps-pause .ps-card { pointer-events: auto; }
  /* Close (✕) button, top-right of the settings card. */
  .ps-pause-x {
    position: absolute; top: 0.6rem; right: 0.7rem; z-index: 2;
    width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center;
    padding: 0; font-size: 1.05rem; line-height: 1; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; color: var(--ps-parch-dim);
    background: linear-gradient(180deg, var(--ps-plate-2), var(--ps-plate));
    border: 1px solid var(--ps-edge); border-radius: 0.3rem;
    transition: color 0.15s, border-color 0.15s;
  }
  .ps-pause-x:hover { color: var(--ps-brass-hi); border-color: var(--ps-edge-strong); }
  .ps-set-row {
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
    justify-content: center; margin: 0.55rem 0;
  }
  .ps-set-lbl {
    min-width: 5.5rem; text-align: right; font-size: 0.68rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ps-parch-dim);
  }
  #ps-vol, #ps-musicvol, #ps-sfxvol { width: 180px; accent-color: var(--ps-brass); cursor: pointer; }
  /* Manila-folder tabs inside the pause/settings card. */
  .ps-tabs {
    display: flex; gap: 0.3rem; justify-content: center; margin: 0.4rem 0 0.7rem;
    border-bottom: 1px solid var(--ps-edge);
  }
  .ps-tab {
    pointer-events: auto; cursor: pointer; font-family: 'JetBrains Mono', monospace;
    padding: 0.35rem 1.1rem; font-size: 0.78rem; letter-spacing: 0.05em; text-transform: uppercase;
    color: var(--ps-parch-dim);
    background: transparent; border: 1px solid transparent; border-bottom: none;
    border-radius: 0.4rem 0.4rem 0 0; transition: color 0.15s, background 0.15s;
  }
  .ps-tab:hover { color: var(--ps-brass-hi); }
  .ps-tab.ps-tab-active {
    color: var(--ps-brass-hi); font-weight: 800;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 70%, transparent), transparent);
    border-color: var(--ps-edge);
  }
  .ps-tabpane { min-height: 12.5rem; }
  #ps-pause .ps-card { max-height: 94vh; overflow-y: auto; }

  /* ---- Achievements tab ---- */
  .ps-ach-body { max-height: 62vh; overflow-y: auto; padding: 0.1rem 0.35rem 0.25rem; text-align: left; }
  .ps-ach-empty { text-align: center; color: var(--ps-parch); font-size: 0.86rem; line-height: 1.55; padding: 1.4rem 0.6rem; }
  .ps-ach-empty .ps-ach-login {
    display: inline-block; margin-top: 0.9rem; padding: 0.5rem 1.2rem; text-decoration: none;
    font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ps-ink);
    background: linear-gradient(180deg, var(--ps-brass-hi), var(--ps-brass) 55%, var(--ps-brass-dim));
    border: 1px solid var(--ps-brass-deep); border-radius: 0.35rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  .ps-ach-summary {
    position: sticky; top: 0; z-index: 1; padding: 0.15rem 0.1rem 0.55rem; margin-bottom: 0.3rem;
    background: color-mix(in oklab, var(--ps-plate) 96%, transparent);
  }
  .ps-ach-count { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .ps-ach-count b { font-size: 1.4rem; line-height: 1; color: var(--ps-brass-hi); }
  .ps-ach-count span { font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ps-parch-dim); }
  .ps-ach-progress {
    height: 8px; border-radius: 4px; overflow: hidden; margin: 0.4rem 0 0.55rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--ps-edge-soft);
  }
  .ps-ach-progress > span { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--ps-brass-dim), var(--ps-brass-hi)); }
  .ps-ach-tiers { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ps-ach-tier {
    display: flex; align-items: center; gap: 0.34rem; font-size: 0.68rem; letter-spacing: 0.03em;
    color: var(--ps-parch); padding: 0.16rem 0.5rem 0.16rem 0.3rem; border-radius: 0.35rem;
    background: color-mix(in oklab, var(--ps-plate-2) 60%, transparent);
    border: 1px solid var(--ps-edge-soft);
  }
  .ps-ach-cat {
    font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ps-brass);
    margin: 0.85rem 0 0.45rem; padding-bottom: 0.28rem; border-bottom: 1px solid var(--ps-edge-soft);
  }
  .ps-ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(144px, 1fr)); gap: 0.5rem; }
  .ps-ach-card {
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.32rem;
    padding: 0.7rem 0.5rem 0.55rem; border-radius: 0.45rem;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 55%, transparent), color-mix(in oklab, var(--ps-plate) 60%, transparent));
    border: 1px solid var(--ps-edge-soft);
  }
  .ps-ach-card.ps-ach-on { border-color: var(--ps-edge-strong); box-shadow: 0 0 16px rgba(217, 164, 65, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04); }
  .ps-ach-name { font-size: 0.75rem; font-weight: 800; line-height: 1.2; letter-spacing: 0.02em; color: var(--ps-parch); }
  .ps-ach-card.ps-ach-on .ps-ach-name { color: var(--ps-brass-hi); }
  .ps-ach-desc { font-size: 0.6rem; line-height: 1.36; color: var(--ps-parch-dim); }
  .ps-ach-cbar { width: 100%; height: 5px; border-radius: 3px; overflow: hidden; margin-top: auto; background: rgba(0, 0, 0, 0.38); }
  .ps-ach-cbar > span { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--ps-brass-dim), var(--ps-brass)); }
  .ps-ach-card.ps-ach-on .ps-ach-cbar > span { background: linear-gradient(90deg, var(--ps-brass), var(--ps-brass-hi)); }
  .ps-ach-val { font-size: 0.58rem; letter-spacing: 0.05em; color: var(--ps-parch-dim); }

  /* Lapel medals: a striped suspension ribbon with a metallic star pendant
     hanging from it — sized entirely in em, so one font-size scales the whole
     medal (grid card / toast / tier chip). Greyed & dimmed when locked. */
  .ps-medal {
    font-size: 10px; width: 4.4em; height: 6em; flex: none; position: relative;
    filter: drop-shadow(0 0.2em 0.24em rgba(0, 0, 0, 0.5));
  }
  /* Ribbon: a folded cloth bar, tier-striped, tapering toward the pendant. */
  .ps-medal::before {
    content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 2.9em; height: 2.7em;
    background: var(--rib, #8a6a2e);
    clip-path: polygon(0 0, 100% 0, 86% 100%, 14% 100%);
    box-shadow: inset 0 0 0 0.1em rgba(0, 0, 0, 0.28), inset 0.7em 0 0.6em -0.4em rgba(255, 255, 255, 0.35), inset -0.7em 0 0.6em -0.4em rgba(0, 0, 0, 0.4);
  }
  /* Pendant: a five-point star in the tier metal, hanging below the ribbon. */
  .ps-medal::after {
    content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 4em; height: 4em;
    background:
      radial-gradient(circle at 34% 26%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 42%),
      radial-gradient(circle at 50% 44%, var(--mhi, #f0b27a), var(--mmid, #b06f2e) 56%, var(--mlo, #7a4a1c));
    clip-path: polygon(50% 1%, 61% 35%, 98% 35%, 68% 57%, 79% 99%, 50% 74%, 21% 99%, 32% 57%, 2% 35%, 39% 35%);
  }
  .ps-medal-bronze   { --rib: repeating-linear-gradient(90deg, #6f3f18 0 0.34em, #9c6330 0.34em 0.68em); --mhi: #f4bd83; --mmid: #b06f2e; --mlo: #6f421a; }
  .ps-medal-silver   { --rib: repeating-linear-gradient(90deg, #46586a 0 0.34em, #8fa2b3 0.34em 0.68em); --mhi: #fbfdff; --mmid: #aab8c6; --mlo: #6f7d8a; }
  .ps-medal-gold     { --rib: repeating-linear-gradient(90deg, #7a2626 0 0.34em, #d9a441 0.34em 0.68em); --mhi: #fff0b8; --mmid: #f5c034; --mlo: #a9760a; }
  .ps-medal-platinum { --rib: repeating-linear-gradient(90deg, #35306a 0 0.34em, #cdd8e6 0.34em 0.68em); --mhi: #ffffff; --mmid: #cfe6f2; --mlo: #7fb0c6; }
  .ps-medal-locked { filter: grayscale(1) brightness(0.6); opacity: 0.42; }

  /* Unlock toasts (bottom-left). */
  #ps-ach-toasts { position: absolute; left: 1.1rem; bottom: 1.1rem; z-index: 9; display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none; }
  .ps-ach-toast {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.9rem 0.45rem 0.55rem; border-radius: 0.45rem;
    background: linear-gradient(180deg, color-mix(in oklab, var(--ps-plate-2) 94%, transparent), color-mix(in oklab, var(--ps-plate) 96%, transparent));
    border: 1px solid var(--ps-edge-strong);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transform: translateX(-120%); opacity: 0; transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s;
  }
  .ps-ach-toast.ps-show { transform: translateX(0); opacity: 1; }
  .ps-ach-toast .ps-medal { font-size: 8px; }
  .ps-ach-toast .ps-t-cap { font-size: 0.55rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ps-parch-dim); }
  .ps-ach-toast .ps-t-name { font-size: 0.86rem; font-weight: 800; color: var(--ps-brass-hi); }
  /* Tier chips in the summary use a small inline medal. */
  .ps-ach-tier .ps-medal { font-size: 3.6px; }
  @media (prefers-reduced-motion: reduce) { .ps-ach-toast { transition: opacity 0.2s; transform: none; } }

  .ps-resume-btn {
    margin-top: 0.9rem; padding: 0.5rem 1.5rem; font-size: 0.85rem; font-weight: 800;
    letter-spacing: 0.09em; text-transform: uppercase;
    cursor: pointer; font-family: 'JetBrains Mono', monospace;
    color: var(--ps-ink);
    background: linear-gradient(180deg, var(--ps-brass-hi), var(--ps-brass) 55%, var(--ps-brass-dim));
    border: 1px solid var(--ps-brass-deep); border-radius: 0.35rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(0, 0, 0, 0.28), 0 3px 9px rgba(0, 0, 0, 0.4);
    transition: filter 0.15s, transform 0.05s;
  }
  .ps-resume-btn:hover { filter: brightness(1.08); }
  .ps-resume-btn:active { transform: translateY(1px); }

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
        <button type="button" class="ps-exit" id="ps-settings-btn" aria-label="Settings">⚙</button>
      </div>

      <!-- FPS readout (top-left corner; updated ~2×/s by the game) -->
      <div id="ps-fps" aria-hidden="true"></div>

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

        <!-- Tutorial prompt (shown only in tutorial mode) -->
        <div class="ps-panel" id="ps-tut" style="display:none">
          <div class="ps-lbl">Lesson — <span id="ps-tut-name"></span> · step <span id="ps-tut-step"></span></div>
          <div id="ps-tut-text"></div>
          <div id="ps-tut-barwrap"><div id="ps-tut-bar"></div></div>
        </div>

        <!-- Stunt score strip (shown only in stunt mode) -->
        <div class="ps-panel" id="ps-stunt" style="display:none">
          <div><div class="ps-lbl">Score</div><div class="ps-val"><span id="ps-st-score">0</span></div></div>
          <div><div class="ps-lbl">Ring</div><div class="ps-val"><span id="ps-st-ring">1 / 1</span></div></div>
          <div><div class="ps-lbl">Time</div><div class="ps-val"><span id="ps-st-time">0:00</span></div></div>
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
        <!-- Ocean-mission objective (empty = hidden) -->
        <div id="ps-objective"></div>
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
        <div class="ps-menu-keys">◄ ► cycle &middot; Mouse: point to fly &middot; RMB fire &middot; W/S throttle &middot; A/D rudder &middot; G gear &middot; B drop bomb &middot; ESC pause</div>
      </div>

      <!-- Game-mode select: tutorial / sortie / stunt -->
      <div id="ps-mode-menu" class="ps-modal ps-hidden">
        <div class="ps-card">
          <h1>Game mode</h1>
          <p class="ps-sub">Pick how you want to fly, then a chapter within it.</p>
          <div class="ps-map-tile" data-gamemode="tutorial">
            <div class="ps-tile-ico">🎓</div>
            <div>
              <p class="ps-map-name">Flight School</p>
              <p class="ps-map-desc">Bite-size lessons with one goal each: take off, manoeuvre, shoot, bomb. The game tells you what to do and watches you do it.</p>
            </div>
          </div>
          <div class="ps-map-tile" data-gamemode="sortie">
            <div class="ps-tile-ico">🎯</div>
            <div>
              <p class="ps-map-name">Sortie</p>
              <p class="ps-map-desc">The combat missions: clear the bandits over the coastal valley, or defend the fleet and sink the enemy carrier.</p>
            </div>
          </div>
          <div class="ps-map-tile" data-gamemode="stunt">
            <div class="ps-tile-ico">💫</div>
            <div>
              <p class="ps-map-name">Stunt Circuit</p>
              <p class="ps-map-desc">Chase rings for points — through valleys, under bridges, wave-high past the fleet. Bullseyes score extra.</p>
            </div>
          </div>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-menuback="plane">‹ Hangar</button>
          </div>
        </div>
      </div>

      <!-- Tutorial: lesson select -->
      <div id="ps-tut-menu" class="ps-modal ps-hidden">
        <div class="ps-card">
          <h1>Flight School</h1>
          <p class="ps-sub">One goal at a time. Follow the prompt at the top of the screen — it ticks off as you nail each step.</p>
          <div class="ps-map-tile" data-tut="takeoff">
            <div class="ps-tile-ico">🛫</div>
            <div><p class="ps-map-name">1 · First Flight</p><p class="ps-map-desc">Throttle up, lift off, gear up, climb away.</p></div>
          </div>
          <div class="ps-map-tile" data-tut="controls">
            <div class="ps-tile-ico">🕹️</div>
            <div><p class="ps-map-name">2 · Stick &amp; Rudder</p><p class="ps-map-desc">Bank, climb, dive and rudder — the plane goes where you point the mouse.</p></div>
          </div>
          <div class="ps-map-tile" data-tut="guns">
            <div class="ps-tile-ico">🔫</div>
            <div><p class="ps-map-name">3 · Gunnery</p><p class="ps-map-desc">Track a bandit and splash him. He won't shoot back — this time.</p></div>
          </div>
          <div class="ps-map-tile" data-tut="bombs">
            <div class="ps-tile-ico">💣</div>
            <div><p class="ps-map-name">4 · Bombing</p><p class="ps-map-desc">Two wing bombs, one enemy flat-top. Put one on the deck (B to drop).</p></div>
          </div>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-menuback>‹ Modes</button>
          </div>
        </div>
      </div>

      <!-- Stunt: course select -->
      <div id="ps-stunt-menu" class="ps-modal ps-hidden">
        <div class="ps-card">
          <h1>Stunt Circuit</h1>
          <p class="ps-sub">Fly the glowing rings in order — 100 points a ring, 150 for a bullseye, nothing for a miss. The beam of light marks the next one.</p>
          <div class="ps-map-tile" data-stunt="valley">
            <div class="ps-tile-ico">🌉</div>
            <div><p class="ps-map-name">Valley Run</p><p class="ps-map-desc">Low through the central valley and UNDER two road bridges. 31 rings.</p></div>
          </div>
          <div class="ps-map-tile" data-stunt="canyon">
            <div class="ps-tile-ico">🏔️</div>
            <div><p class="ps-map-name">The Canyon</p><p class="ps-map-desc">Its own alpine map: weave the gorge switchbacks slow and tight, sprint the straight, pull hard over the exit ridge. 30 rings.</p></div>
          </div>
          <div class="ps-map-tile" data-stunt="wavetop">
            <div class="ps-tile-ico">🌊</div>
            <div><p class="ps-map-name">Wavetop Circuit</p><p class="ps-map-desc">A slalom off the carrier's bow, wave-high out to the enemy fleet and home. 18 rings.</p></div>
          </div>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-menuback>‹ Modes</button>
          </div>
        </div>
      </div>

      <!-- Sortie: map select + briefing -->
      <div id="ps-map-menu" class="ps-modal ps-hidden">
        <div class="ps-card">
          <h1>Sortie</h1>
          <p class="ps-sub">Select a map, set the opposition, and go hunt the bandits. Watch your hull — they shoot back.</p>
          <div class="ps-map-tile ps-active" id="ps-map-coastal" data-map="coastal">
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
          <div class="ps-map-tile" id="ps-map-ocean" data-map="ocean">
            <svg class="ps-map-svg" viewBox="0 0 148 96" role="img" aria-label="Ocean map preview">
              <rect width="148" height="96" rx="6" fill="#123a4c"/>
              <path d="M0 20 q 18 -6 37 0 t 37 0 t 37 0 t 37 0 V 26 q -18 6 -37 0 t -37 0 t -37 0 t -37 0 Z" fill="#1c4a5c" opacity="0.7"/>
              <path d="M0 58 q 18 -6 37 0 t 37 0 t 37 0 t 37 0 V 64 q -18 6 -37 0 t -37 0 t -37 0 t -37 0 Z" fill="#1c4a5c" opacity="0.7"/>
              <rect x="18" y="66" width="46" height="9" rx="3" fill="#5f6a74"/>
              <rect x="46" y="61" width="8" height="6" rx="1" fill="#7e8b90"/>
              <rect x="92" y="22" width="38" height="8" rx="3" fill="#4a4f48"/>
              <rect x="98" y="17" width="7" height="6" rx="1" fill="#5f6455"/>
              <circle cx="124" cy="26" r="2.6" fill="#c23a32"/>
              <circle cx="86" cy="46" r="1.6" fill="#d9a52e"/>
            </svg>
            <div>
              <p class="ps-map-name">Ocean — Carrier Strike</p>
              <p class="ps-map-desc">Launch off your carrier's deck, sweep the bandits away from the fleet, then take two bombs to the enemy flat-top. Press <strong>B</strong> to drop a bomb — one hit sinks her, but waste both and the strike fails. Stray too far too early and it's your carrier on the seabed.</p>
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
          <p class="ps-hint">Bandits fly a mix of all three types with their real quirks. Lower skill also means <strong>your guns hit harder</strong>. Keys <span class="ps-key">1</span> <span class="ps-key">2</span> <span class="ps-key">3</span> switch skill on this screen.</p>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-menuback>‹ Modes</button>
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
            <button type="button" class="ps-resume-btn" id="ps-end-next" style="display:none">Next lesson ›</button>
          </div>
        </div>
      </div>

      <!-- Pause / settings menu (ESC or the ⚙ button). Aircraft and bandit
           setup are pre-game choices (hangar / sortie screen) — only playback
           settings live here. -->
      <div id="ps-pause" class="ps-hidden">
        <div class="ps-card">
          <button type="button" class="ps-pause-x" id="ps-pause-x" aria-label="Close settings">✕</button>
          <h1 id="ps-pause-title">Paused</h1>
          <div class="ps-tabs" role="tablist">
            <button type="button" class="ps-tab" data-tab="achievements" role="tab" aria-label="Achievements">🏆 <span class="ps-tab-txt">Medals</span></button>
            <button type="button" class="ps-tab ps-tab-active" data-tab="general" role="tab">General</button>
            <button type="button" class="ps-tab" data-tab="graphics" role="tab">Graphics</button>
          </div>
          <div class="ps-tabpane" data-pane="achievements" style="display:none">
            <div id="ps-ach-body" class="ps-ach-body"></div>
          </div>
          <div class="ps-tabpane" data-pane="general">
            <div class="ps-set-row">
              <span class="ps-set-lbl">Master</span>
              <input id="ps-vol" type="range" min="0" max="100" value="50" aria-label="Master volume">
            </div>
            <div class="ps-set-row">
              <span class="ps-set-lbl">Music</span>
              <input id="ps-musicvol" type="range" min="0" max="100" value="60" aria-label="Music volume">
            </div>
            <div class="ps-set-row">
              <span class="ps-set-lbl">SFX</span>
              <input id="ps-sfxvol" type="range" min="0" max="100" value="100" aria-label="Sound effects volume">
            </div>
            <div class="ps-set-row">
              <span class="ps-set-lbl">Camera</span>
              <button type="button" class="ps-diff-btn" data-cam="close">Close</button>
              <button type="button" class="ps-diff-btn" data-cam="medium">Medium</button>
              <button type="button" class="ps-diff-btn" data-cam="far">Far</button>
            </div>
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
            <p class="ps-hint">Aircraft, bandit skill and bandit count are picked before a flight — in the hangar and on the sortie screen.</p>
          </div>
          <div class="ps-tabpane" data-pane="graphics" style="display:none">
            <div class="ps-set-row">
              <span class="ps-set-lbl">Quality</span>
              <button type="button" class="ps-diff-btn" data-gfx="low">Low</button>
              <button type="button" class="ps-diff-btn" data-gfx="medium">Medium</button>
              <button type="button" class="ps-diff-btn" data-gfx="high">High</button>
              <button type="button" class="ps-diff-btn" data-gfx="ultra">Ultra</button>
            </div>
            <p class="ps-hint" id="ps-gfx-hint">Low halves texture and terrain detail and drops shadows. High sharpens shadows and adds richer trees and lighting. Ultra maxes everything and adds reflective waves and real grass — needs a beefy GPU. Changing it reloads the sim.</p>
          </div>
          <div class="ps-menu-row">
            <button type="button" class="ps-back-btn" data-hangar>‹ Hangar</button>
            <button type="button" class="ps-resume-btn" id="ps-resume">Resume (ESC)</button>
          </div>
        </div>
      </div>
      <!-- Achievement-unlock toasts (bottom-left, above the minimap corner) -->
      <div id="ps-ach-toasts" aria-live="polite"></div>
    </div>
    ${styles}
    <script type="application/json" id="ps-ach-boot">${achBoot}</script>
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
