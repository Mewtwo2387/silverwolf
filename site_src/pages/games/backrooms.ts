import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import { assetVersion } from '../../asset-version';

// Backrooms — a first-person Three.js survival-horror wander through seeded,
// procedurally generated levels (Level 0, and Level 37 "the Poolrooms"). All
// the 3D lives in the bundled
// site_src/Assets/backrooms.js (built from backrooms.src.js + its modules);
// this file is the shell: canvas, HUD, menu and the references list.
//
// Fully client-side — nothing is posted anywhere, and the PNG-chaser skin the
// player uploads never leaves the browser (it is read with FileReader and kept
// in localStorage as a data URL, which is why the CSP's `img-src data:` is
// enough and no upload endpoint exists).
const BACKROOMS_JS = path.resolve(import.meta.dir, '..', '..', 'Assets', 'backrooms.js');

// Rendered into the References tab and, near enough verbatim, into the code
// comments of the modules each one informed.
const REFERENCES: { group: string; items: { title: string; href?: string; note: string }[] }[] = [
  {
    group: 'Setting & entities',
    items: [
      {
        title: 'The Backrooms Wiki — Level 0',
        href: 'https://backrooms-wiki.wikidot.com/level-0',
        note: 'Mono-yellow wallpaper, damp brownish-beige berber carpet, buzzing fluorescents that spike and drop, pillar halls and blackout stretches. The palette, the layout variety and the lighting behaviour all come from here.',
      },
      {
        title: 'The Backrooms Wiki — Entity 96, "The Neighborhood Watch"',
        href: 'https://backrooms-wiki.wikidot.com/entity-96',
        note: 'Eye entities with keen sight and touch but no hearing or smell, which disintegrate living matter with a beam of light from the pupil and corrupt nearby electronics. Drives its zero hearing range, its charge-then-fire beam, and the HUD static.',
      },
      {
        title: 'Kane Pixels Backrooms Wiki — The Lifeform',
        href: 'https://kane-pixels-backrooms.fandom.com/wiki/The_Lifeform',
        note: 'Very tall black humanoids of stick-figure, vine-like anatomy; aimless hive hunters that mimic human cries for help using victims\' throats. Shapes the model, the slow gait and the mimic-call lure.',
      },
      {
        title: 'The Backrooms Wiki — Level 37, "Sublimity" (the Poolrooms)',
        href: 'https://backrooms-wiki.wikidot.com/level-37',
        note: 'Interconnected rooms and corridors submerged in lukewarm water; pristine white ceramic tiling everywhere, blue-green water the only other colour; waist-deep in most places with deeper pits scattered through it; excessive pillars, absent ledges, irregular lighting, staircases descending into the pits. That paragraph is the whole terrain generator. Its note that the water keeps a constant minimal rippling when undisturbed is why the surface carries a real (very small) wave sum, and its note that sound drops off abnormally and comes out muted is why that level ducks the mains hum for a water wash.',
      },
      {
        title: 'The Backrooms Wiki — Entity 232, "Drowners"',
        href: 'https://backrooms-wiki.wikidot.com/entity-232',
        note: 'Lanky humanoids in weathered yellow raincoats and rubber boots, with no organs — only brackish water filling every cavity. They lurk submerged indefinitely, grab exposed limbs, and fill the lungs in seconds; anomalously unimpeded in water, easily outmanoeuvred on land, and persistent enough to follow you out. Every one of those clauses is a number in its tuning block.',
      },
      {
        title: 'The Backrooms Wiki — Entity 3, "Smilers"',
        href: 'https://backrooms-wiki.wikidot.com/entity-3',
        note: 'Reflective eyes and a long grin of teeth in the dark, and nothing anyone has ever confirmed about the rest. Passive at close range unless a wanderer panics and retreats or makes a loud noise; survivors get away by holding eye contact and backing off slowly. That is the entity inverted from the chaser — looking at it is the safe state — and it is why the model is a grin and two eyes with no body behind them.',
      },
      {
        title: 'The Backrooms Wiki — Entity 207, "Will o\' Waves"',
        href: 'https://backrooms-wiki.wikidot.com/entity-207',
        note: 'Docile 13–15 cm semi-crustaceans with bioluminescent dorsal spines, travelling in shoals of 50–300 in single file down watery channels; following one tends to lead to safe ground and to exits that are otherwise hard to find, and soft humming encourages them to shine brighter. The one friendly thing in either level, and a working compass.',
      },
      {
        title: 'Garry\'s Mod Wiki — NEXTBOT',
        href: 'https://wiki.facepunch.com/gmod/NEXTBOT',
        note: 'The lineage of the flat-image chaser: navmesh-driven bots with real pathfinding rather than scripted patrol paths.',
      },
    ],
  },
  {
    group: 'AI & game design',
    items: [
      {
        title: 'Nextbot behaviour states — stalk / chase / last-known-position / patrol',
        href: 'https://nicos-nextbots.fandom.com/wiki/Nextbots',
        note: 'The four-state model: sensory line-of-sight and hearing checks, committing to a last-known position after losing the player, then falling back to patrol; randomised routes so the bot never reads as predictable.',
      },
      {
        title: 'Jamis Buck — maze generation & braiding',
        href: 'https://weblog.jamisbuck.org/2011/1/3/maze-generation-braid-mazes.html',
        note: 'Recursive backtracker for a guaranteed-connected perfect maze, then braiding away dead ends so the result reads as a floor plan instead of a puzzle.',
      },
      {
        title: 'Weeping Angels (Doctor Who) — observation-gated movement',
        note: 'The stalk mode\'s core rule: it does not move while you are looking at it, so the threat is created by your own attention.',
      },
    ],
  },
  {
    group: 'Technique',
    items: [
      {
        title: 'Three.js documentation',
        href: 'https://threejs.org/docs/',
        note: 'Renderer, materials and the CanvasTexture path every surface here is drawn into.',
      },
      {
        title: 'Inigo Quilez — value noise & fbm',
        href: 'https://iquilezles.org/articles/fbm/',
        note: 'The tileable value-noise fbm behind the wallpaper, carpet and ceiling textures, and the world-space grime that breaks their repeat.',
      },
      {
        title: 'MDN — Web Audio API',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
        note: 'Every sound is synthesised: mains-hum oscillators, filtered noise for footsteps and fizz, HRTF panners for entity position.',
      },
      {
        title: 'Jerry Tessendorf / Mark Finch — Gerstner (trochoidal) waves, GPU Gems ch. 1',
        href: 'https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models',
        note: 'The Poolrooms\' water surface is a real Gerstner wave sum with deep-water dispersion, shared with this site\'s Wave Simulator (wave-field.js) rather than reimplemented — the same code evaluated on the GPU for the mesh and on the CPU for the height the camera bobs at, so the two can never disagree.',
      },
      {
        title: 'Silverwolf — Wave Simulator',
        href: '/games/wave-sim',
        note: 'Where that wave field came from, with sliders on it. The Poolrooms run it at a few centimetres of amplitude and a 3.4 m wavelength, with expanding ring impulses added on top for everything that enters the water.',
      },
      {
        title: 'Silverwolf — Plane Sim',
        href: '/games/plane-sim',
        note: 'This site\'s existing Three.js game; its bundling, quality-tier and glass-panel UI conventions are reused here.',
      },
    ],
  },
];

export function BackroomsPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
  debug?: boolean;
}) {
  const {
    nonce, lv999, user, debug,
  } = opts;

  const styles = raw(`
<style>
  /* Amber-on-grime palette — this page steps away from the site's cyan so the
     HUD reads as part of Level 0 rather than part of Silverwolf. */
  #br-stage {
    --br-amber: #e6c65c;
    --br-amber-dim: #a08a3c;
    --br-ink: #0c0a06;
    --br-panel: rgba(14, 12, 7, 0.82);
    --br-red: #ff4436;
    position: fixed; inset: 0; overflow: hidden; background: #0c0a06;
    font-family: 'JetBrains Mono', monospace; color: #e8dfc4;
    user-select: none; -webkit-user-select: none;
  }
  #br-canvas { display: block; width: 100%; height: 100%; }
  #br-stage.br-playing { cursor: none; }

  /* Entity-96 interference. A tiny canvas scaled up with nearest-neighbour
     sampling — cheaper than a post-process pass and it looks like a failing
     CRT rather than film grain. */
  #br-static {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; opacity: 0; z-index: 2;
    image-rendering: pixelated; mix-blend-mode: screen;
  }

  .br-vignette {
    position: absolute; inset: 0; pointer-events: none; z-index: 2;
    background: radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.72) 100%);
  }
  #br-hurt {
    position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0;
    background: radial-gradient(ellipse at center, transparent 35%, rgba(120,10,4,0.85) 100%);
    transition: opacity 0.25s;
  }
  #br-flash {
    position: absolute; inset: 0; z-index: 8; display: none; pointer-events: none;
    background: #000 center/contain no-repeat;
  }
  /* Level 37: the tint that drops over everything when your head goes under.
     Driven from the same 0..1 blend as the fog and the audio lowpass, so all
     three cross the surface together. */
  #br-water {
    position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0;
    background:
      radial-gradient(ellipse at center, rgba(18,110,120,0.35) 0%, rgba(6,44,52,0.85) 100%);
    mix-blend-mode: multiply;
  }

  /* ---- chrome ---- */
  .br-corner { position: absolute; top: 1rem; left: 1rem; z-index: 6; display: flex; gap: 0.5rem; }
  .br-btn {
    display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
    padding: 0.4rem 0.7rem; font: inherit; font-size: 0.78rem; text-decoration: none;
    color: #e8dfc4; background: var(--br-panel);
    border: 1px solid rgba(230, 198, 92, 0.3); border-radius: 0.45rem;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .br-btn:hover { border-color: var(--br-amber); color: var(--br-amber); }
  .br-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .br-btn.br-primary {
    background: rgba(230, 198, 92, 0.14); border-color: var(--br-amber); color: var(--br-amber);
    font-size: 0.9rem; padding: 0.6rem 1.1rem;
  }
  .br-btn.br-primary:hover { background: rgba(230, 198, 92, 0.26); }

  /* ---- HUD ---- */
  .br-hud { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
  .br-hud.br-off { display: none; }
  /* Sits under the corner buttons on the LEFT: the test harness panel owns the
     top-right, and a readout hidden behind it is a readout you don't have. */
  .br-readout {
    position: absolute; top: 4.2rem; left: 1rem;
    font-size: 0.72rem; line-height: 1.5; color: rgba(232, 223, 196, 0.75);
    text-shadow: 0 1px 3px #000;
  }
  .br-readout b { color: var(--br-amber); font-weight: 500; }
  .br-stamina {
    position: absolute; left: 50%; bottom: 2.2rem; transform: translateX(-50%);
    width: min(240px, 34vw); height: 3px; border-radius: 2px;
    background: rgba(255,255,255,0.12); overflow: hidden;
  }
  .br-stamina.br-spent { box-shadow: 0 0 8px rgba(255, 68, 54, 0.7); }
  #br-stam-fill { height: 100%; width: 100%; background: var(--br-amber); transition: background 0.3s; }
  .br-stamina.br-spent #br-stam-fill { background: var(--br-red); }
  /* Breath sits directly above stamina and only appears once you have spent
     some, so a full bar is never chrome. */
  .br-breath {
    position: absolute; left: 50%; bottom: 3rem; transform: translateX(-50%);
    width: min(240px, 34vw); height: 3px; border-radius: 2px;
    background: rgba(255,255,255,0.12); overflow: hidden;
  }
  .br-breath.br-off { display: none; }
  .br-breath.br-spent { box-shadow: 0 0 10px rgba(255, 68, 54, 0.8); }
  #br-breath-fill { height: 100%; width: 100%; background: #6fd8e6; transition: background 0.3s; }
  .br-breath.br-spent #br-breath-fill { background: var(--br-red); }
  #br-prompt {
    position: absolute; left: 50%; bottom: 6.2rem; transform: translateX(-50%);
    font-size: 0.74rem; letter-spacing: 0.08em; color: rgba(232,240,240,0.9);
    text-shadow: 0 1px 5px #000; opacity: 0; transition: opacity 0.2s; white-space: nowrap;
  }
  #br-prompt kbd {
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.35);
    border-radius: 0.25rem; padding: 0.05rem 0.35rem; font-family: inherit; font-size: 0.7rem;
  }
  #br-crosshair {
    position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px;
    border-radius: 50%; background: rgba(232, 223, 196, 0.5);
  }
  #br-subtitle {
    position: absolute; left: 50%; bottom: 4.4rem; transform: translateX(-50%);
    font-size: 0.8rem; letter-spacing: 0.04em; color: rgba(232,223,196,0.82);
    text-shadow: 0 1px 4px #000; opacity: 0; transition: opacity 0.4s; text-align: center;
    max-width: 80vw;
  }
  #br-fps {
    position: absolute; left: 1rem; bottom: 0.7rem; font-size: 0.68rem;
    color: rgba(232,223,196,0.4); display: none;
  }

  /* ---- overlays ---- */
  .br-overlay {
    position: absolute; inset: 0; z-index: 7; display: flex; align-items: center; justify-content: center;
    background: rgba(6, 5, 3, 0.86); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    padding: 1.5rem;
  }
  .br-overlay.br-hidden { display: none; }
  .br-card {
    width: min(680px, 94vw); max-height: 88vh; overflow-y: auto;
    background: linear-gradient(160deg, rgba(28,24,12,0.96), rgba(12,10,6,0.96));
    border: 1px solid rgba(230, 198, 92, 0.28); border-radius: 0.8rem;
    padding: 1.4rem 1.5rem 1.5rem; box-shadow: 0 24px 70px rgba(0,0,0,0.7);
  }
  .br-card h1 {
    margin: 0; font-size: 1.5rem; letter-spacing: 0.16em; color: var(--br-amber);
    text-shadow: 0 0 18px rgba(230, 198, 92, 0.35);
  }
  .br-card .br-tag { margin: 0.15rem 0 1rem; font-size: 0.72rem; color: rgba(232,223,196,0.5); letter-spacing: 0.08em; }
  .br-card h2 { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--br-amber-dim); margin: 1.2rem 0 0.5rem; }
  .br-card h2:first-of-type { margin-top: 0.4rem; }
  .br-card p { font-size: 0.82rem; line-height: 1.55; color: rgba(232,223,196,0.82); margin: 0 0 0.7rem; }

  .br-tabs { display: flex; gap: 0.25rem; margin: 0 0 1rem; border-bottom: 1px solid rgba(230,198,92,0.18); flex-wrap: wrap; }
  .br-tab {
    padding: 0.45rem 0.8rem; font: inherit; font-size: 0.76rem; cursor: pointer;
    background: transparent; border: none; border-bottom: 2px solid transparent;
    color: rgba(232,223,196,0.55); letter-spacing: 0.06em; text-transform: uppercase;
  }
  .br-tab:hover { color: var(--br-amber); }
  .br-tab.br-active { color: var(--br-amber); border-bottom-color: var(--br-amber); }
  .br-pane { display: none; }
  .br-pane.br-active { display: block; }

  .br-field { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; margin: 0.55rem 0; font-size: 0.8rem; }
  .br-field > label { color: rgba(232,223,196,0.8); flex: 1; min-width: 0; }
  .br-field .br-val { color: var(--br-amber); font-size: 0.76rem; min-width: 3.4rem; text-align: right; }
  .br-field input[type=range] { width: 45%; accent-color: var(--br-amber); }
  .br-field input[type=checkbox] { accent-color: var(--br-amber); width: 16px; height: 16px; cursor: pointer; }
  .br-field input[type=text], .br-field select {
    font: inherit; font-size: 0.78rem; padding: 0.35rem 0.5rem; color: #e8dfc4;
    background: rgba(0,0,0,0.45); border: 1px solid rgba(230,198,92,0.28); border-radius: 0.35rem;
    min-width: 0; width: 45%;
  }
  .br-field input[type=text]:focus, .br-field select:focus { outline: none; border-color: var(--br-amber); }
  .br-hint { font-size: 0.7rem; color: rgba(232,223,196,0.45); line-height: 1.5; margin: 0.2rem 0 0.9rem; }

  .br-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; margin-top: 1.1rem; }
  .br-keys { display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 0.9rem; font-size: 0.8rem; }
  .br-keys kbd {
    background: rgba(230,198,92,0.12); border: 1px solid rgba(230,198,92,0.3); border-radius: 0.25rem;
    padding: 0.1rem 0.4rem; font-family: inherit; font-size: 0.74rem; color: var(--br-amber); white-space: nowrap;
  }
  .br-keys span { color: rgba(232,223,196,0.75); }

  .br-ent { border: 1px solid rgba(230,198,92,0.16); border-radius: 0.5rem; padding: 0.7rem 0.85rem; margin-bottom: 0.7rem; }
  .br-ent-head { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; }
  .br-ent-head strong { color: var(--br-amber); font-size: 0.85rem; font-weight: 500; }
  .br-ent p { font-size: 0.75rem; margin: 0.4rem 0 0; color: rgba(232,223,196,0.65); }
  .br-skin { display: flex; align-items: center; gap: 0.7rem; margin-top: 0.6rem; }
  .br-skin img {
    width: 52px; height: 52px; object-fit: contain; background: #111;
    border: 1px solid rgba(230,198,92,0.25); border-radius: 0.3rem;
  }
  .br-skin input[type=file] { display: none; }

  .br-refs li { margin-bottom: 0.85rem; font-size: 0.78rem; line-height: 1.5; }
  .br-refs a { color: var(--br-amber); text-decoration: none; border-bottom: 1px dotted rgba(230,198,92,0.4); }
  .br-refs a:hover { border-bottom-style: solid; }
  .br-refs ul { list-style: none; padding: 0; margin: 0 0 0.4rem; }
  .br-refs .br-note { color: rgba(232,223,196,0.6); display: block; margin-top: 0.15rem; }

  /* ---- end card ---- */
  #br-end .br-card { text-align: center; width: min(460px, 92vw); }
  #br-end h1 { font-size: 1.8rem; }
  #br-end.br-won h1 { color: #8ef0a0; text-shadow: 0 0 22px rgba(140,240,160,0.4); }
  #br-end.br-lost h1 { color: var(--br-red); text-shadow: 0 0 22px rgba(255,68,54,0.4); }
  #br-end .br-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 1rem; font-size: 0.78rem; margin: 1rem 0; }
  #br-end .br-stats span { color: rgba(232,223,196,0.55); text-align: right; }
  #br-end .br-stats b { color: var(--br-amber); font-weight: 500; text-align: left; }

  /* ---- loading ---- */
  #br-loading { position: absolute; inset: 0; z-index: 9; display: flex; align-items: center; justify-content: center; background: #0c0a06; }
  #br-loading.br-hidden { display: none; }
  /* The roster panes are plain divs, so neither .br-overlay.br-hidden nor the
     rule above reached them and both levels' rosters rendered at once. Scoped
     by id rather than a bare .br-hidden, which would lose to .br-overlay's own
     display on specificity order. */
  #br-roster-lobby.br-hidden, #br-roster-pools.br-hidden { display: none; }
  #br-loading div { text-align: center; }
  #br-loading .br-l-title { font-size: 1.1rem; letter-spacing: 0.3em; color: var(--br-amber); }
  #br-loading .br-l-sub { font-size: 0.72rem; color: rgba(232,223,196,0.45); margin-top: 0.6rem; }

  /* ---- debug harness ---- */
  #br-debug {
    position: absolute; top: 1rem; right: 1rem; z-index: 6; width: 236px;
    background: var(--br-panel); border: 1px solid rgba(230,198,92,0.25); border-radius: 0.5rem;
    padding: 0.6rem 0.7rem; font-size: 0.7rem; display: none;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    max-height: calc(100vh - 2rem); overflow-y: auto;
  }
  #br-debug.br-on { display: block; }
  #br-debug h3 { margin: 0 0 0.4rem; font-size: 0.64rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--br-amber-dim); }
  #br-map { width: 100%; height: auto; display: block; background: #070603; border-radius: 0.3rem; image-rendering: pixelated; }
  .br-dbg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; margin: 0.5rem 0; }
  .br-dbg-grid button, #br-debug > button {
    font: inherit; font-size: 0.66rem; padding: 0.32rem 0.3rem; cursor: pointer;
    background: rgba(230,198,92,0.1); color: #e8dfc4;
    border: 1px solid rgba(230,198,92,0.25); border-radius: 0.3rem;
  }
  .br-dbg-grid button:hover, #br-debug > button:hover { border-color: var(--br-amber); color: var(--br-amber); }
  .br-dbg-grid button.br-on-btn { background: rgba(230,198,92,0.3); color: var(--br-amber); border-color: var(--br-amber); }
  /* Harness controls that only mean something in the Poolrooms. */
  #br-debug.br-dry .br-pools-only { display: none; }
  #br-dbg-ents { font-size: 0.64rem; line-height: 1.45; color: rgba(232,223,196,0.7); }
  #br-dbg-ents b { color: var(--br-amber); font-weight: 500; }

  @media (max-width: 640px) {
    .br-card { padding: 1.1rem 1rem 1.2rem; }
    #br-debug { width: 168px; }
    .br-field { flex-wrap: wrap; }
    .br-field input[type=range], .br-field input[type=text], .br-field select { width: 100%; }
  }
</style>
  `);

  const refsMarkup = html`
    <div class="br-refs">
      <p>
        The Backrooms is a collaborative fiction, and this level is built out of other
        people's descriptions of it. Everything below informed something concrete — the
        palette, an entity's senses, or the algorithm behind a system.
      </p>
      ${REFERENCES.map((section) => html`
        <h2>${section.group}</h2>
        <ul>
          ${section.items.map((item) => html`
            <li>
              ${item.href
    ? html`<a href="${item.href}" target="_blank" rel="noopener noreferrer">${item.title}</a>`
    : html`<strong>${item.title}</strong>`}
              <span class="br-note">${item.note}</span>
            </li>
          `)}
        </ul>
      `)}
      <p class="br-hint">
        No assets are downloaded or bundled from any of these sources: every texture, model
        and sound in this game is generated in your browser from code.
      </p>
    </div>
  `;

  const body = html`
    <div id="br-stage">
      <canvas id="br-canvas" aria-label="Backrooms — first person survival horror"></canvas>
      <canvas id="br-static" width="160" height="90" aria-hidden="true"></canvas>
      <div class="br-vignette" aria-hidden="true"></div>
      <div id="br-hurt" aria-hidden="true"></div>
      <div id="br-water" aria-hidden="true"></div>
      <div id="br-flash" aria-hidden="true"></div>

      <div class="br-corner">
        <a class="br-btn" href="/games">← Games</a>
        <button type="button" class="br-btn" id="br-menu-btn" aria-label="Menu">☰ Menu</button>
      </div>

      <div class="br-hud br-off" id="br-hud" aria-hidden="true">
        <div class="br-readout">
          <div>SEED <b id="br-hud-seed">—</b></div>
          <div>TIME <b id="br-hud-time">0:00</b></div>
          <div id="br-hud-depth">EXPLORED <b>0%</b></div>
        </div>
        <div class="br-stamina" id="br-stamina"><div id="br-stam-fill"></div></div>
        <div class="br-breath br-off" id="br-breath"><div id="br-breath-fill"></div></div>
        <div id="br-prompt"><kbd>SPACE</kbd> climb &middot; <kbd>SHIFT</kbd> descend</div>
        <div id="br-crosshair"></div>
        <div id="br-subtitle"></div>
        <div id="br-fps">— fps</div>
      </div>

      <div id="br-debug" aria-hidden="true">
        <h3>Test harness</h3>
        <canvas id="br-map" width="220" height="220"></canvas>
        <div class="br-dbg-grid">
          <button type="button" data-dbg="exit">→ Exit</button>
          <button type="button" data-dbg="spawn">→ Spawn</button>
          <button type="button" data-dbg="random">→ Random</button>
          <button type="button" data-dbg="nearest">→ Entity</button>
          <button type="button" data-dbg="here">Entity → me</button>
          <button type="button" data-dbg="scare">Force scare</button>
          <button type="button" data-dbg="noclip">Noclip</button>
          <button type="button" data-dbg="freeze">Freeze AI</button>
          <button type="button" data-dbg="invuln">Invuln</button>
          <button type="button" data-dbg="reveal">Reveal map</button>
          <button type="button" data-dbg="lights">Lights up</button>
          <button type="button" data-dbg="win">Win now</button>
          <button type="button" class="br-pools-only" data-dbg="water">→ Deep water</button>
          <button type="button" class="br-pools-only" data-dbg="ladder">→ Ladder</button>
          <button type="button" class="br-pools-only" data-dbg="breath">Empty lungs</button>
        </div>
        <div id="br-dbg-ents">—</div>
      </div>

      <div id="br-loading">
        <div>
          <div class="br-l-title" id="br-l-title">LEVEL 0</div>
          <div class="br-l-sub" id="br-load-sub">generating…</div>
        </div>
      </div>

      <div class="br-overlay br-hidden" id="br-menu">
        <div class="br-card">
          <h1>THE BACKROOMS</h1>
          <p class="br-tag" id="br-tag">LEVEL 0 &middot; "THE LOBBY" &middot; SURVIVAL DIFFICULTY: LOW</p>

          <div class="br-tabs" role="tablist">
            <button type="button" class="br-tab br-active" data-tab="play">Play</button>
            <button type="button" class="br-tab" data-tab="entities">Entities</button>
            <button type="button" class="br-tab" data-tab="settings">Settings</button>
            <button type="button" class="br-tab" data-tab="controls">Controls</button>
            <button type="button" class="br-tab" data-tab="refs">References</button>
          </div>

          <div class="br-pane br-active" data-pane="play">
            <p>
              You noclipped out of reality and landed here. Roughly six hundred million square
              miles of damp carpet, buzzing fluorescents and the smell of old moist carpet —
              and something else, wandering it with you.
            </p>
            <p>Find the exit. It is marked. It is a long way off.</p>
            <div class="br-field">
              <label for="br-level">Level</label>
              <select id="br-level">
                <option value="lobby">Level 0 &mdash; "The Lobby"</option>
                <option value="pools">Level 37 &mdash; "Sublimity", the Poolrooms</option>
              </select>
            </div>
            <p class="br-hint">
              The Poolrooms are the same generator with a height added to every cell and
              most of them flooded. You wade, you swim, you drown &mdash; and the pool wall
              is 1.35&nbsp;m, so the only ways back onto the tile are the ladders and the
              occasional flight of steps. Different level, different residents.
            </p>
            <div class="br-field">
              <label for="br-seed">Seed</label>
              <input type="text" id="br-seed" maxlength="32" spellcheck="false" autocomplete="off" />
              <button type="button" class="br-btn" id="br-reseed">⟳</button>
            </div>
            <div class="br-field">
              <label for="br-size">Level size</label>
              <select id="br-size">
                <option value="18">Small — a quick wander</option>
                <option value="26" selected>Standard</option>
                <option value="34">Large — properly lost</option>
                <option value="42">Vast — bring supplies</option>
              </select>
            </div>
            <p class="br-hint">
              Same seed, same level, every time — the layout, the stains and which tubes flicker
              are all derived from it. Every generated level is verified solvable before you
              are dropped into it.
            </p>
            <div class="br-actions">
              <button type="button" class="br-btn br-primary" id="br-start">Enter the Backrooms</button>
              <button type="button" class="br-btn" id="br-regen">Regenerate level</button>
            </div>
          </div>

          <div class="br-pane" data-pane="entities">
            <p class="br-hint">
              Nothing here knows where you are. Each entity tracks a <em>belief</em> about your
              position, updated only by what it can actually sense — so breaking line of sight,
              crouching, and staying quiet genuinely work.
              <a href="/games/backrooms/entities">Look at them properly →</a>
            </p>

            <div id="br-roster-lobby">
            <div class="br-ent">
              <div class="br-ent-head">
                <strong>PNG chaser</strong>
                <label class="br-field" style="margin:0">
                  <input type="checkbox" id="br-e-chaser" aria-label="Spawn the PNG chaser" checked />
                </label>
              </div>
              <p>
                A flat image that moves with intent. Sees in a wide cone, hears you, and gives
                up slowly. Lethal on contact — except during a jumpscare, which only costs you
                your composure.
              </p>
              <div class="br-field">
                <label for="br-chaser-mode">Behaviour</label>
                <select id="br-chaser-mode">
                  <option value="auto">Auto — mixes all four</option>
                  <option value="stalk">Stalk — keeps its distance, freezes when watched</option>
                  <option value="chase">Chase — runs you down</option>
                  <option value="patrol">Patrol — sweeps your last known area</option>
                  <option value="jumpscare">Jumpscare — repeated ambushes</option>
                </select>
              </div>
              <div class="br-skin">
                <img id="br-skin-preview" alt="Current PNG chaser skin" />
                <div>
                  <button type="button" class="br-btn" id="br-skin-btn">Upload skin</button>
                  <button type="button" class="br-btn" id="br-skin-clear">Reset</button>
                  <input type="file" id="br-skin-file" accept="image/png,image/jpeg,image/webp,image/gif" />
                </div>
              </div>
              <p class="br-hint" style="margin-bottom:0">
                Your image stays on this device — it is read in the browser and saved to local
                storage, never uploaded. PNGs with transparency work best. Max 4&nbsp;MB.
              </p>
            </div>

            <div class="br-ent">
              <div class="br-ent-head">
                <strong>Lifeform</strong>
                <label class="br-field" style="margin:0">
                  <input type="checkbox" id="br-e-lifeform" aria-label="Spawn the Lifeform" checked />
                </label>
              </div>
              <p>
                Eleven feet of black tendrils on stick-figure legs. Nearly blind, but it hears
                everything and never loses interest — and it calls out in a voice that is not
                its own to draw you toward it. Slow enough to walk away from, if you notice.
              </p>
            </div>

            <div class="br-ent">
              <div class="br-ent-head">
                <strong>Entity 96 — "The Neighborhood Watch"</strong>
                <label class="br-field" style="margin:0">
                  <input type="checkbox" id="br-e-watcher" aria-label="Spawn the Entity 96" checked />
                </label>
              </div>
              <p>
                A drifting eye with keen sight and no hearing at all. It does not chase; it
                looks at you, charges, and turns you to dust. Break its line of sight and the
                lock drops. Your HUD will corrupt as it gets close.
              </p>
            </div>
            </div>

            <div id="br-roster-pools" class="br-hidden">
              <p class="br-hint">
                Canon Level 37 is famously empty &mdash; "no encounters with entities
                recorded". These three are documented Backrooms entities brought here from
                elsewhere in the mythos, each chosen because its behaviour only makes sense
                in water or in the dark.
              </p>

              <div class="br-ent">
                <div class="br-ent-head">
                  <strong>Drowner &mdash; Entity 232</strong>
                  <label class="br-field" style="margin:0">
                    <input type="checkbox" id="br-e-drowner" aria-label="Spawn the Drowner" checked />
                  </label>
                </div>
                <p>
                  A lanky grey thing in a weathered yellow raincoat that lies on the bottom of
                  a pit indefinitely and comes up when something swims over it. In water it is
                  faster than you can swim; on tile it lumbers slower than you walk. It grabs,
                  and then your lungs fill.
                </p>
                <p class="br-hint" style="margin-bottom:0">
                  It gives itself away: while it lurks it disturbs the surface above itself.
                  A patch of water rippling with nothing in it is the warning. If it takes
                  hold, thrash &mdash; <kbd>A</kbd>/<kbd>D</kbd>, back and forth.
                </p>
              </div>

              <div class="br-ent">
                <div class="br-ent-head">
                  <strong>Smiler &mdash; Entity 3</strong>
                  <label class="br-field" style="margin:0">
                    <input type="checkbox" id="br-e-smiler" aria-label="Spawn the Smiler" checked />
                  </label>
                </div>
                <p>
                  Eyes and teeth in the unlit stretches, and nothing else &mdash; nobody has
                  ever established what the rest of one looks like. The exact inverse of the
                  chaser: it will not move while you are looking at it. Turn your back, or
                  sprint anywhere near it, and it comes.
                </p>
                <p class="br-hint" style="margin-bottom:0">
                  It cannot route through a lit room at all. Back away slowly, facing it,
                  into the light.
                </p>
              </div>

              <div class="br-ent">
                <div class="br-ent-head">
                  <strong>Will o' Waves &mdash; Entity 207</strong>
                  <label class="br-field" style="margin:0">
                    <input type="checkbox" id="br-e-willo" aria-label="Spawn the Will o' Waves" checked />
                  </label>
                </div>
                <p>
                  A shoal of bioluminescent shrimp travelling in single file down the flooded
                  channels. Entirely harmless, and a good omen: they swim toward the way out.
                  Hold <kbd>H</kbd> to hum and they will brighten and come to you.
                </p>
                <p class="br-hint" style="margin-bottom:0">
                  Two catches. Their route is a swimmer's route, not a safe one &mdash; and a
                  Smiler is drawn to light.
                </p>
              </div>
            </div>
          </div>

          <div class="br-pane" data-pane="settings">
            <h2>View</h2>
            <div class="br-field">
              <label for="br-sens">Mouse sensitivity</label>
              <input type="range" id="br-sens" min="0.2" max="3" step="0.05" />
              <span class="br-val" id="br-sens-v">—</span>
            </div>
            <div class="br-field">
              <label for="br-fov">Field of view</label>
              <input type="range" id="br-fov" min="60" max="105" step="1" />
              <span class="br-val" id="br-fov-v">—</span>
            </div>
            <div class="br-field">
              <label for="br-fog">Fog density</label>
              <input type="range" id="br-fog" min="0.01" max="0.12" step="0.002" />
              <span class="br-val" id="br-fog-v">—</span>
            </div>
            <div class="br-field">
              <label for="br-bob">Head bob</label>
              <input type="checkbox" id="br-bob" />
            </div>
            <div class="br-field">
              <label for="br-invert">Invert vertical look</label>
              <input type="checkbox" id="br-invert" />
            </div>

            <h2>Audio</h2>
            <div class="br-field">
              <label for="br-vol">Volume</label>
              <input type="range" id="br-vol" min="0" max="1" step="0.02" />
              <span class="br-val" id="br-vol-v">—</span>
            </div>
            <div class="br-field">
              <label for="br-mute">Mute</label>
              <input type="checkbox" id="br-mute" />
            </div>

            <h2>Performance</h2>
            <div class="br-field">
              <label for="br-quality">Quality</label>
              <select id="br-quality">
                <option value="low">Low — flat lighting, no normal maps</option>
                <option value="high" selected>High — normal-mapped surfaces</option>
              </select>
            </div>
            <div class="br-field">
              <label for="br-fpson">Show frame rate</label>
              <input type="checkbox" id="br-fpson" />
            </div>

            <h2>Accessibility &amp; comfort</h2>
            <div class="br-field">
              <label for="br-noscare">Disable jumpscares</label>
              <input type="checkbox" id="br-noscare" />
            </div>
            <div class="br-field">
              <label for="br-noflicker">Reduce light flicker</label>
              <input type="checkbox" id="br-noflicker" />
            </div>
            <p class="br-hint">
              Reduced flicker also relaxes the strobing during a scare. The flicker pattern is
              part of the level's seed, so this changes how it looks, not what it is.
            </p>

            <h2>Developer</h2>
            <div class="br-field">
              <label for="br-debugon">Test harness (map, teleports, noclip)</label>
              <input type="checkbox" id="br-debugon" ${debug ? 'checked' : ''} />
            </div>
            <p class="br-hint">
              Opens a live top-down map with teleports and AI controls, and exposes
              <code>window.__backrooms</code> for scripted testing. Also available at
              <code>?debug=1</code>.
            </p>
          </div>

          <div class="br-pane" data-pane="controls">
            <div class="br-keys">
              <kbd>W A S D</kbd><span>Move</span>
              <kbd>Mouse</kbd><span>Look around</span>
              <kbd>Ctrl</kbd><span>Hold to sprint — fast, and very loud</span>
              <kbd>Shift</kbd><span>Hold to crouch — slow, low, and nearly silent</span>
              <kbd>Space</kbd><span>Jump &middot; in the Poolrooms, climb a ladder or kick for the surface</span>
              <kbd>Shift</kbd><span>In deep water, dive &middot; on a ladder, climb down</span>
              <kbd>H</kbd><span>Hum &mdash; calls a shoal of Will o' Waves, and is heard by everything else</span>
              <kbd>A</kbd> <kbd>D</kbd><span>Thrash left and right to tear out of a Drowner's grip</span>
              <kbd>Esc</kbd><span>Release the mouse / open this menu</span>
              <kbd>M</kbd><span>Toggle the test harness (when enabled)</span>
              <kbd>R</kbd><span>Restart this level</span>
            </div>
            <p class="br-hint" style="margin-top:1rem">
              Sound is the main thing you leak. Sprinting can be heard from most of a wing
              away; crouching almost nowhere. If something is hunting you, stopping moving is
              often better than running further.
            </p>
            <p class="br-hint">
              In the Poolrooms the water takes your options away rather than adding any: you
              cannot sprint in it, wading is loud, and treading water burns stamina you cannot
              get back until you are out. When the stamina goes, you stop floating &mdash;
              and then the breath meter starts.
            </p>
          </div>

          <div class="br-pane" data-pane="refs">${refsMarkup}</div>

          <div class="br-actions">
            <button type="button" class="br-btn" id="br-resume" style="display:none">Resume</button>
          </div>
        </div>
      </div>

      <div class="br-overlay br-hidden" id="br-end">
        <div class="br-card">
          <h1 id="br-end-title">—</h1>
          <p id="br-end-msg"></p>
          <div class="br-stats">
            <span>Seed</span><b id="br-end-seed">—</b>
            <span>Time</span><b id="br-end-time">—</b>
            <span>Explored</span><b id="br-end-explored">—</b>
            <span>Shortest route</span><b id="br-end-route">—</b>
          </div>
          <div class="br-actions" style="justify-content:center">
            <button type="button" class="br-btn br-primary" id="br-again">Try again</button>
            <button type="button" class="br-btn" id="br-newlevel">New level</button>
            <button type="button" class="br-btn" id="br-end-menu">Menu</button>
          </div>
        </div>
      </div>

      <div class="br-overlay br-hidden" id="br-error">
        <div class="br-card">
          <h1>WEBGL UNAVAILABLE</h1>
          <p>Your browser or GPU can't run 3D graphics, so the Backrooms can't load.</p>
        </div>
      </div>
    </div>
    ${styles}
    <script type="module" nonce="${nonce}" src="/static/backrooms.js?v=${assetVersion(BACKROOMS_JS)}"></script>
  `;

  return Layout({
    title: 'Silverwolf — The Backrooms',
    body: body as any,
    nonce,
    lv999,
    user,
    fullscreen: true,
  });
}
