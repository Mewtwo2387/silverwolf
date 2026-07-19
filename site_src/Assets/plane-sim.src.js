// Plane Sim — a Three.js prop-plane flight simulator, modelled after a
// Supermarine Spitfire. Bundled (with three) into a self-hosted static asset
// (`plane-sim.js`) via `bun build`, exactly like app.src.js → app.js, because
// the site CSP is `script-src 'self'` and forbids CDNs. Loaded by
// site_src/pages/games/plane-sim.ts as a `<script type="module">`.
//
// The flight sim is entirely client-side. The one exception is achievements:
// when logged in, the game posts semantic gameplay events (a kill, a lesson
// passed, a sortie cleared, a stunt run) to /games/plane-sim/stats, which the
// server validates + stores; play works fine logged out, just untracked.
// Coordinates are metres,
// Y is up, and the aircraft's local forward is -Z (so the chase camera sits on
// +Z behind it and the plane's right wing, +X, reads as screen-right).
//
// Flight model (arcade but plausible): a single world-space velocity vector is
// pushed each frame by thrust (along the nose), gravity, drag (against
// velocity) and lift (along the wing's up axis). Lift uses a real-ish lift
// curve driven by angle-of-attack, which is what makes a too-slow or
// over-pulled wing STALL. On top of that sits the "instructor": the mouse
// points AT something on screen and a pursuit controller (the same one the AI
// uses) works the virtual stick to fly the nose there — so the plane goes
// where you point, banking into coordinated turns by itself, instead of the
// player juggling raw roll/pitch rates.
//
// The world is a ~12×12 km bordered box of procedural terrain (see
// plane-sim-terrain.js): a flat airfield valley in the middle rising to ridged
// mountains near the border, with lakes, instanced forests and rock fields.
//
// TUNING: all the feel constants live in the CFG block below.

import * as THREE from 'three';
import {
  buildAircraft, applyControlSurfaces, setPropBlur, makeHangar, makeControlTower,
  makeWindsock, makeFuelTank, makeBowser, makeNissenHut, PLANE_INFO, planeSpecs, restHeight,
  makePineCanopyGeo, makeBroadleafCanopyGeo, makeConiferCanopyGeo, makeBroadleafTrunkGeo,
  makeCarrier, makeBomb, mountWingBombs, CARRIER, makeBridge, makeCabin, makeJetty,
} from './plane-sim-models.js';
import {
  TERRAIN, terrainHeight, canyonHeight, forestMask, buildTerrain, buildWater, smoothstep, fbm,
} from './plane-sim-terrain.js';
import { GFX, GFX_LEVEL, GFX_LEVELS, loadSceneryTexture } from './plane-sim-quality.js';
import { Water } from 'three/addons/objects/Water.js';
import { buildGrassField } from './plane-sim-grass.js';
import {
  computeAchievements, unlockedIds, CATEGORIES, TIER_META,
} from './plane-achievements.js';

(() => {
  'use strict';

  const canvas = document.getElementById('ps-canvas');
  if (!canvas) return;

  // ---- WebGL guard: show a graceful message instead of a blank screen ----
  let renderer;
  try {
    // logarithmicDepthBuffer: the scene spans 0.5 m..26 km, and a plain 24-bit
    // depth buffer has almost no precision left at lake distance — shorelines
    // shimmer/z-fight. Log depth spreads precision evenly across the range.
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: GFX.antialias, powerPreference: 'high-performance', logarithmicDepthBuffer: true,
    });
  } catch (e) {
    const ov = document.getElementById('ps-overlay');
    if (ov) ov.innerHTML = '<div class="ps-card"><h2>WebGL unavailable</h2>'
      + '<p>Your browser or GPU can’t run 3D graphics, so Plane Sim can’t start.</p></div>';
    return;
  }

  // ============================================================ CONFIG ====
  const CFG = {
    G: 9.81, // gravity (m/s^2)

    // Aero shared by every airframe. The per-type numbers (thrust, lift,
    // parasitic drag, pitch/roll rates, control-authority speed, guns, hull)
    // live in PLANE_TYPES below — one stat block per flyable aircraft.
    THROTTLE_RATE: 0.6, // throttle units per second while holding W/S
    CL_SLOPE: 5.2, // lift-curve slope (per radian of AoA)
    A_STALL: 0.32, // stall angle of attack (rad, ~18°)
    DRAG_IND: 0.0008, // induced drag (× CL²) — bleeds speed in hard turns
    DRAG_GEAR: 0.00060, // extra parasitic drag while the undercarriage is down
    YAW_RATE: 1.0, // rudder authority (rad/s at full effectiveness)

    // Handling feel (see flightAssist) — GRIP rotates the velocity vector
    // toward where the nose points (so the plane goes where you aim instead of
    // sliding sideways); TURN_COUPLING makes a bank carve a coordinated turn.
    GRIP: 4.4, // velocity-vector alignment rate (1/s)
    TURN_COUPLING: 0.7, // bank-to-turn yaw authority (rad/s, scaled by bank & airspeed)

    // World
    BORDER: 6000, // half-extent of the play area (a 12 km box)
    CEIL: 2600, // altitude cap (m)
    GROUND_Y: 1.35, // plane-origin height above the deck when the wheels touch
    RUNWAY_LEN: 760,
    RUNWAY_W: 38,

    // Camera chase rig: lerp factor; the back/up offsets come from the
    // player-selectable CAM_PRESETS below (C key / pause menu).
    CAM_LERP: 0.12,

    // Guns (shared; per-type fire rate/damage/spread/range live in PLANE_TYPES)
    TRACER_SPEED: 520, // m/s muzzle velocity relative to the plane
    TRACER_LIFE: 1.3,
    LEAD_MAX: 1250, // show the lead pipper for targets within this range

    // Combat / AI enemies. The bandits fly the SAME flight model as the player,
    // each with its own airframe's stats, so they're bound by the same
    // stall/turn/speed limits — deliberately not over-assisted. Their gunnery is
    // only as good as their nose-tracking (they fire along the nose + jitter, no
    // aimbot lead), and they pull the trigger slower than the player.
    GUN_DMG: 3, // bandit damage per round (flat: difficulty is the balance knob)
    HITBOX_R: 8, // simplified spherical hitbox radius around any plane (m)
    RADAR_RANGE: 1700, // within this, radar shows true relative pos; beyond -> rim blip
    AI_AIM_JITTER: 0.012, // base rad of spread per shot (scaled by difficulty + personality)
    AI_LEAD: 520, // m/s used to lead the target while STEERING (~tracer speed)
    ENEMY_PAINT: 0x6e7378, // any non-null paint -> bandit grey camo scheme
  };

  const KT = 1.94384; // m/s -> knots
  const FT = 3.28084; // m -> feet
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

  // ---- Maps. 'coastal' is the original airfield valley; 'ocean' is open sea
  //      with two WW2 carrier groups — take off from yours, defend it from the
  //      bandits, then fly out and put a bomb into the enemy's deck. Selected
  //      on the sortie screen; remembered. ----
  const OCEAN = {
    FLOOR: -80, // seabed (never seen; keeps every ground query "over water")
    ALLY: { x: 0, z: 0 }, // your carrier — the spawn deck (waterline origin)
    ENEMY: { x: 950, z: -4700 }, // the strike target, a flight out to the NNE
    DEFEND_R: 2600, // stray farther than this while bandits live and...
    ABANDON_S: 12, // ...this many seconds later your carrier is lost
  };
  const validMap = (n) => n === 'coastal' || n === 'ocean';
  let mapName = (() => {
    try { const m = localStorage.getItem('ps-map'); return validMap(m) ? m : 'coastal'; } catch (_) { return 'coastal'; }
  })();

  // Ocean-mission state: phase 1 'defend' (splash every bandit near the fleet;
  // stray too long and your carrier is lost), phase 2 'strike' (two wing bombs,
  // one deck hit sinks the enemy carrier).
  let missionPhase = 'defend';
  let bombs = 2; // bombs still on the racks
  let awayT = 0; // seconds spent outside DEFEND_R during 'defend'
  let enemySinking = 0; // >0 = sink-animation clock (bomb hit landed)
  let sinkVictory = false; // victory() already fired for this sinking
  const liveBombs = []; // free-falling bombs

  // ---- Game modes. 'sortie' is the combat game (the original); 'tutorial'
  //      runs bite-size scripted lessons with one goal per step; 'stunt' is a
  //      ring-chase time trial. Chosen on the mode screen after the hangar,
  //      then a chapter within it. `tut`/`stunt` hold the live chapter state. ----
  let gameMode = 'sortie';
  let tut = null; // { id, def, step, holdT, hitFlag }
  let stunt = null; // { id, def, rings[], i, score, hits, t, prev }

  // Tutorial chapters. Each step is one prompt + a `done()` check evaluated
  // every frame (held for `hold` seconds where a sustained input is the point).
  // The checks close over the sim state declared further down — they only run
  // mid-flight, long after everything is initialised.
  const TUT = {
    takeoff: {
      label: 'First Flight',
      desc: 'Throttle up, lift off, gear up, climb away.',
      map: 'coastal',
      outro: 'Wheels up and climbing — that’s a textbook departure.',
      steps: [
        { text: 'Hold W to open the throttle to 100%', done: () => throttle > 0.95, prog: () => throttle / 0.95 },
        { text: 'Let her roll — past ~100 kn ease the mouse up gently to lift off', done: () => !onGround && plane.position.y > 6, hold: 0.8 },
        { text: 'Press G to raise the undercarriage', done: () => !gearDown },
        { text: 'Climb above 500 ft (150 m)', done: () => plane.position.y - TERRAIN.WATER_Y > 152, prog: () => (plane.position.y - TERRAIN.WATER_Y) / 152 },
      ],
    },
    controls: {
      label: 'Stick & Rudder',
      desc: 'Bank, climb, dive and rudder — the plane goes where you point.',
      map: 'coastal',
      spawn: { x: 0, y: 350, z: -900, hdg: 0, speed: 110 },
      outro: 'Smooth. You now out-fly half the bandits already.',
      steps: [
        { text: 'The plane flies where the mouse points. Move it RIGHT and hold a banked turn', done: () => bankNow() > 0.55, hold: 0.8 },
        { text: 'Now roll into a LEFT turn and hold it', done: () => bankNow() < -0.55, hold: 0.8 },
        { text: 'Pull into a climb — nose above +10°', done: () => pitchNow() > 0.17, hold: 0.7 },
        { text: 'Push into a dive — nose below −10° (watch the speed build)', done: () => pitchNow() < -0.17, hold: 0.7 },
        { text: 'Feed in rudder with A or D for fine aim — hold one briefly', done: () => !!(keys.a || keys.d), hold: 0.7 },
      ],
    },
    guns: {
      label: 'Gunnery',
      desc: 'Track a bandit and splash him. He won’t shoot back — this time.',
      map: 'coastal',
      bandit: true,
      spawn: { x: 0, y: 320, z: 900, hdg: 0, speed: 115 },
      outro: 'Splash one! The lead diamond is the whole secret — trust it.',
      steps: [
        {
          text: 'A bandit is ahead — the red blip on the radar. Close to 700 m',
          done: () => enemies.some((e) => e.alive && e.group.position.distanceTo(plane.position) < 700),
          prog: () => {
            const d = Math.min(...enemies.filter((e) => e.alive).map((e) => e.group.position.distanceTo(plane.position)), Infinity);
            return Number.isFinite(d) ? (2500 - d) / (2500 - 700) : 0;
          },
        },
        { text: 'Lay the yellow lead diamond under your crosshair and fire with RMB', done: () => tut && tut.hitFlag },
        { text: 'Stay with him — splash him!', done: () => kills >= 1 },
      ],
    },
    bombs: {
      label: 'Bombing',
      desc: 'Two wing bombs, one enemy flat-top. Put one on the deck.',
      map: 'ocean',
      spawn: { x: 950, y: 300, z: -3300, hdg: 0, speed: 110 },
      outro: 'Direct hit — down she goes. That’s the strike sorted.',
      steps: [
        {
          text: 'The enemy carrier is dead ahead — run straight at the deck',
          done: () => Math.hypot(plane.position.x - OCEAN.ENEMY.x, plane.position.z - OCEAN.ENEMY.z) < 800,
          prog: () => (1400 - Math.hypot(plane.position.x - OCEAN.ENEMY.x, plane.position.z - OCEAN.ENEMY.z)) / (1400 - 800),
        },
        { text: 'Press B to drop — the bomb falls ahead of you, so pickle just before the deck', done: () => bombs < 2 },
        { text: 'Put one on the deck! (miss with both and you’ll be re-armed)', done: () => enemySinking > 0 },
      ],
    },
  };
  const TUT_ORDER = ['takeoff', 'controls', 'guns', 'bombs'];

  // Stunt courses: hand-plotted ring chains [x, y, z, radius?] (default radius
  // per course). Plotted offline against the terrain module so every ring
  // clears the ground; the two low rings on Valley Run thread UNDER the road
  // bridges built at those spots.
  const STUNTS = {
    valley: {
      label: 'Valley Run',
      desc: 'Low through the central valley, under two bridges, home past the lakes.',
      map: 'coastal',
      r: 26,
      spawn: { x: 0, y: 55, z: 100, hdg: 0, speed: 100 },
      rings: [
        [0, 45, -700], [0, 39, -1100], [0, 33, -1500], [0, 49, -1900], [0, 46, -2300],
        [0, 33, -2650], [0, 4, -3000, 14], // under the north bridge
        [-600, 74, -3250], [-1200, 144, -3100], [-1800, 186, -2850], [-2300, 193, -2400],
        [-2450, 188, -1950], [-2600, 189, -1500], [-2575, 152, -1050], [-2550, 101, -600],
        [-2450, 63, -150], [-2350, 33, 300], [-2275, 33, 800],
        [-2200, 4, 1300, 14], // under the west bridge
        [-2050, 53, 1650], [-1900, 63, 2000], [-1500, 37, 2100], [-1100, 33, 2200],
        [-750, 33, 2050], [-400, 33, 1900], [-100, 33, 1600], [200, 44, 1300],
        [250, 44, 900], [300, 45, 500], [250, 45, 150], [200, 45, -200],
      ],
    },
    canyon: {
      label: 'The Canyon',
      desc: 'Tight below the rim: weave the gorge switchbacks slow and nimble, sprint the straight, then pull hard over the exit ridge.',
      map: 'canyon',
      r: 24,
      spawn: {
        x: 0, y: 470, z: 4400, hdg: 0, speed: 120,
      },
      rings: [
        // Down the gorge — rings follow CANYON.PATH (scouted offline: floor
        // ~-13 m, rims 400-700 m, every corner walled against cutting).
        // Tight r-20 hoops mark the sharp 60-90° corners; the entry reach,
        // the two sweepers and the mid-course sprint stay wide and straight.
        [0, 18, 3400], [0, 18, 2950], [0, 18, 2500],
        [-400, 18, 2050, 20], [150, 16, 1750, 20], [-150, 16, 1550], [-450, 16, 1350, 20],
        [-175, 18, 1175], [100, 17, 1000, 20],
        [-350, 16, 600], [-750, 17, 150],
        [-1150, 17, -200, 20], [-650, 17, -600, 20], [-1050, 16, -1000, 20],
        [-750, 17, -1150], [-450, 17, -1300], [-50, 17, -1425],
        [350, 16, -1550], [750, 16, -1725], [1150, 15, -1900], [1450, 17, -2025], [1750, 17, -2150],
        [2200, 17, -2500, 20], [1900, 16, -2900, 20],
        [2350, 17, -3250], [2600, 17, -3575], [2850, 16, -3900],
        // The gorge dead-ends into a ~620 m wall: a guide ring marks the
        // pull-up point on the face, then pop over the crest and finish
        // skimming the summit. Build speed on the run-in — it's a zoom climb.
        [2900, 420, -4150, 30], [2950, 690, -4500, 30], [3080, 665, -4950],
      ],
    },
    wavetop: {
      label: 'Wavetop Circuit',
      desc: 'A slalom off the carrier’s bow, wave-high out to the enemy fleet and home.',
      map: 'ocean',
      r: 22,
      spawn: { x: 0, y: 45, z: 260, hdg: 0, speed: 100 },
      rings: [
        [60, 18, -300], [-60, 18, -700], [60, 18, -1100], [-60, 18, -1500], [0, 15, -1900],
        [300, 60, -2300], [600, 90, -2700], [800, 40, -3300], [900, 25, -3900], [950, 16, -4400],
        [950, 30, -5000], [600, 70, -5300], [200, 120, -4600], [0, 120, -3800], [0, 90, -3000],
        [0, 60, -2200], [0, 30, -1200], [0, 25, -500],
      ],
    },
  };
  const STUNT_ORDER = ['valley', 'canyon', 'wavetop'];

  // ---- Flyable aircraft: the catalogue (label / blurb / stat block) lives in
  //      plane-sim-models.js (PLANE_INFO) so the game and the inspector share
  //      one source of truth. Each type's quirks are real history expressed
  //      through the SAME flight model: top speed ≈ sqrt(thrust/drag0); turn is
  //      pitchRate bound by lift/stall; controlV is the airspeed where the
  //      controls reach full authority; hiSpeedStiff is the Zero's infamous
  //      control freeze-up in a dive. Both the player AND the bandits fly with
  //      their type's stats. ----
  const PLANE_TYPES = PLANE_INFO;
  const PLANE_ORDER = ['spitfire', 'p51', 'zero'];
  const validPlane = (n) => Object.prototype.hasOwnProperty.call(PLANE_TYPES, n);
  // Control stiffening with speed (the Zero quirk): fraction of authority kept.
  const stiffen = (st, speed) => 1 - st.hiSpeedStiff * clamp((speed - 110) / 105, 0, 1);

  // Chase-camera distance presets (C key / pause menu; remembered).
  const CAM_PRESETS = {
    close: { back: 10.5, up: 3.3 },
    medium: { back: 14, up: 4.3 },
    far: { back: 17.5, up: 5.4 },
  };
  const CAM_ORDER = ['close', 'medium', 'far'];
  let camName = (() => {
    try { const c = localStorage.getItem('ps-cam'); return CAM_PRESETS[c] ? c : 'far'; } catch (_) { return 'far'; }
  })();

  // ---- Display units (pause-menu settings; remembered). The physics is all
  //      SI (m, m/s); these only change how the HUD reads out. Airspeed drives
  //      the ASI scale + label; altitude drives the altimeter + the VSI
  //      (ft/min when feet, m/s when metres); distance formats the bandit range
  //      labels. ----
  const SPEED_UNITS = {
    kn: { label: 'KN', f: KT, max: 450, step: 50, maj: 100 },
    mph: { label: 'MPH', f: 2.23694, max: 500, step: 50, maj: 100 },
    kmh: { label: 'KM/H', f: 3.6, max: 850, step: 100, maj: 200 },
  };
  const ALT_UNITS = {
    ft: { label: 'FT', f: FT },
    m: { label: 'M', f: 1 },
  };
  const DIST_UNITS = {
    m: (d) => `${Math.round(d)} m`,
    ft: (d) => `${Math.round(d * FT)} ft`,
    km: (d) => `${(d / 1000).toFixed(2)} km`,
    mi: (d) => `${(d / 1609.34).toFixed(2)} mi`,
  };
  const loadUnit = (key, table, dflt) => {
    try { const v = localStorage.getItem(key); return table[v] ? v : dflt; } catch (_) { return dflt; }
  };
  const unit = {
    speed: loadUnit('ps-u-speed', SPEED_UNITS, 'kn'),
    alt: loadUnit('ps-u-alt', ALT_UNITS, 'ft'),
    dist: loadUnit('ps-u-dist', DIST_UNITS, 'm'),
  };
  const fmtDist = (m) => DIST_UNITS[unit.dist](m);
  function setUnit(kind, val, table, key) {
    if (!table[val]) return;
    unit[kind] = val;
    try { localStorage.setItem(key, val); } catch (_) { /* private mode */ }
    for (const b of document.querySelectorAll(`[data-u${kind}]`)) {
      b.classList.toggle('ps-diff-active', b.dataset[`u${kind}`] === val);
    }
  }
  function syncUnitUI() {
    setUnit('speed', unit.speed, SPEED_UNITS, 'ps-u-speed');
    setUnit('alt', unit.alt, ALT_UNITS, 'ps-u-alt');
    setUnit('dist', unit.dist, DIST_UNITS, 'ps-u-dist');
  }

  // ============================================================ SCENE =====
  const scene = new THREE.Scene();
  const SKY_TOP = new THREE.Color(0x3f87cc);
  const SKY_HAZE = new THREE.Color(0xc3d9e8);
  scene.background = SKY_TOP.clone();
  scene.fog = new THREE.Fog(SKY_HAZE.getHex(), GFX.fogNear, GFX.fogFar);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 26000);
  camera.position.set(0, CFG.GROUND_Y + CAM_PRESETS[camName].up, 320 + CAM_PRESETS[camName].back);

  renderer.setPixelRatio(GFX.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic response -> less "flat web GL"
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = GFX.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated (aliases to PCF, but warns every frame)

  // ---- Lighting: a warm sun that casts soft shadows, a cool sky/ground
  //      hemisphere fill, and a dim back-fill so shadowed sides aren't dead
  //      black. The sun's shadow frustum is a small ortho box that follows the
  //      aircraft (see updateCamera) so shadows stay crisp anywhere in the map. ----
  const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.42).normalize();
  const sun = new THREE.DirectionalLight(0xfff2da, 2.4);
  sun.castShadow = GFX.shadows;
  sun.shadow.mapSize.set(GFX.shadowMapSize, GFX.shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  {
    const sc = sun.shadow.camera;
    const sb = GFX.shadowBox; // high tier: bigger map affords a wider shadowed area
    sc.near = 1; sc.far = 420 + (sb - 95) * 2;
    sc.left = -sb; sc.right = sb; sc.top = sb; sc.bottom = -sb;
    sc.updateProjectionMatrix();
  }
  scene.add(sun);
  scene.add(sun.target);
  const backFill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  backFill.position.set(0.6, 0.4, -0.5);
  scene.add(backFill);
  scene.add(new THREE.HemisphereLight(0xcce2ff, 0x6e785a, 1.25));

  // ---- A gradient sky dome (top deep-blue -> pale horizon haze) + sun disc ----
  (function buildSky() {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#2b66a8');
    g.addColorStop(0.55, '#68a4d6');
    g.addColorStop(1.0, '#d5e4ee');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = tex;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(15500, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    scene.add(dome);

    // The sun itself: a bright additive sprite hung out along the light vector.
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sctx = sc.getContext('2d');
    const sg = sctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    sg.addColorStop(0, 'rgba(255,252,240,1)');
    sg.addColorStop(0.18, 'rgba(255,246,214,0.95)');
    sg.addColorStop(0.5, 'rgba(255,232,170,0.25)');
    sg.addColorStop(1, 'rgba(255,225,150,0)');
    sctx.fillStyle = sg; sctx.fillRect(0, 0, 128, 128);
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc), depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    sunSpr.position.copy(SUN_DIR).multiplyScalar(12500);
    sunSpr.scale.setScalar(2400);
    scene.add(sunSpr);
  }());

  // ---- Terrain: procedural mountains/valleys/lakes (plane-sim-terrain.js).
  //      The airfield sits on a flattened disc at the origin. Everything
  //      land-bound (terrain, airfield, forests, rocks) lives in landGroup so
  //      the Ocean map can switch it all off; the water plane is shared (on
  //      the ocean it IS the map). ----
  const landGroup = new THREE.Group();
  scene.add(landGroup);
  landGroup.add(buildTerrain(renderer));
  // Ultra: the water is a planar-reflection surface with animated waves (the
  // whole scene is mirrored into a render target each frame — the closest
  // WebGL gets to ray-traced reflections). Every other tier keeps the cheap
  // translucent plane.
  let waterMesh;
  if (GFX.reflectiveWater) {
    const waterNormals = loadSceneryTexture('/static/planes/water-normal.jpg');
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;
    waterMesh = new Water(new THREE.PlaneGeometry(TERRAIN.SIZE, TERRAIN.SIZE), {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals,
      sunDirection: SUN_DIR.clone(),
      sunColor: 0xfff2da,
      waterColor: 0x0c4254, // deep blue-green body colour (scatter term)
      distortionScale: 18, // ripple the reflection hard — a clean mirror reads as mercury
      fog: true,
    });
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = TERRAIN.WATER_Y;
    waterMesh.material.uniforms.size.value = 8; // wave frequency over world metres
    // De-chrome the stock Water shader (values tuned by eye against the lakes):
    // steeper wave normals, a blue-green tint on the mirrored scene (our world
    // is snow + haze — untinted it reflects silver), and much less of the flat
    // grey sun-diffuse wash so the head-on colour is deep water, not milk.
    waterMesh.material.fragmentShader = waterMesh.material.fragmentShader
      .replace(
        'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
        'vec3 surfaceNormal = normalize( noise.xzy * vec3( 2.6, 1.0, 2.6 ) );',
      )
      .replace(
        'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );',
        'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) ) * vec3( 0.58, 0.74, 0.82 );',
      )
      .replace(
        'vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;',
        'vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor * 1.15;',
      )
      .replace(
        'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask()',
        'vec3 albedo = mix( ( sunColor * diffuseLight * 0.12 + scatter ) * getShadowMask()',
      );
    waterMesh.material.polygonOffset = true;
    waterMesh.material.polygonOffsetFactor = -1;
    waterMesh.material.polygonOffsetUnits = -1;
  } else {
    waterMesh = buildWater();
  }
  scene.add(waterMesh);

  // Paved footprint of the coastal airfield — the runway plus the west-side
  // perimeter taxiway, hangar spurs, threshold links and apron pad. Mirrors
  // buildAirfield()'s taxi() layout below; kept here (before the grass + tree
  // scatter) so nothing sprouts through the tarmac. `onPaved` tests a point,
  // optionally with an outward margin.
  const RW = CFG.RUNWAY_W;
  const RL = CFG.RUNWAY_LEN;
  const TAXI_X = -30;
  const PAVED = [
    { x0: -RW / 2, x1: RW / 2, z0: -RL / 2, z1: RL / 2 },                 // runway
    { x0: TAXI_X - 5.5, x1: TAXI_X + 5.5, z0: -(RL / 2 - 20), z1: RL / 2 - 20 }, // perimeter taxi
    { x0: -51, x1: -21, z0: 35, z1: 45 },                                // hangar spur (N)
    { x0: -51, x1: -21, z0: -39, z1: -29 },                              // hangar spur (S)
    { x0: -30, x1: 4, z0: RL / 2 - 35.5, z1: RL / 2 - 24.5 },            // threshold link (N)
    { x0: -30, x1: 4, z0: -(RL / 2 - 24.5), z1: -(RL / 2 - 35.5) },      // threshold link (S)
    { x0: -85, x1: -35, z0: -62, z1: 68 },                              // hangar apron pad
  ];
  const onPaved = (x, z, m = 0) => PAVED.some(
    (r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m,
  );

  // Ultra: instanced grass blades wrap around the aircraft (coastal map only —
  // it lives in landGroup so the map switch hides it with everything else).
  let grassField = null;
  if (GFX.grass) {
    grassField = buildGrassField({
      heightFn: terrainHeight,
      size: TERRAIN.SIZE,
      waterY: TERRAIN.WATER_Y,
      tile: GFX.grassTile,
      blades: GFX.grassBlades,
      // Every paved rect, grown 14 m so the coarse height/mask bake reliably
      // clears grass off the tarmac (and leaves a tidy mown verge).
      exclude: PAVED.map((r) => ({
        x0: r.x0 - 14, x1: r.x1 + 14, z0: r.z0 - 14, z1: r.z1 + 14,
      })),
    });
    landGroup.add(grassField.mesh);
  }

  // The Canyon map (stunt-only): one alpine gorge world, nothing but terrain —
  // the shared water plane reads as the river along its sunken floor. Lower
  // rock/snow bands sell the high-mountain look.
  const canyonGroup = new THREE.Group();
  canyonGroup.visible = false;
  scene.add(canyonGroup);
  // Built lazily on first entry: the gorge is only ~250 m wide, so this mesh
  // is much finer than the coastal map's (22 m/vertex) — too slow to build at
  // page load for a world most sessions never visit.
  let canyonBuilt = false;
  function ensureCanyon() {
    if (canyonBuilt) return;
    canyonBuilt = true;
    canyonGroup.add(buildTerrain(renderer, canyonHeight, {
      // segScale capped here: the canyon grid is already fine (620), and
      // ultra's 1.8x would mean a >1M-vertex build hitch on first entry.
      rockA: 180, rockB: 330, snowA: 380, snowB: 520, segs: Math.round(620 * Math.min(GFX.segScale, 1.35)), sand: 0.35,
    }));
    // Cool fill light so the shaded wall reads as blue-grey rock instead of
    // pitch black (only lights the scene while the canyon is visible).
    canyonGroup.add(new THREE.HemisphereLight(0xbdd4ee, 0x46503e, 0.55));
  }

  // ---- Obstacle registry for collision. Solid scenery registers a simple
  //      volume here — a vertical cylinder {x,z,r,top} (trees, rocks, poles,
  //      round tanks, the tower) or an axis-aligned box {x0,x1,z0,z1,top}
  //      (hangars, huts, vehicles). `top` is an absolute world height; the
  //      aircraft only collides below it. update() scans these each frame while
  //      the plane is low enough to hit something. Populated by buildAirfield +
  //      scatterVegetation as they build. ----
  const obCyl = [];
  const obBox = [];
  const windsocks = []; // fluttered each frame (userData.flutter)
  const OBSTACLE_CEIL = 70; // taller than the tallest obstacle (the bridges over the lakes)
  const addCyl = (x, z, r, top, reason) => obCyl.push({
    x, z, r, top, reason,
  });
  const addBox = (x0, x1, z0, z1, top, reason) => obBox.push({
    x0, x1, z0, z1, top, reason,
  });

  // ---- Demo airfield: tarmac runway (centreline, threshold + edge lines), a
  //      glazed control tower and Quonset-hut hangars. ----
  (function buildAirfield() {
    const field = new THREE.Group(); // 3D structures (cast + receive shadow)
    const markings = new THREE.Group(); // flat ground paint (receive only)

    const asphaltTex = loadSceneryTexture('/static/planes/asphalt.jpg');
    asphaltTex.colorSpace = THREE.SRGBColorSpace;
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.anisotropy = GFX.aniso;

    const tarmacTex = asphaltTex.clone();
    tarmacTex.repeat.set(3, 60);

    const tarmac = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.RUNWAY_W, CFG.RUNWAY_LEN),
      new THREE.MeshStandardMaterial({ map: tarmacTex, color: 0x8b8f95, roughness: 0.88 }),
    );
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.y = 0.12;
    tarmac.receiveShadow = true;
    markings.add(tarmac);

    const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.8 });
    const flat = (geo, x, z) => {
      const m = new THREE.Mesh(geo, paint);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.18, z); m.receiveShadow = true;
      markings.add(m);
    };
    for (const sx of [-1, 1]) flat(new THREE.PlaneGeometry(0.8, CFG.RUNWAY_LEN - 20), sx * (CFG.RUNWAY_W / 2 - 1.2), 0);
    for (let z = -CFG.RUNWAY_LEN / 2 + 24; z < CFG.RUNWAY_LEN / 2 - 24; z += 26) flat(new THREE.PlaneGeometry(1.1, 11), 0, z);
    for (const end of [-1, 1]) {
      for (let i = -4; i <= 4; i++) flat(new THREE.PlaneGeometry(2.2, 9), i * 3.2, end * (CFG.RUNWAY_LEN / 2 - 9));
    }

    // ---- Paved taxiways: a perimeter track down the west side linking the two
    //      runway thresholds, with spur links out to the hangar apron. Flat
    //      tarmac like the runway (receive shadow only). ----
    const taxiTex = asphaltTex.clone();
    taxiTex.repeat.set(1.5, 30);
    const taxiMat = new THREE.MeshStandardMaterial({ map: taxiTex, color: 0x90949a, roughness: 0.88 });
    const taxi = (w, l, x, z, rot = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), taxiMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
      m.position.set(x, 0.13, z); m.receiveShadow = true;
      markings.add(m);
    };
    const TAXI_X = -30; // perimeter track centreline, just west of the runway
    taxi(11, CFG.RUNWAY_LEN - 40, TAXI_X, 0); // main perimeter track (N-S)
    for (const z of [40, -34]) taxi(30, 10, (TAXI_X - 42) / 2, z); // spurs to the hangars
    for (const end of [-1, 1]) { // links from the track to each runway threshold
      taxi(Math.abs(TAXI_X) + 4, 11, TAXI_X / 2 + 2, end * (CFG.RUNWAY_LEN / 2 - 30));
    }
    // Hangar apron pad.
    taxi(50, 130, -60, 3);

    const tower = makeControlTower();
    tower.position.set(46, 0, 150);
    field.add(tower);
    addCyl(46, 150, 5, 30, 'Flew into the control tower');

    for (let i = 0; i < 2; i++) {
      const hut = makeHangar();
      const hz = 40 - i * 74;
      hut.position.set(-56, 0, hz);
      field.add(hut);
      // Hangar arch: axis along X (LEN 38 -> ±19), R 9 span/height.
      addBox(-56 - 19, -56 + 19, hz - 9, hz + 9, 9, 'Flew into a hangar');
    }

    // ---- A row of Nissen huts (accommodation / stores) behind the hangars. ----
    for (let i = 0; i < 4; i++) {
      const len = 8 + (i % 2) * 3;
      const hut = makeNissenHut(len);
      const hz = -45 + i * 30;
      hut.position.set(-92, 0, hz);
      hut.rotation.y = Math.PI / 2; // ridge line runs across, doors face the apron
      field.add(hut);
      // Rotated 90°, so the length runs along X and the 2.6 m radius along Z.
      addBox(-92 - len / 2, -92 + len / 2, hz - 2.6, hz + 2.6, 2.6, 'Clipped a hut');
    }

    // ---- Dispersed bulk-fuel installation, kept well clear of the hangars in
    //      the SE corner, plus a bowser parked on the apron. ----
    for (const [fx, fz] of [[86, -60], [98, -60], [92, -74]]) {
      const tank = makeFuelTank();
      tank.position.set(fx, 0, fz);
      field.add(tank);
      addCyl(fx, fz, 3.4, 6, 'Flew into a fuel tank');
    }
    const bowser = makeBowser();
    bowser.position.set(-40, 0, 70);
    bowser.rotation.y = 1.1;
    field.add(bowser);
    addCyl(-40, 70, 3.4, 2.6, 'Flew into a bowser');

    // ---- Windsocks by each runway threshold (offset to the east side).
    //      Collected so the frame loop can flutter them in the breeze. ----
    for (const wz of [CFG.RUNWAY_LEN / 2 - 30, -(CFG.RUNWAY_LEN / 2 - 30)]) {
      const sock = makeWindsock();
      sock.position.set(34, 0, wz);
      sock.rotation.y = Math.PI * 0.15;
      field.add(sock);
      windsocks.push(sock);
    }

    // ---- Perimeter security fence around the technical site (hangars, huts,
    //      fuel), with a gate gap on the runway side for the taxi spurs. Chain
    //      link on posts: one alpha-textured panel per run + instanced posts. ----
    (function fenceCompound() {
      const lc = document.createElement('canvas');
      lc.width = lc.height = 64;
      const lx = lc.getContext('2d');
      lx.strokeStyle = 'rgba(196,201,206,0.85)';
      lx.lineWidth = 2;
      for (let o = -64; o < 64; o += 12) { // diagonal chain-link diamonds
        lx.beginPath(); lx.moveTo(o, 0); lx.lineTo(o + 64, 64); lx.stroke();
        lx.beginPath(); lx.moveTo(o + 64, 0); lx.lineTo(o, 64); lx.stroke();
      }
      const linkTex = new THREE.CanvasTexture(lc);
      linkTex.colorSpace = THREE.SRGBColorSpace;
      linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping;
      const FH = 2.3; // fence height
      const postMat = new THREE.MeshStandardMaterial({ color: 0x8b9095, roughness: 0.6, metalness: 0.4 });
      const posts = [];
      const runFence = (x1, z1, x2, z2) => {
        const dx = x2 - x1; const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const mat = new THREE.MeshStandardMaterial({
          map: linkTex.clone(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
          roughness: 0.8, metalness: 0.3, color: 0xd2d6da,
        });
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.repeat.set(len / 2, FH / 2);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, FH), mat);
        panel.position.set((x1 + x2) / 2, FH / 2, (z1 + z2) / 2);
        // Align the plane's local +X (its width) with the run direction (dx,dz).
        // A rotation.y of `a` sends local +X to (cos a, 0, -sin a), so a =
        // atan2(-dz, dx). (The old atan2(dx,dz) left N-S runs lying across X.)
        panel.rotation.y = Math.atan2(-dz, dx);
        field.add(panel);
        const n = Math.max(2, Math.round(len / 4));
        for (let i = 0; i <= n; i++) posts.push([x1 + (dx * i) / n, z1 + (dz * i) / n]);
      };
      const W = -104; const E = -24; const N = 108; const S = -96;
      runFence(W, S, W, N); // west
      runFence(W, N, E, N); // north
      runFence(W, S, E, S); // south
      runFence(E, S, E, -18); // east (lower) — gate gap between -18 and 22
      runFence(E, 22, E, N); // east (upper)
      const postGeo = new THREE.CylinderGeometry(0.09, 0.09, FH + 0.3, 6);
      postGeo.translate(0, (FH + 0.3) / 2, 0);
      const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
      const pm = new THREE.Matrix4();
      for (let i = 0; i < posts.length; i++) {
        pm.makeTranslation(posts[i][0], 0, posts[i][1]);
        postMesh.setMatrixAt(i, pm);
      }
      postMesh.castShadow = true;
      field.add(postMesh);
    }());

    // Parked aircraft — one of each flyable type: a Spitfire and a P-51 tucked
    // inside the hangars (nose out the +X door, wheels on the 0.14 m slab) and
    // a Zero on the grass by the apron.
    for (const [type, px, py, pz, ry] of [
      ['spitfire', -58, 1.49, 40, -Math.PI / 2],
      ['p51', -58, 1.49, -34, -Math.PI / 2],
      ['zero', -42, 1.35, 96, -2.1],
    ]) {
      const parked = buildAircraft({ type });
      parked.group.position.set(px, py, pz);
      parked.group.rotation.y = ry;
      field.add(parked.group);
    }

    landGroup.add(markings);
    landGroup.add(field);
  }());

  // ---- Road bridges across two lake narrows — scenery for the whole map, and
  //      the fly-UNDER gates of the Valley Run stunt course. The deck is a
  //      box obstacle with a `bot` (solid only between bot..top, so the gap
  //      beneath stays flyable); the piers are ordinary cylinders. ----
  (function buildBridges() {
    for (const [bx, bz, len] of [[-20, -3000, 520], [-2200, 1300, 500]]) {
      const bridge = makeBridge(len, 24, -55);
      bridge.position.set(bx, 0, bz);
      landGroup.add(bridge);
      // Deck slab (fly under it, not through it).
      obBox.push({
        x0: bx - len / 2, x1: bx + len / 2, z0: bz - 7.5, z1: bz + 7.5, top: 26, bot: 19.5, reason: 'Flew into a bridge',
      });
      // Piers + end abutments (mirror makeBridge's spacing).
      const n = Math.max(1, Math.round(len / 105) - 1);
      for (let i = 1; i <= n; i++) addCyl(bx - len / 2 + (len * i) / (n + 1), bz, 5.4, 24, 'Flew into a bridge pier');
      for (const ex of [bx - len / 2 + 5, bx + len / 2 - 5]) addCyl(ex, bz, 8.5, 24, 'Flew into a bridge');
    }
  }());

  // ---- The Ocean map: two carrier groups on an empty sea. Yours parked at
  //      the origin (its deck is the runway), the enemy's a few km out. Deck
  //      contact and hull/island collision are handled analytically in
  //      update() via the DECK/ocean-obstacle data captured here. ----
  const oceanGroup = new THREE.Group();
  const DECK_TOP = TERRAIN.WATER_Y + CARRIER.DECK_Y; // absolute deck height
  const carriers = []; // { group, x, z, enemy } — both AABB-aligned (axis along Z)
  const obBoxOcean = []; // island + hull crash volumes, same shape as obBox
  (function buildOcean() {
    for (const [enemy, cx, cz, rotY] of [
      [false, OCEAN.ALLY.x, OCEAN.ALLY.z, 0],
      [true, OCEAN.ENEMY.x, OCEAN.ENEMY.z, Math.PI], // bow toward our fleet
    ]) {
      const c = makeCarrier({ enemy });
      c.group.position.set(cx, TERRAIN.WATER_Y, cz);
      c.group.rotation.y = rotY;

      // Parked deck aircraft (decorative — no collision), spotted along the
      // STERN half's deck edges per WW2 deck-park practice: aircraft are
      // ranged aft (where they're readied and launched from) leaving the bow
      // run clear. Kept clear of the centreline and of the spawn spot at the
      // very stern. Children of the carrier group, so they ride (and sink)
      // with the ship. Local coords: bow at -Z, stern at +Z.
      const spots = [
        { type: 'spitfire', x: -10, z: 48, ry: 2.6 },
        { type: 'p51', x: 10, z: 66, ry: -2.6 },
        { type: 'zero', x: -10, z: 88, ry: 2.95 },
      ];
      for (const s of spots) {
        const t = enemy ? 'zero' : s.type; // enemy fleet flies Zeros
        const parked = buildAircraft({ type: t, paint: enemy ? CFG.ENEMY_PAINT : undefined, markings: !enemy });
        const gy = PLANE_TYPES[t].stats.groundY || CFG.GROUND_Y;
        parked.group.position.set(s.x, CARRIER.DECK_Y + gy, s.z);
        parked.group.rotation.y = s.ry;
        c.group.add(parked.group);
      }

      oceanGroup.add(c.group);
      carriers.push({
        group: c.group, x: cx, z: cz, enemy, rotY,
      });
      // Hull: solid below the flight deck across the whole footprint.
      obBoxOcean.push({
        x0: cx - 12.5, x1: cx + 12.5, z0: cz - 131, z1: cz + 131, top: DECK_TOP - 1.6, reason: 'Flew into the carrier',
      });
      // Island superstructure on the deck (starboard = +X, mirrored by rotY).
      const ix = cx + (rotY ? -1 : 1) * (CARRIER.DECK_W / 2 - 2.6);
      const iz = cz + (rotY ? 18 : -18);
      obBoxOcean.push({
        x0: ix - 3.6, x1: ix + 3.6, z0: iz - 11.5, z1: iz + 11.5, top: DECK_TOP + 22, reason: 'Flew into the island',
      });
    }
    scene.add(oceanGroup);
  }());
  // Deck height at (x, z): the flight-deck top if over a carrier, else -Inf.
  // A sinking enemy carrier stops being a deck (it's on its way down).
  function carrierDeckAt(x, z) {
    for (const c of carriers) {
      if (c.enemy && enemySinking > 0) continue;
      if (Math.abs(x - c.x) <= CARRIER.DECK_W / 2 && Math.abs(z - c.z) <= CARRIER.DECK_LEN / 2) return DECK_TOP;
    }
    return -Infinity;
  }

  // ---- Instanced forests + rock fields across the whole terrain. Three tree
  //      archetypes (broadleaf valleys, conifer slopes, pines up high), each
  //      one trunk + one canopy InstancedMesh — 6 draw calls for every tree on
  //      the map. A separate density noise channel makes some regions thick
  //      woods and others near-empty meadow. ----
  (function scatterVegetation() {
    const types = {
      broadleaf: {
        spots: [],
        trunk: [0.5, 0.85, 3.8, 1.9],
        canopy: makeBroadleafCanopyGeo,
        hsl: () => [0.22 + Math.random() * 0.09, 0.5, 0.28 + Math.random() * 0.09],
        scale: () => 0.6 + Math.random() * 1.1,
        cr: 2.2, // collision radius + top height (× instance scale)
        ctop: 9.1,
      },
      conifer: {
        spots: [],
        trunk: [0.35, 0.65, 4.2, 2.1],
        canopy: makeConiferCanopyGeo,
        hsl: () => [0.26 + Math.random() * 0.07, 0.42 + Math.random() * 0.15, 0.2 + Math.random() * 0.1],
        scale: () => 0.7 + Math.random() * 1.3,
        cr: 2.4,
        ctop: 13,
      },
      pine: {
        spots: [],
        trunk: [0.28, 0.5, 7, 3.5],
        canopy: makePineCanopyGeo,
        hsl: () => [0.31 + Math.random() * 0.05, 0.35, 0.16 + Math.random() * 0.07],
        scale: () => 0.75 + Math.random() * 0.85,
        cr: 1.9,
        ctop: 16.7,
      },
    };
    // Type by altitude band, with fuzzy borders: broadleaf on the valley
    // floor, conifers on the slopes, slim pines toward the peaks.
    const pickType = (h) => {
      if (h > 190 + Math.random() * 70) return 'pine';
      if (h < 45 + Math.random() * 40) return Math.random() < 0.75 ? 'broadleaf' : 'conifer';
      return Math.random() < 0.8 ? 'conifer' : 'pine';
    };
    const TREE_TARGET = Math.round(1900 * GFX.treeScale);
    let placed = 0;
    let guard = 0;
    while (placed < TREE_TARGET && guard++ < 80000) {
      const x = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
      const z = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
      const h = terrainHeight(x, z);
      if (h < TERRAIN.WATER_Y + 6 || h > 380) continue;
      const e = 14;
      const slope = Math.hypot(
        terrainHeight(x + e, z) - terrainHeight(x - e, z),
        terrainHeight(x, z + e) - terrainHeight(x, z - e),
      ) / (2 * e);
      if (slope > 0.38) continue;
      const near = Math.hypot(x, z);
      if (near < 240) continue; // keep the apron clear
      if (Math.abs(x) < CFG.RUNWAY_W + 30 && Math.abs(z) < CFG.RUNWAY_LEN / 2 + 60) continue;
      if (onPaved(x, z, 12)) continue; // never seed a tree on the tarmac
      // Cluster into forests: the shared mask gates placement, and a slower
      // density channel swings the gate so woods thin out into meadows and
      // thicken into proper forest elsewhere (looser near the airfield).
      const dens = fbm(x * 0.00042 + 71.3, z * 0.00042 - 12.9, 3);
      const thresh = (near < 1600 ? 0.38 : 0.42) + 0.26 * (1 - dens);
      const mask = forestMask(x, z);
      if (mask < thresh) continue;
      types[pickType(h)].spots.push([x, h, z]);
      placed++;
      // The stronger the mask, the more satellite trees clump around the seed
      // — sparse lone trees at the wood's edge, thickets in the middle.
      const extra = Math.floor(((mask - thresh) / (1 - thresh)) * 4 * (0.5 + Math.random()));
      for (let k = 0; k < extra && placed < TREE_TARGET; k++) {
        const sx = x + (Math.random() * 2 - 1) * 42;
        const sz = z + (Math.random() * 2 - 1) * 42;
        const sh = terrainHeight(sx, sz);
        if (sh < TERRAIN.WATER_Y + 6 || sh > 380) continue;
        if (onPaved(sx, sz, 10)) continue; // satellites skip the seed tests — keep them off the tarmac too
        types[pickType(sh)].spots.push([sx, sh, sz]);
        placed++;
      }
    }

    const trunkTex = loadSceneryTexture('/static/planes/tree-bark.jpg');
    trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
    trunkTex.repeat.set(1, 3);
    trunkTex.anisotropy = GFX.aniso;

    const leafTex = loadSceneryTexture('/static/planes/tree-leaves.jpg');
    leafTex.colorSpace = THREE.SRGBColorSpace;
    leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
    leafTex.repeat.set(4, 4);
    leafTex.anisotropy = GFX.aniso;

    const trunkMat = new THREE.MeshStandardMaterial({
      map: trunkTex,
      roughness: 0.9,
      metalness: 0.05,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      roughness: 0.85,
      metalness: 0.05,
      vertexColors: true,
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    for (const t of Object.values(types)) {
      if (!t.spots.length) continue;
      let trunkGeo;
      if (t === types.broadleaf) {
        trunkGeo = makeBroadleafTrunkGeo();
      } else {
        const [rTop, rBot, tHeight, tY] = t.trunk;
        trunkGeo = new THREE.CylinderGeometry(rTop, rBot, tHeight, 5);
        trunkGeo.translate(0, tY, 0);
      }
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, t.spots.length);
      const canopies = new THREE.InstancedMesh(t.canopy(), leafMat, t.spots.length);
      for (let i = 0; i < t.spots.length; i++) {
        const [x, h, z] = t.spots[i];
        const s = t.scale();
        q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
        m.compose(p.set(x, h - 0.3, z), q, sc.set(s, s * (0.85 + Math.random() * 0.4), s));
        trunks.setMatrixAt(i, m);
        canopies.setMatrixAt(i, m);
        col.setHSL(...t.hsl());
        canopies.setColorAt(i, col);
        addCyl(x, z, t.cr * s, (h - 0.3) + t.ctop * s, 'Clipped the treeline');
      }
      trunks.castShadow = true; canopies.castShadow = true; canopies.receiveShadow = true;
      landGroup.add(trunks); landGroup.add(canopies);
    }

    // Rocks: on the steeps and the high ground.
    const rocks = [];
    const ROCK_TARGET = Math.round(170 * GFX.treeScale);
    guard = 0;
    while (rocks.length < ROCK_TARGET && guard++ < 22000) {
      const x = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
      const z = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
      const h = terrainHeight(x, z);
      if (h < 60) continue;
      const e = 14;
      const slope = Math.hypot(
        terrainHeight(x + e, z) - terrainHeight(x - e, z),
        terrainHeight(x, z + e) - terrainHeight(x, z - e),
      ) / (2 * e);
      if (slope < 0.3 && h < 300) continue;
      rocks.push([x, h, z]);
    }
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    for (let i = 0; i < rocks.length; i++) {
      const [x, h, z] = rocks[i];
      const s = 2 + Math.random() * 7;
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * Math.PI * 2, Math.random()));
      m.compose(p.set(x, h + s * 0.15, z), q, sc.set(s, s * (0.6 + Math.random() * 0.5), s));
      rockMesh.setMatrixAt(i, m);
      col.setHSL(0.09, 0.06 + Math.random() * 0.06, 0.32 + Math.random() * 0.14);
      rockMesh.setColorAt(i, col);
      addCyl(x, z, s * 0.8, h + s, 'Flew into a rock');
    }
    rockMesh.castShadow = true;
    landGroup.add(rockMesh);
  }());

  // ---- Coastal life: wooden jetties poking out over the lakes with the odd
  //      lakeside cabin behind them. Placement walks the shoreline band
  //      (just above the waterline, gentle slope, open water a short way
  //      downhill) and points each jetty down the terrain gradient. ----
  (function buildCoast() {
    const { WATER_Y } = TERRAIN;
    const spots = []; // [x, z] of placed jetties, for spacing
    let cabins = 0;
    let guard = 0;
    while (spots.length < 12 && guard++ < 60000) {
      const x = (Math.random() * 2 - 1) * CFG.BORDER;
      const z = (Math.random() * 2 - 1) * CFG.BORDER;
      const h = terrainHeight(x, z);
      if (h < WATER_Y + 0.5 || h > WATER_Y + 2.2) continue; // deck sits ~1 m over the water
      const e = 10;
      const gx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
      const gz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
      const gmag = Math.hypot(gx, gz);
      if (gmag < 0.015 || gmag > 0.3) continue; // flat marsh or cliff — no pier
      const dx = -gx / gmag; const dz = -gz / gmag; // downhill = toward the water
      // Open water a short way out, dry ground a short way in.
      if (terrainHeight(x + dx * 30, z + dz * 30) > WATER_Y - 0.6) continue;
      if (terrainHeight(x - dx * 22, z - dz * 22) < WATER_Y + 1.2) continue;
      // Spread them out; skip anything close to an existing pier.
      if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 500)) continue;
      spots.push([x, z]);

      const len = 15 + Math.random() * 8;
      const jetty = makeJetty(len);
      // makeJetty runs along -Z from its origin; yaw -Z onto the water
      // direction (dx, dz).
      const yaw = Math.atan2(-dx, -dz);
      jetty.rotation.y = yaw;
      jetty.position.set(x, WATER_Y + 1.05, z);
      landGroup.add(jetty);
      addCyl(x + dx * len * 0.5, z + dz * len * 0.5, len * 0.55, WATER_Y + 2.2, 'Hit a jetty');

      if (cabins < 8 && Math.random() < 0.7) {
        const cd = 15 + Math.random() * 8; // set back from the shore
        const cx = x - dx * cd;
        const cz = z - dz * cd;
        const ch = terrainHeight(cx, cz);
        if (ch > WATER_Y + 0.8) {
          const cabin = makeCabin();
          cabin.rotation.y = yaw + (Math.random() - 0.5) * 0.5; // door roughly at the water
          cabin.position.set(cx, ch - 0.15, cz);
          landGroup.add(cabin);
          addBox(cx - 4, cx + 4, cz - 4, cz + 4, ch + 4.2, 'Crashed into a cabin');
          cabins++;
        }
      }
    }
  }());

  // ---- Clouds: sprite billboards, but each carries a drawn CUMULUS texture
  //      (a row of overlapping puffs — bright domed tops, grey flattened
  //      base, ragged silhouette) instead of one radial blob, so they read
  //      as clouds rather than circles. Four variants, drawn once. ----
  (function buildClouds() {
    function cloudTexture() {
      const W = 256; const H = 128;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const baseY = H * (0.62 + Math.random() * 0.08); // the flat base of the cloud
      const puffs = 16 + Math.floor(Math.random() * 10);
      for (let i = 0; i < puffs; i++) {
        // Puffs cluster along the base line: big domes near the middle,
        // smaller ones toward the ends; tops rise, bottoms hug the base.
        const t = Math.random(); // 0..1 across the cloud
        const px = W * (0.10 + 0.80 * t);
        const centrality = 1 - Math.abs(t - 0.5) * 2; // 1 middle -> 0 ends
        const r = (10 + 22 * centrality) * (0.7 + Math.random() * 0.6);
        const py = baseY - r * (0.25 + Math.random() * 0.75);
        // Lower puffs pick up a grey-blue shadow tint.
        const shade = clamp((py + r - baseY) / r * 0.5 + Math.random() * 0.15, 0, 0.45);
        const cr = Math.round(255 - 35 * shade);
        const cg = Math.round(255 - 28 * shade);
        const g = ctx.createRadialGradient(px, py, r * 0.12, px, py, r);
        g.addColorStop(0, `rgba(${cr},${cg},255,0.92)`);
        g.addColorStop(0.65, `rgba(${cr},${cg},255,0.45)`);
        g.addColorStop(1, `rgba(${cr},${cg},255,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
      // Erase everything below the base line with a soft gradient so the
      // cloud sits on the flat bottom real cumulus have.
      const cut = ctx.createLinearGradient(0, baseY - 6, 0, baseY + 18);
      cut.addColorStop(0, 'rgba(0,0,0,0)');
      cut.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = cut;
      ctx.fillRect(0, baseY - 6, W, H - baseY + 6);
      ctx.globalCompositeOperation = 'source-over';
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const variants = [cloudTexture(), cloudTexture(), cloudTexture(), cloudTexture()];
    for (let i = 0; i < 34; i++) {
      const mat = new THREE.SpriteMaterial({
        map: variants[Math.floor(Math.random() * variants.length)],
        depthWrite: false,
        opacity: 0.62 + Math.random() * 0.3,
        fog: true,
      });
      const cx = (Math.random() - 0.5) * CFG.BORDER * 2.2;
      const cy = 260 + Math.random() * 1100;
      const cz = (Math.random() - 0.5) * CFG.BORDER * 2.2;
      const base = 260 + Math.random() * 380;
      // One wide main billboard per cloud, sometimes a smaller trailing one.
      const n = 1 + (Math.random() < 0.45 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(mat);
        s.position.set(
          cx + k * base * (0.5 + Math.random() * 0.3),
          cy + (Math.random() - 0.5) * base * 0.12,
          cz + (Math.random() - 0.5) * base * 0.4,
        );
        const scl = base * (k ? 0.55 : 1) * (0.85 + Math.random() * 0.3);
        s.scale.set(scl, scl * 0.5, 1);
        scene.add(s);
      }
    }
  }());

  // ---- World border: Minecraft-style translucent cyan walls, with a scrolling
  //      vertical-stripe texture so the boundary is unmistakable. ----
  const borderMats = [];
  (function buildBorder() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(80,210,255,0.9)';
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 7, 64);
    const B = CFG.BORDER; const H = 1800;
    const sides = [
      { pos: [0, H / 2, -B], rotY: 0 },
      { pos: [0, H / 2, B], rotY: Math.PI },
      { pos: [-B, H / 2, 0], rotY: Math.PI / 2 },
      { pos: [B, H / 2, 0], rotY: -Math.PI / 2 },
    ];
    for (const s of sides) {
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set((B * 2) / 80, H / 80);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      borderMats.push(mat);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(B * 2, H), mat);
      wall.position.set(s.pos[0], s.pos[1], s.pos[2]);
      wall.rotation.y = s.rotY;
      scene.add(wall);
    }
  }());

  // ======================================================== AIRCRAFT ======
  // The player's fighter. Geometry lives in plane-sim-models.js (shared with
  // the model inspector) so the flown model and the inspected model are one
  // and the same. `surf` holds the animatable handles (control surfaces, prop,
  // gear); the physics below drives them. The airframe is player-selectable
  // (start overlay / pause menu) and rebuilt in place on switch.
  let planeName = (() => {
    try { const p = localStorage.getItem('ps-plane'); return validPlane(p) ? p : 'spitfire'; } catch (_) { return 'spitfire'; }
  })();
  let ac = PLANE_TYPES[planeName].stats; // the player's active stat block
  const groundY = () => ac.groundY || CFG.GROUND_Y; // parked origin height (per airframe)
  let plane; let surf;
  let bombRacks = []; // the two wing-hung bomb meshes (Ocean map only)
  function buildPlayer() {
    const old = plane ? { pos: plane.position.clone(), quat: plane.quaternion.clone() } : null;
    if (plane) scene.remove(plane);
    const built = buildAircraft({ type: planeName });
    plane = built.group;
    surf = built.surf;
    // Wing bombs (shown on the Ocean map while still on the rack) — mounted by
    // the shared helper so the rack position matches the inspector exactly.
    bombRacks = mountWingBombs(plane, planeName);
    syncBombRacks();
    if (old) { plane.position.copy(old.pos); plane.quaternion.copy(old.quat); }
    scene.add(plane);
  }
  // Rack i is visible while bomb i hasn't been dropped (drop order: 0 then 1).
  // No bombs on a stunt run — dead weight through the rings.
  function syncBombRacks() {
    for (let i = 0; i < bombRacks.length; i++) {
      bombRacks[i].visible = mapName === 'ocean' && gameMode !== 'stunt' && (2 - bombs) <= i;
    }
  }
  // Are the bombs droppable right now? Sortie: only once the strike phase is
  // unlocked. Tutorial: hot throughout the bombing lesson.
  const bombsHot = () => mapName === 'ocean'
    && (gameMode === 'tutorial' ? !!(tut && tut.id === 'bombs') : (gameMode === 'sortie' && missionPhase === 'strike'));
  buildPlayer();

  // Reset to the runway threshold (or the stern of the carrier deck on the
  // Ocean map), lined up to take off toward -Z, sitting tail-down at the
  // airframe's taildragger stance angle.
  function resetPlane() {
    const st = ac.stance || 0;
    if (mapName === 'ocean') {
      plane.position.set(
        OCEAN.ALLY.x,
        DECK_TOP + restHeight(ac, st),
        OCEAN.ALLY.z + CARRIER.DECK_LEN / 2 - 16,
      );
    } else {
      plane.position.set(0, restHeight(ac, st), CFG.RUNWAY_LEN / 2 - 60);
    }
    plane.quaternion.identity();
    plane.rotateX(st);
  }
  resetPlane();

  // ======================================================== STATE =========
  const vel = new THREE.Vector3(0, 0, 0);
  let throttle = 0;
  let gearDown = true;
  let gearAnim = 1; // 1 = down, 0 = up (animated)
  let started = false;
  let crashed = false;
  let onGround = true;
  let fov = 62;

  // Combat state
  let playerHP = ac.hp;
  let kills = 0;
  let sortieTookDamage = false; // did the player take any hit this sortie (for no-damage medals)
  let won = false;
  let engageStart = 0; // performance.now() at launch/respawn -> engagement clock
  let lockTarget = false; // is an enemy currently in the gun line?
  const enemies = []; // populated by spawnEnemies()

  // Smoothed control-surface deflections (for the visual animation).
  const defl = { ail: 0, elev: 0, rud: 0 };

  // Inputs
  const keys = Object.create(null);
  let mouseNX = 0; let mouseNY = 0; // raw mouse in [-1, 1] from the stage centre
  let firing = false;
  let fireCooldown = 0;

  // Reusable temporaries (avoid per-frame allocation in the hot path).
  const _fwd = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _vLocal = new THREE.Vector3();
  const _acc = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _camPos = new THREE.Vector3();
  const _camAim = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  const getForward = () => _fwd.set(0, 0, -1).applyQuaternion(plane.quaternion);
  const getUp = () => _up.set(0, 1, 0).applyQuaternion(plane.quaternion);
  const getRight = () => _right.set(1, 0, 0).applyQuaternion(plane.quaternion);
  // Attitude readouts for the tutorial goal checks (rad; bank + = right wing down).
  const bankNow = () => { getRight(); getUp(); return Math.atan2(-_right.y, _up.y); };
  const pitchNow = () => { getForward(); return Math.asin(clamp(_fwd.y, -1, 1)); };

  // Ground height under a world position (the terrain module returns exactly 0
  // on the flattened airfield disc, so the runway Just Works). On the Ocean
  // map the "ground" is the seabed — everywhere is over water, and the carrier
  // decks are handled separately (carrierDeckAt).
  const groundAt = (x, z) => {
    if (mapName === 'ocean') return OCEAN.FLOOR;
    return mapName === 'canyon' ? canyonHeight(x, z) : terrainHeight(x, z);
  };

  // Velocity-vector "grip" + coordinated bank-to-turn — the arcade trick that
  // stops a plane sliding sideways. The velocity DIRECTION is eased toward where
  // the nose points (speed preserved, so turns don't bleed energy), and banking
  // induces a coordinated yaw into the turn. Shared by the player and the AI so
  // both fly the same way. `eff` is control effectiveness [0..~1.15] (fades in
  // with airspeed), so grip/turn go mushy when slow or stalled.
  const _faFwd = new THREE.Vector3();
  const _faRight = new THREE.Vector3();
  const _faDir = new THREE.Vector3();
  function flightAssist(group, velo, eff, dt) {
    const sp = velo.length();
    if (sp < 1) return;
    _faFwd.set(0, 0, -1).applyQuaternion(group.quaternion);
    _faRight.set(1, 0, 0).applyQuaternion(group.quaternion);
    const frac = 1 - Math.exp(-CFG.GRIP * Math.max(eff, 0.15) * dt);
    _faDir.copy(velo).multiplyScalar(1 / sp).lerp(_faFwd, frac).normalize();
    velo.copy(_faDir).multiplyScalar(sp);
    // -_faRight.y = sin(bank): >0 when the right wing is down (banked right) ->
    // yaw right (group.rotateY negative is a nose-right yaw, per the controls).
    const sinBank = clamp(-_faRight.y, -1, 1);
    const yawStep = sinBank * CFG.TURN_COUPLING * eff * dt;
    group.rotateY(-yawStep);
    // A body-frame yaw at bank angle φ drops the nose below the horizon by
    // yaw·sin(φ); compensating body pitch-up of yaw·tan(φ) (capped) keeps the
    // turn level — the classic back-pressure of a coordinated turn, applied
    // automatically so turning doesn't secretly trade away all your altitude.
    const cosBank = Math.sqrt(Math.max(1 - sinBank * sinBank, 0.41)); // cap tan at ~50°
    group.rotateX(Math.abs(yawStep) * Math.abs(sinBank / cosBank) * 0.92);
  }

  // ======================================================== AUDIO =========
  // Fully procedural WebAudio: an engine drone (two detuned saws through a
  // lowpass, pitched by throttle + airspeed), noise-burst guns/hits/booms. No
  // audio assets needed, so the CSP stays untouched. Created lazily on the
  // first user gesture (the click that starts the game). M toggles mute.
  const audio = (() => {
    let ctx = null; let master = null; let engine = null;
    let noiseBuf = null; // 2 s of white noise; every shot plays a random slice
    let drive = null; // soft tanh waveshaper — gives the guns their punch
    let muted = false;
    let vol = 0.5;
    try {
      muted = localStorage.getItem('ps-muted') === '1';
      const v = parseFloat(localStorage.getItem('ps-vol'));
      if (Number.isFinite(v)) vol = clamp(v, 0, 1);
    } catch (_) { /* private mode */ }
    function ensure() {
      if (ctx) return;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : vol;
      master.connect(ctx.destination);
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 52.6;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
      o1.start(); o2.start();
      engine = {
        g, lp, o1, o2,
      };
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      drive = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(2.2 * x); }
      drive.curve = curve;
      drive.connect(master);
    }
    // One gun report: a noise "crack" through a collapsing lowpass plus a
    // pitch-dropping triangle thump, both saturated through the shared drive.
    // `far` softens it into the dull thudding of someone ELSE's guns.
    function shot(v, far) {
      if (!ctx || muted || !noiseBuf) return;
      const t = ctx.currentTime;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(far ? 750 : 3600 + Math.random() * 1400, t);
      lp.frequency.exponentialRampToValueAtTime(far ? 220 : 420, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * (0.85 + Math.random() * 0.3), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (far ? 0.13 : 0.09));
      n.connect(lp); lp.connect(g); g.connect(drive);
      n.start(t, Math.random() * 1.5, 0.16);
      n.stop(t + 0.18);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime((far ? 95 : 150) + Math.random() * 25, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.06);
      const og = ctx.createGain();
      og.gain.setValueAtTime(v * (far ? 0.55 : 0.95), t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(og); og.connect(drive);
      o.start(t); o.stop(t + 0.1);
    }
    // Rounds striking a target: a bright metallic snap over a dull thunk.
    function impact() {
      if (!ctx || muted || !noiseBuf) return;
      const t = ctx.currentTime;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 2200 + Math.random() * 900; bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(bp); bp.connect(g); g.connect(drive);
      n.start(t, Math.random() * 1.5, 0.08); n.stop(t + 0.1);
      const n2 = ctx.createBufferSource(); n2.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.55, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      n2.connect(lp); lp.connect(g2); g2.connect(drive);
      n2.start(t, Math.random() * 1.5, 0.1); n2.stop(t + 0.12);
    }
    // Explosion: a sub-bass drop, a long rumble and a short debris crackle.
    function explosion() {
      if (!ctx || muted || !noiseBuf) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(72, t);
      o.frequency.exponentialRampToValueAtTime(36, t + 0.7);
      const og = ctx.createGain();
      og.gain.setValueAtTime(1.4, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(og); og.connect(drive);
      o.start(t); o.stop(t + 1);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(560, t);
      lp.frequency.exponentialRampToValueAtTime(110, t + 1.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      n.connect(lp); lp.connect(g); g.connect(drive);
      n.start(t, Math.random() * 0.6, 1.3); n.stop(t + 1.3);
      const n2 = ctx.createBufferSource(); n2.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1300; bp.Q.value = 0.8;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.5, t + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      n2.connect(bp); bp.connect(g2); g2.connect(drive);
      n2.start(t + 0.03, Math.random() * 1.2, 0.4); n2.stop(t + 0.5);
    }
    function setEngine(thr, speed) {
      if (!engine) return;
      const f = 42 + thr * 68 + speed * 0.1;
      engine.o1.frequency.value = f;
      engine.o2.frequency.value = f * 1.012;
      engine.lp.frequency.value = 220 + thr * 780;
      engine.g.gain.value = 0.1 + thr * 0.22;
    }
    function toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : vol;
      try { localStorage.setItem('ps-muted', muted ? '1' : '0'); } catch (_) { /* private mode */ }
      return muted;
    }
    function setVolume(v) {
      vol = clamp(v, 0, 1);
      if (master && !muted) master.gain.value = vol;
      try { localStorage.setItem('ps-vol', String(vol)); } catch (_) { /* private mode */ }
    }
    return {
      ensure,
      setEngine,
      gun: () => shot(0.5, false),
      // Bandit guns heard at a distance: quieter and duller the farther out.
      gunFar: (dist) => shot(clamp(260 / Math.max(dist, 120), 0.06, 0.4), true),
      hit: impact,
      boom: explosion,
      toggleMute,
      isMuted: () => muted,
      setVolume,
      getVolume: () => vol,
      suspend: () => { if (ctx && ctx.state === 'running') ctx.suspend(); },
      resume: () => { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    };
  })();

  // ======================================================== TRACERS =======
  const tracerGeo = new THREE.BoxGeometry(0.12, 0.12, 3.2);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, fog: false }); // player: amber
  const enemyTracerMat = new THREE.MeshBasicMaterial({ color: 0xff5535, fog: false }); // bandit: red
  const tracers = [];
  const _tq = new THREE.Quaternion();
  const _tz = new THREE.Vector3(0, 0, 1);
  // Spawn one visible tracer round travelling `dir` (unit) at `speed`, drifting
  // with the firer's own velocity. Used by both the player guns and the AI.
  // Tracers are pooled: guns spawn dozens per second, so allocating a Mesh +
  // Vector3 per round churns the GC. Expired rounds go back on the free list.
  const tracerPool = [];
  function spawnTracer(pos, dir, speed, baseVel, mat) {
    const t = tracerPool.pop() || new THREE.Mesh(tracerGeo, mat);
    t.material = mat;
    t.position.copy(pos);
    t.quaternion.copy(_tq.setFromUnitVectors(_tz, dir)); // align the long axis with travel
    if (!t.userData.vel) t.userData.vel = new THREE.Vector3();
    t.userData.vel.copy(dir).multiplyScalar(speed).add(baseVel);
    t.userData.life = CFG.TRACER_LIFE;
    scene.add(t);
    tracers.push(t);
  }
  function stepTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.position.addScaledVector(t.userData.vel, dt);
      t.userData.life -= dt;
      if (t.userData.life <= 0) {
        scene.remove(t);
        tracerPool.push(t);
        tracers.splice(i, 1);
      }
    }
  }

  // ---- Hitscan: distance along a unit ray to where it first pierces a sphere,
  //      or -1 if it misses / is behind / is beyond maxDist. The visible tracers
  //      are cosmetic; this is what actually decides a hit. ----
  const _co = new THREE.Vector3();
  function rayHitsSphere(origin, dir, center, radius, maxDist) {
    _co.copy(center).sub(origin);
    const t = _co.dot(dir); // projection of centre onto the ray (dir is unit)
    if (t < 0 || t > maxDist) return -1;
    const d2 = _co.lengthSq() - t * t; // squared miss distance
    return d2 > radius * radius ? -1 : t;
  }

  // ---- Impact sparks / muzzle flashes: additive sprites that pop and fade. ----
  const sparkTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.4, 'rgba(255,150,40,0.9)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  // Sparks and smoke are pooled too (muzzle flashes alone are several sprites
  // per trigger-second): each sprite keeps its own material for independent
  // opacity, but the sprite+material pair is reused instead of re-allocated.
  const sparks = [];
  const sparkPool = [];
  function spawnSpark(pos, size, life) {
    const s = sparkPool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTex, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.material.opacity = 1;
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.userData = { life, maxLife: life, size };
    scene.add(s);
    sparks.push(s);
  }
  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.userData.life -= dt;
      const k = s.userData.life / s.userData.maxLife; // 1 -> 0
      if (k <= 0) {
        scene.remove(s);
        sparkPool.push(s);
        sparks.splice(i, 1);
        continue;
      }
      s.material.opacity = k;
      s.scale.setScalar(s.userData.size * (1 + (1 - k) * 1.6)); // expand as it fades
    }
  }

  // ---- Smoke: soft grey sprites that drift up, expand and fade. Used for
  //      damaged-engine trails and explosion aftermath. ----
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    g.addColorStop(0, 'rgba(70,70,74,0.85)');
    g.addColorStop(0.7, 'rgba(60,60,64,0.35)');
    g.addColorStop(1, 'rgba(55,55,58,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const smokes = [];
  const smokePool = [];
  function spawnSmoke(pos, size, life) {
    const s = smokePool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, depthWrite: false, transparent: true,
    }));
    s.material.opacity = 0.8;
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.userData = { life, maxLife: life, size };
    scene.add(s);
    smokes.push(s);
  }
  function stepSmokes(dt) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.userData.life -= dt;
      const k = s.userData.life / s.userData.maxLife;
      if (k <= 0) {
        scene.remove(s); smokePool.push(s); smokes.splice(i, 1);
        continue;
      }
      s.position.y += dt * 2.5;
      s.material.opacity = k * 0.8;
      s.scale.setScalar(s.userData.size * (1 + (1 - k) * 2.2));
    }
  }

  // ---- Debris: tumbling chunks thrown by a kill, falling under gravity. ----
  const debris = [];
  const debrisPool = [];
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.9 });
  const debrisGeo = new THREE.BoxGeometry(1, 0.5, 1.4); // unit chunk, scaled per instance
  function spawnDebris(pos, baseVel) {
    for (let i = 0; i < 6; i++) {
      const s = 0.3 + Math.random() * 0.9;
      const d = debrisPool.pop() || new THREE.Mesh(debrisGeo, debrisMat);
      d.scale.setScalar(s);
      d.position.copy(pos);
      if (!d.userData.vel) { d.userData.vel = new THREE.Vector3(); d.userData.rot = new THREE.Vector3(); }
      d.userData.vel.copy(baseVel).multiplyScalar(0.6);
      d.userData.vel.x += (Math.random() - 0.5) * 45;
      d.userData.vel.y += Math.random() * 30;
      d.userData.vel.z += (Math.random() - 0.5) * 45;
      d.userData.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.userData.life = 2.6;
      scene.add(d);
      debris.push(d);
    }
  }
  function stepDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.userData.life -= dt;
      d.userData.vel.y -= CFG.G * 2 * dt;
      d.position.addScaledVector(d.userData.vel, dt);
      d.rotation.x += d.userData.rot.x * dt;
      d.rotation.y += d.userData.rot.y * dt;
      d.rotation.z += d.userData.rot.z * dt;
      if (d.userData.life <= 0 || d.position.y < groundAt(d.position.x, d.position.z)) {
        scene.remove(d);
        debrisPool.push(d);
        debris.splice(i, 1);
      }
    }
  }

  // The player's wing guns: two amber tracers + a centreline hitscan (with the
  // same random spread the tracers show) that damages the nearest bandit.
  const _shot = new THREE.Vector3();
  function fireGuns() {
    // Clone the basis vectors — addScaledVector/clone below must not alias the
    // shared _fwd/_right temps (that bug fired tracers backwards at 4.5 m/s).
    const fwd = getForward().clone();
    const right = getRight().clone();
    const up = getUp().clone();
    _shot.copy(fwd)
      .addScaledVector(up, (Math.random() - 0.5) * 2 * ac.gunSpread)
      .addScaledVector(right, (Math.random() - 0.5) * 2 * ac.gunSpread)
      .normalize();
    const muzzle = plane.position.clone().addScaledVector(fwd, 4.5);
    for (const sx of [-1, 1]) {
      const mpos = muzzle.clone().addScaledVector(right, sx * 3.0);
      spawnTracer(mpos, _shot, CFG.TRACER_SPEED, vel, tracerMat);
      spawnSpark(mpos, 1.1, 0.06); // muzzle flash
    }
    audio.gun();
    // Hitscan along the (spread-jittered) shot line: damage the closest bandit.
    let bestT = ac.gunRange; let bestE = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const t = rayHitsSphere(muzzle, _shot, e.group.position, CFG.HITBOX_R, ac.gunRange);
      if (t >= 0 && t < bestT) { bestT = t; bestE = e; }
    }
    if (bestE) {
      spawnSpark(muzzle.clone().addScaledVector(_shot, bestT), 4, 0.18);
      audio.hit();
      damageEnemy(bestE, ac.gunDmg * diff.dmgMul);
    }
  }

  // ==================================================== OCEAN MISSION =====
  // The two wing bombs. B drops one (strike phase only): it falls as a free
  // body — inherits the aircraft's velocity, pulled by gravity, nose aligned
  // to the fall — and either lands on the enemy carrier's deck footprint (one
  // hit sinks her) or splashes. Both missed = the strike failed.
  const _bq = new THREE.Quaternion();
  const _bv = new THREE.Vector3();
  function dropBomb() {
    if (!bombsHot() || crashed || won || bombs <= 0 || enemySinking > 0) return;
    const rack = bombRacks[2 - bombs];
    bombs--;
    const b = makeBomb();
    rack.getWorldPosition(b.position);
    b.quaternion.copy(plane.quaternion);
    rack.visible = false;
    b.userData.vel = vel.clone();
    scene.add(b);
    liveBombs.push(b);
    updateObjective();
  }
  function bombResolved() {
    if (!(bombs <= 0 && liveBombs.length === 0 && enemySinking <= 0 && !won && !crashed)) return;
    if (gameMode === 'tutorial') {
      // A lesson never fails — hang two fresh bombs and send them back in.
      bombs = 2;
      syncBombRacks();
      toast('✚ BOMBS RE-ARMED — RUN IN AGAIN', 3500);
    } else if (gameMode === 'sortie' && missionPhase === 'strike') {
      // Last bomb spent and nothing sank her -> the strike has failed.
      missionFail('Both bombs missed — the enemy carrier steams on.');
    }
  }
  // A transient line on the warning banner.
  function toast(text, ms) {
    if (!hud.warn) return;
    hud.warn.textContent = text;
    hud.warn.classList.add('ps-show');
    setTimeout(() => { if (!crashed && hud.warn && hud.warn.textContent === text) hud.warn.classList.remove('ps-show'); }, ms);
  }
  function stepBombs(dt) {
    for (let i = liveBombs.length - 1; i >= 0; i--) {
      const b = liveBombs[i];
      const v = b.userData.vel;
      v.y -= CFG.G * dt;
      v.multiplyScalar(1 - 0.04 * dt); // light drag
      b.position.addScaledVector(v, dt);
      // Nose follows the fall.
      _bv.copy(v);
      if (_bv.lengthSq() > 1) {
        _bv.normalize();
        b.quaternion.slerp(_bq.setFromUnitVectors(FWD_REF, _bv), Math.min(1, 3 * dt));
      }
      // Impact: a carrier deck, or the sea.
      const hitDeck = carrierDeckAt(b.position.x, b.position.z);
      const enemyC = carriers[1];
      const onEnemyDeck = Math.abs(b.position.x - enemyC.x) <= CARRIER.DECK_W / 2
        && Math.abs(b.position.z - enemyC.z) <= CARRIER.DECK_LEN / 2;
      if (b.position.y <= hitDeck + 0.4 || b.position.y <= TERRAIN.WATER_Y + 0.2) {
        scene.remove(b);
        liveBombs.splice(i, 1);
        if (onEnemyDeck && b.position.y > TERRAIN.WATER_Y && enemySinking <= 0) {
          // Direct hit — fireball on deck, and down she goes.
          spawnSpark(b.position, 30, 0.9);
          spawnDebris(b.position, v);
          for (let k = 0; k < 10; k++) {
            spawnSmoke(b.position.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 24, Math.random() * 10, (Math.random() - 0.5) * 40,
            )), 8 + Math.random() * 8, 2.5 + Math.random() * 2);
          }
          audio.boom();
          enemySinking = 0.0001;
          updateObjective();
        } else {
          // Splash (or a dud on a friendly deck).
          spawnSpark(b.position, 8, 0.35);
          for (let k = 0; k < 4; k++) {
            spawnSmoke(b.position.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6,
            )), 3 + Math.random() * 3, 1.2);
          }
          audio.boom();
          bombResolved();
        }
      }
    }
    // Sink animation: settle by the bow, slip under, then the win card.
    if (enemySinking > 0 && !won && !crashed) {
      enemySinking += dt;
      const g = carriers[1].group;
      g.position.y -= dt * (0.6 + enemySinking * 0.28);
      g.rotation.x += dt * 0.012; // down by the bow (rotY=π flips the visual sense correctly)
      if (Math.random() < 0.5) {
        spawnSmoke(new THREE.Vector3(
          carriers[1].x + (Math.random() - 0.5) * 20,
          DECK_TOP + 4,
          carriers[1].z + (Math.random() - 0.5) * 80,
        ), 10 + Math.random() * 8, 2 + Math.random());
      }
      // The tutorial's end card fires on the hit itself; only the sortie waits
      // for her to slip under before calling the win.
      if (enemySinking > 4 && !sinkVictory) { sinkVictory = true; if (gameMode === 'sortie') victory(); }
    }
  }
  // Kills done on the Ocean map -> phase 2: guns fall silent, bombs go hot.
  function beginStrike() {
    missionPhase = 'strike';
    awayT = 0;
    updateObjective();
    if (hud.warn) {
      hud.warn.textContent = '✔ FLEET SAFE — NOW SINK THE ENEMY CARRIER (B drops a bomb)';
      hud.warn.classList.add('ps-show');
      setTimeout(() => { if (!crashed && hud.warn) hud.warn.classList.remove('ps-show'); }, 5000);
    }
  }
  // A mission loss that isn't your aircraft being destroyed.
  function missionFail(reason) {
    if (crashed || won || dev.god) return;
    crashed = true;
    started = true;
    audio.boom();
    showEnd(false, reason, false, 'Mission failed');
  }
  function updateObjective() {
    if (!hud.obj) return;
    if (mapName !== 'ocean' || gameMode !== 'sortie' || !started || crashed || won) { hud.obj.textContent = ''; return; }
    hud.obj.textContent = missionPhase === 'defend'
      ? 'OBJECTIVE — defend your carrier: splash every bandit near the fleet'
      : `OBJECTIVE — sink the enemy carrier · bombs ${bombs}/2 · press B over the target`;
  }

  // ======================================================== ENEMIES =======
  // AI bandits. Each keeps its own world-space velocity + throttle and is flown
  // by a pursuit controller that outputs the SAME pitch/roll/yaw/throttle inputs
  // a human would, then runs them through an integrator identical to the player's
  // (same CFG). They therefore obey the same stall, turn-rate and speed limits —
  // not over-assisted. Gunnery fires along the nose (+ jitter), so a bandit only
  // hits as well as it actually tracks you.
  const FWD_REF = new THREE.Vector3(0, 0, -1);
  const EN = { // enemy-only scratch (must not alias the player's _fwd/_q temps)
    fwd: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(),
    acc: new THREE.Vector3(), vDir: new THREE.Vector3(), vLocal: new THREE.Vector3(),
    q: new THREE.Quaternion(), toP: new THREE.Vector3(), aim: new THREE.Vector3(),
    desired: new THREE.Vector3(), local: new THREE.Vector3(),
    muzzle: new THREE.Vector3(), shotDir: new THREE.Vector3(), dirP: new THREE.Vector3(),
  };
  // Five spawn slots; how many actually fly comes from the player-picked
  // bandit count (1-5, start overlay / pause menu, applied on restart).
  const ENEMY_SPAWN = [
    { ang: -0.7, dist: 1500, alt: 300 },
    { ang: 0.15, dist: 2000, alt: 420 },
    { ang: 0.95, dist: 1300, alt: 240 },
    { ang: -1.7, dist: 1750, alt: 360 },
    { ang: 2.3, dist: 1600, alt: 280 },
  ];
  let enemyCountPref = (() => {
    try {
      const n = parseInt(localStorage.getItem('ps-count'), 10);
      return (n >= 1 && n <= ENEMY_SPAWN.length) ? n : 3;
    } catch (_) { return 3; }
  })();
  let activeCount = enemyCountPref; // the count this engagement was started with

  // ---- Difficulty. Scales the bandits' turn performance (turn = multiplier on
  //      their control effectiveness, so <1 means you out-turn them), gunnery
  //      (jitter/range/cone/interval), how long they'll grind a turn fight
  //      before breaking off (breakAfter), and YOUR gun damage (dmgMul — a
  //      rookie fight also means faster kills). Chosen on the start overlay or
  //      with 1/2/3; remembered across sessions. ----
  const DIFFS = {
    easy: {
      label: 'ROOKIE', turn: 0.55, jitterMul: 2.6, fireInt: 0.22, range: 520, cone: 0.990, breakAfter: 3.0, breakMin: 3.2, breakMax: 5.0, dmgMul: 3,
    },
    normal: {
      label: 'REGULAR', turn: 0.72, jitterMul: 1.6, fireInt: 0.17, range: 620, cone: 0.994, breakAfter: 4.5, breakMin: 2.4, breakMax: 4.0, dmgMul: 2,
    },
    hard: {
      label: 'ACE', turn: 0.90, jitterMul: 1.0, fireInt: 0.13, range: 700, cone: 0.997, breakAfter: 6.5, breakMin: 1.6, breakMax: 2.8, dmgMul: 1,
    },
  };
  const validDiff = (n) => n === 'easy' || n === 'normal' || n === 'hard';
  let diffName = (() => {
    try { const d = localStorage.getItem('ps-diff'); return validDiff(d) ? d : 'normal'; } catch (_) { return 'normal'; }
  })();
  let diff = DIFFS[diffName];
  function setDifficulty(name) {
    if (!validDiff(name)) return;
    diffName = name;
    diff = DIFFS[name];
    try { localStorage.setItem('ps-diff', name); } catch (_) { /* private mode */ }
    if (hud.diff) hud.diff.textContent = diff.label;
    if (diffBtns) for (const b of diffBtns) b.classList.toggle('ps-diff-active', b.dataset.diff === name);
  }

  function makeEnemy(spec) {
    // Bandits fly a random mix of the three airframes, with that type's REAL
    // stats — a Zero bandit out-turns you, a Mustang bandit outruns you, and
    // their hull strength differs to match (the HP bars show it).
    const type = PLANE_ORDER[Math.floor(Math.random() * PLANE_ORDER.length)];
    const { group, surf: esurf } = buildAircraft({ type, paint: CFG.ENEMY_PAINT, markings: false });
    applyControlSurfaces(esurf, { gear: 0 }); // bandits fly gear-up
    setPropBlur(esurf, 0.85); // airborne -> prop is a blur disc
    scene.add(group);
    return {
      group,
      surf: esurf,
      type,
      st: PLANE_TYPES[type].stats,
      vel: new THREE.Vector3(),
      throttle: 0.85,
      hp: PLANE_TYPES[type].stats.hp,
      alive: true,
      fireCd: Math.random() * 0.25,
      smokeCd: 0,
      propSpin: 0,
      defl: { ail: 0, elev: 0, rud: 0 },
      spec,
      // Behaviour: 'engage' (pursue + shoot) or 'break' (extend away + climb,
      // guns cold) — see stepEnemy. coTurn tracks how long we've been grinding a
      // close turn fight; underFire ticks up when we're being hit.
      mode: 'engage',
      modeT: 0,
      coTurn: 0,
      underFire: 0,
      // Per-bandit personality so the three don't fly identically.
      pers: {
        turnBias: 0.92 + Math.random() * 0.16, // 0.92..1.08
        jitterBias: 0.85 + Math.random() * 0.4, // 0.85..1.25 (gunnery spread)
        breakBias: 0.8 + Math.random() * 0.5, // 0.8..1.3 (how long before they extend)
        leadBias: 0.85 + Math.random() * 0.35, // 0.85..1.20 (how much they lead)
        alt: 180 + Math.random() * 260, // preferred working altitude when repositioning
      },
    };
  }

  // (Re)place a bandit at its spawn: airborne, level, cruising toward the field.
  function placeEnemy(e) {
    const { ang, dist, alt } = e.spec;
    e.group.position.set(Math.sin(ang) * dist, alt, -Math.cos(ang) * dist);
    EN.desired.set(-e.group.position.x, 0, -e.group.position.z).normalize(); // toward origin
    e.group.quaternion.setFromUnitVectors(FWD_REF, EN.desired);
    e.vel.copy(EN.desired).multiplyScalar(95);
    e.throttle = 0.85;
    e.hp = e.st.hp;
    e.alive = true;
    e.group.visible = true;
    e.defl.ail = 0; e.defl.elev = 0; e.defl.rud = 0;
    e.mode = 'engage'; e.modeT = 0; e.coTurn = 0; e.underFire = 0;
  }

  // How many bandits this mode wants aloft: the player-picked count in a
  // sortie, exactly one (non-firing) in the gunnery lesson, none anywhere else.
  const desiredEnemyCount = () => {
    if (gameMode === 'sortie') return enemyCountPref;
    if (gameMode === 'tutorial' && tut && tut.def.bandit) return 1;
    return 0;
  };
  // All five airframes are built once; an engagement activates the first
  // `desiredEnemyCount()` of them and parks the rest (invisible, not alive).
  function applyEnemyActivation() {
    activeCount = desiredEnemyCount();
    enemies.forEach((e, i) => {
      if (i < activeCount) {
        placeEnemy(e);
        e.group.visible = !menuMode; // menus keep bandits off-camera
      } else { e.alive = false; e.group.visible = false; }
    });
  }
  function spawnEnemies() {
    for (const spec of ENEMY_SPAWN) enemies.push(makeEnemy(spec));
    applyEnemyActivation();
  }
  function resetEnemies() { applyEnemyActivation(); }
  function setEnemyCount(n) {
    if (!(n >= 1 && n <= ENEMY_SPAWN.length)) return;
    enemyCountPref = n;
    try { localStorage.setItem('ps-count', String(n)); } catch (_) { /* private mode */ }
    for (const b of document.querySelectorAll('[data-count]')) {
      b.classList.toggle('ps-diff-active', +b.dataset.count === n);
    }
    // Not yet flying (or already over)? Apply immediately; mid-fight it waits
    // for the restart so the kill tally stays honest.
    if (!started || crashed || won || onGround) {
      resetEnemies();
      kills = 0;
      updateCombatHUD();
    }
  }

  // ---- Aircraft selection (start overlay / pause menu; remembered). The
  //      model is rebuilt in place; the stat block swaps live. Mid-flight the
  //      hull is scaled to the new maximum so switching isn't a free heal. ----
  function setPlaneType(name) {
    if (!validPlane(name) || name === planeName) return;
    const hpFrac = playerHP / ac.hp;
    planeName = name;
    ac = PLANE_TYPES[name].stats;
    playerHP = Math.round(ac.hp * clamp(hpFrac, 0, 1));
    try { localStorage.setItem('ps-plane', name); } catch (_) { /* private mode */ }
    buildPlayer();
    syncPlaneUI();
    updateCombatHUD();
  }
  function syncPlaneUI() {
    for (const b of document.querySelectorAll('[data-plane]')) {
      b.classList.toggle('ps-diff-active', b.dataset.plane === planeName);
    }
    const info = PLANE_TYPES[planeName];
    for (const el of document.querySelectorAll('.ps-plane-desc')) el.textContent = info.desc;
    if (hud.plane) hud.plane.textContent = info.label.toUpperCase();
  }

  function stepEnemy(e, dt, canFire) {
    const g = e.group;

    // ---- Pursuit controller -> stick inputs ----
    EN.toP.copy(plane.position).sub(g.position);
    const dist = EN.toP.length();

    // --- Behaviour state machine: don't grind one endless turn circle. While
    //     'engage', co-turn time builds up in a close fight (faster when we're
    //     taking fire); once it tops out we 'break' — extend away + climb with
    //     guns cold for a few seconds — then re-engage from a fresh merge. This
    //     resets the geometry and lets the player convert instead of waiting
    //     forever for an opening. ---
    e.underFire = Math.max(0, e.underFire - dt);
    if (e.mode === 'engage') {
      if (dist < 480) e.coTurn += dt * (e.underFire > 0 ? 2.6 : 1);
      else e.coTurn = Math.max(0, e.coTurn - dt * 2);
      if (e.coTurn > diff.breakAfter * e.pers.breakBias) {
        e.mode = 'break';
        e.modeT = diff.breakMin + Math.random() * (diff.breakMax - diff.breakMin);
        e.coTurn = 0;
      }
    } else {
      e.modeT -= dt;
      if (e.modeT <= 0) { e.mode = 'engage'; e.coTurn = 0; }
    }
    const engaging = e.mode === 'engage';

    // --- Aim point ---
    if (engaging) {
      // Lead the target a little (capped). This only AIMS the nose; the guns
      // fire along the nose, so it's no aimbot.
      const lead = clamp(dist / CFG.AI_LEAD, 0, 1.6) * e.pers.leadBias;
      EN.aim.copy(plane.position).addScaledVector(vel, lead);
    } else {
      // Extend: run away from the player and climb to rebuild energy.
      EN.dirP.copy(EN.toP).multiplyScalar(-1 / Math.max(dist, 0.001));
      EN.aim.copy(g.position).addScaledVector(EN.dirP, 900);
      EN.aim.y = e.pers.alt + 150;
    }
    // Stay in the box + off the deck: near a wall, steer back toward the centre.
    if (Math.max(Math.abs(g.position.x), Math.abs(g.position.z)) > CFG.BORDER - 400) {
      EN.aim.set(0, Math.max(e.pers.alt, 260), 0);
    }
    EN.desired.copy(EN.aim).sub(g.position);
    if (EN.desired.lengthSq() < 1e-6) EN.desired.copy(FWD_REF);
    EN.desired.normalize();

    EN.q.copy(g.quaternion).invert();
    EN.local.copy(EN.desired).applyQuaternion(EN.q); // desired dir in body frame
    const yawErr = Math.atan2(EN.local.x, -EN.local.z); // + => target to the right
    const pitchErr = Math.atan2(EN.local.y, Math.hypot(EN.local.x, EN.local.z)); // + => above nose

    let rollInput = clamp(yawErr * 1.5, -1, 1); // bank toward the target
    let pitchInput = clamp(pitchErr * 1.5 + Math.abs(yawErr) * 0.35, -1, 1); // pull into the turn
    const yawInput = clamp(yawErr * 0.4, -1, 1); // a little coordinating rudder

    // Terrain avoidance: probe the ground here and ~2.5 s ahead; if we're
    // sinking toward it, level the wings and pull.
    const ghHere = Math.max(groundAt(g.position.x, g.position.z), TERRAIN.WATER_Y);
    const ghAhead = Math.max(groundAt(g.position.x + e.vel.x * 2.5, g.position.z + e.vel.z * 2.5), TERRAIN.WATER_Y);
    const floor = Math.max(ghHere, ghAhead);
    if (g.position.y < floor + 90) { pitchInput = Math.max(pitchInput, 0.7); rollInput *= 0.3; }
    if (g.position.y < floor + 45) { pitchInput = 1; rollInput = 0; }

    let thrTarget = 0.9;
    const speed = e.vel.length();
    if (engaging && dist < 130) thrTarget = 0.55; // don't overshoot/ram
    if (!engaging) thrTarget = 1; // extend hard
    if (speed < 60) thrTarget = 1; // never mush into a stall
    e.throttle = clamp(e.throttle + clamp(thrTarget - e.throttle, -dt, dt), 0, 1);

    // ---- Flight integration: identical model as the player, driven by this
    //      bandit's own airframe stats (gear-up) ----
    const st = e.st;
    const v2 = speed * speed;
    EN.vLocal.copy(e.vel).applyQuaternion(EN.q);
    const fwdSpeed = -EN.vLocal.z;
    const aoa = Math.atan2(-EN.vLocal.y, Math.max(fwdSpeed, 0.001));
    const clMax = CFG.CL_SLOPE * CFG.A_STALL;
    let CL;
    if (Math.abs(aoa) <= CFG.A_STALL) CL = CFG.CL_SLOPE * aoa;
    else CL = Math.sign(aoa) * Math.max(0, clMax - (Math.abs(aoa) - CFG.A_STALL) * CFG.CL_SLOPE * 1.7);
    const stalled = Math.abs(aoa) > CFG.A_STALL && speed > 4;

    EN.fwd.copy(FWD_REF).applyQuaternion(g.quaternion);
    EN.up.set(0, 1, 0).applyQuaternion(g.quaternion);
    EN.acc.set(0, 0, 0);
    EN.acc.addScaledVector(EN.fwd, e.throttle * st.thrust);
    EN.acc.addScaledVector(EN.up, st.lift * v2 * CL);
    EN.acc.y -= CFG.G;
    if (speed > 0.01) {
      const cd = st.drag0 + CFG.DRAG_IND * CL * CL;
      EN.vDir.copy(e.vel).multiplyScalar(1 / speed);
      EN.acc.addScaledVector(EN.vDir, -cd * v2);
    }
    e.vel.addScaledVector(EN.acc, dt);
    g.position.addScaledVector(e.vel, dt);

    let eff = clamp(speed / st.controlV, 0, 1.15) * stiffen(st, speed);
    if (stalled) eff *= 0.45;
    eff *= diff.turn * e.pers.turnBias; // difficulty/personality turn handicap
    g.rotateX(pitchInput * st.pitchRate * eff * dt);
    g.rotateZ(-rollInput * st.rollRate * eff * dt);
    g.rotateY(-yawInput * CFG.YAW_RATE * eff * dt);
    if (stalled && fwdSpeed > 0) g.rotateX(-(Math.abs(aoa) - CFG.A_STALL) * 1.6 * dt);
    flightAssist(g, e.vel, eff, dt); // same grip + coordinated turn as the player

    // hard floor: never tunnel into the terrain
    if (g.position.y < ghHere + 12) { g.position.y = ghHere + 12; if (e.vel.y < 0) e.vel.y = 0; }

    // ---- Visual: prop spin + control-surface deflection + damage smoke ----
    e.propSpin -= (0.2 + e.throttle * 0.8) * 60 * dt;
    if (e.surf.prop) e.surf.prop.rotation.z = e.propSpin;
    e.defl.ail += (rollInput * 0.4 - e.defl.ail) * 0.2;
    e.defl.elev += (pitchInput * 0.4 - e.defl.elev) * 0.2;
    e.defl.rud += (yawInput * 0.5 - e.defl.rud) * 0.2;
    applyControlSurfaces(e.surf, {
      ail: e.defl.ail, elev: e.defl.elev, rud: e.defl.rud, gear: 0,
    });
    if (e.hp < 40) {
      e.smokeCd -= dt;
      if (e.smokeCd <= 0) {
        e.smokeCd = 0.07;
        EN.muzzle.copy(g.position).addScaledVector(EN.fwd, -3); // tail
        spawnSmoke(EN.muzzle, 2.2 + Math.random(), 1.2);
      }
    }

    // ---- Gunnery: fire along the nose (+ jitter) when close and roughly lined
    //      up. Accuracy falls off with range because the same angular jitter
    //      misses the hitbox by more the farther away you are. ----
    e.fireCd -= dt;
    if (canFire && engaging && dist < diff.range) {
      EN.dirP.copy(EN.toP).multiplyScalar(1 / Math.max(dist, 0.001)); // unit dir to player
      if (EN.fwd.dot(EN.dirP) > diff.cone && e.fireCd <= 0) {
        e.fireCd = diff.fireInt;
        const j = CFG.AI_AIM_JITTER * diff.jitterMul * e.pers.jitterBias;
        EN.shotDir.copy(EN.fwd)
          .addScaledVector(EN.up, (Math.random() - 0.5) * 2 * j)
          .addScaledVector(EN.right.copy(EN.fwd).cross(EN.up), (Math.random() - 0.5) * 2 * j)
          .normalize();
        EN.muzzle.copy(g.position).addScaledVector(EN.fwd, 4.5);
        spawnTracer(EN.muzzle, EN.shotDir, CFG.TRACER_SPEED, e.vel, enemyTracerMat);
        const gd = e.group.position.distanceTo(plane.position);
        if (gd < 900) audio.gunFar(gd);
        const t = rayHitsSphere(EN.muzzle, EN.shotDir, plane.position, CFG.HITBOX_R, diff.range);
        // Bandit rounds do a flat CFG.GUN_DMG regardless of airframe so the
        // difficulty tiers stay the balance knob (their AIRFRAME quirks already
        // vary threat: a Zero tracks you longer, a P-51 catches you).
        if (t >= 0) damagePlayer(CFG.GUN_DMG, EN.dirP.copy(EN.muzzle).addScaledVector(EN.shotDir, t));
      }
    }
  }

  // ---- Damage / death ----
  function damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg;
    if (tut) tut.hitFlag = true; // gunnery lesson: "landed a hit" goal
    e.underFire = 0.8; // being hit -> accelerates toward a break (jink away)
    if (e.hp <= 0) {
      e.alive = false;
      e.group.visible = false;
      spawnSpark(e.group.position, 22, 0.7); // fireball
      spawnDebris(e.group.position, e.vel);
      for (let i = 0; i < 7; i++) {
        spawnSmoke(e.group.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10,
        )), 5 + Math.random() * 5, 1.6 + Math.random());
      }
      audio.boom();
      kills += 1;
      // First Blood counts in any mode (the gunnery lesson too); the kill-count
      // ladder only counts real sorties above Rookie — the server enforces both.
      achievements.emit({ t: 'kill', mode: gameMode, diff: diffName });
      updateCombatHUD();
      if (kills >= activeCount && !won && gameMode === 'sortie') {
        // Coastal: last bandit down = win. Ocean: it unlocks the strike phase.
        // (The gunnery lesson's kill is scored by the tutorial engine instead.)
        if (mapName === 'ocean') { if (missionPhase === 'defend') beginStrike(); } else victory();
      }
    }
  }

  function damagePlayer(dmg, at) {
    if (crashed || won || dev.god) return;
    playerHP -= dmg;
    sortieTookDamage = true; // forfeits the no-damage medals for this sortie
    flashDamage();
    audio.hit();
    if (at) spawnSpark(at, 2.6, 0.14);
    if (playerHP <= 0) { playerHP = 0; updateCombatHUD(); crash('Downed by enemy fire', true); return; }
    updateCombatHUD();
  }

  // The end screen: a victory / defeat card with a scoreboard (aircraft flown,
  // bandits downed, hull left, skill, time). Click it or press SPACE to fly
  // again. Replaces the old one-line warn banner.
  function fmtTime(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function showEnd(win, reason, combat, title, sub, icon) {
    const ov = document.getElementById('ps-end');
    if (hud.warn) hud.warn.classList.remove('ps-show'); // the card supersedes the banner
    if (hud.obj) hud.obj.textContent = '';
    if (!ov) return;
    const el = (id) => document.getElementById(id);
    ov.classList.remove('ps-hidden', 'ps-win', 'ps-lose');
    ov.classList.add(win ? 'ps-win' : 'ps-lose');
    if (el('ps-end-icon')) el('ps-end-icon').textContent = icon || (win ? '🏆' : '💥');
    // "Shot down" only for enemy fire; anything you fly into is a "Crashed";
    // an explicit title (e.g. "Mission failed", "Lesson complete") overrides both.
    if (el('ps-end-title')) el('ps-end-title').textContent = title || (win ? 'Victory' : (combat ? 'Shot down' : 'Crashed'));
    if (el('ps-end-sub')) {
      el('ps-end-sub').textContent = sub || (win
        ? (mapName === 'ocean'
          ? 'The enemy carrier slips beneath the waves. The fleet is yours.'
          : `All ${activeCount} bandit${activeCount > 1 ? 's' : ''} cleared from the valley.`)
        : reason);
    }
    const stats = el('ps-end-stats');
    if (stats) {
      const time = fmtTime(engageStart ? performance.now() - engageStart : 0);
      let rows;
      if (gameMode === 'stunt' && stunt) {
        rows = [
          ['Course', stunt.def.label],
          ['Score', String(stunt.score)],
          ['Rings', `${stunt.hits} / ${stunt.rings.length}`],
          ['Aircraft', PLANE_TYPES[planeName].label],
          ['Time', fmtTime(stunt.t * 1000)],
        ];
      } else if (gameMode === 'tutorial' && tut) {
        rows = [
          ['Lesson', tut.def.label],
          ['Step', `${Math.min(tut.step + 1, tut.def.steps.length)} / ${tut.def.steps.length}`],
          ['Aircraft', PLANE_TYPES[planeName].label],
          ['Time', time],
        ];
      } else {
        const hullPct = Math.max(0, Math.round((playerHP / ac.hp) * 100));
        rows = [
          ['Aircraft', PLANE_TYPES[planeName].label],
          ['Bandits downed', `${kills} / ${activeCount}`],
          ['Hull remaining', `${hullPct}%`],
          ['Skill', diff.label],
          ['Time', time],
        ];
      }
      stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    }
    // A finished lesson offers the next one directly from the card.
    const nextBtn = el('ps-end-next');
    if (nextBtn) {
      const nextId = (win && gameMode === 'tutorial' && tut)
        ? TUT_ORDER[TUT_ORDER.indexOf(tut.id) + 1] : null;
      nextBtn.style.display = nextId ? '' : 'none';
      if (nextId) {
        nextBtn.textContent = `Next: ${TUT[nextId].label} ›`;
        nextBtn.dataset.tutNext = nextId;
      }
    }
  }
  function hideEnd() {
    const ov = document.getElementById('ps-end');
    if (ov) ov.classList.add('ps-hidden');
  }

  function victory() {
    won = true;
    if (gameMode === 'sortie') {
      achievements.emit({
        t: 'sortieClear',
        map: mapName,
        diff: diffName,
        hullPct: Math.max(0, Math.round((playerHP / ac.hp) * 100)),
        bandits: activeCount,
        tookDamage: sortieTookDamage,
      });
    }
    showEnd(true);
  }

  // ======================================================== INPUT =========
  const stage = document.getElementById('ps-stage') || canvas;
  const reticle = document.getElementById('ps-reticle');

  // Difficulty / bandit-count / camera pickers live on BOTH the start overlay
  // and the pause menu; wire them all. mousedown stopPropagation so clicking a
  // button on the start overlay selects it instead of also starting the game
  // (the stage's mousedown handler calls start()).
  const diffBtns = document.querySelectorAll('[data-diff]');
  for (const b of diffBtns) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); setDifficulty(b.dataset.diff); });
  }
  for (const b of document.querySelectorAll('[data-count]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); setEnemyCount(+b.dataset.count); });
  }
  for (const b of document.querySelectorAll('[data-plane]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); setPlaneType(b.dataset.plane); });
  }
  // Swap the visible world without touching the saved sortie preference —
  // tutorial/stunt chapters borrow whichever map they need.
  function applyWorld(name) {
    mapName = name;
    if (name === 'canyon') ensureCanyon();
    landGroup.visible = name === 'coastal';
    oceanGroup.visible = name === 'ocean';
    canyonGroup.visible = name === 'canyon';
  }
  // Map picker (sortie chapter screen). Switching worlds re-parks the aircraft
  // on the new map's deck/runway and resets the engagement; remembered.
  function setMap(name) {
    if (!validMap(name)) return;
    try { localStorage.setItem('ps-map', name); } catch (_) { /* private mode */ }
    for (const t of document.querySelectorAll('[data-map]')) {
      t.classList.toggle('ps-active', t.dataset.map === name);
    }
    applyWorld(name);
    respawnBase();
  }
  for (const t of document.querySelectorAll('[data-map]')) {
    t.addEventListener('mousedown', (ev) => ev.stopPropagation());
    t.addEventListener('click', (ev) => { ev.stopPropagation(); setMap(t.dataset.map); });
  }
  function setCamPreset(name) {
    if (!CAM_PRESETS[name]) return;
    camName = name;
    try { localStorage.setItem('ps-cam', name); } catch (_) { /* private mode */ }
    for (const b of document.querySelectorAll('[data-cam]')) {
      b.classList.toggle('ps-diff-active', b.dataset.cam === name);
    }
  }
  for (const b of document.querySelectorAll('[data-cam]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); setCamPreset(b.dataset.cam); });
  }
  // Unit pickers (speed / altitude / distance).
  for (const [kind, table, key] of [
    ['speed', SPEED_UNITS, 'ps-u-speed'], ['alt', ALT_UNITS, 'ps-u-alt'], ['dist', DIST_UNITS, 'ps-u-dist'],
  ]) {
    for (const b of document.querySelectorAll(`[data-u${kind}]`)) {
      b.addEventListener('mousedown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setUnit(kind, b.dataset[`u${kind}`], table, key); });
    }
  }

  // ---- Achievements. Login-gated career tracking rendered into the Medals
  //      tab. The game calls achievements.emit({...}) at decisive moments; the
  //      events queue and flush to /games/plane-sim/stats (the SERVER decides
  //      what each event does — never a client total), and the returned stat
  //      blob is diffed to toast fresh unlocks. Logged out: emit is a no-op and
  //      the tab shows a login prompt. ----
  const achievements = (() => {
    let boot = { loggedIn: false, csrf: null, stats: null };
    try {
      const el = document.getElementById('ps-ach-boot');
      if (el && el.textContent) boot = JSON.parse(el.textContent) || boot;
    } catch (_) { boot = { loggedIn: false, csrf: null, stats: null }; }
    const bodyEl = document.getElementById('ps-ach-body');
    const toastWrap = document.getElementById('ps-ach-toasts');
    let stats = boot.stats || null;
    let unlocked = unlockedIds(stats || undefined);
    let queue = [];
    let flushTimer = 0;
    let rendered = false;

    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const medal = (tier, on) => `<div class="ps-medal ps-medal-${tier}${on ? '' : ' ps-medal-locked'}"></div>`;
    const pct = (n) => `${Math.max(0, Math.min(100, n * 100)).toFixed(0)}%`;

    function render() {
      if (!bodyEl) return;
      if (!boot.loggedIn) {
        bodyEl.innerHTML = '<div class="ps-ach-empty">Achievements track your career across sorties, '
          + 'lessons and stunt runs — but only with an account.<br>Log in with Discord to start earning medals.'
          + '<a class="ps-ach-login" href="/auth/discord/login">Log in with Discord</a></div>';
        rendered = true;
        return;
      }
      const board = computeAchievements(stats || undefined);
      let h = '<div class="ps-ach-summary">'
        + `<div class="ps-ach-count"><b>${board.earned} / ${board.total}</b><span>Medals earned</span></div>`
        + `<div class="ps-ach-progress"><span style="width:${pct(board.total ? board.earned / board.total : 0)}"></span></div>`
        + '<div class="ps-ach-tiers">';
      for (const t of ['bronze', 'silver', 'gold', 'platinum']) {
        const bt = board.byTier[t];
        h += `<div class="ps-ach-tier">${medal(t, bt.earned > 0)}${TIER_META[t].label} ${bt.earned}/${bt.total}</div>`;
      }
      h += '</div></div>';
      for (const cat of CATEGORIES) {
        const items = board.items.filter((i) => i.cat === cat.id);
        if (!items.length) continue;
        h += `<div class="ps-ach-cat">${esc(cat.label)}</div><div class="ps-ach-grid">`;
        for (const it of items) {
          const label = it.objective
            ? (it.unlocked ? 'Complete' : 'Locked')
            : `${Math.min(it.value, it.target).toLocaleString()} / ${it.target.toLocaleString()}`;
          h += `<div class="ps-ach-card${it.unlocked ? ' ps-ach-on' : ''}">`
            + `<div class="ps-ach-name">${esc(it.name)}</div>`
            + medal(it.tier, it.unlocked)
            + `<div class="ps-ach-desc">${esc(it.desc)}</div>`
            + `<div class="ps-ach-cbar"><span style="width:${pct(it.pct)}"></span></div>`
            + `<div class="ps-ach-val">${esc(label)}</div>`
            + '</div>';
        }
        h += '</div>';
      }
      bodyEl.innerHTML = h;
      rendered = true;
    }

    function popToast(item) {
      if (!toastWrap) return;
      const el = document.createElement('div');
      el.className = 'ps-ach-toast';
      el.innerHTML = medal(item.tier, true)
        + `<div><div class="ps-t-cap">Achievement unlocked</div><div class="ps-t-name">${esc(item.name)}</div></div>`;
      toastWrap.appendChild(el);
      requestAnimationFrame(() => el.classList.add('ps-show'));
      setTimeout(() => {
        el.classList.remove('ps-show');
        setTimeout(() => el.remove(), 450);
      }, 4200);
    }

    function applyStats(next) {
      if (!next) return;
      const before = unlocked;
      stats = next;
      unlocked = unlockedIds(stats);
      const board = computeAchievements(stats);
      for (const it of board.items) if (it.unlocked && !before.has(it.id)) popToast(it);
      if (rendered) render();
    }

    async function flush() {
      flushTimer = 0;
      if (!boot.loggedIn || !boot.csrf || !queue.length) { queue = []; return; }
      const batch = queue.splice(0, 64);
      try {
        const r = await fetch('/games/plane-sim/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf: boot.csrf, events: batch }),
          keepalive: true,
        });
        if (!r.ok) return;
        const data = await r.json();
        if (data && data.stats) applyStats(data.stats);
      } catch (_) { /* offline/transient — the medal just won't tick this time */ }
    }
    function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(flush, 500); }

    function emit(ev) {
      if (!boot.loggedIn) return;
      queue.push(ev);
      scheduleFlush();
    }

    // Best-effort flush of anything still queued when the tab is closing.
    window.addEventListener('pagehide', () => { if (queue.length) flush(); });
    const tabBtn = document.querySelector('[data-tab="achievements"]');
    if (tabBtn) tabBtn.addEventListener('click', render);
    render(); // pre-render so the first open of the tab is instant

    return { emit, render };
  })();

  // ---- Pause / settings menu (ESC or the corner ⚙). Mid-flight it freezes
  //      the sim (dt = 0) and suspends audio; opened from a menu screen it's
  //      just a settings panel (nothing to pause). Tabs: Medals | General |
  //      Graphics. Aircraft/bandit setup deliberately does NOT live here —
  //      those are pre-game choices on the hangar and sortie screens. ----
  const pauseOv = document.getElementById('ps-pause');
  const pauseTitle = document.getElementById('ps-pause-title');
  const resumeBtn = document.getElementById('ps-resume');
  let userPaused = false;
  let settingsOpen = false; // overlay shown from a menu screen (no pause needed)
  function syncPauseChrome() {
    const flying = started && !menuMode;
    if (pauseTitle) pauseTitle.textContent = flying ? 'Paused' : 'Settings';
    if (resumeBtn) resumeBtn.textContent = flying ? 'Resume (ESC)' : 'Close (ESC)';
  }
  function setPaused(on) {
    userPaused = !!on;
    firing = false;
    if (pauseOv) pauseOv.classList.toggle('ps-hidden', !userPaused && !settingsOpen);
    if (userPaused) audio.suspend(); else audio.resume();
    syncPauseChrome();
  }
  function showSettings(on) {
    if (started && !menuMode) { setPaused(on); return; }
    settingsOpen = !!on;
    if (pauseOv) pauseOv.classList.toggle('ps-hidden', !settingsOpen);
    syncPauseChrome();
  }
  const settingsShowing = () => userPaused || settingsOpen;
  // The single close path for the pause/settings overlay (Resume, ✕, click the
  // dark backdrop, or a menu transition all route here) so it can never linger.
  function dismissSettings() { setPaused(false); showSettings(false); }
  resumeBtn?.addEventListener('click', dismissSettings);
  document.getElementById('ps-pause-x')?.addEventListener('click', dismissSettings);
  // Click on the backdrop itself (not the card or its controls) closes it.
  pauseOv?.addEventListener('mousedown', (ev) => { if (ev.target === pauseOv) dismissSettings(); });
  document.getElementById('ps-settings-btn')?.addEventListener('click', () => {
    showSettings(!settingsShowing());
  });
  // Tab strip: one pane visible at a time.
  for (const t of document.querySelectorAll('.ps-tab')) {
    t.addEventListener('click', () => {
      for (const o of document.querySelectorAll('.ps-tab')) o.classList.toggle('ps-tab-active', o === t);
      for (const p of document.querySelectorAll('.ps-tabpane')) {
        p.style.display = p.dataset.pane === t.dataset.tab ? '' : 'none';
      }
    });
  }
  // Graphics quality: the world (terrain mesh, forests, textures) is baked at
  // boot, so a tier change saves the choice and reloads the sim. Guarded so
  // re-clicking the active tier does nothing.
  for (const b of document.querySelectorAll('[data-gfx]')) {
    b.classList.toggle('ps-diff-active', b.dataset.gfx === GFX_LEVEL);
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const name = b.dataset.gfx;
      if (!GFX_LEVELS.includes(name) || name === GFX_LEVEL) return;
      try { localStorage.setItem('ps-gfx', name); } catch (_) { /* private mode */ }
      const hint = document.getElementById('ps-gfx-hint');
      if (hint) hint.textContent = 'Applying — reloading the sim…';
      window.location.reload();
    });
  }
  const volSlider = document.getElementById('ps-vol');
  if (volSlider) {
    volSlider.value = String(Math.round(audio.getVolume() * 100));
    volSlider.addEventListener('input', () => { audio.setVolume((+volSlider.value) / 100); });
  }

  // ---- Menu flow: loading screen -> hangar (3D plane select) -> map select
  //      -> sortie. The hangar overlay is transparent, so the live scene
  //      behind it IS the turntable: the camera orbits the fighter parked on
  //      the runway while arrows swap the airframe in place. ----
  const menuEl = document.getElementById('ps-menu');
  const modeMenuEl = document.getElementById('ps-mode-menu');
  const mapMenuEl = document.getElementById('ps-map-menu');
  const tutMenuEl = document.getElementById('ps-tut-menu');
  const stuntMenuEl = document.getElementById('ps-stunt-menu');
  const menuNameEl = document.getElementById('ps-menu-name');
  const menuStatsEl = document.getElementById('ps-mstats');
  let menuMode = null; // null (flying) | 'plane' | 'mode' | 'sortie' | 'tutorial' | 'stunt'
  let menuAngle = 2.35; // hangar orbit angle, advanced each frame
  const SPEED_LBL = { kn: 'kn', mph: 'mph', kmh: 'km/h' };

  // Stats panel: name, blurb, the five 0-1 ratings as bars, and hard numbers
  // (top speed in the player's speed unit). Content is our own static
  // catalogue — nothing user-supplied goes through innerHTML.
  function renderMenuStats() {
    const info = PLANE_TYPES[planeName];
    if (menuNameEl) menuNameEl.textContent = info.label.toUpperCase();
    if (!menuStatsEl) return;
    const specs = planeSpecs(planeName);
    const st = info.stats;
    const su = SPEED_UNITS[unit.speed];
    const top = Math.round(Math.sqrt(st.thrust / st.drag0) * su.f);
    const bars = Object.entries(specs.ratings).map(([k, v]) => (
      `<div class="ps-mbar"><span class="ps-mbar-l">${k}</span>`
      + `<span class="ps-mbar-t"><span class="ps-mbar-f" style="width:${Math.round(16 + v * 84)}%"></span></span></div>`
    )).join('');
    menuStatsEl.innerHTML = `<div class="ps-mdesc">${info.desc}</div>${bars}`
      + `<div class="ps-mchips"><span>TOP ${top} ${SPEED_LBL[unit.speed] || unit.speed}</span>`
      + `<span>HULL ${st.hp}</span><span>GUNS ${Math.round(st.gunDmg / st.fireInterval)} DPS</span></div>`;
  }

  function setMenu(mode) {
    // Every menu transition (including starting a flight, mode === null) first
    // dismisses the pause/settings overlay, so it can never be left on screen.
    dismissSettings();
    menuMode = mode;
    if (menuEl) menuEl.classList.toggle('ps-hidden', mode !== 'plane');
    if (modeMenuEl) modeMenuEl.classList.toggle('ps-hidden', mode !== 'mode');
    if (mapMenuEl) mapMenuEl.classList.toggle('ps-hidden', mode !== 'sortie');
    if (tutMenuEl) tutMenuEl.classList.toggle('ps-hidden', mode !== 'tutorial');
    if (stuntMenuEl) stuntMenuEl.classList.toggle('ps-hidden', mode !== 'stunt');
    stage.classList.toggle('ps-in-menu', !!mode);
    // Bandits have no business photobombing the hangar turntable.
    for (const e of enemies) e.group.visible = e.alive && !mode;
    if (mode === 'plane') renderMenuStats();
  }
  // Tear down whatever special mode is live and put the game back into its
  // plain sortie shape (rings gone, lesson dropped, bandit count restored).
  function clearSpecialModes() {
    tut = null;
    disposeStunt();
    gameMode = 'sortie';
    syncModeHUD();
  }
  function enterHangar() {
    clearSpecialModes();
    // Back to the remembered sortie map (a lesson/course may have borrowed
    // the other world).
    let saved = mapName;
    try { const m = localStorage.getItem('ps-map'); if (validMap(m)) saved = m; } catch (_) { /* private mode */ }
    applyWorld(saved);
    respawnBase(); // park on the runway, reset the fight
    started = false; // back to the pre-launch state
    setPaused(false);
    setMenu('plane');
  }
  function startSortie() {
    clearSpecialModes();
    if (!validMap(mapName)) { // a stunt map (canyon) may still be applied
      let saved = 'coastal';
      try { const m = localStorage.getItem('ps-map'); if (validMap(m)) saved = m; } catch (_) { /* private mode */ }
      applyWorld(saved);
    }
    setMenu(null);
    respawnBase();
    started = true;
    engageStart = performance.now();
    updateObjective();
    audio.ensure(); // user gesture -> AudioContext allowed
  }
  function cyclePlane(dir) {
    const i = PLANE_ORDER.indexOf(planeName);
    setPlaneType(PLANE_ORDER[(i + dir + PLANE_ORDER.length) % PLANE_ORDER.length]);
    renderMenuStats();
  }
  document.querySelector('[data-mprev]')?.addEventListener('click', () => cyclePlane(-1));
  document.querySelector('[data-mnext]')?.addEventListener('click', () => cyclePlane(1));
  document.getElementById('ps-continue')?.addEventListener('click', () => setMenu('mode'));
  // Game-mode tiles -> that mode's chapter screen. The sortie screen also
  // re-parks the plane on the remembered map so the backdrop matches.
  for (const b of document.querySelectorAll('[data-gamemode]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setMenu(b.dataset.gamemode);
    });
  }
  // Chapter tiles: a tutorial lesson / a stunt course starts immediately.
  for (const b of document.querySelectorAll('[data-tut]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); startTutorial(b.dataset.tut); });
  }
  for (const b of document.querySelectorAll('[data-stunt]')) {
    b.addEventListener('mousedown', (ev) => ev.stopPropagation());
    b.addEventListener('click', (ev) => { ev.stopPropagation(); startStunt(b.dataset.stunt); });
  }
  for (const b of document.querySelectorAll('[data-menuback]')) {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); setMenu(b.dataset.menuback || 'mode'); });
  }
  document.getElementById('ps-takeoff')?.addEventListener('click', () => startSortie());
  for (const b of document.querySelectorAll('[data-hangar]')) {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); enterHangar(); });
  }

  function start() {
    if (started) return;
    started = true;
    engageStart = performance.now(); // start the engagement clock at launch
    updateObjective();
    audio.ensure(); // user gesture -> AudioContext allowed
  }

  // Fly-again from the end screen (button + click-anywhere), same as SPACE.
  const endOverlay = document.getElementById('ps-end');
  document.getElementById('ps-end-again')?.addEventListener('click', (ev) => { ev.stopPropagation(); respawn(); });
  document.getElementById('ps-end-next')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const id = ev.currentTarget.dataset.tutNext;
    if (id) { hideEnd(); startTutorial(id); }
  });
  endOverlay?.addEventListener('click', () => respawn());

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === 'escape') {
      if (settingsOpen) { showSettings(false); return; } // settings-over-menu closes first
      if (menuMode === 'sortie' || menuMode === 'tutorial' || menuMode === 'stunt') { setMenu('mode'); return; }
      if (menuMode === 'mode') { setMenu('plane'); return; }
      if (menuMode) return; // the hangar is the root screen
      if (started) setPaused(!userPaused);
      return;
    }
    if (menuMode === 'plane' && (k === 'arrowleft' || k === 'arrowright')) {
      cyclePlane(k === 'arrowleft' ? -1 : 1);
      return;
    }
    if (menuMode === 'plane' && k === 'enter') { setMenu('mode'); return; }
    if (menuMode === 'mode' && k === 'enter') { setMenu('sortie'); return; }
    if (menuMode === 'sortie' && k === 'enter') { startSortie(); return; }
    // Bandit skill is a pre-game choice (sortie screen); the 1/2/3 hotkeys
    // only work before the engagement is live.
    const preGame = !started || !!menuMode || crashed || won;
    if (k === '1' && preGame) { setDifficulty('easy'); return; }
    if (k === '2' && preGame) { setDifficulty('normal'); return; }
    if (k === '3' && preGame) { setDifficulty('hard'); return; }
    if (k === 'm') { audio.toggleMute(); return; }
    if (k === 'c') {
      setCamPreset(CAM_ORDER[(CAM_ORDER.indexOf(camName) + 1) % CAM_ORDER.length]);
      return;
    }
    if (['w', 'a', 's', 'd', 'g', 'b', ' '].includes(k)) {
      if (started) e.preventDefault();
      if (k === 'g') gearDown = !gearDown; // toggle on key-down edge
      if (k === 'b') dropBomb(); // strike phase only (no-op otherwise)
      if (k === ' ' && (crashed || won)) respawn();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // The mouse is an AIM POINT, not a stick: its screen position is unprojected
  // through the camera each frame and the instructor flies the nose there.
  function onMove(e) {
    const r = stage.getBoundingClientRect();
    mouseNX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    mouseNY = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    if (reticle) {
      reticle.style.left = `${e.clientX - r.left}px`;
      reticle.style.top = `${e.clientY - r.top}px`;
    }
  }
  stage.addEventListener('mousemove', onMove);
  stage.addEventListener('mouseleave', () => { mouseNX = 0; mouseNY = 0; });

  stage.addEventListener('mousedown', (e) => {
    if (menuMode) return; // menus own the pointer; buttons handle themselves
    start();
    if (e.button === 2) { firing = true; e.preventDefault(); }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) firing = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // ======================================================== HUD ===========
  const hud = {
    gear: document.getElementById('ps-gear'),
    gearBox: document.getElementById('ps-gear-box'),
    stall: document.getElementById('ps-stall'),
    warn: document.getElementById('ps-warning'),
    kills: document.getElementById('ps-kills'),
    hp: document.getElementById('ps-hp'),
    hpFill: document.getElementById('ps-hp-fill'),
    diff: document.getElementById('ps-diff'),
    plane: document.getElementById('ps-plane-label'),
    obj: document.getElementById('ps-objective'),
  };
  const mapCanvas = document.getElementById('ps-map');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
  const pipper = document.getElementById('ps-pipper');
  const leadEl = document.getElementById('ps-lead');
  const dmgVignette = document.getElementById('ps-damage');
  let dmgFlash = 0; // 1 -> 0 red screen pulse when hit

  // Kill board ("k / N") + hull HP bar (green -> amber -> red as it drops).
  function updateCombatHUD() {
    if (hud.kills) hud.kills.textContent = `${kills} / ${activeCount}`;
    const pct = clamp(Math.round((playerHP / ac.hp) * 100), 0, 100);
    if (hud.hp) hud.hp.textContent = String(Math.max(0, Math.round(playerHP)));
    if (hud.hpFill) {
      hud.hpFill.style.width = `${pct}%`;
      hud.hpFill.style.background = pct > 50 ? '#37d67a' : (pct > 25 ? '#ffc24a' : '#ff5d6c');
    }
  }
  function flashDamage() { dmgFlash = 1; }

  // ---- The instrument cluster: six WWII-style analogue gauges drawn on one
  //      canvas — airspeed, artificial horizon, altimeter (two needles), climb
  //      (VSI), heading (rotating compass card) and throttle. Real moving
  //      needles instead of bare digits. ----
  const gauges = (() => {
    const cv = document.getElementById('ps-gauges');
    if (!cv) return null;
    const ctx = cv.getContext('2d');
    const N = 6; const CELL = 116; const R = 52;
    const LW = N * CELL; const LH = 128; // logical size
    let scale = 1;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth || LW;
      scale = (w / LW) * dpr;
      cv.width = Math.round(LW * scale);
      cv.height = Math.round(LH * scale);
    }
    window.addEventListener('resize', resize);
    resize();

    const CREAM = '#e8e2cc';
    const DIM = '#9a947e';
    const face = (cx, cy) => {
      // bezel + face
      ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#23262b'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#101318'; ctx.fill();
      ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 2; ctx.stroke();
    };
    const glass = (cx, cy) => {
      const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.55, 2, cx, cy, R);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.02)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    };
    const needle = (cx, cy, ang, len, w, color, tailLen) => {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-(tailLen || 6), 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#c9c4ae'; ctx.fill();
    };
    const label = (cx, cy, txt) => {
      ctx.fillStyle = DIM; ctx.font = '600 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center'; ctx.fillText(txt, cx, cy + R * 0.55);
    };
    const D2R = Math.PI / 180;

    // 1) Airspeed: 0..max over a 270° sweep starting at 135°. Scale + label
    //    follow the selected speed unit (knots / mph / km/h).
    function drawASI(cx, cy, speedMs) {
      const u = SPEED_UNITS[unit.speed];
      const val = speedMs * u.f;
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 8px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (let v = 0; v <= u.max; v += u.step) {
        const a = (135 + (v / u.max) * 270) * D2R;
        const c = Math.cos(a); const s = Math.sin(a);
        ctx.strokeStyle = CREAM; ctx.lineWidth = v % u.maj === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - 8), cy + s * (R - 8));
        ctx.lineTo(cx + c * (R - 2), cy + s * (R - 2));
        ctx.stroke();
        if (v % u.maj === 0) ctx.fillText(String(v), cx + c * (R - 17), cy + s * (R - 17) + 3);
      }
      label(cx, cy, `AIRSPEED · ${u.label}`);
      ctx.fillStyle = CREAM; ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(String(Math.round(val)), cx, cy + 20);
      needle(cx, cy, (135 + (clamp(val, 0, u.max) / u.max) * 270) * D2R, R - 10, 2.4, '#f2ede0');
      glass(cx, cy);
    }

    // 2) Artificial horizon: sky/ground card rotated by roll, shifted by pitch.
    function drawATT(cx, cy, pitchRad, rollRad) {
      face(cx, cy);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(-rollRad);
      const pxPerDeg = 1.35;
      const off = clamp((pitchRad / D2R) * pxPerDeg, -R * 1.6, R * 1.6);
      ctx.translate(0, off);
      ctx.fillStyle = '#3f7fb5'; ctx.fillRect(-R * 2, -R * 3, R * 4, R * 3); // sky
      ctx.fillStyle = '#6d532f'; ctx.fillRect(-R * 2, 0, R * 4, R * 3); // ground
      ctx.strokeStyle = '#f5f2e6'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-R * 2, 0); ctx.lineTo(R * 2, 0); ctx.stroke();
      // pitch ladder every 10°
      ctx.lineWidth = 1; ctx.fillStyle = '#f5f2e6';
      ctx.font = '600 6px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (const d of [-30, -20, -10, 10, 20, 30]) {
        const y = -d * pxPerDeg;
        const w = Math.abs(d) === 10 ? 10 : (Math.abs(d) === 20 ? 15 : 20);
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();
      // fixed miniature aircraft
      ctx.strokeStyle = '#ffb648'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 7, cy);
      ctx.moveTo(cx + 7, cy); ctx.lineTo(cx + 20, cy);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb648'; ctx.fill();
      label(cx, cy, 'HORIZON');
      glass(cx, cy);
    }

    // 3) Altimeter: long needle = 100s, short = 1000s of the selected unit
    //    (feet or metres — the dial reads 0..9 either way). Classic two-hand.
    function drawALT(cx, cy, altM) {
      const u = ALT_UNITS[unit.alt];
      const val = altM * u.f;
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 8px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (let i = 0; i < 10; i++) {
        const a = (-90 + i * 36) * D2R;
        const c = Math.cos(a); const s = Math.sin(a);
        ctx.strokeStyle = CREAM; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - 8), cy + s * (R - 8));
        ctx.lineTo(cx + c * (R - 2), cy + s * (R - 2));
        ctx.stroke();
        ctx.fillText(String(i), cx + c * (R - 16), cy + s * (R - 16) + 3);
      }
      label(cx, cy, `ALTITUDE · ${u.label}`);
      ctx.fillStyle = CREAM; ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(String(Math.max(0, Math.round(val))), cx, cy + 20);
      const a1000 = (-90 + ((val % 10000) / 10000) * 360) * D2R;
      const a100 = (-90 + ((val % 1000) / 1000) * 360) * D2R;
      needle(cx, cy, a1000, R * 0.45, 3.4, '#d8d2ba');
      needle(cx, cy, a100, R - 12, 2.2, '#f2ede0');
      glass(cx, cy);
    }

    // 4) VSI: 0 points left; climb sweeps up, dive sweeps down. ±2000 ft/min in
    //    feet mode, ±10 m/s in metres mode (paired with the altitude unit).
    function drawVSI(cx, cy, vyMs) {
      const ftMode = unit.alt === 'ft';
      const val = ftMode ? vyMs * FT * 60 : vyMs;
      const max = ftMode ? 8000 : 40;
      const ticks = ftMode
        ? [[-8000, '8'], [-6000, '6'], [-4000, '4'], [-2000, '2'], [0, '0'], [2000, '2'], [4000, '4'], [6000, '6'], [8000, '8']]
        : [[-40, '40'], [-30, '30'], [-20, '20'], [-10, '10'], [0, '0'], [10, '10'], [20, '20'], [30, '30'], [40, '40']];
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 7px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (const [v, t] of ticks) {
        const a = (180 + (v / max) * 80) * D2R;
        const c = Math.cos(a); const s = Math.sin(a);
        ctx.strokeStyle = CREAM; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - 8), cy + s * (R - 8));
        ctx.lineTo(cx + c * (R - 2), cy + s * (R - 2));
        ctx.stroke();
        ctx.fillText(t, cx + c * (R - 15), cy + s * (R - 15) + 2.5);
      }
      ctx.fillStyle = DIM; ctx.font = '600 6px "JetBrains Mono", monospace';
      ctx.fillText('UP', cx - R * 0.32, cy - 10);
      ctx.fillText('DN', cx - R * 0.32, cy + 14);
      label(cx, cy, ftMode ? 'CLIMB ×1000' : 'CLIMB m/s');
      needle(cx, cy, (180 + (clamp(val, -max, max) / max) * 80) * D2R, R - 11, 2.4, '#f2ede0');
      glass(cx, cy);
    }

    // 5) Heading: rotating compass card under a fixed lubber line.
    function drawHDG(cx, cy, hdgRad) {
      face(cx, cy);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-hdgRad);
      ctx.fillStyle = CREAM; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      const pts = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
      for (const [t, deg] of pts) {
        const a = (deg - 90) * D2R;
        ctx.save();
        ctx.translate(Math.cos(a) * (R - 15), Math.sin(a) * (R - 15));
        ctx.rotate(deg * D2R);
        ctx.fillStyle = t === 'N' ? '#ff8f5a' : CREAM;
        ctx.fillText(t, 0, 3);
        ctx.restore();
      }
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg - 90) * D2R;
        ctx.strokeStyle = deg % 90 === 0 ? CREAM : DIM;
        ctx.lineWidth = deg % 90 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7));
        ctx.lineTo(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2));
        ctx.stroke();
      }
      ctx.restore();
      // fixed plane silhouette + lubber line
      ctx.strokeStyle = '#ffb648'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy - R + 2); ctx.lineTo(cx, cy - R + 10); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 4.5, cy + 5); ctx.lineTo(cx, cy + 2);
      ctx.lineTo(cx - 4.5, cy + 5); ctx.closePath();
      ctx.fillStyle = '#ffb648'; ctx.fill();
      label(cx, cy, 'HEADING');
      const deg = Math.round((((hdgRad / D2R) % 360) + 360) % 360);
      ctx.fillStyle = CREAM; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${String(deg).padStart(3, '0')}°`, cx, cy + 20);
      glass(cx, cy);
    }

    // 6) Throttle: 0..100% over the same 270° sweep, amber needle.
    function drawTHR(cx, cy, thr) {
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 8px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (let v = 0; v <= 100; v += 10) {
        const a = (135 + (v / 100) * 270) * D2R;
        const c = Math.cos(a); const s = Math.sin(a);
        ctx.strokeStyle = v >= 90 ? '#ff8f5a' : CREAM; ctx.lineWidth = v % 20 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - 8), cy + s * (R - 8));
        ctx.lineTo(cx + c * (R - 2), cy + s * (R - 2));
        ctx.stroke();
        if (v % 20 === 0) ctx.fillText(String(v), cx + c * (R - 17), cy + s * (R - 17) + 3);
      }
      label(cx, cy, 'THROTTLE %');
      ctx.fillStyle = CREAM; ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`${Math.round(thr * 100)}%`, cx, cy + 20);
      needle(cx, cy, (135 + clamp(thr, 0, 1) * 270) * D2R, R - 10, 2.6, '#ffb648');
      glass(cx, cy);
    }

    return {
      draw(st) {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, LW, LH);
        const cy = 60;
        drawASI(60, cy, st.speedMs);
        drawATT(60 + CELL, cy, st.pitch, st.roll);
        drawALT(60 + CELL * 2, cy, st.altM);
        drawVSI(60 + CELL * 3, cy, st.vyMs);
        drawHDG(60 + CELL * 4, cy, st.hdg);
        drawTHR(60 + CELL * 5, cy, st.thr);
      },
    };
  })();

  // Player-centred radar scope, HEADING-UP: your arrow is fixed pointing up
  // and the world (border, runway, bandits, the N marker) rotates around you —
  // "left on the scope" is always "left out the canopy". A bandit within
  // RADAR_RANGE shows at its true relative position; one beyond range is
  // pinned to the rim as a chevron pointing in its direction.
  function drawMap() {
    if (!mapCtx) return;
    const W = mapCanvas.width; const H = mapCanvas.height;
    const cx = W / 2; const cy = H / 2;
    const Rpx = Math.min(W, H) / 2 - 3;
    const s = Rpx / CFG.RADAR_RANGE; // metres -> px
    const px = plane.position.x; const pz = plane.position.z;
    const f = getForward();
    const ang = Math.atan2(f.x, -f.z); // heading: 0 = north (-Z)

    mapCtx.clearRect(0, 0, W, H);
    mapCtx.save();
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx, 0, Math.PI * 2); mapCtx.clip(); // disc

    mapCtx.fillStyle = 'rgba(8,20,26,0.55)';
    mapCtx.fillRect(0, 0, W, H);

    // ---- rotated world layer (heading-up) ----
    mapCtx.save();
    mapCtx.translate(cx, cy);
    mapCtx.rotate(-ang);

    // world border — only on screen when you're within range of a wall
    const B = CFG.BORDER;
    mapCtx.strokeStyle = 'rgba(80,210,255,0.85)';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect((-B - px) * s, (-B - pz) * s, 2 * B * s, 2 * B * s);

    if (mapName === 'coastal') {
      // runway
      mapCtx.strokeStyle = 'rgba(230,238,242,0.7)';
      mapCtx.lineWidth = 3;
      mapCtx.beginPath();
      mapCtx.moveTo(-px * s, (-CFG.RUNWAY_LEN / 2 - pz) * s);
      mapCtx.lineTo(-px * s, (CFG.RUNWAY_LEN / 2 - pz) * s);
      mapCtx.stroke();
    } else if (mapName === 'ocean') {
      // carriers: little deck rectangles (white = yours, red = the target).
      // The enemy carrier is usually far beyond radar range — pin a hollow
      // square to the rim in its direction so the strike leg is navigable.
      for (const c of carriers) {
        const dx = (c.x - px) * s;
        const dy = (c.z - pz) * s;
        const inR = Math.hypot(dx, dy) <= Rpx;
        mapCtx.fillStyle = c.enemy ? '#ff4d4d' : 'rgba(230,238,242,0.9)';
        if (inR) {
          mapCtx.fillRect(dx - 2, dy - 6, 4, 12);
        } else if (c.enemy && enemySinking <= 0) {
          const a = Math.atan2(dy, dx);
          mapCtx.save();
          mapCtx.translate(Math.cos(a) * (Rpx - 6), Math.sin(a) * (Rpx - 6));
          mapCtx.strokeStyle = '#ff4d4d';
          mapCtx.lineWidth = 2;
          mapCtx.strokeRect(-3.5, -3.5, 7, 7);
          mapCtx.restore();
        }
      }
      // The defend perimeter while it matters.
      if (gameMode === 'sortie' && missionPhase === 'defend') {
        mapCtx.strokeStyle = 'rgba(120,220,255,0.35)';
        mapCtx.lineWidth = 1.5;
        mapCtx.beginPath();
        mapCtx.arc((OCEAN.ALLY.x - px) * s, (OCEAN.ALLY.z - pz) * s, OCEAN.DEFEND_R * s, 0, Math.PI * 2);
        mapCtx.stroke();
      }
    }

    // Stunt: the active ring — a cyan diamond in range, a rim chevron beyond.
    if (stunt && stunt.rings[stunt.i]) {
      const rp = stunt.rings[stunt.i].pos;
      const dx = (rp.x - px) * s;
      const dy = (rp.z - pz) * s;
      mapCtx.fillStyle = '#7fdfff';
      mapCtx.strokeStyle = '#7fdfff';
      if (Math.hypot(dx, dy) <= Rpx) {
        mapCtx.save();
        mapCtx.translate(dx, dy);
        mapCtx.rotate(Math.PI / 4);
        mapCtx.strokeRect(-3.2, -3.2, 6.4, 6.4);
        mapCtx.restore();
      } else {
        const a = Math.atan2(dy, dx);
        mapCtx.save();
        mapCtx.translate(Math.cos(a) * (Rpx - 5), Math.sin(a) * (Rpx - 5));
        mapCtx.rotate(a);
        mapCtx.beginPath(); mapCtx.moveTo(5, 0); mapCtx.lineTo(-3, 4); mapCtx.lineTo(-3, -4);
        mapCtx.closePath(); mapCtx.fill();
        mapCtx.restore();
      }
    }

    // bandits
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = (e.group.position.x - px) * s;
      const dy = (e.group.position.z - pz) * s;
      mapCtx.fillStyle = '#ff4d4d';
      if (Math.hypot(dx, dy) <= Rpx) {
        mapCtx.beginPath(); mapCtx.arc(dx, dy, 3.2, 0, Math.PI * 2); mapCtx.fill();
      } else {
        const a = Math.atan2(dy, dx); // bearing in the rotated frame
        mapCtx.save();
        mapCtx.translate(Math.cos(a) * (Rpx - 4), Math.sin(a) * (Rpx - 4));
        mapCtx.rotate(a);
        mapCtx.beginPath(); mapCtx.moveTo(4, 0); mapCtx.lineTo(-3, 3); mapCtx.lineTo(-3, -3);
        mapCtx.closePath(); mapCtx.fill();
        mapCtx.restore();
      }
    }
    mapCtx.restore(); // un-rotate

    // range rings + cross-hairs (fixed to the scope, not the world)
    mapCtx.strokeStyle = 'rgba(120,220,255,0.16)';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx * 0.5, 0, Math.PI * 2); mapCtx.stroke();
    mapCtx.beginPath();
    mapCtx.moveTo(cx, cy - Rpx); mapCtx.lineTo(cx, cy + Rpx);
    mapCtx.moveTo(cx - Rpx, cy); mapCtx.lineTo(cx + Rpx, cy);
    mapCtx.stroke();

    // north marker riding the rim (drawn upright)
    const nx = cx - Math.sin(ang) * (Rpx - 9);
    const ny = cy - Math.cos(ang) * (Rpx - 9);
    mapCtx.fillStyle = '#ff8f5a';
    mapCtx.font = '700 10px "JetBrains Mono", monospace';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', nx, ny + 3.5);

    // player: fixed arrow at the centre, always pointing up
    mapCtx.fillStyle = crashed ? '#ff5d6c' : '#ffe04a';
    mapCtx.beginPath();
    mapCtx.moveTo(cx, cy - 6); mapCtx.lineTo(cx + 4, cy + 5); mapCtx.lineTo(cx - 4, cy + 5);
    mapCtx.closePath();
    mapCtx.fill();

    mapCtx.restore(); // un-clip
    mapCtx.strokeStyle = 'rgba(120,220,255,0.5)';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx, 0, Math.PI * 2); mapCtx.stroke();
  }

  // ---- Enemy health bars: a small HP bar + range readout floats over every
  //      living bandit on screen, so you can see who's hurt and pick targets. ----
  const ebarsWrap = document.getElementById('ps-ebars');
  const ebars = [];
  function initEnemyBars() {
    if (!ebarsWrap) return;
    for (let i = 0; i < enemies.length; i++) {
      const root = document.createElement('div');
      root.className = 'ps-ebar';
      const track = document.createElement('div');
      track.className = 'ps-ebar-track';
      const fill = document.createElement('div');
      fill.className = 'ps-ebar-fill';
      track.appendChild(fill);
      const label = document.createElement('div');
      label.className = 'ps-ebar-label';
      root.appendChild(track);
      root.appendChild(label);
      ebarsWrap.appendChild(root);
      ebars.push({ root, fill, label });
    }
  }
  const _ebv = new THREE.Vector3();
  function updateEnemyBars() {
    if (!ebarsWrap) return;
    const r = stage.getBoundingClientRect();
    for (let i = 0; i < ebars.length; i++) {
      const b = ebars[i]; const e = enemies[i];
      if (!e || !e.alive || !started) { b.root.style.display = 'none'; continue; }
      const d = e.group.position.distanceTo(plane.position);
      _ebv.copy(e.group.position);
      _ebv.y += 7; // float above the airframe
      _ebv.project(camera);
      if (_ebv.z > 1 || Math.abs(_ebv.x) > 1.05 || Math.abs(_ebv.y) > 1.05 || d > 2400) {
        b.root.style.display = 'none';
        continue;
      }
      b.root.style.display = 'block';
      b.root.style.left = `${((_ebv.x + 1) / 2) * r.width}px`;
      b.root.style.top = `${((1 - _ebv.y) / 2) * r.height}px`;
      const pct = clamp((e.hp / e.st.hp) * 100, 0, 100);
      b.fill.style.width = `${pct}%`;
      b.fill.style.background = pct > 50 ? '#ff8f5a' : '#ff4d4d';
      b.label.textContent = fmtDist(d);
    }
  }

  // ---- Lead pipper: for the nearest bandit ahead, project the point you'd
  //      have to shoot AT (target position advanced by flight time, minus our
  //      own inherited velocity) onto the screen. Put the pipper on it and
  //      pull the trigger — this is what makes hitting a crossing target
  //      actually possible. ----
  const _lead = new THREE.Vector3();
  const _leadRel = new THREE.Vector3();
  function updateLeadPipper() {
    if (!leadEl) return;
    let best = null; let bestD = CFG.LEAD_MAX;
    getForward();
    for (const e of enemies) {
      if (!e.alive) continue;
      _lead.copy(e.group.position).sub(plane.position);
      const d = _lead.length();
      if (d > bestD) continue;
      if (_lead.dot(_fwd) < d * 0.25) continue; // roughly ahead of us only
      best = e; bestD = d;
    }
    if (!best || crashed || won || !started) { leadEl.style.display = 'none'; return; }
    // Two-pass intercept: t = d / muzzle speed, aim = target + (vT - vMe)·t.
    _leadRel.copy(best.vel).sub(vel);
    let t = bestD / CFG.TRACER_SPEED;
    _lead.copy(best.group.position).addScaledVector(_leadRel, t);
    t = _lead.distanceTo(plane.position) / CFG.TRACER_SPEED;
    _lead.copy(best.group.position).addScaledVector(_leadRel, t);
    _lead.project(camera);
    if (_lead.z > 1 || Math.abs(_lead.x) > 1.05 || Math.abs(_lead.y) > 1.05) {
      leadEl.style.display = 'none';
      return;
    }
    const r = stage.getBoundingClientRect();
    leadEl.style.display = 'block';
    leadEl.style.left = `${((_lead.x + 1) / 2) * r.width}px`;
    leadEl.style.top = `${((1 - _lead.y) / 2) * r.height}px`;
    leadEl.classList.toggle('ps-lead-close', bestD < 700);
  }

  // "Fly again" respects the mode: a lesson or a course restarts itself from
  // its own spawn; everything else is the plain park-on-the-runway reset.
  function respawn() {
    if (gameMode === 'tutorial' && tut) { startTutorial(tut.id); return; }
    if (gameMode === 'stunt' && stunt) { startStunt(stunt.id); return; }
    respawnBase();
  }
  function respawnBase() {
    resetPlane();
    vel.set(0, 0, 0);
    throttle = 0;
    crashed = false;
    won = false;
    onGround = true;
    gearDown = true;
    playerHP = ac.hp;
    kills = 0;
    sortieTookDamage = false;
    engageStart = performance.now(); // restart the engagement clock
    // Reset the ocean mission: bombs back on the racks, enemy carrier refloated.
    missionPhase = 'defend';
    bombs = 2;
    awayT = 0;
    enemySinking = 0;
    sinkVictory = false;
    for (const b of liveBombs) scene.remove(b);
    liveBombs.length = 0;
    syncBombRacks();
    const ec = carriers[1];
    ec.group.position.set(ec.x, TERRAIN.WATER_Y, ec.z);
    ec.group.rotation.set(0, ec.rotY, 0);
    updateObjective();
    resetEnemies();
    updateCombatHUD();
    hideEnd();
    if (hud.warn) { hud.warn.textContent = ''; hud.warn.classList.remove('ps-show'); }
  }

  // ================================================== TUTORIAL / STUNT =====
  // Airborne spawn for lessons and courses that skip the takeoff.
  function placeAir({
    x, y, z, hdg = 0, speed = 110,
  }) {
    plane.position.set(x, y, z);
    plane.quaternion.setFromAxisAngle(WORLD_UP, (-hdg * Math.PI) / 180);
    getForward();
    vel.copy(_fwd).multiplyScalar(speed);
    throttle = 0.75;
    gearDown = false;
    gearAnim = 0;
    onGround = false;
  }

  // Which HUD panels belong to the current mode: the combat board only when
  // there's something to shoot, the lesson prompt in a tutorial, the score
  // strip on a stunt run.
  const combatPanelEl = document.querySelector('.ps-combat');
  const tutEl = document.getElementById('ps-tut');
  const stuntEl = document.getElementById('ps-stunt');
  function syncModeHUD() {
    if (combatPanelEl) combatPanelEl.style.display = (gameMode === 'sortie' || (tut && tut.def.bandit)) ? '' : 'none';
    if (tutEl) tutEl.style.display = gameMode === 'tutorial' ? '' : 'none';
    if (stuntEl) stuntEl.style.display = gameMode === 'stunt' ? '' : 'none';
  }

  // ---- Tutorial engine: show the current step's prompt, watch its done()
  //      check each frame (held for `hold` seconds where sustaining the input
  //      is the point), advance with a chime, finish with a lesson card. ----
  const tutNameEl = document.getElementById('ps-tut-name');
  const tutStepEl = document.getElementById('ps-tut-step');
  const tutTextEl = document.getElementById('ps-tut-text');
  const tutBarEl = document.getElementById('ps-tut-bar');
  function updateTutHUD() {
    if (!tut || !tutTextEl) return;
    const n = tut.def.steps.length;
    if (tutNameEl) tutNameEl.textContent = tut.def.label;
    if (tutStepEl) tutStepEl.textContent = `${Math.min(tut.step + 1, n)} / ${n}`;
    const st = tut.def.steps[tut.step];
    tutTextEl.textContent = st ? st.text : '✔ Lesson complete';
    setTutBar(0);
  }
  // Goal progress bar under the prompt: hold steps fill with time held, metric
  // steps (climb / close distance / throttle) with the step's prog(), and
  // plain on/off steps jump 0 → 100.
  function setTutBar(frac) {
    if (!tutBarEl) return;
    const f = Math.max(0, Math.min(1, frac));
    tutBarEl.style.width = `${(f * 100).toFixed(1)}%`;
    tutBarEl.classList.toggle('ps-tut-bar-full', f >= 0.999);
  }
  function startTutorial(id) {
    const def = TUT[id];
    if (!def) return;
    disposeStunt();
    gameMode = 'tutorial';
    tut = {
      id, def, step: 0, holdT: 0, hitFlag: false,
    };
    applyWorld(def.map);
    respawnBase();
    if (def.spawn) placeAir(def.spawn);
    setMenu(null);
    started = true;
    engageStart = performance.now();
    audio.ensure();
    syncModeHUD();
    updateTutHUD();
  }
  function stepTutorial(dt) {
    if (!tut || crashed || won) return;
    const st = tut.def.steps[tut.step];
    if (!st) return;
    const ok = st.done();
    if (ok) tut.holdT += dt; else tut.holdT = 0;
    if (st.hold) setTutBar(tut.holdT / st.hold);
    else if (st.prog) setTutBar(ok ? 1 : st.prog());
    else setTutBar(ok ? 1 : 0);
    if (ok && tut.holdT >= (st.hold || 0)) {
      tut.step++;
      tut.holdT = 0;
      audio.hit(); // the "goal ticked" chime
      if (tut.step >= tut.def.steps.length) {
        won = true;
        achievements.emit({ t: 'tutorial', id: tut.id });
        showEnd(true, null, false, 'Lesson complete', tut.def.outro, '🎓');
      }
      updateTutHUD();
    }
  }

  // ---- Stunt engine: a chain of glowing rings. Fly the chain in order; each
  //      frame the segment the aircraft just flew is tested against the active
  //      ring's plane — crossing inside the hoop scores (bullseye at half
  //      radius), crossing wide of it forfeits the ring. A light beacon marks
  //      the active ring; the last ring ends the run with a score card. ----
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  let beacon = null;
  const beaconTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 128;
    const ctx = c.getContext('2d');
    const gx = ctx.createLinearGradient(0, 0, 32, 0);
    gx.addColorStop(0, 'rgba(120,220,255,0)');
    gx.addColorStop(0.5, 'rgba(160,230,255,0.9)');
    gx.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = gx; ctx.fillRect(0, 0, 32, 128);
    const gy = ctx.createLinearGradient(0, 0, 0, 128);
    gy.addColorStop(0, 'rgba(255,255,255,0)');
    gy.addColorStop(0.5, 'rgba(255,255,255,1)');
    gy.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gy; ctx.fillRect(0, 0, 32, 128);
    return new THREE.CanvasTexture(c);
  })();
  const stScoreEl = document.getElementById('ps-st-score');
  const stRingEl = document.getElementById('ps-st-ring');
  const stTimeEl = document.getElementById('ps-st-time');
  function updateStuntHUD() {
    if (!stunt) return;
    if (stScoreEl) stScoreEl.textContent = String(stunt.score);
    if (stRingEl) stRingEl.textContent = `${Math.min(stunt.i + 1, stunt.rings.length)} / ${stunt.rings.length}`;
    if (stTimeEl) stTimeEl.textContent = fmtTime(stunt.t * 1000);
  }
  function disposeStunt() {
    if (!stunt) return;
    for (const r of stunt.rings) {
      ringGroup.remove(r.mesh);
      for (const c of r.mesh.children) { c.geometry.dispose(); c.material.dispose(); }
    }
    if (beacon) { ringGroup.remove(beacon); beacon.material.dispose(); beacon = null; }
    stunt = null;
  }
  function highlightRing() {
    for (let i = 0; i < stunt.rings.length; i++) {
      const r = stunt.rings[i];
      r.mesh.visible = i >= stunt.i; // passed rings vanish
      const active = i === stunt.i;
      r.core.opacity = active ? 1 : 0.55;
      r.core.color.setHex(active ? 0x35e6ff : 0x1d97bd);
      r.back.opacity = active ? 0.85 : 0.6;
    }
    const cur = stunt.rings[stunt.i];
    if (beacon) {
      beacon.visible = !!cur;
      if (cur) beacon.position.set(cur.pos.x, cur.pos.y + 235, cur.pos.z);
    }
  }
  function startStunt(id) {
    const def = STUNTS[id];
    if (!def) return;
    disposeStunt();
    tut = null;
    gameMode = 'stunt';
    applyWorld(def.map);
    const rings = def.rings.map((rw, i) => {
      const [x, y, z, rr] = rw;
      const r = rr || def.r;
      // Ring faces the local course direction (central difference).
      const p = def.rings[Math.max(0, i - 1)];
      const nx = def.rings[Math.min(def.rings.length - 1, i + 1)];
      const n = new THREE.Vector3(nx[0] - p[0], nx[1] - p[1], nx[2] - p[2]).normalize();
      // Two concentric hoops, normal blending: a dark backing ring so the
      // hoop still reads against bright sea/sky (additive cyan vanished
      // there), with the bright core on top.
      const mesh = new THREE.Group();
      const back = new THREE.Mesh(
        new THREE.TorusGeometry(r, 2.8, 8, 40),
        new THREE.MeshBasicMaterial({
          color: 0x062733, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false,
        }),
      );
      const core = new THREE.Mesh(
        new THREE.TorusGeometry(r, 1.4, 8, 40),
        new THREE.MeshBasicMaterial({
          color: 0x22d3ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false,
        }),
      );
      // Draw after the (transparent, depthWrite-off) water plane — otherwise
      // the sorter can paint water over the hoop and wash out its lower arc.
      back.renderOrder = 10;
      core.renderOrder = 11;
      mesh.add(back);
      mesh.add(core);
      mesh.position.set(x, y, z);
      mesh.lookAt(x + n.x, y + n.y, z + n.z);
      ringGroup.add(mesh);
      return {
        pos: new THREE.Vector3(x, y, z), n, r, mesh, core: core.material, back: back.material,
      };
    });
    stunt = {
      id, def, rings, i: 0, score: 0, hits: 0, bull: 0, t: 0, prev: new THREE.Vector3(),
    };
    beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: beaconTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75,
    }));
    beacon.renderOrder = 12; // above the water plane, like the rings
    beacon.scale.set(26, 470, 1);
    ringGroup.add(beacon);
    highlightRing();
    respawnBase();
    placeAir(def.spawn);
    stunt.prev.copy(plane.position);
    setMenu(null);
    started = true;
    engageStart = performance.now();
    audio.ensure();
    syncModeHUD();
    updateStuntHUD();
  }
  const _sv = new THREE.Vector3();
  function advanceRing() {
    stunt.i++;
    if (stunt.i >= stunt.rings.length) {
      won = true;
      if (beacon) beacon.visible = false;
      achievements.emit({
        t: 'stuntRun',
        course: stunt.id,
        score: stunt.score,
        ringsHit: stunt.hits,
        ringsTotal: stunt.rings.length,
        bullseyes: stunt.bull,
      });
      showEnd(true, null, false, 'Course complete',
        `${stunt.hits} of ${stunt.rings.length} rings — final score ${stunt.score}.`, '🏁');
      return;
    }
    highlightRing();
  }
  function stepStunt(dt) {
    if (!stunt) return;
    stunt.t += dt;
    const cur = stunt.rings[stunt.i];
    if (cur) {
      const d0 = _sv.copy(stunt.prev).sub(cur.pos).dot(cur.n);
      const d1 = _sv.copy(plane.position).sub(cur.pos).dot(cur.n);
      if ((d0 < 0) !== (d1 < 0)) { // crossed the ring's plane this frame
        const f = d0 / (d0 - d1);
        _sv.lerpVectors(stunt.prev, plane.position, f).sub(cur.pos);
        const off = _sv.length();
        if (off <= cur.r) {
          const bulls = off <= cur.r * 0.5;
          stunt.score += bulls ? 150 : 100;
          stunt.hits++;
          if (bulls) stunt.bull++;
          cur.core.color.set(0x37d67a);
          audio.hit();
          toast(bulls ? '◎ BULLSEYE +150' : '○ RING +100', 900);
          advanceRing();
        } else if (off <= cur.r * 4) { // flew past it -> forfeited
          cur.core.color.set(0xff5d6c);
          toast('✕ MISSED RING', 900);
          advanceRing();
        }
      }
    }
    stunt.prev.copy(plane.position);
    updateStuntHUD();
  }

  // ======================================================== UPDATE ========
  function update(dt) {
    // Throttle ramps while W/S held.
    if (keys.w) throttle = clamp(throttle + CFG.THROTTLE_RATE * dt, 0, 1);
    if (keys.s) throttle = clamp(throttle - CFG.THROTTLE_RATE * dt, 0, 1);

    const speed = vel.length();
    const v2 = speed * speed;

    // --- The instructor: the mouse offset from screen centre is a COMMANDED
    //     NOSE OFFSET (rate command), fed through the same bank-and-pull
    //     controller the AI uses — the plane rolls into a coordinated turn by
    //     itself. Mouse centred = fly straight; hold it on a bandit and the
    //     nose walks onto him. Deliberately NOT a camera ray: putting the
    //     chase camera inside the control loop feeds its lag back into pitch
    //     and sets up a violent pilot-induced oscillation (found the hard way). ---
    const dead = 0.04;
    const shape = (v) => {
      const a = Math.abs(v);
      return a < dead ? 0 : Math.sign(v) * ((a - dead) / (1 - dead));
    };
    const inNX = dev.stickOverride ? dev.stickOverride.nx : mouseNX;
    const inNY = dev.stickOverride ? dev.stickOverride.ny : mouseNY;
    const turnCmd = shape(inNX); // -1..1: how hard to turn
    const pitchCmd = shape(-inNY); // -1..1: + => nose up

    // Bank-angle command: mouse X sets a TARGET BANK (capped ~72°) and the
    // ailerons drive the actual bank onto it — hold the mouse right and the
    // plane banks and carves right, it doesn't barrel-roll. atan2 keeps the
    // bank well-defined even inverted, so recovery always rolls upright.
    getRight(); getUp();
    const bank = Math.atan2(-_right.y, _up.y); // + = banked right
    const targetBank = turnCmd * 1.05; // up to ~60°
    let rollInput = clamp((targetBank - bank) * 2.2, -1, 1);
    // Elevator: the commanded pitch, plus a little extra pull in a hard bank
    // (flightAssist already holds the nose up through the turn itself), plus a
    // hands-off auto-level trim: with the mouse centred the nose eases back to
    // the horizon instead of staying wherever the last manoeuvre left it (that
    // residue is what used to turn every hard turn into a slow spiral dive).
    getForward();
    const pitchAngle = Math.asin(clamp(_fwd.y, -1, 1));
    const autoLevel = clamp(-pitchAngle * 0.9, -0.5, 0.5) * (1 - Math.abs(pitchCmd));
    let pitchInput = clamp(pitchCmd * 1.0 + (1 - Math.cos(bank)) * 0.35 + autoLevel, -1, 1);
    // Manual rudder on top (fine aim / taxi steering).
    const rudder = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const yawInput = clamp(rudder + turnCmd * 0.3, -1, 1);
    _q.copy(plane.quaternion).invert();

    // --- Angle of attack & lift coefficient (the heart of the model) ---
    _vLocal.copy(vel).applyQuaternion(_q); // velocity in body frame
    const fwdSpeed = -_vLocal.z;
    const aoa = Math.atan2(-_vLocal.y, Math.max(fwdSpeed, 0.001));
    let CL;
    const clMax = CFG.CL_SLOPE * CFG.A_STALL;
    if (Math.abs(aoa) <= CFG.A_STALL) CL = CFG.CL_SLOPE * aoa;
    else CL = Math.sign(aoa) * Math.max(0, clMax - (Math.abs(aoa) - CFG.A_STALL) * CFG.CL_SLOPE * 1.7);
    const stalled = Math.abs(aoa) > CFG.A_STALL && speed > 4;

    // --- Forces -> acceleration (thrust/lift/drag from the selected airframe) ---
    getForward(); getUp();
    _acc.set(0, 0, 0);
    _acc.addScaledVector(_fwd, throttle * ac.thrust); // thrust
    _acc.addScaledVector(_up, ac.lift * v2 * CL); // lift (CL carries the sign)
    _acc.y -= CFG.G; // gravity
    if (speed > 0.01) {
      const cd = ac.drag0 + CFG.DRAG_IND * CL * CL + (gearDown ? CFG.DRAG_GEAR : 0);
      _vDir.copy(vel).multiplyScalar(1 / speed);
      _acc.addScaledVector(_vDir, -cd * v2);
    }
    vel.addScaledVector(_acc, dt);
    plane.position.addScaledVector(vel, dt);

    // --- Attitude (rate control, fading in with airspeed; the Zero's controls
    //     stiffen again at high speed via stiffen()) ---
    let e = clamp(speed / ac.controlV, 0, 1.15) * stiffen(ac, speed);
    if (stalled) e *= 0.45; // mushy controls in the stall
    if (onGround) {
      rollInput = 0; // wings stay level on the wheels
      // taxi steering: the tailwheel gives real authority even when slow
      plane.rotateY(-rudder * CFG.YAW_RATE * Math.max(e, 0.4) * dt);
    } else {
      plane.rotateY(-yawInput * CFG.YAW_RATE * e * dt);
    }
    plane.rotateX(pitchInput * ac.pitchRate * e * dt);
    plane.rotateZ(-rollInput * ac.rollRate * e * dt);
    // Stall break: the nose drops, which lowers AoA and lets you recover.
    if (stalled && fwdSpeed > 0) plane.rotateX(-(Math.abs(aoa) - CFG.A_STALL) * 1.6 * dt);

    // Grip + coordinated turn (the anti-drift fix). Skipped on the deck so the
    // takeoff roll / tyre model owns ground velocity.
    if (!onGround) flightAssist(plane, vel, e, dt);

    // --- Terrain / water contact: touchdown, taxi, or crash ---
    const gh = groundAt(plane.position.x, plane.position.z);
    // Over a lake (or the open ocean) the water SURFACE is the hard deck —
    // touching it ditches the aircraft, instead of letting it fly down through
    // the water to the lakebed before anything registers. A carrier flight
    // deck overrides both: over it, IT is the ground you land on.
    const cDeck = mapName === 'ocean' ? carrierDeckAt(plane.position.x, plane.position.z) : -Infinity;
    const overWater = cDeck === -Infinity && gh < TERRAIN.WATER_Y - 0.5;
    const deck = Math.max(overWater ? TERRAIN.WATER_Y : gh, cDeck);
    // Taildragger geometry: the height of the origin over the deck when the
    // main wheels touch depends on pitch (mains are ahead of the origin), so
    // the aircraft can sit tail-down at `stance` and pivot on the mains as
    // the tail flies up during the takeoff roll.
    const stance = ac.stance || 0;
    getForward();
    let gndPitch = Math.asin(clamp(_fwd.y, -1, 1)); // nose-up positive
    const hRest = restHeight(ac, clamp(gndPitch, 0, stance));
    if (plane.position.y <= deck + hRest) {
      plane.position.y = deck + hRest;
      const impactV = -vel.y;
      if (vel.y < 0) vel.y = 0;

      // Water, steep slopes, hard/fast/gear-up arrivals = crash.
      const ee = 8;
      const slope = Math.hypot(
        groundAt(plane.position.x + ee, plane.position.z) - groundAt(plane.position.x - ee, plane.position.z),
        groundAt(plane.position.x, plane.position.z + ee) - groundAt(plane.position.x, plane.position.z - ee),
      ) / (2 * ee);
      if (started && !crashed) {
        if (overWater) {
          crash(mapName === 'ocean' ? 'Ditched in the sea'
            : (mapName === 'canyon' ? 'Ditched in the river' : 'Ditched in the lake'));
        }
        else if (slope > 0.25) crash('Flew into terrain');
        else if (impactV > 14 || (impactV > 5 && !gearDown)) {
          crash(gearDown ? 'Hard landing' : 'Belly flop — gear up!');
        }
      }

      onGround = true;
      // Auto-level roll, and don't let the nose dig into the runway.
      getRight();
      const rollErr = Math.asin(clamp(_right.y, -1, 1));
      plane.rotateZ(-rollErr * Math.min(1, 6 * dt));
      // Nose can't dig in (prop clearance) and the tail can't rotate through
      // the runway past the parked stance while the wheels carry the weight.
      if (gndPitch < 0) plane.rotateX(-gndPitch * Math.min(1, 8 * dt));
      else if (gndPitch > stance) plane.rotateX(-(gndPitch - stance) * Math.min(1, 10 * dt));
      // Tail settle: gravity drops the tail to the stance angle at rest; the
      // tailplane lifts it toward level as the takeoff roll gathers speed.
      // Elevator input overrides (blended out by |pitchInput|).
      getForward();
      gndPitch = Math.asin(clamp(_fwd.y, -1, 1));
      const tailLift = clamp(1 - (speed / (0.55 * ac.controlV)) ** 2, 0, 1);
      plane.rotateX((stance * tailLift - gndPitch) * Math.min(1, 2.5 * dt) * (1 - Math.abs(pitchInput)));

      // Tyre grip: keep the horizontal velocity pointing along the nose (no
      // skid) but leave the vertical component alone so lift can fly it off.
      getForward();
      const vy = vel.y;
      const fH = new THREE.Vector3(_fwd.x, 0, _fwd.z);
      const fl = fH.length() || 1; fH.multiplyScalar(1 / fl);
      let hs = vel.x * fH.x + vel.z * fH.z;
      hs = Math.max(hs, 0);
      // light rolling resistance / wheel brakes when throttle is closed
      hs *= 1 - (throttle > 0.02 ? 0.02 : 0.5) * dt;
      vel.set(fH.x * hs, vy, fH.z * hs);
    } else {
      onGround = false;
    }

    // --- Obstacle collision: buildings, trees, rocks, vehicles. Only scanned
    //     while the aircraft is low enough to hit something (an AABB reject on
    //     each keeps the ~2 k-cylinder scan cheap; it's skipped entirely above
    //     OBSTACLE_CEIL AGL, i.e. almost always in normal flight). A hit is a
    //     crash. ---
    // Ocean: carrier hulls + islands are the only obstacles (few, always scanned
    // when low over the sea). The deck itself is NOT an obstacle — its top is
    // above both boxes' `top`, so a deck landing never trips them.
    if (mapName === 'ocean' && started && !crashed && !dev.god && plane.position.y < DECK_TOP + 24) {
      const px = plane.position.x; const pz = plane.position.z; const py = plane.position.y;
      const PR = 2.6;
      for (let i = 0; i < obBoxOcean.length; i++) {
        const o = obBoxOcean[i];
        if (py > o.top + 1) continue;
        if (px > o.x0 - PR && px < o.x1 + PR && pz > o.z0 - PR && pz < o.z1 + PR) {
          crash(o.reason); break;
        }
      }
    }
    if (mapName === 'coastal' && started && !crashed && !dev.god && plane.position.y - gh < OBSTACLE_CEIL) {
      const px = plane.position.x; const pz = plane.position.z; const py = plane.position.y;
      const PR = 2.6; // plane collision radius (fuselage-ish, so gaps stay threadable)
      for (let i = 0; i < obCyl.length; i++) {
        const o = obCyl[i];
        if (py > o.top + 1) continue;
        const dx = px - o.x; const dz = pz - o.z; const rr = o.r + PR;
        if (dx * dx + dz * dz < rr * rr) { crash(o.reason); break; }
      }
      if (!crashed) {
        for (let i = 0; i < obBox.length; i++) {
          const o = obBox[i];
          if (py > o.top + 1) continue;
          if (o.bot != null && py < o.bot) continue; // open underneath (bridge decks)
          if (px > o.x0 - PR && px < o.x1 + PR && pz > o.z0 - PR && pz < o.z1 + PR) {
            crash(o.reason); break;
          }
        }
      }
    }

    // --- Keep the aircraft inside the world border (soft clamp + warning) ---
    const B = CFG.BORDER - 6;
    let hitBorder = false;
    for (const axis of ['x', 'z']) {
      if (plane.position[axis] > B) { plane.position[axis] = B; if (vel[axis] > 0) vel[axis] = 0; hitBorder = true; }
      if (plane.position[axis] < -B) { plane.position[axis] = -B; if (vel[axis] < 0) vel[axis] = 0; hitBorder = true; }
    }
    if (plane.position.y > CFG.CEIL) { plane.position.y = CFG.CEIL; if (vel.y > 0) vel.y = 0; }

    // --- Propeller: spin + blur disc at RPM, gear retract animation ---
    const rpmNorm = 0.18 + throttle * 0.82;
    if (surf.prop) surf.prop.rotation.z -= rpmNorm * 60 * dt;
    setPropBlur(surf, rpmNorm);

    const target = gearDown ? 1 : 0;
    gearAnim += clamp(target - gearAnim, -dt / 1.4, dt / 1.4); // ~1.4 s travel

    // --- Animate the control surfaces + gear toward their commanded state.
    //     One shared animator (plane-sim-models.js) drives the player, the
    //     bandits and the inspector, so the deflection conventions can't
    //     drift apart (this block used to hand-roll its own — with a stale
    //     90° gear fold and an inverted rudder). ---
    const lerp = (a, b, t) => a + (b - a) * t;
    defl.ail = lerp(defl.ail, rollInput * 0.4, 0.2);
    defl.elev = lerp(defl.elev, pitchInput * 0.4, 0.2);
    defl.rud = lerp(defl.rud, yawInput * 0.5, 0.2);
    applyControlSurfaces(surf, { ail: defl.ail, elev: defl.elev, rud: defl.rud, gear: gearAnim });

    // --- Guns ---
    fireCooldown -= dt;
    if (firing && fireCooldown <= 0) { fireGuns(); fireCooldown = ac.fireInterval; }
    stepTracers(dt);

    // --- Target lock: is a bandit in the gun line right now? (turns the pipper red) ---
    getForward();
    lockTarget = false;
    for (const en of enemies) {
      if (en.alive && rayHitsSphere(plane.position, _fwd, en.group.position, CFG.HITBOX_R, ac.gunRange) >= 0) {
        lockTarget = true; break;
      }
    }
    if (pipper) pipper.classList.toggle('ps-lock', lockTarget);

    // --- Engine audio follows throttle + speed ---
    audio.setEngine(throttle, speed);

    // --- HUD (raw SI values; the gauges convert per the unit settings) ---
    if (gauges) {
      getForward(); getUp(); getRight();
      gauges.draw({
        speedMs: Math.max(0, fwdSpeed),
        // Altitude above sea level (the lake surface is the sea-level datum),
        // like a real altimeter — it no longer tracks the terrain underneath.
        altM: plane.position.y - TERRAIN.WATER_Y,
        vyMs: vel.y,
        thr: throttle,
        pitch: Math.asin(clamp(_fwd.y, -1, 1)),
        roll: Math.atan2(-_right.y, _up.y),
        hdg: Math.atan2(_fwd.x, -_fwd.z),
      });
    }
    if (hud.gear) {
      const transit = Math.abs(gearAnim - (gearDown ? 1 : 0)) > 0.02;
      hud.gear.textContent = transit ? 'GEAR ···' : (gearDown ? 'GEAR DOWN' : 'GEAR UP');
      hud.gear.classList.toggle('ps-warn-amber', !gearDown || transit);
      if (hud.gearBox) {
        hud.gearBox.classList.toggle('ps-gear-down', gearDown && !transit);
        hud.gearBox.classList.toggle('ps-gear-transit', transit);
      }
    }
    if (hud.stall) hud.stall.classList.toggle('ps-show', (stalled || (fwdSpeed * KT < 70 && !onGround)) && !crashed);

    // --- Ocean phase 1: stay with the fleet. Straying past DEFEND_R while
    //     bandits still live starts a countdown; run it out and your carrier
    //     is sunk behind you — mission over. Coming back rewinds it fast. ---
    let awayWarn = null;
    if (mapName === 'ocean' && gameMode === 'sortie' && missionPhase === 'defend' && started && !won) {
      const dHome = Math.hypot(plane.position.x - OCEAN.ALLY.x, plane.position.z - OCEAN.ALLY.z);
      if (dHome > OCEAN.DEFEND_R) {
        awayT += dt;
        awayWarn = `⚠ CARRIER UNDER ATTACK — RETURN TO THE FLEET (${Math.max(0, Math.ceil(OCEAN.ABANDON_S - awayT))})`;
        if (awayT >= OCEAN.ABANDON_S) {
          missionFail('You left the fleet undefended — your carrier was sunk.');
        }
      } else {
        awayT = Math.max(0, awayT - dt * 3);
      }
    }

    if (hud.warn && !crashed) {
      if (hitBorder) { hud.warn.textContent = '⚠ WORLD BORDER'; hud.warn.classList.add('ps-show'); }
      else if (awayWarn) { hud.warn.textContent = awayWarn; hud.warn.classList.add('ps-show'); }
      else if (missionPhase !== 'strike' || !hud.warn.textContent.startsWith('✔')) hud.warn.classList.remove('ps-show');
    }
  }

  // `combat` = downed by enemy fire (title "Shot down"); otherwise it's a crash
  // into terrain/water/scenery (title "Crashed"). `reason` is the detail line.
  function crash(reason, combat = false) {
    if (dev.god) return;
    crashed = true;
    started = true;
    throttle = 0;
    audio.boom();
    spawnSpark(plane.position, 14, 0.5);
    for (let i = 0; i < 5; i++) {
      spawnSmoke(plane.position.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6,
      )), 4 + Math.random() * 3, 1.4);
    }
    showEnd(false, reason, combat);
  }

  // ======================================================== CAMERA ========
  // Hangar turntable: a slow orbit around the fighter parked on the runway,
  // never sinking into the apron. Replaces the chase rig while a menu is up.
  function menuCamera(dt) {
    sun.position.copy(plane.position).addScaledVector(SUN_DIR, 170);
    sun.target.position.copy(plane.position);
    sun.target.updateMatrixWorld();
    menuAngle += dt * 0.12;
    const R = 13.5;
    _camPos.set(
      plane.position.x + Math.sin(menuAngle) * R,
      plane.position.y + 3.4,
      plane.position.z + Math.cos(menuAngle) * R,
    );
    const ghc = Math.max(groundAt(_camPos.x, _camPos.z), TERRAIN.WATER_Y);
    if (_camPos.y < ghc + 1.6) _camPos.y = ghc + 1.6;
    camera.position.copy(_camPos);
    camera.up.copy(WORLD_UP);
    _camAim.copy(plane.position);
    _camAim.y += 1.0;
    camera.lookAt(_camAim);
    if (camera.fov !== 55) { camera.fov = 55; fov = 55; camera.updateProjectionMatrix(); }
  }

  function updateCamera(dt) {
    // Keep the sun's shadow frustum centred on the aircraft — it's a small ortho
    // box, so shadows stay crisp wherever you fly across the map.
    sun.position.copy(plane.position).addScaledVector(SUN_DIR, 170);
    sun.target.position.copy(plane.position);
    sun.target.updateMatrixWorld();

    // Dev free camera: park it (or ride along) and look at the plane/a point.
    if (dev.cam) {
      camera.position.set(dev.cam.x, dev.cam.y, dev.cam.z);
      if (dev.cam.rel) camera.position.add(plane.position);
      camera.up.copy(WORLD_UP);
      if (dev.cam.look === 'plane') camera.lookAt(plane.position);
      else camera.lookAt(dev.cam.look.x, dev.cam.look.y, dev.cam.look.z);
      return;
    }

    // Stable chase: sit behind/above following the nose's heading & pitch, but
    // don't roll the view with the aircraft (much easier to fly, less nausea).
    const rig = CAM_PRESETS[camName];
    getForward();
    _camPos.copy(plane.position)
      .addScaledVector(_fwd, -rig.back)
      .addScaledVector(WORLD_UP, rig.up)
      // Lead the lerp by ~one lag constant so the chase distance stays true to
      // the preset at speed instead of stretching ~15 m behind it.
      .addScaledVector(vel, 0.09);
    const ghc = Math.max(groundAt(_camPos.x, _camPos.z), TERRAIN.WATER_Y);
    if (_camPos.y < ghc + 2) _camPos.y = ghc + 2; // don't dive the camera underground (or underwater)
    const a = crashed ? 0.06 : 1 - Math.pow(1 - CFG.CAM_LERP, dt * 60);
    camera.position.lerp(_camPos, a);
    _camAim.copy(plane.position).addScaledVector(_fwd, 8);
    camera.up.copy(WORLD_UP);
    camera.lookAt(_camAim);

    // A touch of speed-FOV: the world widens as you go fast.
    const targetFov = 62 + clamp((vel.length() - 70) / 110, 0, 1) * 8;
    fov += (targetFov - fov) * Math.min(1, dt * 3);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // ======================================================== LOOP ==========
  function resize() {
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  spawnEnemies();
  initEnemyBars();
  updateCombatHUD();
  setDifficulty(diffName); // sync HUD label + overlay highlight from the saved tier
  setEnemyCount(enemyCountPref); // sync the 1-5 picker highlight
  setCamPreset(camName); // sync the camera-distance picker highlight
  syncUnitUI(); // sync the unit-picker highlights
  syncPlaneUI(); // sync the aircraft picker highlight + description + HUD label
  syncModeHUD(); // hide the tutorial/stunt panels until their mode is live
  setMenu('plane'); // boot into the hangar (the loading screen covers the first frame)

  // ==================================================== DEV MODE ==========
  // A scriptable dev/debug handle on window.__ps (client-side single-player;
  // "cheating" only cheats yourself). Lets tooling — or a curious player —
  // simulate stick inputs, teleport, slow time, park a free camera and record
  // telemetry without touching the real mouse/keyboard.
  const dev = {
    stickOverride: null, // {nx, ny} or null
    god: false,
    noAiFire: false,
    timeScale: 1,
    paused: false,
    cam: null, // {x,y,z, look?: 'plane'|{x,y,z}} or null for the chase cam
  };
  const devState = () => {
    const V = THREE.Vector3;
    const f = new V(0, 0, -1).applyQuaternion(plane.quaternion);
    const r = new V(1, 0, 0).applyQuaternion(plane.quaternion);
    const u = new V(0, 1, 0).applyQuaternion(plane.quaternion);
    return {
      plane: planeName,
      x: +plane.position.x.toFixed(1),
      y: +plane.position.y.toFixed(1),
      z: +plane.position.z.toFixed(1),
      agl: +(plane.position.y - groundY() - groundAt(plane.position.x, plane.position.z)).toFixed(1),
      hdg: +((Math.atan2(f.x, -f.z) * 180) / Math.PI).toFixed(1),
      pitch: +((Math.asin(clamp(f.y, -1, 1)) * 180) / Math.PI).toFixed(1),
      bank: +((Math.atan2(-r.y, u.y) * 180) / Math.PI).toFixed(1),
      speed: +vel.length().toFixed(1),
      kn: +(vel.length() * KT).toFixed(0),
      vy: +vel.y.toFixed(1),
      throttle: +throttle.toFixed(2),
      gearDown,
      onGround,
      started,
      crashed,
      won,
      hp: playerHP,
      kills,
      enemies: enemies.map((e) => ({
        type: e.type,
        alive: e.alive,
        hp: e.hp,
        mode: e.mode,
        dist: +e.group.position.distanceTo(plane.position).toFixed(0),
        y: +e.group.position.y.toFixed(0),
      })),
    };
  };
  window.__ps = {
    vel, enemies, camera, start, respawn, dev,
    get renderer() { return renderer; }, // draw-call/triangle stats for benchmarking
    get plane() { return plane; }, // getter: the group is swapped on type change
    get throttle() { return throttle; },
    set throttle(v) { throttle = clamp(v, 0, 1); },
    setPlane: setPlaneType,
    get planeType() { return planeName; },
    state: devState,
    // Virtual stick: overrides the mouse until stick(null).
    stick(nx, ny) {
      dev.stickOverride = (nx == null) ? null : { nx: clamp(nx, -1, 1), ny: clamp(ny || 0, -1, 1) };
    },
    key(k, down) { keys[String(k).toLowerCase()] = !!down; },
    fire(on) { firing = !!on; },
    teleport(x, y, z, hdgDeg = 0, speed = 120) {
      if (menuMode) setMenu(null); // dev shortcut past the hangar/map menus
      start();
      crashed = false; won = false;
      plane.position.set(x, y, z);
      plane.quaternion.setFromAxisAngle(WORLD_UP, (-hdgDeg * Math.PI) / 180);
      getForward();
      vel.copy(_fwd).multiplyScalar(speed);
      if (hud.warn) hud.warn.classList.remove('ps-show');
      return devState();
    },
    god(on) { dev.god = !!on; },
    aiFire(on) { dev.noAiFire = !on; },
    pause(on) { dev.paused = !!on; },
    set timeScale(v) { dev.timeScale = clamp(v, 0, 4); },
    get timeScale() { return dev.timeScale; },
    // Free camera for inspection: cam(x,y,z) parks it looking at the plane,
    // cam(x,y,z,{x,y,z}) at a point, cam(x,y,z,'rel') rides along as an offset
    // from the aircraft, cam(null) restores the chase rig.
    cam(x, y, z, look) {
      dev.cam = (x == null) ? null : {
        x, y, z, rel: look === 'rel', look: (look && look !== 'rel') ? look : 'plane',
      };
    },
    gear(down) { gearDown = !!down; },
    // Ocean-mission dev handles.
    setMap,
    get map() { return mapName; },
    mission() {
      return {
        phase: missionPhase, bombs, awayT: +awayT.toFixed(1), enemySinking: +enemySinking.toFixed(1), liveBombs: liveBombs.length,
      };
    },
    bomb: dropBomb,
    strike() { missionPhase = 'strike'; updateObjective(); }, // skip phase 1 for testing
    // Mode / chapter dev handles (tooling + harness).
    get gameMode() { return gameMode; },
    tutorial: startTutorial,
    stunt: startStunt,
    tutState() { return tut && { id: tut.id, step: tut.step, of: tut.def.steps.length, hit: tut.hitFlag }; },
    stuntState() {
      return stunt && {
        id: stunt.id, ring: stunt.i, of: stunt.rings.length, score: stunt.score, hits: stunt.hits, t: +stunt.t.toFixed(1),
      };
    },
    hangar: enterHangar,
    sortie: startSortie,
    kill(i) { const e = enemies[i]; if (e && e.alive) damageEnemy(e, 99999); },
    // Collision-obstacle registry (debug/tooling): counts + a sample entry.
    obstacles() { return { cyl: obCyl.length, box: obBox.length, sampleTree: obCyl.find((o) => o.reason.includes('tree')) }; },
    // Sample state() at `hz` for `sec` seconds -> Promise<samples[]>.
    record(sec = 5, hz = 2) {
      return new Promise((res) => {
        const out = [];
        const iv = setInterval(() => {
          out.push(devState());
          if (out.length >= sec * hz) { clearInterval(iv); res(out); }
        }, 1000 / hz);
      });
    },
  };

  let last = performance.now();
  let borderScroll = 0;
  let waterScrollX = 0;
  let waterScrollY = 0;
  let bootShown = false;
  // FPS readout: count real frames, refresh the corner label twice a second.
  const fpsEl = document.getElementById('ps-fps');
  let fpsFrames = 0;
  let fpsT0 = performance.now();

  function frame(now) {
    if (fpsEl) {
      fpsFrames++;
      if (now - fpsT0 >= 500) {
        fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT0))} fps`;
        fpsFrames = 0; fpsT0 = now;
      }
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)
    dt *= dev.timeScale;
    if (dev.paused || userPaused) dt = 0;

    const playing = started && !crashed && !won && dt > 0;
    if (playing) {
      update(dt);
      if (gameMode === 'tutorial') stepTutorial(dt);
      else if (gameMode === 'stunt') stepStunt(dt);
    } else {
      // idle the prop + animate gear even before launch / after a crash
      if (surf.prop) surf.prop.rotation.z -= 0.18 * 60 * dt;
      setPropBlur(surf, 0.18);
      stepTracers(dt);
      if (gauges && !started) {
        gauges.draw({
          speedMs: 0, altM: plane.position.y - TERRAIN.WATER_Y, vyMs: 0, thr: 0, pitch: 0, roll: 0, hdg: 0,
        });
      }
    }

    // Bandits fly even before launch / after a crash (so they patrol), but only
    // shoot while the engagement is live. In the hangar/map menus they're
    // hidden AND frozen — otherwise they dive at the parked showpiece.
    if (!menuMode) {
      // Bandits only shoot in a sortie — the gunnery lesson's bandit flies
      // full evasion but keeps his guns cold.
      for (const e of enemies) if (e.alive && dt > 0) stepEnemy(e, dt, playing && !dev.noAiFire && gameMode === 'sortie');
    }

    // Windsocks ripple in the ambient breeze (menus included — the hangar
    // turntable looks better alive).
    for (const w of windsocks) w.userData.flutter(now / 1000);
    stepBombs(dt);
    // Idly spin the carriers' radar antennas.
    if (mapName === 'ocean') for (const c of carriers) { if (c.group.userData.radar) c.group.userData.radar.rotation.y += dt * 1.1; }
    stepSparks(dt);
    stepSmokes(dt);
    stepDebris(dt);
    updateLeadPipper();
    updateEnemyBars();

    // Fade the red damage vignette.
    dmgFlash = Math.max(0, dmgFlash - dt * 3);
    if (dmgVignette) dmgVignette.style.opacity = (dmgFlash * 0.55).toFixed(3);

    // scroll the border stripes for that shimmering Minecraft-wall look
    borderScroll = (borderScroll + dt * 0.06) % 1;
    for (const m of borderMats) if (m.map) m.map.offset.y = borderScroll;

    // scroll the water ripples for dynamic active waves
    if (waterMesh && waterMesh.material && waterMesh.material.normalMap) {
      waterScrollX = (waterScrollX + dt * 0.015) % 1;
      waterScrollY = (waterScrollY + dt * 0.010) % 1;
      waterMesh.material.normalMap.offset.set(waterScrollX, waterScrollY);
    } else if (waterMesh && waterMesh.isWater) {
      waterMesh.material.uniforms.time.value += dt * 0.55; // ultra: animated waves
    }
    if (grassField && landGroup.visible) grassField.update(plane.position, dt);

    if (menuMode) menuCamera(dt); else updateCamera(dt);
    drawMap();
    renderer.render(scene, camera);
    // First frame is on screen -> fade the loading screen out over the hangar.
    if (!bootShown) {
      bootShown = true;
      const lo = document.getElementById('ps-load');
      if (lo) {
        lo.classList.add('ps-fade');
        setTimeout(() => lo.classList.add('ps-hidden'), 500);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- GPU warm-up, under the loading screen. Everything a sortie can show
  //      is compiled/uploaded now: one enemy build of each airframe (their
  //      shaders + sheet textures otherwise compile on the first frame the
  //      camera catches a bandit — measured as a multi-second hitch mid-
  //      flight), plus one of every transient effect (tracer/spark/smoke).
  //      renderer.compile() links the programs and initTexture() uploads the
  //      maps without waiting for the objects to enter the frustum; the warm
  //      rig is then removed before the first visible frame. ----
  (() => {
    const warm = new THREE.Group();
    for (const t of ['spitfire', 'p51', 'zero']) warm.add(buildAircraft({ type: t, enemy: true }).group);
    warm.add(makeBomb());
    // One stunt ring + beacon so entering a course doesn't hitch either.
    warm.add(new THREE.Mesh(
      new THREE.TorusGeometry(2, 0.2, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    ));
    warm.add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: beaconTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    })));
    warm.position.set(0, -400, 0); // out of sight even if a frame slips through
    scene.add(warm);
    // Compile BOTH worlds while we're at it (map switches shouldn't hitch).
    landGroup.visible = true;
    oceanGroup.visible = true;
    spawnTracer(warm.position, new THREE.Vector3(0, 1, 0), 0, new THREE.Vector3(), tracerMat);
    spawnTracer(warm.position, new THREE.Vector3(0, 1, 0), 0, new THREE.Vector3(), enemyTracerMat);
    spawnSpark(warm.position, 0.01, 0.01);
    spawnSmoke(warm.position, 0.01, 0.01);
    renderer.compile(scene, camera);
    scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap']) if (m[k]) renderer.initTexture(m[k]);
    });
    scene.remove(warm);
    // Now show only the selected map (also parks the plane on its deck/runway
    // and syncs the sortie-screen map tiles).
    setMap(mapName);
  })();
  requestAnimationFrame(frame);
})();
