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
  buildAircraft, makeTree, makeHangar, makeControlTower,
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
    CONTROL_V: 55,

    // World
    BORDER: 2200, // half-extent of the play area (a 4.4 km box)
    GROUND_Y: 1.35, // plane-origin height when the wheels are on the deck
    RUNWAY_LEN: 760,
    RUNWAY_W: 38,

    // Camera chase rig (local offset behind/above the plane)
    CAM_BACK: 17,
    CAM_UP: 5.2,
    CAM_LERP: 0.10,

    // Guns (demo)
    FIRE_INTERVAL: 0.08, // seconds between tracer pairs
    TRACER_SPEED: 480, // m/s muzzle velocity relative to the plane
    TRACER_LIFE: 0.9,
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

  // ======================================================== TRACERS =======
  const tracerGeo = new THREE.BoxGeometry(0.12, 0.12, 3.2);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, fog: false });
  const tracers = [];
  function fireGuns() {
    // Clone the basis vectors — addScaledVector/clone below must not alias the
    // shared _fwd/_right temps (that bug fired tracers backwards at 4.5 m/s).
    const fwd = getForward().clone();
    const right = getRight().clone();
    for (const sx of [-1, 1]) {
      const t = new THREE.Mesh(tracerGeo, tracerMat);
      // muzzle just ahead of the wing guns
      t.position.copy(plane.position)
        .addScaledVector(right, sx * 3.0)
        .addScaledVector(fwd, 4.5);
      t.quaternion.copy(plane.quaternion);
      t.userData.vel = fwd.clone().multiplyScalar(CFG.TRACER_SPEED).add(vel);
      t.userData.life = CFG.TRACER_LIFE;
      scene.add(t);
      tracers.push(t);
    }
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

  // ======================================================== INPUT =========
  const stage = document.getElementById('ps-stage') || canvas;
  const overlay = document.getElementById('ps-overlay');
  const reticle = document.getElementById('ps-reticle');

  function start() {
    if (started) return;
    started = true;
    if (overlay) overlay.classList.add('ps-hidden');
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (['w', 'a', 's', 'd', 'g', ' '].includes(k)) {
      if (started) e.preventDefault();
      if (k === 'g') gearDown = !gearDown; // toggle on key-down edge
      if (k === ' ' && crashed) respawn();
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
  };
  const mapCanvas = document.getElementById('ps-map');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  function drawMap() {
    if (!mapCtx) return;
    const W = mapCanvas.width; const H = mapCanvas.height;
    const B = CFG.BORDER;
    const toX = (x) => (x / B) * (W / 2 - 6) + W / 2;
    const toY = (z) => (z / B) * (H / 2 - 6) + H / 2;
    mapCtx.clearRect(0, 0, W, H);
    // play-area border
    mapCtx.strokeStyle = 'rgba(80,210,255,0.9)';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(toX(-B), toY(-B), toX(B) - toX(-B), toY(B) - toY(-B));
    // runway
    mapCtx.strokeStyle = 'rgba(230,238,242,0.8)';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(toX(0), toY(-CFG.RUNWAY_LEN / 2));
    mapCtx.lineTo(toX(0), toY(CFG.RUNWAY_LEN / 2));
    mapCtx.stroke();
    // plane: a triangle pointing along heading
    const f = getForward();
    const ang = Math.atan2(f.x, -f.z); // 0 = north (-Z)
    const px = toX(plane.position.x); const py = toY(plane.position.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-ang); // canvas y is down; heading measured so up = north
    mapCtx.fillStyle = crashed ? '#ff5d6c' : '#ffe04a';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 5); mapCtx.lineTo(-4, 5); mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function respawn() {
    resetPlane();
    vel.set(0, 0, 0);
    throttle = 0;
    crashed = false;
    onGround = true;
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

    // --- Guns (demo) ---
    fireCooldown -= dt;
    if (firing && fireCooldown <= 0) { fireGuns(); fireCooldown = CFG.FIRE_INTERVAL; }
    stepTracers(dt);

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

  let last = performance.now();
  let borderScroll = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)

    if (started && !crashed) update(dt);
    else {
      // idle the prop + animate gear even before launch / after a crash
      if (surf.prop) surf.prop.rotation.z -= 0.18 * 60 * dt;
      stepTracers(dt);
    }

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
