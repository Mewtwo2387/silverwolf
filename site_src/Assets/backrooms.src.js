// The Backrooms — a first-person survival-horror wander through a seeded,
// procedurally generated Level 0. Bundled with three into the self-hosted asset
// backrooms.js (CSP is script-src 'self', so no CDN) and loaded as a module by
// pages/games/backrooms.ts.
//
// Entirely client-side and account-free: nothing is posted anywhere, and the
// PNG-chaser skin the player uploads is read with FileReader and kept in
// localStorage as a data URL — it never leaves the device.
//
// Conventions: metres, Y up, +Z is "south" on the map. The level grid maps to
// world space as x = column * CELL, z = row * CELL.
//
// Module map:
//   backrooms-maze.js       seeded generation, nav graph, line of sight, collision
//   backrooms-materials.js  every texture, drawn from noise into canvases
//   backrooms-world.js      grid -> merged geometry, fluorescents, the exit
//   backrooms-entities.js   entity models, senses and behaviour
//   backrooms-audio.js      synthesised sound (no audio files at all)
//
// Design sources are listed in full on the page's References tab.

import * as THREE from 'three';
import {
  generate, Collider, CELL, WALL_H, mulberry32, hashSeed,
} from './backrooms-maze.js';
import { buildMaterials, defaultChaserTexture, irisTexture } from './backrooms-materials.js';
import { buildWorld, updateFixtures } from './backrooms-world.js';
import {
  PngChaser, Lifeform, Entity96, Director, CHASER_MODES, PLAYER_SPEEDS,
} from './backrooms-entities.js';
import { Audio } from './backrooms-audio.js';

(() => {
  'use strict';

  const canvas = document.getElementById('br-canvas');
  if (!canvas) return;
  const $ = (id) => document.getElementById(id);
  const stage = $('br-stage');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    $('br-loading').classList.add('br-hidden');
    $('br-error').classList.remove('br-hidden');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  // ============================================================ CONFIG ====
  const CFG = {
    EYE_STAND: 1.66,
    EYE_CROUCH: 0.95,
    RADIUS: 0.32,
    // Defined in backrooms-entities.js: every entity speed is tuned against
    // these, so they live next to the numbers they are compared with.
    WALK: PLAYER_SPEEDS.WALK,
    SPRINT: PLAYER_SPEEDS.SPRINT,
    CROUCH: PLAYER_SPEEDS.CROUCH,
    ACCEL: 13, // ground acceleration (m/s²) — brisk, but not frictionless
    FRICTION: 11,
    STAMINA_MAX: 100,
    STAMINA_DRAIN: 17, // per second while sprinting
    STAMINA_REGEN: 13,
    STAMINA_DELAY: 1.1, // seconds after sprinting before regen starts
    // How loud the player is, which is the ONLY thing most entities go on.
    NOISE: {
      idle: 0.06, crouch: 0.22, walk: 1, sprint: 2.45,
    },
    STEP_DIST: { walk: 2.1, sprint: 1.55, crouch: 2.9 },
    LIGHT_POOL: { low: 4, high: 7 },
  };

  // ========================================================== SETTINGS ====
  const STORE_KEY = 'sw-backrooms-v1';
  const SKIN_KEY = 'sw-backrooms-skin-v1';
  const DEFAULTS = {
    seed: '', size: 26, sensitivity: 1, fov: 78, fog: 0.052, bob: true, invert: false,
    volume: 0.7, mute: false, quality: 'high', showFps: false, noScares: false,
    reduceFlicker: false, debug: false, chaserMode: 'auto',
    entities: { chaser: true, lifeform: true, watcher: true },
  };
  const settings = { ...DEFAULTS, entities: { ...DEFAULTS.entities } };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Merge field by field — a stale or hand-edited blob must never be able
      // to inject keys the game then trusts.
      for (const k of Object.keys(DEFAULTS)) {
        if (k === 'entities' || !(k in saved)) continue;
        if (typeof saved[k] === typeof DEFAULTS[k]) settings[k] = saved[k];
      }
      if (saved.entities) {
        for (const k of Object.keys(DEFAULTS.entities)) {
          if (typeof saved.entities[k] === 'boolean') settings.entities[k] = saved.entities[k];
        }
      }
      if (!CHASER_MODES.includes(settings.chaserMode)) settings.chaserMode = 'auto';
      if (settings.quality !== 'low' && settings.quality !== 'high') settings.quality = 'high';
      settings.size = Math.max(12, Math.min(48, Math.round(Number(settings.size) || 26)));
      settings.sensitivity = clamp(Number(settings.sensitivity) || 1, 0.2, 3);
      settings.fov = clamp(Number(settings.fov) || 78, 60, 105);
      settings.fog = clamp(Number(settings.fog) || 0.052, 0.01, 0.12);
      settings.volume = clamp(Number(settings.volume) ?? 0.7, 0, 1);
    } catch (e) { /* corrupt storage is not worth failing to boot over */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (e) { /* private mode / quota — the game plays fine unsaved */ }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  loadSettings();
  // The harness (and ?debug=1) arm the test tools server-side by pre-checking
  // the box, so the rendered checkbox is a third source of truth alongside
  // storage and the query string.
  if (new URLSearchParams(location.search).get('debug') === '1'
    || $('br-debugon')?.checked) settings.debug = true;

  const randomSeed = () => {
    const words = ['almond', 'carpet', 'hum', 'lobby', 'noclip', 'moist', 'yellow', 'exit',
      'tube', 'grid', 'wander', 'buzz', 'damp', 'beige', 'static', 'corridor'];
    const w = words[Math.floor(Math.random() * words.length)];
    return `${w}-${Math.floor(Math.random() * 9000 + 1000)}`;
  };
  if (!settings.seed) settings.seed = randomSeed();

  // ============================================================= SCENE ====
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 90);
  camera.rotation.order = 'YXZ';

  // Fog is doing a lot of work: it sets the mood, hides the level's finite
  // extent, and lets us cull hard without the player ever seeing a pop.
  scene.fog = new THREE.FogExp2(0x2b2410, settings.fog);
  scene.background = new THREE.Color(0x1a160b);

  // Level 0 is *lit* — uncomfortably, evenly, endlessly. The horror is the
  // sameness, not the dark, so ambient sits high enough to always read the
  // wallpaper and the fog does the work of hiding distance.
  const ambient = new THREE.AmbientLight(0xa08b4e, 0.85);
  scene.add(ambient);
  // Faint bounce off the carpet so floors aren't black between fixtures.
  const bounce = new THREE.HemisphereLight(0x8a7434, 0x2a2210, 0.6);
  scene.add(bounce);
  const AMBIENT_BASE = 0.85;

  let lightPool = [];
  function buildLightPool() {
    for (const l of lightPool) scene.remove(l);
    lightPool = [];
    const n = CFG.LIGHT_POOL[settings.quality];
    for (let i = 0; i < n; i += 1) {
      // Intensity is in candela (Three's physical units since r155): a tube
      // that reads correctly at 3 m needs tens, not units.
      const l = new THREE.PointLight(0xfff0cc, 0, 16, 2);
      scene.add(l);
      lightPool.push(l);
    }
  }

  // =========================================================== PLAYER ====
  const player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eyeY: CFG.EYE_STAND,
    eyeTarget: CFG.EYE_STAND,
    crouching: false,
    sprinting: false,
    stamina: CFG.STAMINA_MAX,
    staminaLock: 0,
    noise: CFG.NOISE.idle,
    forward: new THREE.Vector3(0, 0, -1),
    bobPhase: 0,
    stepAccum: 0,
    alive: true,
  };

  const keys = Object.create(null);
  let pointerLocked = false;

  // ============================================================ STATE ====
  let level = null;
  let collider = null;
  let world = null;
  let director = null;
  let materials = null;
  let chaserTexture = null;
  let skinDataUrl = null;
  const audio = new Audio();

  const game = {
    phase: 'menu', // menu | playing | paused | ended
    time: 0,
    visited: new Set(),
    interference: 0,
    heartTimer: 0,
    shake: 0,
    scareUntil: 0,
    invuln: false,
    noclip: false,
    frozen: false,
    revealed: false,
    lightsUp: false,
  };

  // ============================================================ AUDIO ====
  // The chaser skin lives in its own storage key: a 4 MB data URL alongside the
  // settings blob would make a settings write fail on quota and silently drop
  // every other preference.
  // A skin is interpolated into a CSS `url("...")` for the jumpscare flash, so
  // it has to be a plain base64 data URL before we will touch it: anything with
  // a quote or a bracket in it could close the url() and inject declarations.
  // FileReader always produces this shape, so a rejected value means the entry
  // was hand-edited or written by something else.
  const SKIN_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

  function loadSkin() {
    try {
      const v = localStorage.getItem(SKIN_KEY);
      if (v && SKIN_RE.test(v)) skinDataUrl = v;
    } catch (e) { /* ignore */ }
  }
  loadSkin();

  // The chaser's skin is owned here, not by the entity (PngChaser sets
  // ownsTextures = false), because the menu preview shares it and it survives
  // level rebuilds. So this is the only place allowed to release one.
  function replaceChaserTexture(tex) {
    const old = chaserTexture;
    chaserTexture = tex;
    if (director?.get('chaser')) director.get('chaser').setTexture(tex);
    if (old && old !== tex) old.dispose();
  }

  function applySkin(dataUrl, onDone) {
    if (!dataUrl) {
      replaceChaserTexture(defaultChaserTexture());
      $('br-skin-preview').src = chaserTexture.image.toDataURL();
      if (onDone) onDone();
      return;
    }
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      replaceChaserTexture(tex);
      $('br-skin-preview').src = dataUrl;
      if (onDone) onDone();
    };
    img.onerror = () => applySkin(null, onDone);
    img.src = dataUrl;
  }

  // ============================================================= BUILD ====
  function setLoading(on, msg) {
    const el = $('br-loading');
    if (msg) $('br-load-sub').textContent = msg;
    el.classList.toggle('br-hidden', !on);
  }

  /**
   * Yield to the browser so the loading caption actually paints between stages.
   * rAF alone is not enough: a backgrounded tab stops firing it entirely, and a
   * level that only finishes generating once you look at it is a hang. Race it
   * against a timer so the build always completes.
   */
  const nextTick = () => new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(go);
    setTimeout(go, 60);
  });

  /** Rebuild the whole level, in stages so the loading text can keep up. */
  async function buildLevel(seed) {
    setLoading(true, 'generating floor plan…');
    game.phase = 'menu';
    await nextTick();

    if (world) {
      scene.remove(world.group);
      world.dispose();
    }
    if (director) director.dispose();

    level = generate({ seed, width: settings.size, height: settings.size });
    collider = new Collider(level);

    setLoading(true, 'printing wallpaper…');
    await nextTick();
    if (materials && materials.detailed !== (settings.quality !== 'low')) {
      // The old world was disposed above, so nothing is still drawing with it.
      materials.dispose();
      materials = null;
    }
    if (!materials) materials = buildMaterials(settings.quality);

    setLoading(true, 'laying carpet…');
    await nextTick();
    world = buildWorld(level, materials, collider);
    scene.add(world.group);
    buildLightPool();

    setLoading(true, 'listening…');
    await nextTick();
    spawnEntities(seed);
    resetPlayer();
    updateHud();
    setLoading(false);
  }

  function spawnEntities(seed) {
    const rnd = mulberry32(hashSeed(`${seed}:entities`));
    director = new Director(level, collider, scene, rnd);
    if (settings.entities.chaser) {
      const chaser = new PngChaser(level, collider, chaserTexture, rnd, { mode: settings.chaserMode });
      director.add(chaser, 14);
    }
    if (settings.entities.lifeform) director.add(new Lifeform(level, collider, rnd), 16);
    if (settings.entities.watcher) director.add(new Entity96(level, collider, rnd, irisTexture()), 12);
  }

  function resetPlayer() {
    const c = level.centre(level.spawn.x, level.spawn.y);
    player.pos.set(c.x, 0, c.z);
    player.vel.set(0, 0, 0);
    player.yaw = 0;
    player.pitch = 0;
    player.stamina = CFG.STAMINA_MAX;
    player.staminaLock = 0;
    player.crouching = false;
    player.eyeY = CFG.EYE_STAND;
    player.alive = true;
    game.time = 0;
    game.visited = new Set([`${level.spawn.x},${level.spawn.y}`]);
    game.shake = 0;
    game.interference = 0;
    $('br-hurt').style.opacity = '0';
    $('br-static').style.opacity = '0';
  }

  // ============================================================ INPUT ====
  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    keys[e.code] = true;
    if (e.code === 'KeyM' && settings.debug) {
      toggleDebug(!$('br-debug').classList.contains('br-on'));
      e.preventDefault();
    }
    if (e.code === 'KeyR' && game.phase !== 'menu') {
      restart();
      e.preventDefault();
    }
    // The browser scrolls on space / arrows even in a locked-pointer game.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  // A dropped keyup (alt-tab mid-sprint) would otherwise leave you running
  // forever into a wall.
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked || game.phase !== 'playing') return;
    const s = settings.sensitivity * 0.0022;
    player.yaw -= e.movementX * s;
    player.pitch -= e.movementY * s * (settings.invert ? -1 : 1);
    player.pitch = clamp(player.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    stage.classList.toggle('br-playing', pointerLocked);
    if (!pointerLocked && game.phase === 'playing') pause();
  });

  canvas.addEventListener('click', () => {
    if (game.phase === 'playing' && !pointerLocked) canvas.requestPointerLock();
  });

  // ======================================================== GAME FLOW ====
  function startGame() {
    game.phase = 'playing';
    $('br-menu').classList.add('br-hidden');
    $('br-end').classList.add('br-hidden');
    $('br-hud').classList.remove('br-off');
    audio.start();
    audio.resume();
    audio.setVolume(settings.mute ? 0 : settings.volume);
    canvas.requestPointerLock();
    say('You noclipped out of reality.');
  }

  /**
   * Return to the menu. Anything that rebuilds the level mid-session ends here:
   * the run you were on no longer exists, so dropping you back into a silently
   * regenerated world (with a stale HUD) would be worse than asking you to
   * press Start again.
   */
  function toMenu() {
    game.phase = 'menu';
    $('br-end').classList.add('br-hidden');
    $('br-menu').classList.remove('br-hidden');
    $('br-resume').style.display = 'none';
    $('br-hud').classList.add('br-off');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function pause() {
    if (game.phase !== 'playing') return;
    game.phase = 'paused';
    $('br-menu').classList.remove('br-hidden');
    $('br-resume').style.display = '';
    audio.setDread(0);
  }

  function resume() {
    if (game.phase !== 'paused') return;
    game.phase = 'playing';
    $('br-menu').classList.add('br-hidden');
    canvas.requestPointerLock();
  }

  function restart() {
    resetPlayer();
    if (director) director.dispose();
    spawnEntities(settings.seed);
    $('br-end').classList.add('br-hidden');
    $('br-menu').classList.add('br-hidden');
    $('br-hud').classList.remove('br-off');
    game.phase = 'playing';
    if (!pointerLocked) canvas.requestPointerLock();
  }

  function endGame(won, message) {
    if (game.phase === 'ended') return;
    game.phase = 'ended';
    player.alive = won;
    document.exitPointerLock();
    audio.setDread(0);
    audio.interference(0);
    if (won) audio.escape(); else audio.death();

    const el = $('br-end');
    el.classList.remove('br-hidden', 'br-won', 'br-lost');
    el.classList.add(won ? 'br-won' : 'br-lost');
    $('br-end-title').textContent = won ? 'YOU FOUND THE EXIT' : 'YOU DID NOT GET OUT';
    $('br-end-msg').textContent = message;
    $('br-end-seed').textContent = level.seed;
    $('br-end-time').textContent = formatTime(game.time);
    $('br-end-explored').textContent = `${explored()}%`;
    $('br-end-route').textContent = `${level.solveSteps} rooms`;
    $('br-hud').classList.add('br-off');
  }

  const explored = () => Math.round((game.visited.size / (level.w * level.h)) * 100);
  const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  let subtitleTimer = 0;
  function say(text, seconds = 3.5) {
    const el = $('br-subtitle');
    el.textContent = text;
    el.style.opacity = '1';
    subtitleTimer = seconds;
  }

  // The API entities are allowed to affect the world through. Nothing in
  // backrooms-entities.js touches game state directly.
  const entityApi = {
    kill(reason) {
      if (game.invuln || game.phase !== 'playing') return;
      endGame(false, reason);
    },
    scare(pos) {
      if (settings.noScares) return;
      audio.screech(pos);
      game.scareUntil = performance.now() + 900;
      game.shake = 1;
      const flash = $('br-flash');
      flash.style.backgroundImage = `url("${skinDataUrl || chaserTexture.image.toDataURL()}")`;
      flash.style.display = 'block';
      setTimeout(() => { flash.style.display = 'none'; }, 780);
    },
    mimic(pos) {
      audio.mimicCall(pos);
      const d = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
      if (d < 26) say('Someone is calling for help.', 2.6);
    },
    beamCharge(pos, seconds) { return audio.beamCharge(pos, seconds); },
    interference(level96) { game.interference = Math.max(game.interference, level96); },
  };

  // ============================================================ UPDATE ====
  function updatePlayer(dt) {
    const wantSprint = (keys.ControlLeft || keys.ControlRight) && player.stamina > 1;
    const wantCrouch = keys.ShiftLeft || keys.ShiftRight;
    player.crouching = !!wantCrouch;

    let f = 0;
    let s = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1;
    if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD || keys.ArrowRight) s += 1;
    if (keys.KeyA || keys.ArrowLeft) s -= 1;
    const moving = f !== 0 || s !== 0;

    player.sprinting = wantSprint && moving && !player.crouching;
    let speed = CFG.WALK;
    if (player.crouching) speed = CFG.CROUCH;
    else if (player.sprinting) speed = CFG.SPRINT;

    // Stamina: sprinting is the loudest and fastest thing you can do, and it
    // runs out. That is the game's central trade — outrun it now, or stay
    // quiet and keep the option.
    if (player.sprinting) {
      player.stamina = Math.max(0, player.stamina - CFG.STAMINA_DRAIN * dt);
      player.staminaLock = CFG.STAMINA_DELAY;
    } else {
      player.staminaLock = Math.max(0, player.staminaLock - dt);
      if (player.staminaLock <= 0) {
        player.stamina = Math.min(CFG.STAMINA_MAX, player.stamina
          + CFG.STAMINA_REGEN * dt * (player.crouching ? 1.5 : 1));
      }
    }

    // Movement in the yaw plane; pitch must not make you fly.
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = 0;
    let dz = 0;
    if (moving) {
      const len = Math.hypot(f, s);
      const fx = -sin * (f / len);
      const fz = -cos * (f / len);
      const sx = cos * (s / len);
      const sz = -sin * (s / len);
      dx = (fx + sx) * speed;
      dz = (fz + sz) * speed;
    }
    const accel = moving ? CFG.ACCEL : CFG.FRICTION;
    player.vel.x += (dx - player.vel.x) * Math.min(1, accel * dt);
    player.vel.z += (dz - player.vel.z) * Math.min(1, accel * dt);

    const nx = player.pos.x + player.vel.x * dt;
    const nz = player.pos.z + player.vel.z * dt;
    if (game.noclip) {
      player.pos.x = nx;
      player.pos.z = nz;
    } else {
      const r = collider.resolve(nx, nz, CFG.RADIUS);
      player.pos.x = r.x;
      player.pos.z = r.z;
    }

    // Noise: what the entities actually hear. Derived from real speed, so
    // grinding against a wall while holding sprint doesn't broadcast.
    const actual = Math.hypot(player.vel.x, player.vel.z);
    if (actual < 0.25) player.noise = CFG.NOISE.idle;
    else if (player.crouching) player.noise = CFG.NOISE.crouch;
    else if (player.sprinting) player.noise = CFG.NOISE.sprint;
    else player.noise = CFG.NOISE.walk * clamp(actual / CFG.WALK, 0.3, 1);

    // Eye height, head bob and footsteps.
    player.eyeTarget = player.crouching ? CFG.EYE_CROUCH : CFG.EYE_STAND;
    player.eyeY += (player.eyeTarget - player.eyeY) * Math.min(1, dt * 9);
    if (actual > 0.3) {
      player.bobPhase += dt * actual * 1.9;
      player.stepAccum += actual * dt;
      const stride = player.crouching ? CFG.STEP_DIST.crouch
        : (player.sprinting ? CFG.STEP_DIST.sprint : CFG.STEP_DIST.walk);
      if (player.stepAccum >= stride) {
        player.stepAccum = 0;
        audio.footstep(player.crouching, player.sprinting);
      }
    } else {
      player.stepAccum = 0;
    }

    const here = level.cellAt(player.pos.x, player.pos.z);
    game.visited.add(`${here.x},${here.y}`);

    // Win check — the trigger sits at the far end of the exit passage.
    const t = world.exit.trigger;
    if (Math.hypot(player.pos.x - t.x, player.pos.z - t.z) < t.r) {
      endGame(true, 'The corridor kept going, and then it stopped being a corridor.');
    }
  }

  function updateCamera(dt) {
    camera.position.set(player.pos.x, player.eyeY, player.pos.z);
    let roll = 0;
    if (settings.bob) {
      const amp = player.sprinting ? 0.052 : 0.03;
      camera.position.y += Math.sin(player.bobPhase * 2) * amp;
      camera.position.x += Math.cos(player.bobPhase) * amp * 0.35 * Math.cos(player.yaw);
      camera.position.z -= Math.cos(player.bobPhase) * amp * 0.35 * Math.sin(player.yaw);
      roll = Math.cos(player.bobPhase) * 0.006;
    }
    // Scare shake: decays fast, and reduced-flicker mode tones it down too.
    if (game.shake > 0.001) {
      const k = game.shake * (settings.reduceFlicker ? 0.35 : 1);
      camera.position.x += (Math.random() - 0.5) * 0.16 * k;
      camera.position.y += (Math.random() - 0.5) * 0.16 * k;
      roll += (Math.random() - 0.5) * 0.06 * k;
      game.shake = Math.max(0, game.shake - dt * 2.2);
    }
    camera.rotation.set(player.pitch, player.yaw, roll);
    camera.getWorldDirection(player.forward);
  }

  // Interference static: a 160x90 canvas of noise, scaled up by CSS with
  // nearest-neighbour. Only redrawn while something is actually corrupting it.
  const staticCanvas = $('br-static');
  const staticCtx = staticCanvas.getContext('2d');
  let staticImage = null;
  function drawStatic(level96) {
    staticCanvas.style.opacity = String(clamp(level96 * 0.55, 0, 0.6));
    if (level96 < 0.02) return;
    if (!staticImage) staticImage = staticCtx.createImageData(staticCanvas.width, staticCanvas.height);
    const d = staticImage.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = v * 0.95;
      d[i + 2] = v * 0.8;
      d[i + 3] = Math.random() < 0.75 ? 255 : 0;
    }
    staticCtx.putImageData(staticImage, 0, 0);
  }

  function updateHud() {
    if (!level) return;
    $('br-hud-seed').textContent = level.seed;
    $('br-hud-time').textContent = formatTime(game.time);
    $('br-hud-depth').innerHTML = `EXPLORED <b>${explored()}%</b>`;
    const pct = (player.stamina / CFG.STAMINA_MAX) * 100;
    $('br-stam-fill').style.width = `${pct}%`;
    $('br-stamina').classList.toggle('br-spent', player.stamina < 20);
  }

  // ============================================================== LOOP ====
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;
  let hudAccum = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    // Cap dt: a background tab or a long GC pause must not teleport anything
    // through a wall on the next frame.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (game.phase === 'playing' && level) {
      game.time += dt;
      updatePlayer(dt);
      game.interference = Math.max(0, game.interference - dt * 1.6);
      director.paused = game.frozen;
      director.update(dt, player, entityApi);
    }
    if (level) updateCamera(dt);

    // Lighting and its audio counterpart.
    if (world) {
      const lit = updateFixtures(
        world.fixtures, lightPool, player.pos,
        settings.reduceFlicker ? 0 : now / 1000,
      );
      if (game.lightsUp) {
        ambient.intensity = 3.5;
        for (const l of lightPool) l.intensity = Math.max(l.intensity, 30);
      } else {
        ambient.intensity = AMBIENT_BASE;
      }
      if (game.phase === 'playing') {
        audio.setListener(camera.position, player.forward);
        audio.updateAmbience(lit.nearestLight, settings.reduceFlicker ? 0 : lit.flicker);
      }
    }

    // Proximity dread + heartbeat. Distance is straight-line, deliberately: it
    // is the player's nerves, not the entity's knowledge.
    if (game.phase === 'playing' && director) {
      const near = director.nearest(player.pos);
      const threat = clamp(1 - near.dist / 18, 0, 1);
      audio.setDread(threat * 0.9);
      game.heartTimer -= dt;
      if (threat > 0.25 && game.heartTimer <= 0) {
        audio.heartbeat(threat);
        game.heartTimer = 1.15 - threat * 0.55;
      }
      $('br-hurt').style.opacity = String(threat * 0.55);
    }

    audio.interference(game.interference);
    drawStatic(game.interference);

    if (subtitleTimer > 0) {
      subtitleTimer -= dt;
      if (subtitleTimer <= 0) $('br-subtitle').style.opacity = '0';
    }

    hudAccum += dt;
    if (hudAccum > 0.2) {
      hudAccum = 0;
      if (game.phase === 'playing') updateHud();
      if (settings.debug && $('br-debug').classList.contains('br-on')) drawDebug();
    }

    fpsAccum += dt;
    fpsFrames += 1;
    if (fpsAccum >= 0.5) {
      if (settings.showFps) $('br-fps').textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.quality === 'low' ? 1 : 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ======================================================= DEBUG / TEST ====
  // A live top-down view with teleports and AI switches. The point is being
  // able to reach a far corner, a specific entity, or the exit in one click
  // instead of walking a 40x40 maze every time a behaviour needs checking.
  const mapCanvas = $('br-map');
  const mapCtx = mapCanvas.getContext('2d');

  function toggleDebug(on) {
    $('br-debug').classList.toggle('br-on', on);
    if (on) drawDebug();
  }

  function drawDebug() {
    if (!level) return;
    const size = mapCanvas.width;
    const s = size / Math.max(level.w, level.h);
    mapCtx.fillStyle = '#070603';
    mapCtx.fillRect(0, 0, size, size);

    // Visited cells (or the whole floor plan when revealed).
    mapCtx.fillStyle = 'rgba(230,198,92,0.16)';
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        if (game.revealed || game.visited.has(`${x},${y}`)) {
          mapCtx.fillRect(x * s, y * s, s, s);
        }
      }
    }
    mapCtx.strokeStyle = 'rgba(230,198,92,0.55)';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x <= level.w; x += 1) {
        if (level.vWall[y][x]) {
          mapCtx.moveTo(x * s, y * s);
          mapCtx.lineTo(x * s, (y + 1) * s);
        }
      }
    }
    for (let y = 0; y <= level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        if (level.hWall[y][x]) {
          mapCtx.moveTo(x * s, y * s);
          mapCtx.lineTo((x + 1) * s, y * s);
        }
      }
    }
    mapCtx.stroke();

    const dot = (wx, wz, colour, r) => {
      mapCtx.fillStyle = colour;
      mapCtx.beginPath();
      mapCtx.arc((wx / CELL) * s, (wz / CELL) * s, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    const ex = level.centre(level.exit.x, level.exit.y);
    dot(ex.x, ex.z, '#ff4436', 4);
    // Player, with a facing tick.
    dot(player.pos.x, player.pos.z, '#8ef0a0', 3.5);
    mapCtx.strokeStyle = '#8ef0a0';
    mapCtx.beginPath();
    mapCtx.moveTo((player.pos.x / CELL) * s, (player.pos.z / CELL) * s);
    mapCtx.lineTo(
      (player.pos.x / CELL) * s + player.forward.x * 9,
      (player.pos.z / CELL) * s + player.forward.z * 9,
    );
    mapCtx.stroke();

    const colours = { chaser: '#ffffff', lifeform: '#c07bff', watcher: '#ffd166' };
    let text = '';
    for (const e of director?.entities ?? []) {
      dot(e.pos.x, e.pos.z, colours[e.kind] || '#fff', 3);
      // Belief marker: where it *thinks* you are. The gap between this and the
      // green dot is the whole sensing model, made visible.
      const b = level.centre(e.belief.x, e.belief.y);
      mapCtx.strokeStyle = colours[e.kind] || '#fff';
      mapCtx.globalAlpha = 0.5;
      mapCtx.strokeRect((b.x / CELL) * s - 3, (b.z / CELL) * s - 3, 6, 6);
      mapCtx.globalAlpha = 1;
      const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      text += `<b>${e.name}</b> ${e.state} · ${d.toFixed(0)}m · conf ${e.confidence.toFixed(2)}<br>`;
    }
    text += `noise <b>${player.noise.toFixed(2)}</b> · stam ${player.stamina.toFixed(0)}`;
    $('br-dbg-ents').innerHTML = text;
  }

  function teleport(cellX, cellY) {
    const c = level.centre(cellX, cellY);
    player.pos.set(c.x, 0, c.z);
    player.vel.set(0, 0, 0);
  }

  $('br-debug').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dbg]');
    if (!btn || !level) return;
    const act = btn.dataset.dbg;
    const toggle = (flag) => {
      game[flag] = !game[flag];
      btn.classList.toggle('br-on-btn', game[flag]);
    };
    switch (act) {
      case 'exit': {
        // Just inside the passage, so the win trigger isn't tripped instantly.
        const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][world.exit.dir];
        player.pos.set(
          world.exit.mouth.x + d[0] * CELL * 0.6,
          0,
          world.exit.mouth.z + d[1] * CELL * 0.6,
        );
        player.vel.set(0, 0, 0);
        break;
      }
      case 'spawn': teleport(level.spawn.x, level.spawn.y); break;
      case 'random': teleport(
        Math.floor(Math.random() * level.w),
        Math.floor(Math.random() * level.h),
      ); break;
      case 'nearest': {
        const n = director.nearest(player.pos);
        if (n.entity) {
          player.pos.set(n.entity.pos.x, 0, n.entity.pos.z);
          player.vel.set(0, 0, 0);
        }
        break;
      }
      case 'here': {
        const c = level.cellAt(player.pos.x, player.pos.z);
        for (const ent of director.entities) {
          const near = ent.wanderTarget(c.x, c.y, 3, Math.random);
          ent.placeAtCell(near.x, near.y);
        }
        break;
      }
      case 'scare': {
        const chaser = director.get('chaser');
        if (chaser) chaser.beginJumpscare(player);
        else entityApi.scare(player.pos.clone());
        break;
      }
      case 'noclip': toggle('noclip'); break;
      case 'freeze': toggle('frozen'); break;
      case 'invuln': toggle('invuln'); break;
      case 'reveal': toggle('revealed'); break;
      case 'lights': toggle('lightsUp'); break;
      case 'win': endGame(true, 'Debug: forced win.'); break;
      default: break;
    }
    drawDebug();
  });

  /**
   * Scripted-test surface. Exposed only with the harness on, so a normal play
   * session can't be driven from the console, and kept deliberately small:
   * move the player, inspect and pose entities, force outcomes.
   */
  function installTestApi() {
    window.__backrooms = {
      get level() { return level; },
      get scene() { return scene; },
      get renderer() { return renderer; },
      get player() { return player; },
      get entities() { return director?.entities ?? []; },
      get state() {
        return {
          phase: game.phase,
          time: game.time,
          explored: explored(),
          seed: level?.seed,
          solveSteps: level?.solveSteps,
        };
      },
      teleport,
      teleportTo(x, z) {
        player.pos.set(x, 0, z);
        player.vel.set(0, 0, 0);
      },
      toExit() { $('br-debug').querySelector('[data-dbg="exit"]').click(); },
      look(yaw, pitch = 0) {
        player.yaw = yaw;
        player.pitch = pitch;
      },
      /** Walk the shortest route to the exit, one cell per call. */
      stepToExit() {
        const field = level.distanceField([level.exit]);
        const here = level.cellAt(player.pos.x, player.pos.z);
        const next = level.stepDownhill(here.x, here.y, field);
        if (next) teleport(next.x, next.y);
        return next;
      },
      setEntityMode(mode) {
        const c = director?.get('chaser');
        if (c && CHASER_MODES.includes(mode)) c.mode = mode;
      },
      placeEntity(kind, cx, cy) { director?.get(kind)?.placeAtCell(cx, cy); },
      freeze(on) { game.frozen = !!on; },
      invuln(on) { game.invuln = !!on; },
      noclip(on) { game.noclip = !!on; },
      start: startGame,
      restart,
      win() { endGame(true, 'Test: forced win.'); },
      lose() { endGame(false, 'Test: forced loss.'); },
      rebuild(seed) { return buildLevel(seed || settings.seed).then(() => startGame()); },
    };
  }

  // ================================================================ UI ====
  function bindMenu() {
    // Tabs.
    document.querySelectorAll('.br-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.br-tab').forEach((t) => t.classList.remove('br-active'));
        document.querySelectorAll('.br-pane').forEach((p) => p.classList.remove('br-active'));
        tab.classList.add('br-active');
        document.querySelector(`.br-pane[data-pane="${tab.dataset.tab}"]`)?.classList.add('br-active');
      });
    });

    $('br-menu-btn').addEventListener('click', () => {
      if (game.phase === 'playing') pause();
      else if (game.phase === 'paused') resume();
      else $('br-menu').classList.remove('br-hidden');
    });
    $('br-resume').addEventListener('click', resume);
    $('br-start').addEventListener('click', startGame);
    $('br-again').addEventListener('click', restart);
    $('br-end-menu').addEventListener('click', toMenu);
    $('br-newlevel').addEventListener('click', async () => {
      settings.seed = randomSeed();
      $('br-seed').value = settings.seed;
      saveSettings();
      $('br-end').classList.add('br-hidden');
      await buildLevel(settings.seed);
      startGame();
    });
    $('br-regen').addEventListener('click', async () => {
      settings.seed = $('br-seed').value.trim() || randomSeed();
      $('br-seed').value = settings.seed;
      saveSettings();
      await buildLevel(settings.seed);
      toMenu();
    });
    $('br-reseed').addEventListener('click', () => {
      settings.seed = randomSeed();
      $('br-seed').value = settings.seed;
      saveSettings();
    });

    // --- simple bindings -------------------------------------------------
    const bindRange = (id, key, fmt, apply) => {
      const el = $(id);
      const out = $(`${id}-v`);
      el.value = settings[key];
      if (out) out.textContent = fmt(settings[key]);
      el.addEventListener('input', () => {
        settings[key] = Number(el.value);
        if (out) out.textContent = fmt(settings[key]);
        if (apply) apply(settings[key]);
        saveSettings();
      });
    };
    const bindCheck = (id, key, apply) => {
      const el = $(id);
      el.checked = !!settings[key];
      el.addEventListener('change', () => {
        settings[key] = el.checked;
        if (apply) apply(el.checked);
        saveSettings();
      });
    };

    bindRange('br-sens', 'sensitivity', (v) => `${v.toFixed(2)}×`);
    bindRange('br-fov', 'fov', (v) => `${v}°`, (v) => {
      camera.fov = v;
      camera.updateProjectionMatrix();
    });
    bindRange('br-fog', 'fog', (v) => v.toFixed(3), (v) => { scene.fog.density = v; });
    bindRange('br-vol', 'volume', (v) => `${Math.round(v * 100)}%`, (v) => {
      audio.setVolume(settings.mute ? 0 : v);
    });
    bindCheck('br-bob', 'bob');
    bindCheck('br-invert', 'invert');
    bindCheck('br-mute', 'mute', (on) => audio.setVolume(on ? 0 : settings.volume));
    bindCheck('br-fpson', 'showFps', (on) => {
      $('br-fps').style.display = on ? 'block' : 'none';
    });
    bindCheck('br-noscare', 'noScares');
    bindCheck('br-noflicker', 'reduceFlicker');
    bindCheck('br-debugon', 'debug', (on) => {
      toggleDebug(on);
      if (on) installTestApi();
      else delete window.__backrooms;
    });

    $('br-quality').value = settings.quality;
    $('br-quality').addEventListener('change', async () => {
      settings.quality = $('br-quality').value === 'low' ? 'low' : 'high';
      saveSettings();
      // buildLevel notices the tier changed and swaps the material set itself,
      // disposing the old one once the world using it has gone.
      resize();
      await buildLevel(settings.seed);
      toMenu();
    });

    $('br-seed').value = settings.seed;
    $('br-seed').addEventListener('change', () => {
      settings.seed = $('br-seed').value.trim() || randomSeed();
      $('br-seed').value = settings.seed;
      saveSettings();
    });
    $('br-size').value = String(settings.size);
    $('br-size').addEventListener('change', async () => {
      settings.size = clamp(Number($('br-size').value) || 26, 12, 48);
      saveSettings();
      await buildLevel(settings.seed);
      toMenu();
    });

    // --- entities --------------------------------------------------------
    const entToggle = (id, key) => {
      const el = $(id);
      el.checked = settings.entities[key];
      el.addEventListener('change', () => {
        settings.entities[key] = el.checked;
        saveSettings();
        if (!director) return;
        const kinds = { chaser: 'chaser', lifeform: 'lifeform', watcher: 'watcher' };
        if (!el.checked) director.remove(kinds[key]);
        else if (!director.has(kinds[key])) {
          const rnd = mulberry32(hashSeed(`${settings.seed}:${key}:${Date.now()}`));
          if (key === 'chaser') {
            director.add(new PngChaser(level, collider, chaserTexture, rnd,
              { mode: settings.chaserMode }), 14);
          } else if (key === 'lifeform') director.add(new Lifeform(level, collider, rnd), 16);
          else director.add(new Entity96(level, collider, rnd, irisTexture()), 12);
        }
      });
    };
    entToggle('br-e-chaser', 'chaser');
    entToggle('br-e-lifeform', 'lifeform');
    entToggle('br-e-watcher', 'watcher');

    $('br-chaser-mode').value = settings.chaserMode;
    $('br-chaser-mode').addEventListener('change', () => {
      const v = $('br-chaser-mode').value;
      settings.chaserMode = CHASER_MODES.includes(v) ? v : 'auto';
      saveSettings();
      const c = director?.get('chaser');
      if (c) c.mode = settings.chaserMode;
    });

    // --- skin upload (local only) ----------------------------------------
    const fileInput = $('br-skin-file');
    $('br-skin-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      // Guard both size and type before touching it: a 60 MB "PNG" would blow
      // the localStorage quota and hang the main thread decoding.
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        say('That file is not an image.', 3);
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        say('Skin too large — 4 MB maximum.', 3);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        if (!SKIN_RE.test(url)) {
          say('That image could not be read.', 3);
          return;
        }
        skinDataUrl = url;
        try {
          localStorage.setItem(SKIN_KEY, url);
        } catch (e) {
          say('Skin loaded, but too large to remember for next time.', 4);
        }
        applySkin(url);
      };
      reader.onerror = () => say('Could not read that file.', 3);
      reader.readAsDataURL(file);
    });
    $('br-skin-clear').addEventListener('click', () => {
      skinDataUrl = null;
      try { localStorage.removeItem(SKIN_KEY); } catch (e) { /* ignore */ }
      applySkin(null);
    });

    $('br-fps').style.display = settings.showFps ? 'block' : 'none';
  }

  // ============================================================== BOOT ====
  bindMenu();
  resize();
  applySkin(skinDataUrl, async () => {
    await buildLevel(settings.seed);
    $('br-menu').classList.remove('br-hidden');
    if (settings.debug) {
      toggleDebug(true);
      installTestApi();
    }
    requestAnimationFrame(frame);
  });
})();
