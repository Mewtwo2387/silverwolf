// Plane Sim — a Three.js prop-plane flight simulator, modelled after a
// Supermarine Spitfire. Bundled (with three) into a self-hosted static asset
// (`plane-sim.js`) via `bun build`, exactly like app.src.js → app.js, because
// the site CSP is `script-src 'self'` and forbids CDNs. Loaded by
// site_src/pages/games/plane-sim.ts as a `<script type="module">`.
//
// Everything is client-side: no API, no DB, no login. Coordinates are metres,
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
} from './plane-sim-models.js';
import {
  TERRAIN, terrainHeight, forestMask, buildTerrain, buildWater, smoothstep, fbm,
} from './plane-sim-terrain.js';

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
      canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true,
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

    // Engine / aero. Stall ~64 kn, top speed ~330 kn.
    THRUST_MAX: 38, // full-throttle acceleration (m/s^2)
    THROTTLE_RATE: 0.6, // throttle units per second while holding W/S

    LIFT: 0.0054, // lift accel = LIFT * speed^2 * CL
    CL_SLOPE: 5.2, // lift-curve slope (per radian of AoA)
    A_STALL: 0.32, // stall angle of attack (rad, ~18°)

    DRAG0: 0.0013, // parasitic drag coefficient (sets top speed)
    DRAG_IND: 0.0008, // induced drag (× CL²) — bleeds speed in hard turns
    DRAG_GEAR: 0.00060, // extra parasitic drag while the undercarriage is down

    // Control authority (rad/s at full effectiveness) and the speed at which
    // the controls reach full effectiveness. Generous on purpose — the old
    // rates made just pointing at a bandit a workout.
    PITCH_RATE: 1.6,
    ROLL_RATE: 3.4,
    YAW_RATE: 1.0,
    CONTROL_V: 42, // airspeed (m/s) at which the controls reach full authority

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

    // Guns (player)
    FIRE_INTERVAL: 0.085, // seconds between tracer pairs
    TRACER_SPEED: 520, // m/s muzzle velocity relative to the plane
    TRACER_LIFE: 1.3,
    GUN_RANGE: 900, // hitscan reach (m)
    GUN_DMG: 3, // damage per round that connects
    GUN_SPREAD: 0.006, // rad of random spread per round
    LEAD_MAX: 1250, // show the lead pipper for targets within this range

    // Combat / AI enemies. The bandits fly the SAME flight model + CFG as the
    // player (same thrust, lift, drag, turn rates) so they're bound by the same
    // stall/turn/speed limits — deliberately not over-assisted. Their gunnery is
    // only as good as their nose-tracking (they fire along the nose + jitter, no
    // aimbot lead), and they pull the trigger slower than the player.
    ENEMY_HP: 100,
    PLAYER_HP: 100,
    HITBOX_R: 8, // simplified spherical hitbox radius around any plane (m)
    RADAR_RANGE: 1700, // within this, radar shows true relative pos; beyond -> rim blip
    AI_AIM_JITTER: 0.012, // base rad of spread per shot (scaled by difficulty + personality)
    AI_LEAD: 520, // m/s used to lead the target while STEERING (~tracer speed)
    ENEMY_PAINT: 0x6e7378, // any non-null paint -> bandit grey camo scheme
  };

  const KT = 1.94384; // m/s -> knots
  const FT = 3.28084; // m -> feet
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

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

  // ============================================================ SCENE =====
  const scene = new THREE.Scene();
  const SKY_TOP = new THREE.Color(0x3f87cc);
  const SKY_HAZE = new THREE.Color(0xc3d9e8);
  scene.background = SKY_TOP.clone();
  scene.fog = new THREE.Fog(SKY_HAZE.getHex(), 900, 9000);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 26000);
  camera.position.set(0, CFG.GROUND_Y + CAM_PRESETS[camName].up, 320 + CAM_PRESETS[camName].back);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic response -> less "flat web GL"
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated (aliases to PCF, but warns every frame)

  // ---- Lighting: a warm sun that casts soft shadows, a cool sky/ground
  //      hemisphere fill, and a dim back-fill so shadowed sides aren't dead
  //      black. The sun's shadow frustum is a small ortho box that follows the
  //      aircraft (see updateCamera) so shadows stay crisp anywhere in the map. ----
  const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.42).normalize();
  const sun = new THREE.DirectionalLight(0xfff2da, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  {
    const sc = sun.shadow.camera;
    sc.near = 1; sc.far = 420;
    sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95;
    sc.updateProjectionMatrix();
  }
  scene.add(sun);
  scene.add(sun.target);
  const backFill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  backFill.position.set(0.6, 0.4, -0.5);
  scene.add(backFill);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x55633f, 1.15));

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
  //      The airfield sits on a flattened disc at the origin. ----
  scene.add(buildTerrain(renderer));
  scene.add(buildWater());

  // ---- Demo airfield: tarmac runway (centreline, threshold + edge lines), a
  //      glazed control tower and Quonset-hut hangars. ----
  (function buildAirfield() {
    const field = new THREE.Group(); // 3D structures (cast + receive shadow)
    const markings = new THREE.Group(); // flat ground paint (receive only)

    const tarmac = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.RUNWAY_W, CFG.RUNWAY_LEN),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 }),
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

    const tower = makeControlTower();
    tower.position.set(46, 0, 150);
    field.add(tower);

    for (let i = 0; i < 2; i++) {
      const hut = makeHangar();
      hut.position.set(-56, 0, 40 - i * 74);
      field.add(hut);
    }

    // Parked aircraft: one tucked inside each hangar (nose out the +X door,
    // wheels on the 0.14 m slab) and one on the grass by the apron.
    for (const [px, py, pz, ry] of [
      [-58, 1.49, 40, -Math.PI / 2],
      [-58, 1.49, -34, -Math.PI / 2],
      [-42, 1.35, 96, -2.1],
    ]) {
      const parked = buildAircraft();
      parked.group.position.set(px, py, pz);
      parked.group.rotation.y = ry;
      field.add(parked.group);
    }

    scene.add(markings);
    scene.add(field);
  }());

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
        canopy: () => { const s = new THREE.SphereGeometry(3.5, 8, 6); s.scale(1, 0.85, 1); s.translate(0, 5.6, 0); return s; },
        hsl: () => [0.22 + Math.random() * 0.09, 0.5, 0.28 + Math.random() * 0.09],
        scale: () => 0.6 + Math.random() * 1.1,
      },
      conifer: {
        spots: [],
        trunk: [0.35, 0.65, 4.2, 2.1],
        canopy: () => { const c = new THREE.ConeGeometry(3.2, 9.5, 6); c.translate(0, 8.2, 0); return c; },
        hsl: () => [0.26 + Math.random() * 0.07, 0.42 + Math.random() * 0.15, 0.2 + Math.random() * 0.1],
        scale: () => 0.7 + Math.random() * 1.3,
      },
      pine: {
        spots: [],
        trunk: [0.28, 0.5, 7, 3.5],
        canopy: () => { const c = new THREE.ConeGeometry(2.0, 11, 7); c.translate(0, 11.2, 0); return c; },
        hsl: () => [0.31 + Math.random() * 0.05, 0.35, 0.16 + Math.random() * 0.07],
        scale: () => 0.75 + Math.random() * 0.85,
      },
    };
    // Type by altitude band, with fuzzy borders: broadleaf on the valley
    // floor, conifers on the slopes, slim pines toward the peaks.
    const pickType = (h) => {
      if (h > 190 + Math.random() * 70) return 'pine';
      if (h < 45 + Math.random() * 40) return Math.random() < 0.75 ? 'broadleaf' : 'conifer';
      return Math.random() < 0.8 ? 'conifer' : 'pine';
    };
    let placed = 0;
    let guard = 0;
    while (placed < 1900 && guard++ < 80000) {
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
      for (let k = 0; k < extra && placed < 1900; k++) {
        const sx = x + (Math.random() * 2 - 1) * 42;
        const sz = z + (Math.random() * 2 - 1) * 42;
        const sh = terrainHeight(sx, sz);
        if (sh < TERRAIN.WATER_Y + 6 || sh > 380) continue;
        types[pickType(sh)].spots.push([sx, sh, sz]);
        placed++;
      }
    }

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x54381f, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    for (const t of Object.values(types)) {
      if (!t.spots.length) continue;
      const [rTop, rBot, tHeight, tY] = t.trunk;
      const trunkGeo = new THREE.CylinderGeometry(rTop, rBot, tHeight, 5);
      trunkGeo.translate(0, tY, 0);
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
      }
      trunks.castShadow = true; canopies.castShadow = true; canopies.receiveShadow = true;
      scene.add(trunks); scene.add(canopies);
    }

    // Rocks: on the steeps and the high ground.
    const rocks = [];
    guard = 0;
    while (rocks.length < 170 && guard++ < 22000) {
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
    }
    rockMesh.castShadow = true;
    scene.add(rockMesh);
  }());

  // ---- Clouds: puffy clusters of overlapping sprites for altitude/speed
  //      reference (one material per cluster so opacity can vary). ----
  (function buildClouds() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(250,252,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 34; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, depthWrite: false, opacity: 0.5 + Math.random() * 0.35, fog: true,
      });
      const cx = (Math.random() - 0.5) * CFG.BORDER * 2.2;
      const cy = 260 + Math.random() * 1100;
      const cz = (Math.random() - 0.5) * CFG.BORDER * 2.2;
      const base = 120 + Math.random() * 220;
      const n = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(mat);
        s.position.set(
          cx + (Math.random() - 0.5) * base * 1.6,
          cy + (Math.random() - 0.5) * base * 0.35,
          cz + (Math.random() - 0.5) * base * 1.2,
        );
        const scl = base * (0.55 + Math.random() * 0.7);
        s.scale.set(scl, scl * 0.55, 1);
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
  // The Spitfire-ish prop fighter. Geometry lives in plane-sim-models.js (shared
  // with the model inspector) so the flown model and the inspected model are one
  // and the same. `surf` holds the animatable handles (control surfaces, prop,
  // gear); the physics below drives them.
  const { group: plane, surf } = buildAircraft();
  scene.add(plane);

  // Reset to the runway threshold, lined up to take off toward -Z.
  function resetPlane() {
    plane.position.set(0, CFG.GROUND_Y, CFG.RUNWAY_LEN / 2 - 60);
    plane.quaternion.identity();
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
  let playerHP = CFG.PLAYER_HP;
  let kills = 0;
  let won = false;
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

  // Ground height under a world position (the terrain module returns exactly 0
  // on the flattened airfield disc, so the runway Just Works).
  const groundAt = (x, z) => terrainHeight(x, z);

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
    }
    function setEngine(thr, speed) {
      if (!engine) return;
      const f = 42 + thr * 68 + speed * 0.1;
      engine.o1.frequency.value = f;
      engine.o2.frequency.value = f * 1.012;
      engine.lp.frequency.value = 220 + thr * 780;
      engine.g.gain.value = 0.1 + thr * 0.22;
    }
    function burst(dur, freq, vol, type) {
      if (!ctx || muted) return;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const k = 1 - i / len; d[i] = (Math.random() * 2 - 1) * k * k; }
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = vol;
      n.connect(f); f.connect(g); g.connect(master);
      n.start();
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
      gun: () => burst(0.05, 950, 0.5),
      hit: () => burst(0.09, 380, 0.6),
      boom: () => burst(0.9, 130, 1.6, 'lowpass'),
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
  function spawnTracer(pos, dir, speed, baseVel, mat) {
    const t = new THREE.Mesh(tracerGeo, mat);
    t.position.copy(pos);
    t.quaternion.copy(_tq.setFromUnitVectors(_tz, dir)); // align the long axis with travel
    t.userData.vel = dir.clone().multiplyScalar(speed).add(baseVel);
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
  const sparks = [];
  function spawnSpark(pos, size, life) {
    const m = new THREE.SpriteMaterial({
      map: sparkTex, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const s = new THREE.Sprite(m);
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
        s.material.dispose();
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
  function spawnSmoke(pos, size, life) {
    const m = new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true });
    const s = new THREE.Sprite(m);
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
        scene.remove(s); s.material.dispose(); smokes.splice(i, 1);
        continue;
      }
      s.position.y += dt * 2.5;
      s.material.opacity = k * 0.8;
      s.scale.setScalar(s.userData.size * (1 + (1 - k) * 2.2));
    }
  }

  // ---- Debris: tumbling chunks thrown by a kill, falling under gravity. ----
  const debris = [];
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.9 });
  function spawnDebris(pos, baseVel) {
    for (let i = 0; i < 6; i++) {
      const s = 0.3 + Math.random() * 0.9;
      const d = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.5, s * 1.4), debrisMat);
      d.position.copy(pos);
      d.userData.vel = baseVel.clone().multiplyScalar(0.6).add(new THREE.Vector3(
        (Math.random() - 0.5) * 45, Math.random() * 30, (Math.random() - 0.5) * 45,
      ));
      d.userData.rot = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
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
        d.geometry.dispose();
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
      .addScaledVector(up, (Math.random() - 0.5) * 2 * CFG.GUN_SPREAD)
      .addScaledVector(right, (Math.random() - 0.5) * 2 * CFG.GUN_SPREAD)
      .normalize();
    const muzzle = plane.position.clone().addScaledVector(fwd, 4.5);
    for (const sx of [-1, 1]) {
      const mpos = muzzle.clone().addScaledVector(right, sx * 3.0);
      spawnTracer(mpos, _shot, CFG.TRACER_SPEED, vel, tracerMat);
      spawnSpark(mpos, 1.1, 0.06); // muzzle flash
    }
    audio.gun();
    // Hitscan along the (spread-jittered) shot line: damage the closest bandit.
    let bestT = CFG.GUN_RANGE; let bestE = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const t = rayHitsSphere(muzzle, _shot, e.group.position, CFG.HITBOX_R, CFG.GUN_RANGE);
      if (t >= 0 && t < bestT) { bestT = t; bestE = e; }
    }
    if (bestE) {
      spawnSpark(muzzle.clone().addScaledVector(_shot, bestT), 4, 0.18);
      audio.hit();
      damageEnemy(bestE, CFG.GUN_DMG * diff.dmgMul);
    }
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
    const { group, surf: esurf } = buildAircraft({ paint: CFG.ENEMY_PAINT, markings: false });
    applyControlSurfaces(esurf, { gear: 0 }); // bandits fly gear-up
    setPropBlur(esurf, 0.85); // airborne -> prop is a blur disc
    scene.add(group);
    return {
      group,
      surf: esurf,
      vel: new THREE.Vector3(),
      throttle: 0.85,
      hp: CFG.ENEMY_HP,
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
    e.hp = CFG.ENEMY_HP;
    e.alive = true;
    e.group.visible = true;
    e.defl.ail = 0; e.defl.elev = 0; e.defl.rud = 0;
    e.mode = 'engage'; e.modeT = 0; e.coTurn = 0; e.underFire = 0;
  }

  // All five airframes are built once; an engagement activates the first
  // `enemyCountPref` of them and parks the rest (invisible, not alive).
  function applyEnemyActivation() {
    activeCount = enemyCountPref;
    enemies.forEach((e, i) => {
      if (i < activeCount) placeEnemy(e);
      else { e.alive = false; e.group.visible = false; }
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
    const ghHere = groundAt(g.position.x, g.position.z);
    const ghAhead = groundAt(g.position.x + e.vel.x * 2.5, g.position.z + e.vel.z * 2.5);
    const floor = Math.max(ghHere, ghAhead);
    if (g.position.y < floor + 90) { pitchInput = Math.max(pitchInput, 0.7); rollInput *= 0.3; }
    if (g.position.y < floor + 45) { pitchInput = 1; rollInput = 0; }

    let thrTarget = 0.9;
    const speed = e.vel.length();
    if (engaging && dist < 130) thrTarget = 0.55; // don't overshoot/ram
    if (!engaging) thrTarget = 1; // extend hard
    if (speed < 60) thrTarget = 1; // never mush into a stall
    e.throttle = clamp(e.throttle + clamp(thrTarget - e.throttle, -dt, dt), 0, 1);

    // ---- Flight integration: identical model + CFG as the player (gear-up) ----
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
    EN.acc.addScaledVector(EN.fwd, e.throttle * CFG.THRUST_MAX);
    EN.acc.addScaledVector(EN.up, CFG.LIFT * v2 * CL);
    EN.acc.y -= CFG.G;
    if (speed > 0.01) {
      const cd = CFG.DRAG0 + CFG.DRAG_IND * CL * CL;
      EN.vDir.copy(e.vel).multiplyScalar(1 / speed);
      EN.acc.addScaledVector(EN.vDir, -cd * v2);
    }
    e.vel.addScaledVector(EN.acc, dt);
    g.position.addScaledVector(e.vel, dt);

    let eff = clamp(speed / CFG.CONTROL_V, 0, 1.15);
    if (stalled) eff *= 0.45;
    eff *= diff.turn * e.pers.turnBias; // difficulty/personality turn handicap
    g.rotateX(pitchInput * CFG.PITCH_RATE * eff * dt);
    g.rotateZ(-rollInput * CFG.ROLL_RATE * eff * dt);
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
        const t = rayHitsSphere(EN.muzzle, EN.shotDir, plane.position, CFG.HITBOX_R, diff.range);
        if (t >= 0) damagePlayer(CFG.GUN_DMG, EN.dirP.copy(EN.muzzle).addScaledVector(EN.shotDir, t));
      }
    }
  }

  // ---- Damage / death ----
  function damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg;
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
      updateCombatHUD();
      if (kills >= activeCount && !won) victory();
    }
  }

  function damagePlayer(dmg, at) {
    if (crashed || won || dev.god) return;
    playerHP -= dmg;
    flashDamage();
    audio.hit();
    if (at) spawnSpark(at, 2.6, 0.14);
    if (playerHP <= 0) { playerHP = 0; updateCombatHUD(); crash('Shot down'); return; }
    updateCombatHUD();
  }

  function victory() {
    won = true;
    if (hud.warn) {
      hud.warn.textContent = '🏆 All bandits downed — press SPACE to fly again';
      hud.warn.classList.add('ps-show');
    }
  }

  // ======================================================== INPUT =========
  const stage = document.getElementById('ps-stage') || canvas;
  const overlay = document.getElementById('ps-overlay');
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

  // ---- Pause menu (ESC). Freezes the sim (dt = 0) and suspends audio; the
  //      overlay hosts volume/camera/bandits/skill settings. ----
  const pauseOv = document.getElementById('ps-pause');
  let userPaused = false;
  function setPaused(on) {
    userPaused = !!on;
    firing = false;
    if (pauseOv) pauseOv.classList.toggle('ps-hidden', !userPaused);
    if (userPaused) audio.suspend(); else audio.resume();
  }
  document.getElementById('ps-resume')?.addEventListener('click', () => setPaused(false));
  const volSlider = document.getElementById('ps-vol');
  if (volSlider) {
    volSlider.value = String(Math.round(audio.getVolume() * 100));
    volSlider.addEventListener('input', () => { audio.setVolume((+volSlider.value) / 100); });
  }

  function start() {
    if (started) return;
    started = true;
    audio.ensure(); // user gesture -> AudioContext allowed
    if (overlay) overlay.classList.add('ps-hidden');
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === 'escape' && started) { setPaused(!userPaused); return; }
    if (k === '1') { setDifficulty('easy'); return; }
    if (k === '2') { setDifficulty('normal'); return; }
    if (k === '3') { setDifficulty('hard'); return; }
    if (k === 'm') { audio.toggleMute(); return; }
    if (k === 'c') {
      setCamPreset(CAM_ORDER[(CAM_ORDER.indexOf(camName) + 1) % CAM_ORDER.length]);
      return;
    }
    if (['w', 'a', 's', 'd', 'g', ' '].includes(k)) {
      if (started) e.preventDefault();
      if (k === 'g') gearDown = !gearDown; // toggle on key-down edge
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
    start();
    if (e.button === 2) { firing = true; e.preventDefault(); }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) firing = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  if (overlay) overlay.addEventListener('click', start);

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
    const pct = clamp(Math.round((playerHP / CFG.PLAYER_HP) * 100), 0, 100);
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

    // 1) Airspeed: 0..450 kn over a 270° sweep starting at 135°.
    function drawASI(cx, cy, kn) {
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 8px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (let v = 0; v <= 450; v += 50) {
        const a = (135 + (v / 450) * 270) * D2R;
        const c = Math.cos(a); const s = Math.sin(a);
        ctx.strokeStyle = CREAM; ctx.lineWidth = v % 100 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + c * (R - 8), cy + s * (R - 8));
        ctx.lineTo(cx + c * (R - 2), cy + s * (R - 2));
        ctx.stroke();
        if (v % 100 === 0) ctx.fillText(String(v), cx + c * (R - 17), cy + s * (R - 17) + 3);
      }
      label(cx, cy, 'AIRSPEED · KN');
      ctx.fillStyle = CREAM; ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(String(Math.round(kn)), cx, cy + 20);
      needle(cx, cy, (135 + (clamp(kn, 0, 450) / 450) * 270) * D2R, R - 10, 2.4, '#f2ede0');
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

    // 3) Altimeter: long needle = 100s of feet, short = 1000s. Classic two-hand.
    function drawALT(cx, cy, ft) {
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
      label(cx, cy, 'ALTITUDE · FT');
      ctx.fillStyle = CREAM; ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(String(Math.max(0, Math.round(ft))), cx, cy + 20);
      const a1000 = (-90 + ((ft % 10000) / 10000) * 360) * D2R;
      const a100 = (-90 + ((ft % 1000) / 1000) * 360) * D2R;
      needle(cx, cy, a1000, R * 0.45, 3.4, '#d8d2ba');
      needle(cx, cy, a100, R - 12, 2.2, '#f2ede0');
      glass(cx, cy);
    }

    // 4) VSI: ±2000 ft/min. 0 points left; climb sweeps up, dive sweeps down.
    function drawVSI(cx, cy, fpm) {
      face(cx, cy);
      ctx.fillStyle = CREAM; ctx.font = '600 7px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (const [v, t] of [[-2000, '2'], [-1000, '1'], [0, '0'], [1000, '1'], [2000, '2']]) {
        const a = (180 + (v / 2000) * 80) * D2R;
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
      label(cx, cy, 'CLIMB ×1000');
      needle(cx, cy, (180 + (clamp(fpm, -2000, 2000) / 2000) * 80) * D2R, R - 11, 2.4, '#f2ede0');
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
        drawASI(60, cy, st.kn);
        drawATT(60 + CELL, cy, st.pitch, st.roll);
        drawALT(60 + CELL * 2, cy, st.ft);
        drawVSI(60 + CELL * 3, cy, st.fpm);
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

    // runway
    mapCtx.strokeStyle = 'rgba(230,238,242,0.7)';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(-px * s, (-CFG.RUNWAY_LEN / 2 - pz) * s);
    mapCtx.lineTo(-px * s, (CFG.RUNWAY_LEN / 2 - pz) * s);
    mapCtx.stroke();

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
      const pct = clamp((e.hp / CFG.ENEMY_HP) * 100, 0, 100);
      b.fill.style.width = `${pct}%`;
      b.fill.style.background = pct > 50 ? '#ff8f5a' : '#ff4d4d';
      b.label.textContent = `${Math.round(d)} m`;
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

  function respawn() {
    resetPlane();
    vel.set(0, 0, 0);
    throttle = 0;
    crashed = false;
    won = false;
    onGround = true;
    gearDown = true;
    playerHP = CFG.PLAYER_HP;
    kills = 0;
    resetEnemies();
    updateCombatHUD();
    if (hud.warn) { hud.warn.textContent = ''; hud.warn.classList.remove('ps-show'); }
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

    // --- Forces -> acceleration ---
    getForward(); getUp();
    _acc.set(0, 0, 0);
    _acc.addScaledVector(_fwd, throttle * CFG.THRUST_MAX); // thrust
    _acc.addScaledVector(_up, CFG.LIFT * v2 * CL); // lift (CL carries the sign)
    _acc.y -= CFG.G; // gravity
    if (speed > 0.01) {
      const cd = CFG.DRAG0 + CFG.DRAG_IND * CL * CL + (gearDown ? CFG.DRAG_GEAR : 0);
      _vDir.copy(vel).multiplyScalar(1 / speed);
      _acc.addScaledVector(_vDir, -cd * v2);
    }
    vel.addScaledVector(_acc, dt);
    plane.position.addScaledVector(vel, dt);

    // --- Attitude (rate control, fading in with airspeed) ---
    let e = clamp(speed / CFG.CONTROL_V, 0, 1.15);
    if (stalled) e *= 0.45; // mushy controls in the stall
    if (onGround) {
      rollInput = 0; // wings stay level on the wheels
      // taxi steering: the tailwheel gives real authority even when slow
      plane.rotateY(-rudder * CFG.YAW_RATE * Math.max(e, 0.4) * dt);
    } else {
      plane.rotateY(-yawInput * CFG.YAW_RATE * e * dt);
    }
    plane.rotateX(pitchInput * CFG.PITCH_RATE * e * dt);
    plane.rotateZ(-rollInput * CFG.ROLL_RATE * e * dt);
    // Stall break: the nose drops, which lowers AoA and lets you recover.
    if (stalled && fwdSpeed > 0) plane.rotateX(-(Math.abs(aoa) - CFG.A_STALL) * 1.6 * dt);

    // Grip + coordinated turn (the anti-drift fix). Skipped on the deck so the
    // takeoff roll / tyre model owns ground velocity.
    if (!onGround) flightAssist(plane, vel, e, dt);

    // --- Terrain contact: touchdown, taxi, or crash ---
    const gh = groundAt(plane.position.x, plane.position.z);
    if (plane.position.y <= gh + CFG.GROUND_Y) {
      plane.position.y = gh + CFG.GROUND_Y;
      const impactV = -vel.y;
      if (vel.y < 0) vel.y = 0;

      // Water, steep slopes, hard/fast/gear-up arrivals = crash.
      const ee = 8;
      const slope = Math.hypot(
        groundAt(plane.position.x + ee, plane.position.z) - groundAt(plane.position.x - ee, plane.position.z),
        groundAt(plane.position.x, plane.position.z + ee) - groundAt(plane.position.x, plane.position.z - ee),
      ) / (2 * ee);
      if (started && !crashed) {
        if (gh < TERRAIN.WATER_Y + 0.5) crash('Ditched in the lake');
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
      getForward();
      const pitch = Math.asin(clamp(_fwd.y, -1, 1));
      if (pitch < 0) plane.rotateX(-pitch * Math.min(1, 8 * dt));

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
    if (surf.gear) {
      const r = (1 - gearAnim) * (Math.PI / 2); // main legs fold inward to the belly
      if (surf.gear.userData.left) surf.gear.userData.left.rotation.z = r;
      if (surf.gear.userData.right) surf.gear.userData.right.rotation.z = -r;
      if (surf.gear.userData.tail) surf.gear.userData.tail.rotation.x = -r;
      surf.gear.visible = gearAnim > 0.02;
    }

    // --- Animate the control surfaces toward their commanded deflection ---
    const lerp = (a, b, t) => a + (b - a) * t;
    defl.ail = lerp(defl.ail, rollInput * 0.4, 0.2);
    defl.elev = lerp(defl.elev, pitchInput * 0.4, 0.2);
    defl.rud = lerp(defl.rud, yawInput * 0.5, 0.2);
    if (surf.aileronL) surf.aileronL.rotation.x = defl.ail; // ailerons move opposite
    if (surf.aileronR) surf.aileronR.rotation.x = -defl.ail;
    if (surf.elevator) surf.elevator.rotation.x = -defl.elev;
    if (surf.rudder) surf.rudder.rotation.y = -defl.rud;

    // --- Guns ---
    fireCooldown -= dt;
    if (firing && fireCooldown <= 0) { fireGuns(); fireCooldown = CFG.FIRE_INTERVAL; }
    stepTracers(dt);

    // --- Target lock: is a bandit in the gun line right now? (turns the pipper red) ---
    getForward();
    lockTarget = false;
    for (const en of enemies) {
      if (en.alive && rayHitsSphere(plane.position, _fwd, en.group.position, CFG.HITBOX_R, CFG.GUN_RANGE) >= 0) {
        lockTarget = true; break;
      }
    }
    if (pipper) pipper.classList.toggle('ps-lock', lockTarget);

    // --- Engine audio follows throttle + speed ---
    audio.setEngine(throttle, speed);

    // --- HUD ---
    const knots = Math.max(0, fwdSpeed) * KT;
    if (gauges) {
      getForward(); getUp(); getRight();
      gauges.draw({
        kn: knots,
        ft: (plane.position.y - CFG.GROUND_Y - gh) * FT,
        fpm: vel.y * FT * 60,
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
    if (hud.stall) hud.stall.classList.toggle('ps-show', (stalled || (knots < 70 && !onGround)) && !crashed);
    if (hud.warn && !crashed) {
      if (hitBorder) { hud.warn.textContent = '⚠ WORLD BORDER'; hud.warn.classList.add('ps-show'); }
      else { hud.warn.classList.remove('ps-show'); }
    }
  }

  function crash(reason) {
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
    if (hud.warn) {
      hud.warn.textContent = `💥 ${reason} — press SPACE to respawn`;
      hud.warn.classList.add('ps-show');
    }
  }

  // ======================================================== CAMERA ========
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
    const ghc = groundAt(_camPos.x, _camPos.z);
    if (_camPos.y < ghc + 2) _camPos.y = ghc + 2; // don't dive the camera underground
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
      x: +plane.position.x.toFixed(1),
      y: +plane.position.y.toFixed(1),
      z: +plane.position.z.toFixed(1),
      agl: +(plane.position.y - CFG.GROUND_Y - groundAt(plane.position.x, plane.position.z)).toFixed(1),
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
        alive: e.alive,
        hp: e.hp,
        mode: e.mode,
        dist: +e.group.position.distanceTo(plane.position).toFixed(0),
        y: +e.group.position.y.toFixed(0),
      })),
    };
  };
  window.__ps = {
    plane, vel, enemies, camera, start, respawn, dev,
    get throttle() { return throttle; },
    set throttle(v) { throttle = clamp(v, 0, 1); },
    state: devState,
    // Virtual stick: overrides the mouse until stick(null).
    stick(nx, ny) {
      dev.stickOverride = (nx == null) ? null : { nx: clamp(nx, -1, 1), ny: clamp(ny || 0, -1, 1) };
    },
    key(k, down) { keys[String(k).toLowerCase()] = !!down; },
    fire(on) { firing = !!on; },
    teleport(x, y, z, hdgDeg = 0, speed = 120) {
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
    kill(i) { const e = enemies[i]; if (e && e.alive) damageEnemy(e, 99999); },
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
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)
    dt *= dev.timeScale;
    if (dev.paused || userPaused) dt = 0;

    const playing = started && !crashed && !won && dt > 0;
    if (playing) update(dt);
    else {
      // idle the prop + animate gear even before launch / after a crash
      if (surf.prop) surf.prop.rotation.z -= 0.18 * 60 * dt;
      setPropBlur(surf, 0.18);
      stepTracers(dt);
      if (gauges && !started) {
        gauges.draw({
          kn: 0, ft: 0, fpm: 0, thr: 0, pitch: 0, roll: 0, hdg: 0,
        });
      }
    }

    // Bandits fly even before launch / after a crash (so they patrol), but only
    // shoot while the engagement is live.
    for (const e of enemies) if (e.alive && dt > 0) stepEnemy(e, dt, playing && !dev.noAiFire);
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

    updateCamera(dt);
    drawMap();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
