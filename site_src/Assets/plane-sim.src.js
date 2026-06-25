// Plane Sim — a small Three.js prop-plane flight simulator, modelled after a
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
// curve driven by angle-of-attack — the angle between where the nose points
// and where the plane is actually going — which is what makes a too-slow or
// over-pulled wing STALL, and what sets the takeoff/stall speeds emergently
// rather than by hand. Attitude is rate-controlled and the rates fade with
// airspeed, so the controls are mushy on the runway and crisp at speed.
//
// TUNING: all the feel constants live in the CFG block below. If any axis feels
// inverted during playtest, flip the sign on its rotate call (search ROLL_RATE
// / PITCH_RATE / YAW_RATE in update()).

import * as THREE from 'three';
import {
  buildAircraft, applyControlSurfaces, makeTree, makeHangar, makeControlTower,
} from './plane-sim-models.js';

(() => {
  'use strict';

  const canvas = document.getElementById('ps-canvas');
  if (!canvas) return;

  // ---- WebGL guard: show a graceful message instead of a blank screen ----
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    const ov = document.getElementById('ps-overlay');
    if (ov) ov.innerHTML = '<div class="ps-card"><h2>WebGL unavailable</h2>'
      + '<p>Your browser or GPU can’t run 3D graphics, so Plane Sim can’t start.</p></div>';
    return;
  }

  // ============================================================ CONFIG ====
  const CFG = {
    G: 9.81, // gravity (m/s^2)

    // Engine / aero — see the sanity figures in the header comment.
    THRUST_MAX: 34, // full-throttle acceleration (m/s^2)
    THROTTLE_RATE: 0.55, // throttle units per second while holding W/S

    LIFT: 0.0052, // lift accel = LIFT * speed^2 * CL
    CL_SLOPE: 5.0, // lift-curve slope (per radian of AoA)
    A_STALL: 0.30, // stall angle of attack (rad, ~17°)

    DRAG0: 0.0014, // parasitic drag coefficient (sets top speed ~155 m/s)
    DRAG_IND: 0.0008, // induced drag (× CL²) — bleeds speed in hard turns
    DRAG_GEAR: 0.00060, // extra parasitic drag while the undercarriage is down

    // Control authority (rad/s at full effectiveness) and the speed at which
    // the controls reach full effectiveness.
    PITCH_RATE: 1.30,
    ROLL_RATE: 2.60,
    YAW_RATE: 0.75,
    CONTROL_V: 46, // airspeed (m/s) at which the controls reach full authority

    // Handling feel (see flightAssist) — the "tight arcade" fix for floaty,
    // drifty turns. GRIP rotates the velocity vector toward where the nose points
    // (so the plane goes where you aim instead of sliding sideways and bleeding
    // speed); TURN_COUPLING makes a bank carve a coordinated turn. Raise GRIP for
    // even less drift, lower it for a heavier / more sim-like feel.
    GRIP: 3.2, // velocity-vector alignment rate (1/s)
    TURN_COUPLING: 1.4, // bank-to-turn yaw authority (rad/s, scaled by bank & airspeed)

    // World
    BORDER: 2200, // half-extent of the play area (a 4.4 km box)
    GROUND_Y: 1.35, // plane-origin height when the wheels are on the deck
    RUNWAY_LEN: 760,
    RUNWAY_W: 38,

    // Camera chase rig (local offset behind/above the plane)
    CAM_BACK: 17,
    CAM_UP: 5.2,
    CAM_LERP: 0.10,

    // Guns (player)
    FIRE_INTERVAL: 0.08, // seconds between tracer pairs
    TRACER_SPEED: 480, // m/s muzzle velocity relative to the plane
    TRACER_LIFE: 0.9,
    GUN_RANGE: 750, // hitscan reach (m)
    GUN_DMG: 3, // damage per round that connects

    // Combat / AI enemies. The bandits fly the SAME flight model + CFG as the
    // player (same thrust, lift, drag, turn rates) so they're bound by the same
    // stall/turn/speed limits — deliberately not over-assisted. Their gunnery is
    // only as good as their nose-tracking (they fire along the nose + jitter, no
    // aimbot lead), and they pull the trigger slower than the player.
    ENEMY_COUNT: 3,
    ENEMY_HP: 100,
    PLAYER_HP: 100,
    HITBOX_R: 6.5, // simplified spherical hitbox radius around any plane (m)
    RADAR_RANGE: 1400, // within this, radar shows true relative pos; beyond -> rim blip
    AI_AIM_JITTER: 0.012, // base rad of spread per shot (scaled by difficulty + personality)
    AI_LEAD: 480, // m/s used to lead the target while STEERING (~tracer speed)
    ENEMY_PAINT: 0x6e7378, // gunmetal grey — clearly not the player's olive
  };

  const KT = 1.94384; // m/s -> knots
  const FT = 3.28084; // m -> feet
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

  // ============================================================ SCENE =====
  const scene = new THREE.Scene();
  const SKY_TOP = new THREE.Color(0x4a93d4);
  const SKY_HAZE = new THREE.Color(0xbcd6e8);
  scene.background = SKY_TOP.clone();
  scene.fog = new THREE.Fog(SKY_HAZE.getHex(), 700, CFG.BORDER * 1.7);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, CFG.BORDER * 3);
  camera.position.set(0, CFG.GROUND_Y + CFG.CAM_UP, 320 + CFG.CAM_BACK);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic response -> less "flat web GL"
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  const backFill = new THREE.DirectionalLight(0x9fc4ff, 0.35);
  backFill.position.set(0.6, 0.4, -0.5);
  scene.add(backFill);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x55633f, 0.9));

  // ---- A gradient sky dome (top deep-blue -> pale horizon haze) ----
  (function buildSky() {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#2f6fb0');
    g.addColorStop(0.55, '#6aa6d8');
    g.addColorStop(1.0, '#cfe2ee');
    const ctx = c.getContext('2d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(CFG.BORDER * 2.4, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    scene.add(dome);
  }());

  // ---- Ground: large green plane with soft tonal patches + a faint grid for
  //      motion/altitude cues. Receives the aircraft's shadow. ----
  (function buildGround() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#466431'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 256; const y = Math.random() * 256; const rad = 14 + Math.random() * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, Math.random() < 0.5 ? 'rgba(98,128,62,0.5)' : 'rgba(42,62,30,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(28,42,18,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 255, 255);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(150, 150);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.BORDER * 6, CFG.BORDER * 6),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
  }());

  // ---- Demo airfield: tarmac runway (centreline, threshold + edge lines), a
  //      glazed control tower, Quonset-hut hangars, and scattered trees. ----
  (function buildAirfield() {
    const field = new THREE.Group(); // 3D structures (cast + receive shadow)
    const markings = new THREE.Group(); // flat ground paint (receive only)

    const tarmac = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.RUNWAY_W, CFG.RUNWAY_LEN),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 }),
    );
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.y = 0.03;
    tarmac.receiveShadow = true;
    markings.add(tarmac);

    const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.8 });
    const flat = (geo, x, z) => {
      const m = new THREE.Mesh(geo, paint);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); m.receiveShadow = true;
      markings.add(m);
    };
    for (const sx of [-1, 1]) flat(new THREE.PlaneGeometry(0.8, CFG.RUNWAY_LEN - 20), sx * (CFG.RUNWAY_W / 2 - 1.2), 0);
    for (let z = -CFG.RUNWAY_LEN / 2 + 24; z < CFG.RUNWAY_LEN / 2 - 24; z += 26) flat(new THREE.PlaneGeometry(1.1, 11), 0, z);
    for (const end of [-1, 1]) {
      for (let i = -4; i <= 4; i++) flat(new THREE.PlaneGeometry(2.2, 9), i * 3.2, end * (CFG.RUNWAY_LEN / 2 - 9));
    }

    // Scenery (shared builders — see plane-sim-models.js): a control tower,
    // Quonset-hut hangars, and a ring of trees around the field.
    const tower = makeControlTower();
    tower.position.set(46, 0, 150);
    field.add(tower);

    for (let i = 0; i < 2; i++) {
      const hut = makeHangar();
      hut.position.set(-56, 0, 40 - i * 74);
      field.add(hut);
    }

    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 240 + Math.random() * (CFG.BORDER - 340);
      const x = Math.cos(a) * rr; const z = Math.sin(a) * rr;
      if (Math.abs(x) < CFG.RUNWAY_W + 20 && Math.abs(z) < CFG.RUNWAY_LEN / 2) continue;
      const tree = makeTree();
      tree.position.set(x, 0, z);
      field.add(tree);
    }

    scene.add(markings);
    scene.add(field);
  }());

  // ---- A few drifting cloud sprites for altitude/speed reference ----
  (function buildClouds() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, opacity: 0.85, fog: true });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(mat);
      s.position.set(
        (Math.random() - 0.5) * CFG.BORDER * 2,
        180 + Math.random() * 520,
        (Math.random() - 0.5) * CFG.BORDER * 2,
      );
      const sc = 90 + Math.random() * 180;
      s.scale.set(sc, sc * 0.62, 1);
      scene.add(s);
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
    const B = CFG.BORDER; const H = 1000;
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
        map: tex, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
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
  let stickX = 0; let stickY = 0; // virtual stick from the mouse, [-1, 1]
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
    group.rotateY(-sinBank * CFG.TURN_COUPLING * eff * dt);
  }

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

  // ---- Impact sparks / explosions: cheap additive sprites that pop and fade. ----
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

  // The player's wing guns: two amber tracers + a single centreline hitscan that
  // damages the nearest bandit it passes through.
  function fireGuns() {
    // Clone the basis vectors — addScaledVector/clone below must not alias the
    // shared _fwd/_right temps (that bug fired tracers backwards at 4.5 m/s).
    const fwd = getForward().clone();
    const right = getRight().clone();
    const muzzle = plane.position.clone().addScaledVector(fwd, 4.5);
    for (const sx of [-1, 1]) {
      spawnTracer(muzzle.clone().addScaledVector(right, sx * 3.0), fwd, CFG.TRACER_SPEED, vel, tracerMat);
    }
    // Hitscan along the nose: damage the closest bandit within range.
    let bestT = CFG.GUN_RANGE; let bestE = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const t = rayHitsSphere(muzzle, fwd, e.group.position, CFG.HITBOX_R, CFG.GUN_RANGE);
      if (t >= 0 && t < bestT) { bestT = t; bestE = e; }
    }
    if (bestE) {
      spawnSpark(muzzle.clone().addScaledVector(fwd, bestT), 4, 0.18);
      damageEnemy(bestE, CFG.GUN_DMG);
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
  const ENEMY_SPAWN = [
    { ang: -0.7, dist: 900, alt: 230 },
    { ang: 0.15, dist: 1150, alt: 320 },
    { ang: 0.95, dist: 780, alt: 180 },
  ];

  // ---- Difficulty. Scales the bandits' turn performance (turn = multiplier on
  //      their control effectiveness, so <1 means you out-turn them), gunnery
  //      (jitter/range/cone/interval) and how long they'll grind a turn fight
  //      before breaking off (breakAfter). Chosen on the start overlay or with
  //      1/2/3; remembered across sessions. ----
  const DIFFS = {
    easy: {
      label: 'ROOKIE', turn: 0.70, jitterMul: 2.6, fireInt: 0.22, range: 520, cone: 0.990, breakAfter: 3.0, breakMin: 3.2, breakMax: 5.0,
    },
    normal: {
      label: 'REGULAR', turn: 0.86, jitterMul: 1.6, fireInt: 0.17, range: 600, cone: 0.994, breakAfter: 4.5, breakMin: 2.4, breakMax: 4.0,
    },
    hard: {
      label: 'ACE', turn: 1.00, jitterMul: 1.0, fireInt: 0.13, range: 660, cone: 0.997, breakAfter: 6.5, breakMin: 1.6, breakMax: 2.8,
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
    scene.add(group);
    return {
      group,
      surf: esurf,
      vel: new THREE.Vector3(),
      throttle: 0.85,
      hp: CFG.ENEMY_HP,
      alive: true,
      fireCd: Math.random() * 0.25,
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
        alt: 150 + Math.random() * 220, // preferred working altitude when repositioning
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

  function spawnEnemies() {
    for (const spec of ENEMY_SPAWN) {
      const e = makeEnemy(spec);
      placeEnemy(e);
      enemies.push(e);
    }
  }
  function resetEnemies() { for (const e of enemies) placeEnemy(e); }

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
      EN.aim.y = e.pers.alt + 120;
    }
    // Stay in the box + off the deck: near a wall, steer back toward the centre.
    if (Math.max(Math.abs(g.position.x), Math.abs(g.position.z)) > CFG.BORDER - 350) {
      EN.aim.set(0, Math.max(e.pers.alt, 200), 0);
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
    if (g.position.y < 70) { pitchInput = Math.max(pitchInput, 0.7); rollInput *= 0.3; } // ground avoid
    if (g.position.y < 35) { pitchInput = 1; rollInput = 0; }

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

    if (g.position.y < 12) { g.position.y = 12; if (e.vel.y < 0) e.vel.y = 0; } // soft floor

    // ---- Visual: prop spin + control-surface deflection ----
    e.propSpin -= (0.2 + e.throttle * 0.8) * 60 * dt;
    if (e.surf.prop) e.surf.prop.rotation.z = e.propSpin;
    e.defl.ail += (rollInput * 0.4 - e.defl.ail) * 0.2;
    e.defl.elev += (pitchInput * 0.4 - e.defl.elev) * 0.2;
    e.defl.rud += (yawInput * 0.5 - e.defl.rud) * 0.2;
    applyControlSurfaces(e.surf, {
      ail: e.defl.ail, elev: e.defl.elev, rud: e.defl.rud, gear: 0,
    });

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
      spawnSpark(e.group.position, 16, 0.6); // explosion puff
      kills += 1;
      updateCombatHUD();
      if (kills >= CFG.ENEMY_COUNT && !won) victory();
    }
  }

  function damagePlayer(dmg, at) {
    if (crashed || won) return;
    playerHP -= dmg;
    flashDamage();
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

  // Difficulty picker on the start overlay. mousedown stopPropagation so clicking
  // a tier selects it instead of also starting the game (the stage's mousedown
  // handler calls start()).
  const diffBtns = overlay ? overlay.querySelectorAll('[data-diff]') : null;
  if (diffBtns) {
    for (const b of diffBtns) {
      b.addEventListener('mousedown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setDifficulty(b.dataset.diff); });
    }
  }

  function start() {
    if (started) return;
    started = true;
    if (overlay) overlay.classList.add('ps-hidden');
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === '1') { setDifficulty('easy'); return; }
    if (k === '2') { setDifficulty('normal'); return; }
    if (k === '3') { setDifficulty('hard'); return; }
    if (['w', 'a', 's', 'd', 'g', ' '].includes(k)) {
      if (started) e.preventDefault();
      if (k === 'g') gearDown = !gearDown; // toggle on key-down edge
      if (k === ' ' && (crashed || won)) respawn();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // Virtual stick: mouse offset from the stage centre, normalised + dead-zoned.
  function onMove(e) {
    const r = stage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    const dead = 0.05;
    const shape = (v) => {
      const s = Math.sign(v); const a = Math.abs(v);
      return a < dead ? 0 : s * ((a - dead) / (1 - dead));
    };
    stickX = clamp(shape(nx), -1, 1);
    stickY = clamp(shape(ny), -1, 1);
    if (reticle) {
      reticle.style.left = `${e.clientX - r.left}px`;
      reticle.style.top = `${e.clientY - r.top}px`;
    }
  }
  stage.addEventListener('mousemove', onMove);
  stage.addEventListener('mouseleave', () => { stickX = 0; stickY = 0; });

  stage.addEventListener('mousedown', (e) => {
    start();
    if (e.button === 2) { firing = true; e.preventDefault(); }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) firing = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  if (overlay) overlay.addEventListener('click', start);

  // ======================================================== HUD ===========
  const hud = {
    spd: document.getElementById('ps-airspeed'),
    alt: document.getElementById('ps-altitude'),
    thr: document.getElementById('ps-throttle'),
    thrFill: document.getElementById('ps-throttle-fill'),
    hdg: document.getElementById('ps-heading'),
    vsi: document.getElementById('ps-vspeed'),
    gear: document.getElementById('ps-gear'),
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
  const dmgVignette = document.getElementById('ps-damage');
  let dmgFlash = 0; // 1 -> 0 red screen pulse when hit

  // Kill board ("k / N") + hull HP bar (green -> amber -> red as it drops).
  function updateCombatHUD() {
    if (hud.kills) hud.kills.textContent = `${kills} / ${CFG.ENEMY_COUNT}`;
    const pct = clamp(Math.round((playerHP / CFG.PLAYER_HP) * 100), 0, 100);
    if (hud.hp) hud.hp.textContent = String(Math.max(0, Math.round(playerHP)));
    if (hud.hpFill) {
      hud.hpFill.style.width = `${pct}%`;
      hud.hpFill.style.background = pct > 50 ? '#37d67a' : (pct > 25 ? '#ffc24a' : '#ff5d6c');
    }
  }
  function flashDamage() { dmgFlash = 1; }

  // Player-centred radar scope (north-up). The player sits at the centre; a
  // bandit within RADAR_RANGE shows at its true position relative to us, and one
  // beyond range is pinned to the rim as a chevron pointing in its direction. The
  // world border + runway are drawn relative too, so they slide past as you fly.
  function drawMap() {
    if (!mapCtx) return;
    const W = mapCanvas.width; const H = mapCanvas.height;
    const cx = W / 2; const cy = H / 2;
    const Rpx = Math.min(W, H) / 2 - 3;
    const s = Rpx / CFG.RADAR_RANGE; // metres -> px
    const px = plane.position.x; const pz = plane.position.z;
    const rX = (wx) => cx + (wx - px) * s;
    const rY = (wz) => cy + (wz - pz) * s; // world +Z (south) -> screen down

    mapCtx.clearRect(0, 0, W, H);
    mapCtx.save();
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx, 0, Math.PI * 2); mapCtx.clip(); // disc

    mapCtx.fillStyle = 'rgba(8,20,26,0.55)';
    mapCtx.fillRect(0, 0, W, H);

    // world border (relative) — only on screen when you're within range of a wall
    const B = CFG.BORDER;
    mapCtx.strokeStyle = 'rgba(80,210,255,0.85)';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(rX(-B), rY(-B), 2 * B * s, 2 * B * s);

    // runway (relative)
    mapCtx.strokeStyle = 'rgba(230,238,242,0.7)';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(rX(0), rY(-CFG.RUNWAY_LEN / 2));
    mapCtx.lineTo(rX(0), rY(CFG.RUNWAY_LEN / 2));
    mapCtx.stroke();

    // range rings + cross-hairs
    mapCtx.strokeStyle = 'rgba(120,220,255,0.16)';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx * 0.5, 0, Math.PI * 2); mapCtx.stroke();
    mapCtx.beginPath();
    mapCtx.moveTo(cx, cy - Rpx); mapCtx.lineTo(cx, cy + Rpx);
    mapCtx.moveTo(cx - Rpx, cy); mapCtx.lineTo(cx + Rpx, cy);
    mapCtx.stroke();

    // bandits
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = (e.group.position.x - px) * s;
      const dy = (e.group.position.z - pz) * s;
      mapCtx.fillStyle = '#ff4d4d';
      if (Math.hypot(dx, dy) <= Rpx) {
        mapCtx.beginPath(); mapCtx.arc(cx + dx, cy + dy, 3.2, 0, Math.PI * 2); mapCtx.fill();
      } else {
        const a = Math.atan2(dy, dx); // bearing on screen
        mapCtx.save();
        mapCtx.translate(cx + Math.cos(a) * (Rpx - 4), cy + Math.sin(a) * (Rpx - 4));
        mapCtx.rotate(a);
        mapCtx.beginPath(); mapCtx.moveTo(4, 0); mapCtx.lineTo(-3, 3); mapCtx.lineTo(-3, -3);
        mapCtx.closePath(); mapCtx.fill();
        mapCtx.restore();
      }
    }

    // player at centre, pointing along heading
    const f = getForward();
    const ang = Math.atan2(f.x, -f.z); // 0 = north (-Z) = up
    mapCtx.save();
    mapCtx.translate(cx, cy);
    mapCtx.rotate(-ang);
    mapCtx.fillStyle = crashed ? '#ff5d6c' : '#ffe04a';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 5); mapCtx.lineTo(-4, 5); mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();

    mapCtx.restore(); // un-clip
    mapCtx.strokeStyle = 'rgba(120,220,255,0.5)';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath(); mapCtx.arc(cx, cy, Rpx, 0, Math.PI * 2); mapCtx.stroke();
  }

  function respawn() {
    resetPlane();
    vel.set(0, 0, 0);
    throttle = 0;
    crashed = false;
    won = false;
    onGround = true;
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

    // Yaw input from rudder keys; pitch/roll from the mouse stick.
    const yawInput = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const pitchInput = -stickY; // mouse up -> nose up
    const rollInput = stickX; // mouse right -> roll right

    const speed = vel.length();
    const v2 = speed * speed;

    // --- Angle of attack & lift coefficient (the heart of the model) ---
    _q.copy(plane.quaternion).invert();
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
    plane.rotateX(pitchInput * CFG.PITCH_RATE * e * dt);
    plane.rotateZ(-rollInput * CFG.ROLL_RATE * e * dt);
    plane.rotateY(-yawInput * CFG.YAW_RATE * e * dt);
    // Stall break: the nose drops, which lowers AoA and lets you recover.
    if (stalled && fwdSpeed > 0) plane.rotateX(-(Math.abs(aoa) - CFG.A_STALL) * 1.6 * dt);

    // Grip + coordinated turn (the anti-drift fix). Skipped on the deck so the
    // takeoff roll / tyre model owns ground velocity.
    if (plane.position.y > CFG.GROUND_Y + 0.3) flightAssist(plane, vel, e, dt);

    // --- Ground contact / taxi / takeoff roll ---
    if (plane.position.y <= CFG.GROUND_Y) {
      plane.position.y = CFG.GROUND_Y;
      const impactV = -vel.y;
      if (vel.y < 0) vel.y = 0;

      // A hard, fast, or gear-up arrival = crash.
      if (started && !crashed && (impactV > 14 || (impactV > 5 && !gearDown))) {
        crash(gearDown ? 'Hard landing' : 'Belly flop — gear up!');
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
    if (plane.position.y > 1500) { plane.position.y = 1500; if (vel.y > 0) vel.y = 0; }

    // --- Propeller spin (idle + throttle), gear retract animation ---
    const rpm = (0.18 + throttle * 0.82) * 60;
    if (surf.prop) surf.prop.rotation.z -= rpm * dt;

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
    for (const e of enemies) {
      if (e.alive && rayHitsSphere(plane.position, _fwd, e.group.position, CFG.HITBOX_R, CFG.GUN_RANGE) >= 0) {
        lockTarget = true; break;
      }
    }
    if (pipper) pipper.classList.toggle('ps-lock', lockTarget);

    // --- HUD ---
    const knots = Math.max(0, fwdSpeed) * KT;
    if (hud.spd) hud.spd.textContent = Math.round(knots);
    if (hud.alt) hud.alt.textContent = Math.round((plane.position.y - CFG.GROUND_Y) * FT);
    if (hud.thr) hud.thr.textContent = `${Math.round(throttle * 100)}%`;
    if (hud.thrFill) hud.thrFill.style.height = `${Math.round(throttle * 100)}%`;
    if (hud.vsi) hud.vsi.textContent = `${vel.y >= 0 ? '+' : ''}${Math.round(vel.y * FT * 60)}`;
    if (hud.hdg) {
      getForward();
      let deg = (Math.atan2(_fwd.x, -_fwd.z) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      hud.hdg.textContent = `${Math.round(deg).toString().padStart(3, '0')}°`;
    }
    if (hud.gear) {
      hud.gear.textContent = gearDown ? 'GEAR DN' : 'GEAR UP';
      hud.gear.classList.toggle('ps-warn-amber', !gearDown);
    }
    if (hud.stall) hud.stall.classList.toggle('ps-show', (stalled || (knots < 70 && !onGround)) && !crashed);
    if (hud.warn && !crashed) {
      if (hitBorder) { hud.warn.textContent = '⚠ WORLD BORDER'; hud.warn.classList.add('ps-show'); }
      else { hud.warn.classList.remove('ps-show'); }
    }
  }

  function crash(reason) {
    crashed = true;
    started = true;
    throttle = 0;
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

    // Stable chase: sit behind/above following the nose's heading & pitch, but
    // don't roll the view with the aircraft (much easier to fly, less nausea).
    getForward();
    _camPos.copy(plane.position)
      .addScaledVector(_fwd, -CFG.CAM_BACK)
      .addScaledVector(WORLD_UP, CFG.CAM_UP);
    if (_camPos.y < 2) _camPos.y = 2; // don't dive the camera underground
    const a = crashed ? 0.06 : 1 - Math.pow(1 - CFG.CAM_LERP, dt * 60);
    camera.position.lerp(_camPos, a);
    _camAim.copy(plane.position).addScaledVector(_fwd, 8);
    camera.up.copy(WORLD_UP);
    camera.lookAt(_camAim);
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
  updateCombatHUD();
  setDifficulty(diffName); // sync HUD label + overlay highlight from the saved tier

  let last = performance.now();
  let borderScroll = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)

    const playing = started && !crashed && !won;
    if (playing) update(dt);
    else {
      // idle the prop + animate gear even before launch / after a crash
      if (surf.prop) surf.prop.rotation.z -= 0.18 * 60 * dt;
      stepTracers(dt);
    }

    // Bandits fly even before launch / after a crash (so they patrol), but only
    // shoot while the engagement is live.
    for (const e of enemies) if (e.alive) stepEnemy(e, dt, playing);
    stepSparks(dt);

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
