// The Backrooms — a first-person survival-horror wander through seeded,
// procedurally generated levels. Bundled with three into the self-hosted asset
// backrooms.js (CSP is script-src 'self', so no CDN) and loaded as a module by
// pages/games/backrooms.ts.
//
// TWO LEVELS, ONE SHELL. Level 0 ("the Lobby") is flat: one floor height, no
// vertical axis to speak of, and the whole game is where you are on a grid.
// Level 37 ("the Poolrooms") gives that grid a height per cell and floods most
// of it, which turns every system in this file three-dimensional — the player
// gains gravity, buoyancy, breath and a climb; entities gain a floor to stand
// on; sound gains a filter for when your head goes under. Everything below
// that reads `pools` is that difference.
//
// Entirely client-side and account-free: nothing is posted anywhere, and the
// PNG-chaser skin the player uploads is read with FileReader and kept in
// localStorage as a data URL — it never leaves the device.
//
// Conventions: metres, Y up, +Z is "south" on the map. The level grid maps to
// world space as x = column * CELL, z = row * CELL.
//
// Module map:
//   backrooms-maze.js         seeded generation, nav graph, line of sight, collision
//   backrooms-materials.js    every texture, drawn from noise into canvases
//   backrooms-world.js        grid -> merged geometry, fluorescents, the exit
//   backrooms-entities.js     entity models, senses and behaviour
//   backrooms-audio.js        synthesised sound (no audio files at all)
//   backrooms-pools.js        Level 37 terrain: water depth, ladders, darkness
//   backrooms-pool-world.js   Level 37 geometry, caustics, ladders
//   backrooms-water.js        the water surface: Gerstner sea + live ripples
//   backrooms-pool-entities.js  Drowner, Smiler, Will o' Waves
//
// Design sources are listed in full on the page's References tab.

import * as THREE from 'three';
import {
  generate, Collider, CELL, WALL_H, mulberry32, hashSeed,
} from './backrooms-maze.js';
import {
  buildMaterials, defaultChaserTexture, irisTexture, upgradeSurfaces,
} from './backrooms-materials.js';
import { buildWorld, updateFixtures } from './backrooms-world.js';
import {
  PngChaser, Lifeform, Entity96, Director, CHASER_MODES, PLAYER_SPEEDS,
} from './backrooms-entities.js';
import { Audio } from './backrooms-audio.js';
import {
  generatePools, WATER_Y, DECK_Y, STEP_UP, DECK,
} from './backrooms-pools.js';
import { buildPoolMaterials, upgradePoolSurfaces } from './backrooms-materials.js';
import { loadPlayerModel } from './backrooms-player.js';
import { buildPoolWorld } from './backrooms-pool-world.js';
import { buildWater } from './backrooms-water.js';
import {
  Drowner, Smiler, WillOWaves, DROWNER,
} from './backrooms-pool-entities.js';

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

    // ---- Level 37: the vertical axis ------------------------------------
    GRAVITY: 18, // m/s² — snappier than earth, because falling is not the game
    JUMP_V: 4.6, // enough to clear the 1.35 m pool wall from a run-up? No:
    // deliberately not. You can jump INTO a pool and off a step, and you can
    // hop a hand's breadth, but the only way back onto the deck is a ladder.
    TERMINAL_V: 22,
    // Wading vs swimming. Below WADE_MIN the water does not affect you at all;
    // above SWIM_DEPTH your feet are off the floor and everything changes.
    WADE_MIN: 0.3,
    SWIM_DEPTH: 1.75,
    WADE: PLAYER_SPEEDS.WADE,
    SWIM: PLAYER_SPEEDS.SWIM,
    DIVE: PLAYER_SPEEDS.DIVE,
    // How deep you float when treading water: eyes about 24 cm clear of it.
    FLOAT_SUB: 1.42,
    SINK_MAX: 1.5, // how far under a spent swimmer drifts
    LADDER_REACH: 1.15, // how close you must be to take hold of one
    LADDER_SPEED: 1.85,
    // Breath. It only drains with your head actually under the surface, and it
    // comes back nearly twice as fast as it goes, so a dive is cheap and being
    // held under is not.
    BREATH_MAX: 100,
    BREATH_DRAIN: 13,
    BREATH_REGEN: 24,
    DROWN_TIME: 4.5, // seconds on empty lungs before it kills you
    // Treading water is work. Stamina drains all the time you are swimming and
    // does not come back until you are out or standing — and when it is gone
    // you stop floating, which is how "in the water too long" becomes drowning
    // rather than a number quietly hitting zero.
    SWIM_STAMINA: 7.5,
    // What the water does to how loud you are.
    NOISE_WADE: 1.5,
    NOISE_SWIM: 1.25,
    NOISE_HUM: 1.7,
  };

  // ========================================================== SETTINGS ====
  const STORE_KEY = 'sw-backrooms-v1';
  const SKIN_KEY = 'sw-backrooms-skin-v1';
  const LEVELS = ['lobby', 'pools'];
  const DEFAULTS = {
    level: 'lobby',
    seed: '', size: 26, sensitivity: 1, fov: 78, fog: 0.052, bob: true, invert: false,
    volume: 0.7, mute: false, quality: 'high', showFps: false, noScares: false,
    reduceFlicker: false, debug: false, chaserMode: 'auto',
    entities: {
      chaser: true, lifeform: true, watcher: true, drowner: true, smiler: true, willo: true,
    },
  };
  // Which roster belongs to which level. A Lifeform does not live in the
  // Poolrooms and a Drowner has nothing to lurk in on Level 0, so the menu
  // shows one set or the other and spawnEntities only ever reads this one.
  const ROSTER = {
    lobby: ['chaser', 'lifeform', 'watcher'],
    pools: ['drowner', 'smiler', 'willo'],
  };
  // The two blocks of entity cards in the menu, shown one at a time. Resolved
  // lazily in bindMenu so this can sit next to the roster it mirrors.
  const LEVELS_PANES = {};
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
      if (!LEVELS.includes(settings.level)) settings.level = 'lobby';
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

  /**
   * Everything that differs between the two levels' *look*, in one table.
   *
   * Level 0 is lit warm and evenly and the horror is the sameness. Level 37 is
   * lit cool and sparsely and the horror is the geometry. UNDER is the third
   * state: the fog goes thick and green the moment your eyes go below the
   * surface, which is what makes putting your head under feel like a decision.
   */
  const LOOK = {
    lobby: {
      fog: 0x2b2410,
      bg: 0x1a160b,
      ambient: 0xa08b4e,
      ambientLevel: 0.85,
      hemiSky: 0x8a7434,
      hemiGround: 0x2a2210,
      hemiLevel: 0.6,
      tube: 0xfff0cc,
      fogScale: 1,
    },
    pools: {
      fog: 0x123f45,
      bg: 0x0a2126,
      ambient: 0x9fc6cc,
      ambientLevel: 0.72,
      hemiSky: 0xa8d6dc,
      // Bounce off a lit pool floor is the strongest fill light in the place.
      hemiGround: 0x1d5b60,
      hemiLevel: 0.85,
      tube: 0xe8f6ff,
      fogScale: 0.7, // tiled halls read further than carpeted ones
    },
    under: {
      fog: 0x0b3b3c,
      bg: 0x072526,
      fogScale: 5.2, // you can see a few metres, and that is all
    },
  };

  // Level 0 is *lit* — uncomfortably, evenly, endlessly. The horror is the
  // sameness, not the dark, so ambient sits high enough to always read the
  // wallpaper and the fog does the work of hiding distance.
  const ambient = new THREE.AmbientLight(0xa08b4e, 0.85);
  scene.add(ambient);
  // Faint bounce off the carpet so floors aren't black between fixtures.
  const bounce = new THREE.HemisphereLight(0x8a7434, 0x2a2210, 0.6);
  scene.add(bounce);

  let lightPool = [];
  function buildLightPool() {
    for (const l of lightPool) scene.remove(l);
    lightPool = [];
    const n = CFG.LIGHT_POOL[settings.quality];
    for (let i = 0; i < n; i += 1) {
      // Intensity is in candela (Three's physical units since r155): a tube
      // that reads correctly at 3 m needs tens, not units.
      const l = new THREE.PointLight(LOOK[settings.level].tube, 0, 16, 2);
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

    // ---- Level 37 ------------------------------------------------------
    // Feet height. Mirrored into pos.y every frame so entities can ask how far
    // above or below them you are without knowing anything else about you.
    y: 0,
    vy: 0,
    grounded: true,
    depth: 0, // metres of water over the floor under you
    swimming: false,
    wading: false,
    submerged: false, // eyes below the surface
    diving: false,
    breath: CFG.BREATH_MAX,
    drownTimer: 0,
    ladder: null, // the ladder currently in reach
    climbing: false,
    // Set the moment a climb tops out, and held until the player is standing
    // over the deck. Without it, letting go of the key at the top of a ladder
    // drops you straight back in the pool, because you are still horizontally
    // over the water.
    mounting: null,
    humming: false,
    // A live grab by a Drowner: { entity, left, total, need, lastDir }.
    grab: null,
  };

  const keys = Object.create(null);
  let pointerLocked = false;

  // ============================================================ STATE ====
  let level = null;
  let collider = null;
  let world = null;
  let director = null;
  let materials = null;
  let poolMaterials = null;
  let water = null; // the Poolrooms' water surface, null on Level 0
  let chaserTexture = null;
  let skinDataUrl = null;
  const audio = new Audio();

  /** True while the Poolrooms are loaded. The one flag the rest of this reads. */
  const isPools = () => level?.theme === 'pools';

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

  // What the menu and the loading screen call each level. Kept here rather
  // than in the markup because the markup can only hold one of them.
  const LEVEL_NAMES = {
    lobby: { title: 'LEVEL 0', tag: 'LEVEL 0 · "THE LOBBY" · SURVIVAL DIFFICULTY: LOW' },
    // The wiki rates Level 37 as entity-free and survival difficulty 0. Three
    // entities later, the rating is left standing as the joke it now is.
    pools: { title: 'LEVEL 37', tag: 'LEVEL 37 · "SUBLIMITY" · THE POOLROOMS · CANON DIFFICULTY: 0' },
  };
  function applyLevelName() {
    const n = LEVEL_NAMES[settings.level] || LEVEL_NAMES.lobby;
    $('br-l-title').textContent = n.title;
    $('br-tag').textContent = n.tag;
    // The water/ladder/lungs harness buttons have nothing to act on in a level
    // with no water in it.
    $('br-debug').classList.toggle('br-dry', settings.level !== 'pools');
  }

  /** Apply a level's palette to the scene. Called on build and when surfacing. */
  function applyLook(key, blend = 1) {
    const L = LOOK[key];
    if (!L) return;
    if (L.fog !== undefined) scene.fog.color.setHex(L.fog);
    if (L.bg !== undefined) scene.background.setHex(L.bg);
    scene.fog.density = settings.fog * L.fogScale * blend;
    if (L.ambient !== undefined) {
      ambient.color.setHex(L.ambient);
      bounce.color.setHex(L.hemiSky);
      bounce.groundColor.setHex(L.hemiGround);
      bounce.intensity = L.hemiLevel;
    }
  }

  /** Rebuild the whole level, in stages so the loading text can keep up. */
  async function buildLevel(seed) {
    const pools = settings.level === 'pools';
    applyLevelName();
    setLoading(true, pools ? 'flooding the floor plan…' : 'generating floor plan…');
    game.phase = 'menu';
    await nextTick();

    if (world) {
      scene.remove(world.group);
      world.dispose();
    }
    if (water) {
      scene.remove(water.mesh);
      water.dispose();
      water = null;
    }
    if (director) director.dispose();

    level = pools
      ? generatePools({ seed, width: settings.size, height: settings.size })
      : generate({ seed, width: settings.size, height: settings.size });
    collider = new Collider(level);

    setLoading(true, pools ? 'glazing the tile…' : 'printing wallpaper…');
    await nextTick();
    // Each level owns its own material set, and each is kept across rebuilds
    // (the tile does not change when the floor plan does) until the quality
    // tier moves under it. The world using them was disposed above, so
    // dropping them here is safe.
    const detailWanted = settings.quality !== 'low';
    if (materials && materials.detailed !== detailWanted) {
      materials.dispose();
      materials = null;
    }
    if (poolMaterials && poolMaterials.detailed !== detailWanted) {
      poolMaterials.dispose();
      poolMaterials = null;
    }
    if (pools) {
      if (!poolMaterials) {
        poolMaterials = buildPoolMaterials(settings.quality);
        poolMaterials.scanned = upgradePoolSurfaces(poolMaterials);
      }
    } else if (!materials) {
      materials = buildMaterials(settings.quality);
      materials.scanned = upgradeSurfaces(materials);
    }

    // The body is level-independent, so it loads once and is then simply
    // re-used; a failure leaves playerModel null and the game stays a
    // disembodied camera exactly as before.
    if (!playerModelLoad) {
      playerModelLoad = loadPlayerModel().then((m) => {
        if (!m) return null;
        playerModel = m;
        playerModel.setFirstPerson(!thirdPerson);
        scene.add(m.group);
        return m;
      });
    }

    setLoading(true, pools ? 'filling the pools…' : 'laying carpet…');
    await nextTick();
    await playerModelLoad;
    // Swap in the scanned surface maps before the world is shown. The promise
    // is stored on the material set, which outlives the level, so this only
    // waits on the network the first time a level is entered — every rebuild
    // after that awaits an already-settled promise. A failure resolves false
    // and we simply show the procedural textures.
    await (pools ? poolMaterials : materials).scanned;
    if (pools) {
      world = buildPoolWorld(level, poolMaterials, collider);
      water = buildWater(level, settings.quality);
      scene.add(water.mesh);
    } else {
      world = buildWorld(level, materials, collider);
    }
    scene.add(world.group);
    applyLook(settings.level);
    buildLightPool();
    audio.setTheme(settings.level);

    setLoading(true, 'listening…');
    await nextTick();
    spawnEntities(seed);
    resetPlayer();
    updateHud();
    setLoading(false);
  }

  /** Build one entity by kind, or null if this level does not have it. */
  function makeEntity(kind, rnd) {
    switch (kind) {
      case 'chaser':
        return new PngChaser(level, collider, chaserTexture, rnd, { mode: settings.chaserMode });
      case 'lifeform': return new Lifeform(level, collider, rnd);
      case 'watcher': return new Entity96(level, collider, rnd, irisTexture());
      case 'drowner': return new Drowner(level, collider, rnd);
      case 'smiler': return new Smiler(level, collider, rnd);
      case 'willo': return new WillOWaves(level, collider, rnd);
      default: return null;
    }
  }

  // How far from spawn, in path steps, each thing starts. The shoal is the one
  // exception: it is harmless, and finding it early is the point of it.
  const SPAWN_DISTANCE = {
    chaser: 14, lifeform: 16, watcher: 12, drowner: 12, smiler: 10, willo: 6,
  };

  function spawnEntities(seed) {
    const rnd = mulberry32(hashSeed(`${seed}:entities`));
    director = new Director(level, collider, scene, rnd);
    for (const kind of ROSTER[settings.level]) {
      if (!settings.entities[kind]) continue;
      const e = makeEntity(kind, rnd);
      if (e) director.add(e, SPAWN_DISTANCE[kind] ?? 12);
    }
  }

  function resetPlayer() {
    const c = level.centre(level.spawn.x, level.spawn.y);
    // Spawn on the floor of the spawn cell — which on Level 37 is a deck cell
    // 1.35 m above the water, so this is not 0.
    player.y = isPools() ? level.groundAt(c.x, c.z) : 0;
    player.pos.set(c.x, player.y, c.z);
    player.vel.set(0, 0, 0);
    player.vy = 0;
    player.yaw = 0;
    player.pitch = 0;
    player.stamina = CFG.STAMINA_MAX;
    player.staminaLock = 0;
    player.crouching = false;
    player.eyeY = CFG.EYE_STAND;
    player.alive = true;
    player.breath = CFG.BREATH_MAX;
    player.drownTimer = 0;
    player.swimming = false;
    player.wading = false;
    player.submerged = false;
    player.diving = false;
    player.climbing = false;
    player.mounting = null;
    player.ladder = null;
    player.humming = false;
    releaseGrab(false);
    audio.hum(false);
    audio.setUnderwater(false);
    game.time = 0;
    game.visited = new Set([`${level.spawn.x},${level.spawn.y}`]);
    game.shake = 0;
    game.interference = 0;
    $('br-hurt').style.opacity = '0';
    $('br-static').style.opacity = '0';
    $('br-water').style.opacity = '0';
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
    if (e.code === 'KeyV' && playerModel) {
      thirdPerson = !thirdPerson;
      // The head only exists in third person; in first person it is collapsed
      // so the camera is not sitting inside a face.
      playerModel.setFirstPerson(!thirdPerson);
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
    player.pitch = clampPitch(player.pitch);
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
    player.humming = false;
    audio.hum(false);
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
    player.humming = false;
    audio.hum(false);
    audio.setUnderwater(false);
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

    // ---- Level 37 -------------------------------------------------------
    /** Disturb the water. Silently ignored on a level that has none. */
    ripple(x, z, strength) {
      if (water) water.disturb(x, z, strength);
    },
    /**
     * Ask to take hold of the player. The ENTITY does not get to decide this:
     * invulnerability, a finished run and an existing grab are all the game's
     * business, and a refusal is a plain false rather than an exception.
     */
    grab(entity, seconds, need) {
      if (game.invuln || game.phase !== 'playing' || player.grab) return false;
      player.grab = {
        entity,
        left: seconds,
        total: seconds,
        need,
        progress: 0,
        lastDir: 0,
        // Read off the terrain, not off the transient swim flags: waist-deep
        // is quite enough water for something to hold your head under, and a
        // flag sampled on the wrong frame would silently turn a drowning into
        // a shove.
        underwater: isPools() && level.depthAt(player.pos.x, player.pos.z) > CFG.WADE_MIN,
      };
      audio.grabbed(entity.pos.clone());
      game.shake = 1;
      say('Thrash — left and right — to tear free.', 3);
      return true;
    },
    /** A Smiler committing. Fires every frame of the charge; the audio dedupes. */
    smilerRush(pos, age) {
      audio.smilerRush(pos, age);
      if (age < 0.12) {
        game.shake = Math.max(game.shake, 0.55);
        say('You looked away.', 2);
      }
    },
  };

  // ============================================================ UPDATE ====

  /**
   * The Drowner's grab, from the player's side.
   *
   * Being held is the only time the game takes the controls away, so it gives
   * something back immediately: thrashing works, and it works on inputs you
   * already have. Every time you REVERSE your strafe direction you tear a
   * little further out of its grip. Holding one key does nothing — it has to
   * be a struggle, not a lean.
   */
  function updateGrab(dt) {
    const g = player.grab;
    g.left -= dt;
    player.vel.set(0, 0, 0);

    let dir = 0;
    if (keys.KeyA || keys.ArrowLeft) dir -= 1;
    if (keys.KeyD || keys.ArrowRight) dir += 1;
    if (dir !== 0 && dir !== g.lastDir) {
      g.lastDir = dir;
      g.progress += g.need;
      audio.struggle();
      if (water) water.disturb(player.pos.x, player.pos.z, 0.12);
      game.shake = Math.max(game.shake, 0.35);
    }

    // It is holding you under, so your lungs are on the clock as well.
    if (g.underwater) {
      player.submerged = true;
      player.breath = Math.max(0, player.breath - CFG.BREATH_DRAIN * 1.6 * dt);
    }
    $('br-hurt').style.opacity = String(0.35 + (1 - g.left / g.total) * 0.5);

    if (g.progress >= 1) {
      releaseGrab(true);
    } else if (g.left <= 0) {
      endGame(false, g.underwater
        ? 'A Drowner held you under until your lungs filled.'
        : 'A Drowner got its hands on you.');
    }
  }

  /** End a grab, from either side. Safe to call when there is no grab. */
  function releaseGrab(brokeFree) {
    const g = player.grab;
    player.grab = null;
    if (!g) return;
    g.entity?.releaseGrab?.(brokeFree);
    if (brokeFree) {
      // Tearing free costs you the thing you most want in the water: the
      // stamina to keep floating.
      player.stamina = Math.max(0, player.stamina - 34);
      player.staminaLock = CFG.STAMINA_DELAY;
      audio.splash(player.pos.clone(), 2.4);
      if (water) water.disturb(player.pos.x, player.pos.z, 0.22);
      say('You tore free. Get out of the water.', 3);
    }
  }

  /**
   * The player, in three dimensions.
   *
   * Level 0 only ever needed the first half of this: read the keys, accelerate,
   * resolve against walls. Level 37 adds the vertical, and the order matters —
   * the water is sampled BEFORE the move so the speed you get is the speed for
   * the water you are in, and the ground is resolved AFTER it so stepping off a
   * deck edge is a fall rather than a snap.
   */
  function updatePlayer(dt) {
    if (player.grab) {
      updateGrab(dt);
      return;
    }
    const pools = isPools();

    // ---- where the water is, right here --------------------------------
    const here = level.cellAt(player.pos.x, player.pos.z);
    const ground = pools ? level.groundAt(player.pos.x, player.pos.z) : 0;
    const cellWet = pools && level.isWater(here.x, here.y);
    // The moving surface, not the datum: the sea and every live ripple are in
    // this number, so a wave really can wash over your eyeline.
    const surf = cellWet && water ? water.heightAt(player.pos.x, player.pos.z) : -Infinity;
    const inWater = cellWet && player.y < surf - 0.04;
    const depth = cellWet ? Math.max(0, surf - ground) : 0;
    player.depth = depth;
    player.swimming = inWater && depth > CFG.SWIM_DEPTH;
    player.wading = inWater && !player.swimming && depth > CFG.WADE_MIN;

    // ---- input ----------------------------------------------------------
    const wantCrouch = keys.ShiftLeft || keys.ShiftRight;
    const wantUp = keys.Space;
    // Sprinting is a dry-land privilege. You cannot sprint through water and
    // you certainly cannot sprint while swimming in it.
    const wantSprint = (keys.ControlLeft || keys.ControlRight)
      && player.stamina > 1 && !inWater;
    player.crouching = !!wantCrouch && !player.swimming;

    let f = 0;
    let sd = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1;
    if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD || keys.ArrowRight) sd += 1;
    if (keys.KeyA || keys.ArrowLeft) sd -= 1;
    const moving = f !== 0 || sd !== 0;

    // Humming. You cannot hum with your head under the water, and letting go
    // of the key has to actually stop the voice — this is the only continuous
    // sound the player themselves emits.
    const wantHum = pools && !!keys.KeyH && !player.submerged && !player.grab;
    if (wantHum !== player.humming) {
      player.humming = wantHum;
      audio.hum(wantHum);
    }

    // ---- ladders --------------------------------------------------------
    player.ladder = pools ? level.ladderNear(player.pos.x, player.pos.z, CFG.LADDER_REACH) : null;
    // You may only take hold from below the deck: grabbing a ladder while
    // standing on the tile beside it would let you ride it down into a pool
    // you were trying to walk past.
    const canClimb = !!player.ladder && player.y < DECK_Y - 0.05;
    player.climbing = !!player.mounting || (canClimb && (wantUp || wantCrouch));

    // ---- speed ----------------------------------------------------------
    player.sprinting = wantSprint && moving && !player.crouching;
    let speed = CFG.WALK;
    if (player.swimming) speed = player.diving ? CFG.DIVE : CFG.SWIM;
    else if (player.wading) speed = CFG.WADE * (1 - Math.min(0.35, depth * 0.14));
    else if (player.crouching) speed = CFG.CROUCH;
    else if (player.sprinting) speed = CFG.SPRINT;
    if (player.climbing) speed *= 0.35; // one hand on the rail

    // ---- stamina --------------------------------------------------------
    // Treading water is the second thing that spends it, and unlike sprinting
    // you cannot simply stop doing it.
    if (player.sprinting) {
      player.stamina = Math.max(0, player.stamina - CFG.STAMINA_DRAIN * dt);
      player.staminaLock = CFG.STAMINA_DELAY;
    } else if (player.swimming && !player.climbing) {
      player.stamina = Math.max(0, player.stamina - CFG.SWIM_STAMINA * dt);
      player.staminaLock = CFG.STAMINA_DELAY;
    } else {
      player.staminaLock = Math.max(0, player.staminaLock - dt);
      if (player.staminaLock <= 0) {
        player.stamina = Math.min(CFG.STAMINA_MAX, player.stamina
          + CFG.STAMINA_REGEN * dt * (player.crouching ? 1.5 : 1));
      }
    }

    // ---- horizontal -----------------------------------------------------
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = 0;
    let dz = 0;
    if (moving) {
      const len = Math.hypot(f, sd);
      const fx = -sin * (f / len);
      const fz = -cos * (f / len);
      const sx = cos * (sd / len);
      const sz = -sin * (sd / len);
      dx = (fx + sx) * speed;
      dz = (fz + sz) * speed;
    }
    // Water is thick: you accelerate into it and coast out of it far more
    // slowly than you do on tile, which is most of why swimming feels like a
    // commitment.
    const drag = inWater ? 0.45 : 1;
    const accel = (moving ? CFG.ACCEL : CFG.FRICTION) * drag;
    player.vel.x += (dx - player.vel.x) * Math.min(1, accel * dt);
    player.vel.z += (dz - player.vel.z) * Math.min(1, accel * dt);

    const nx = player.pos.x + player.vel.x * dt;
    const nz = player.pos.z + player.vel.z * dt;
    // Mounting a ladder is a scripted step onto the tile driven from
    // updateVertical, so the collider is left out of it entirely — resolving
    // against the pool wall mid-mount is what shoves you back off the ladder.
    if (game.noclip || player.mounting) {
      player.pos.x = nx;
      player.pos.z = nz;
    } else {
      const r = collider.resolve(nx, nz, CFG.RADIUS);
      let px = r.x;
      let pz = r.z;
      // The pool wall. Nothing may step up more than STEP_UP, so a 1.35 m lip
      // is as solid as masonry — but it is resolved per axis first, so running
      // along a pool edge skims it instead of sticking to it.
      if (pools && !player.climbing && !player.mounting
        && level.groundAt(px, pz) - player.y > STEP_UP) {
        const ax = collider.resolve(nx, player.pos.z, CFG.RADIUS);
        const az = collider.resolve(player.pos.x, nz, CFG.RADIUS);
        if (level.groundAt(ax.x, ax.z) - player.y <= STEP_UP) {
          px = ax.x;
          pz = ax.z;
        } else if (level.groundAt(az.x, az.z) - player.y <= STEP_UP) {
          px = az.x;
          pz = az.z;
        } else {
          px = player.pos.x;
          pz = player.pos.z;
          player.vel.set(0, 0, 0);
        }
      }
      player.pos.x = px;
      player.pos.z = pz;
    }

    // ---- vertical -------------------------------------------------------
    if (pools) updateVertical(dt, ground, surf, cellWet, wantUp, wantCrouch, moving);
    player.pos.y = player.y;

    // ---- noise ----------------------------------------------------------
    const actual = Math.hypot(player.vel.x, player.vel.z);
    if (player.swimming) {
      player.noise = CFG.NOISE_SWIM * (actual > 0.4 ? 1 : 0.45);
    } else if (player.wading) {
      player.noise = CFG.NOISE_WADE * clamp(actual / CFG.WADE, 0.35, 1);
    } else if (actual < 0.25) player.noise = CFG.NOISE.idle;
    else if (player.crouching) player.noise = CFG.NOISE.crouch;
    else if (player.sprinting) player.noise = CFG.NOISE.sprint;
    else player.noise = CFG.NOISE.walk * clamp(actual / CFG.WALK, 0.3, 1);
    // Humming is a choice to be heard. It is the only way to call a shoal, and
    // it is louder than walking.
    if (player.humming) player.noise = Math.max(player.noise, CFG.NOISE_HUM);

    // ---- breath ---------------------------------------------------------
    if (pools) updateBreath(dt);

    // ---- eye height, bob, and the sound you make ------------------------
    player.eyeTarget = player.crouching ? CFG.EYE_CROUCH : CFG.EYE_STAND;
    player.eyeY += (player.eyeTarget - player.eyeY) * Math.min(1, dt * 9);
    if (actual > 0.3) {
      player.bobPhase += dt * actual * (player.swimming ? 1.1 : 1.9);
      player.stepAccum += actual * dt;
      let stride = CFG.STEP_DIST.walk;
      if (player.swimming) stride = 1.6;
      else if (player.wading) stride = 1.5;
      else if (player.crouching) stride = CFG.STEP_DIST.crouch;
      else if (player.sprinting) stride = CFG.STEP_DIST.sprint;
      if (player.stepAccum >= stride) {
        player.stepAccum = 0;
        if (player.swimming) {
          audio.stroke(player.submerged);
          if (water) water.disturb(player.pos.x, player.pos.z, 0.06);
        } else if (player.wading) {
          audio.splash(null, 0.7 + depth * 0.4);
          if (water) water.disturb(player.pos.x, player.pos.z, 0.05);
        } else {
          audio.footstep(player.crouching, player.sprinting);
        }
      }
    } else {
      player.stepAccum = 0;
    }

    game.visited.add(`${here.x},${here.y}`);

    // Win check — the trigger sits at the far end of the exit passage.
    const t = world.exit.trigger;
    if (Math.hypot(player.pos.x - t.x, player.pos.z - t.z) < t.r) {
      endGame(true, isPools()
        ? 'The tile ran out, and the water did not follow you.'
        : 'The corridor kept going, and then it stopped being a corridor.');
    }
  }

  /**
   * Feet height: gravity, buoyancy and the ladder, in that order of priority.
   *
   * The one rule worth stating out loud is that STAMINA IS WHAT KEEPS YOU
   * AFLOAT. A swimmer with stamina rides the surface with their eyes clear of
   * it. As stamina runs out they sink, and once their eyes go under, breath
   * starts draining — so "you have been in the water too long" arrives as a
   * slow slide beneath the surface you can watch happening, not as a number
   * hitting zero somewhere off screen.
   */
  function updateVertical(dt, ground, surf, cellWet, wantUp, wantCrouch, moving) {
    const prevY = player.y;

    if (player.climbing) {
      player.vy = 0;
      player.diving = false;
      player.grounded = false;

      if (player.mounting) {
        // Topping out. This is a short scripted walk rather than something the
        // player steers, because the alternative is releasing them at deck
        // height while they are still over open water — which reads as the
        // ladder having dropped them.
        const c = level.centre(player.mounting.x, player.mounting.y);
        const mx = c.x - player.pos.x;
        const mz = c.z - player.pos.z;
        const md = Math.hypot(mx, mz);
        const step = Math.min(md, 2.8 * dt);
        if (md > 1e-4) {
          player.pos.x += (mx / md) * step;
          player.pos.z += (mz / md) * step;
        }
        player.y = DECK_Y;
        // Done the moment there is deck under both feet.
        if (level.groundAt(player.pos.x, player.pos.z) >= DECK_Y - 0.01) {
          player.mounting = null;
          player.climbing = false;
          player.grounded = true;
        }
        return;
      }

      const dir = wantUp ? 1 : -1;
      player.y += dir * CFG.LADDER_SPEED * dt;
      // The bottom of the rungs, and the deck at the top.
      player.y = clamp(player.y, surf > -Infinity ? surf - 1.45 : ground, DECK_Y);
      // Hold station on the ladder so a stray strafe does not slide you off it.
      const l = player.ladder;
      player.pos.x += (l.x - player.pos.x) * Math.min(1, dt * 3.5);
      player.pos.z += (l.z - player.pos.z) * Math.min(1, dt * 3.5);
      // Hand over to the mount BEFORE the climb runs out of ladder. The
      // take-hold test above stops applying at DECK_Y - 0.05, so a trigger any
      // higher than that is a trigger the climb oscillates underneath and
      // never reaches: you ride the top rung forever and drop back in the
      // moment you let go.
      if (dir > 0 && player.y >= DECK_Y - 0.12) player.mounting = l.deck;
      return;
    }

    player.diving = false;
    if (player.swimming) {
      // Buoyancy. Diving overrides it entirely — you can always pull yourself
      // under, and you can always kick back up.
      player.diving = !!wantCrouch;
      const spent = clamp(1 - player.stamina / 22, 0, 1);
      let target = surf - CFG.FLOAT_SUB - spent * CFG.SINK_MAX;
      if (player.diving) target = ground;
      else if (wantUp) target = surf - CFG.FLOAT_SUB + 0.25;
      // Sinking is slower than rising: you go down like a body and come up
      // like a person trying to.
      const rate = target > player.y ? 3.4 : 1.5;
      player.y += (target - player.y) * Math.min(1, dt * rate);
      player.y = Math.max(ground, player.y);
      player.vy = 0;
      player.grounded = false;
    } else {
      // On the floor, or on the way to it.
      if (player.grounded && wantUp && !cellWet) {
        player.vy = CFG.JUMP_V;
        player.grounded = false;
      }
      player.vy = Math.max(-CFG.TERMINAL_V, player.vy - CFG.GRAVITY * dt);
      player.y += player.vy * dt;
      if (player.y <= ground) {
        // Landing. A hard one on tile hurts nothing but is loud; in water it
        // throws a proper splash.
        const impact = -player.vy;
        player.y = ground;
        player.vy = 0;
        if (!player.grounded && impact > 2.5 && !cellWet) {
          audio.footstep(false, true);
        }
        player.grounded = true;
      } else if (player.y > ground + 0.02) {
        player.grounded = false;
      }
      // Small lips (a step, the rim of a shallow) are simply walked up.
      if (player.grounded && ground - player.y > 0 && ground - player.y <= STEP_UP) {
        player.y = ground;
      }
    }

    // Breaking the surface, in either direction. This is the one moment the
    // level is loud, so it gets a splash sized by how hard you hit it and a
    // ripple to match.
    if (cellWet && water && surf > -Infinity) {
      const wasAbove = prevY >= surf;
      const isAbove = player.y >= surf;
      if (wasAbove !== isAbove) {
        const impact = Math.abs(player.y - prevY) / Math.max(dt, 1e-3);
        const size = clamp(impact * 0.5, 0.6, 4.5);
        audio.splash(null, size);
        water.disturb(player.pos.x, player.pos.z, clamp(0.05 + impact * 0.03, 0.06, 0.28));
        if (!isAbove && size > 2) game.shake = Math.max(game.shake, 0.3);
      }
      // A swimmer pushes the water around continuously, not only on entry.
      if (player.swimming && moving) {
        player.wakeAccum = (player.wakeAccum || 0) + dt;
        if (player.wakeAccum > 0.4) {
          player.wakeAccum = 0;
          water.disturb(player.pos.x, player.pos.z, 0.035);
        }
      }
    }
  }

  /**
   * Breath, and drowning.
   *
   * It only drains with your eyes actually below the moving surface, which
   * means a wave washing over you costs you a little and a spent swimmer
   * sliding under costs them everything.
   */
  function updateBreath(dt) {
    const cell = level.cellAt(player.pos.x, player.pos.z);
    const wet = level.isWater(cell.x, cell.y);
    const surf = wet && water ? water.heightAt(player.pos.x, player.pos.z) : -Infinity;
    player.submerged = wet && (player.y + player.eyeY) < surf;

    if (player.submerged) {
      player.breath = Math.max(0, player.breath - CFG.BREATH_DRAIN * dt);
    } else {
      player.breath = Math.min(CFG.BREATH_MAX, player.breath + CFG.BREATH_REGEN * dt);
      if (player.breath > 30) player.drownTimer = Math.max(0, player.drownTimer - dt * 2);
    }

    // Gasping. Two different sounds: a strained one under, a relieved one on
    // the way back up.
    player.breathTimer = (player.breathTimer || 0) - dt;
    if (player.breathTimer <= 0 && (player.submerged || player.breath < 60)) {
      player.breathTimer = 1.1 + (player.breath / CFG.BREATH_MAX) * 2;
      audio.breath(player.breath / CFG.BREATH_MAX, player.submerged);
    }

    if (player.breath <= 0) {
      player.drownTimer += dt;
      game.shake = Math.max(game.shake, 0.25);
      if (player.drownTimer > CFG.DROWN_TIME) {
        endGame(false, 'You went under and did not come back up.');
      }
    }
  }

  /**
   * Clamp look pitch.
   *
   * Straight down is fine with no body in the way, but once you have shoulders
   * the last few degrees are spent looking at the top of your own trapezius,
   * which reads as a bug rather than as a body. Stopping at ~66 degrees keeps
   * chest, hands and legs reachable and the shoulders out of frame. Without a
   * body loaded the old near-vertical limit stands.
   */
  function clampPitch(p) {
    const down = playerModel && !thirdPerson ? -1.15 : -Math.PI / 2 + 0.02;
    return clamp(p, down, Math.PI / 2 - 0.02);
  }

  // The player's own body. Loaded once, lives for the whole session, and is
  // simply absent if the fetch fails — see backrooms-player.js.
  let playerModel = null;
  let playerModelLoad = null;
  let thirdPerson = false;
  const TP_BOOM = 2.6;   // metres behind the head
  const TP_LIFT = 0.28;  // raised slightly so the body does not fill the frame
  const TP_RADIUS = 0.34;
  const TP_MIN = 0.55;  // closest the boom is allowed to pull in
  const TP_STEPS = 6;   // boom lengths tested, far to near

  /**
   * Collapse everything the movement code knows into the one word the
   * animation needs. Order matters: dead outranks swimming outranks falling.
   */
  function playerAnimState() {
    if (!player.alive) return 'death';
    if (player.swimming) return 'swim';
    if (!player.grounded && !player.climbing) return 'air';
    if (player.crouching) return 'crouch';
    return 'ground';
  }

  function updateCamera(dt) {
    // player.y is 0 for the whole of Level 0, so this is the same line it was
    // — it only comes alive once there is somewhere to fall to.
    camera.position.set(player.pos.x, player.y + player.eyeY, player.pos.z);
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

    // Third person: pull the camera back along the look axis from a point just
    // behind the head. The boom is clamped by the same collider the player
    // walks with (resolve() pushes a point out of any wall it is inside), so
    // the view never ends up looking through wallpaper — cheaper and more
    // reliable here than a raycast, because the maze is all axis-aligned boxes.
    if (thirdPerson && playerModel) {
      // Orbit pivot: the head, not the feet.
      const px = player.pos.x;
      const pz = player.pos.z;
      const py = player.y + playerModel.eyeHeight() * 0.94 + TP_LIFT;
      // Shorten the boom until it is clear, rather than sliding it sideways out
      // of whatever it hit. Sliding was fine while the camera was locked behind
      // the player, but a freely orbiting camera in corridors this tight spends
      // most of its time with a wall behind it, and sliding parks the lens flat
      // against the wallpaper. Pulling in toward the player keeps the avatar in
      // frame, which is the entire point of the view.
      let dist = TP_MIN;
      for (let i = TP_STEPS; i >= 1; i -= 1) {
        const d = TP_MIN + ((TP_BOOM - TP_MIN) * i) / TP_STEPS;
        const bx = px - player.forward.x * d;
        const bz = pz - player.forward.z * d;
        if (!collider || !collider.resolve(bx, bz, TP_RADIUS).hit) {
          dist = d;
          break;
        }
      }
      camera.position.set(
        px - player.forward.x * dist,
        py - player.forward.y * dist,
        pz - player.forward.z * dist,
      );
    }

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

    // The breath meter only exists where there is something to hold it in, and
    // only shows up once it is not full — a permanently full bar is chrome.
    const breathEl = $('br-breath');
    const showBreath = isPools() && player.breath < CFG.BREATH_MAX - 0.5;
    breathEl.classList.toggle('br-off', !showBreath);
    if (showBreath) {
      $('br-breath-fill').style.width = `${(player.breath / CFG.BREATH_MAX) * 100}%`;
      breathEl.classList.toggle('br-spent', player.breath < 30);
    }

    // The one prompt in the game. Ladders are the level's only affordance and
    // nothing else would teach you they are usable.
    const prompt = $('br-prompt');
    const showPrompt = isPools() && !!player.ladder && player.y < DECK_Y - 0.05 && !player.grab;
    prompt.style.opacity = showPrompt ? '1' : '0';
  }

  /**
   * Going under.
   *
   * Three things change together, and they have to be one blend or the
   * transition reads as a bug: the fog goes thick and green, a tint drops over
   * the screen, and the whole audio bus is lowpassed. The blend is driven by
   * the CAMERA against the moving surface rather than by the player's feet, so
   * a wave passing over your head briefly ducks the world exactly as it should.
   */
  let underBlend = 0;
  function updateUnderwater(dt) {
    let want = 0;
    if (water) {
      const c = level.cellAt(camera.position.x, camera.position.z);
      if (level.isWater(c.x, c.y)) {
        const surf = water.heightAt(camera.position.x, camera.position.z);
        want = clamp((surf - camera.position.y) * 4, 0, 1);
      }
    }
    underBlend += (want - underBlend) * Math.min(1, dt * 9);

    const air = LOOK.pools;
    const wet = LOOK.under;
    scene.fog.color.setHex(air.fog).lerp(new THREE.Color(wet.fog), underBlend);
    scene.background.setHex(air.bg).lerp(new THREE.Color(wet.bg), underBlend);
    scene.fog.density = settings.fog
      * (air.fogScale + (wet.fogScale - air.fogScale) * underBlend);
    $('br-water').style.opacity = String(underBlend * 0.55);

    const under = underBlend > 0.5;
    if (under !== audio.underwater) audio.setUnderwater(under);
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

    // The water runs whenever it exists, paused game or not: a frozen surface
    // behind a pause menu looks like the renderer has died.
    if (water) {
      water.update(dt);
      if (world?.causticClock) world.causticClock.value = water.time;
    }

    if (game.phase === 'playing' && level) {
      game.time += dt;
      updatePlayer(dt);
      game.interference = Math.max(0, game.interference - dt * 1.6);
      director.paused = game.frozen;
      director.update(dt, player, entityApi);
    }
    if (playerModel && level) playerModel.update(dt, player, playerAnimState());
    if (level) updateCamera(dt);
    if (isPools()) updateUnderwater(dt);

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
        ambient.intensity = LOOK[settings.level].ambientLevel;
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

    // Visited cells (or the whole floor plan when revealed). On the Poolrooms
    // the fill carries the terrain as well, because "why can I not get out
    // here" is the question this map exists to answer.
    const pools = isPools();
    for (let y = 0; y < level.h; y += 1) {
      for (let x = 0; x < level.w; x += 1) {
        if (!game.revealed && !game.visited.has(`${x},${y}`)) continue;
        if (pools) {
          const t = level.terrain[y][x];
          mapCtx.fillStyle = t === 2 ? 'rgba(28,120,170,0.55)'
            : (t === 1 ? 'rgba(52,168,180,0.34)' : 'rgba(230,240,236,0.18)');
          mapCtx.fillRect(x * s, y * s, s, s);
          if (level.dark[y][x]) {
            mapCtx.fillStyle = 'rgba(0,0,0,0.55)';
            mapCtx.fillRect(x * s, y * s, s, s);
          }
        } else {
          mapCtx.fillStyle = 'rgba(230,198,92,0.16)';
          mapCtx.fillRect(x * s, y * s, s, s);
        }
      }
    }
    // Ladders and steps: the only two places the deck and the water connect.
    if (pools) {
      for (const l of level.ladders) {
        mapCtx.fillStyle = '#eaeaea';
        mapCtx.fillRect((l.x / CELL) * s - 1.5, (l.z / CELL) * s - 1.5, 3, 3);
      }
      mapCtx.fillStyle = '#8ef0a0';
      for (const st of level.stairs) {
        const c = level.centre(st.water.x, st.water.y);
        mapCtx.fillRect((c.x / CELL) * s - 2, (c.z / CELL) * s - 2, 4, 4);
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

    const colours = {
      chaser: '#ffffff',
      lifeform: '#c07bff',
      watcher: '#ffd166',
      drowner: '#f2c53d',
      smiler: '#ff6f6f',
      willo: '#59a8ff',
    };
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
    if (isPools()) {
      const st = player.swimming ? 'swim' : (player.wading ? 'wade' : 'dry');
      text += `<br>${st}${player.submerged ? ' · UNDER' : ''} · depth ${player.depth.toFixed(1)}m`
        + ` · y ${player.y.toFixed(2)} · breath ${player.breath.toFixed(0)}`;
    }
    $('br-dbg-ents').innerHTML = text;
  }

  function teleport(cellX, cellY) {
    const c = level.centre(cellX, cellY);
    placeAt(c.x, c.z);
  }

  /** Drop the player at a world point, on whatever floor is under it. */
  function placeAt(wx, wz) {
    player.y = isPools() ? level.groundAt(wx, wz) : 0;
    player.pos.set(wx, player.y, wz);
    player.vel.set(0, 0, 0);
    player.vy = 0;
    player.grounded = true;
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
        placeAt(
          world.exit.mouth.x + d[0] * CELL * 0.6,
          world.exit.mouth.z + d[1] * CELL * 0.6,
        );
        break;
      }
      case 'spawn': teleport(level.spawn.x, level.spawn.y); break;
      case 'random': teleport(
        Math.floor(Math.random() * level.w),
        Math.floor(Math.random() * level.h),
      ); break;
      case 'nearest': {
        const n = director.nearest(player.pos);
        if (n.entity) placeAt(n.entity.pos.x, n.entity.pos.z);
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
      case 'water': {
        // The fastest way to check the swim, the breath meter and the surface
        // shader at once: stand in the deepest thing in the level.
        if (!isPools()) break;
        let best = null;
        for (let yy = 0; yy < level.h; yy += 1) {
          for (let xx = 0; xx < level.w; xx += 1) {
            if (level.terrain[yy][xx] === 2) best = best || { x: xx, y: yy };
          }
        }
        if (best) {
          const c = level.centre(best.x, best.y);
          placeAt(c.x, c.z);
          player.y = 0;
          player.pos.y = 0;
        }
        break;
      }
      case 'ladder': {
        if (!isPools() || !level.ladders.length) break;
        const l = level.ladders[Math.floor(Math.random() * level.ladders.length)];
        const dd = [[0, -1], [1, 0], [0, 1], [-1, 0]][l.dir];
        placeAt(l.x + dd[0] * 0.8, l.z + dd[1] * 0.8);
        player.y = -0.2;
        player.pos.y = -0.2;
        break;
      }
      case 'breath': {
        player.breath = 8;
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
      get body() { return playerModel; },
      /** Toggle the third-person view from a script, as KeyV does by hand. */
      setThirdPerson(on) {
        thirdPerson = !!on;
        if (playerModel) playerModel.setFirstPerson(!thirdPerson);
        return thirdPerson;
      },
      /**
       * Freeze the body mid-clip so a pose can be photographed from several
       * angles without it moving between shots. `clip` is a name from
       * PLAYER_STATES, `t` a time in seconds into it.
       */
      poseBody(clip, t = 0) {
        return playerModel ? playerModel.pose(clip, t) : false;
      },
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
      teleportTo(x, z) { placeAt(x, z); },
      /** Poolrooms terrain, for scripted checks. Null on Level 0. */
      get terrain() {
        if (!isPools()) return null;
        return {
          groundAt: (x, z) => level.groundAt(x, z),
          depthAt: (x, z) => level.depthAt(x, z),
          surfaceAt: (x, z) => water?.heightAt(x, z),
          ladders: level.ladders,
          stairs: level.stairs,
          darkCells: level.darkCells,
          counts: (() => {
            const c = [0, 0, 0];
            for (let y = 0; y < level.h; y += 1) {
              for (let x = 0; x < level.w; x += 1) c[level.terrain[y][x]] += 1;
            }
            return { deck: c[0], shallow: c[1], deep: c[2] };
          })(),
        };
      },
      get swim() {
        return {
          y: player.y,
          depth: player.depth,
          swimming: player.swimming,
          wading: player.wading,
          submerged: player.submerged,
          breath: player.breath,
          stamina: player.stamina,
          onLadder: !!player.ladder,
          grabbed: !!player.grab,
        };
      },
      /** Drop the player into the water at a world point. */
      dropIn(x, z) {
        placeAt(x, z);
        player.y = 0.4;
        player.pos.y = 0.4;
        player.vy = 0;
      },
      ripple(x, z, strength = 0.2) { water?.disturb(x, z, strength); },
      /**
       * Winding audit over every triangle in the scene.
       *
       * This exists because a hand-written table of which pool-wall skirts to
       * flip was inverted in all four directions, which made every 1.35 m pool
       * wall in the Poolrooms back-facing — and therefore invisible from the
       * water, the one side you ever look at one from. Nothing catches that
       * except looking, and looking is exactly what a build step cannot do.
       *
       * A triangle whose vertex order disagrees with its own stored normal is
       * a surface that vanishes from the side it is meant to be seen from.
       * Returns { triangles, backFacing, samples } — backFacing must be 0.
       */
      auditGeometry() {
        let triangles = 0;
        let backFacing = 0;
        const samples = [];
        scene.traverse((o) => {
          const g = o.isMesh && o.geometry;
          if (!g || !g.index || !g.attributes?.normal) return;
          const pos = g.attributes.position;
          const nrm = g.attributes.normal;
          const idx = g.index;
          for (let i = 0; i < idx.count; i += 3) {
            const a = idx.getX(i);
            const b = idx.getX(i + 1);
            const c = idx.getX(i + 2);
            const ux = pos.getX(b) - pos.getX(a);
            const uy = pos.getY(b) - pos.getY(a);
            const uz = pos.getZ(b) - pos.getZ(a);
            const vx = pos.getX(c) - pos.getX(a);
            const vy = pos.getY(c) - pos.getY(a);
            const vz = pos.getZ(c) - pos.getZ(a);
            const gx = uy * vz - uz * vy;
            const gy = uz * vx - ux * vz;
            const gz = ux * vy - uy * vx;
            const len = Math.hypot(gx, gy, gz);
            if (len < 1e-9) continue; // degenerate, nothing to face either way
            triangles += 1;
            const dot = (gx / len) * nrm.getX(a)
              + (gy / len) * nrm.getY(a)
              + (gz / len) * nrm.getZ(a);
            if (dot >= 0) continue;
            backFacing += 1;
            if (samples.length < 5) {
              samples.push({
                at: [+pos.getX(a).toFixed(2), +pos.getY(a).toFixed(2), +pos.getZ(a).toFixed(2)],
                normal: [+nrm.getX(a).toFixed(2), +nrm.getY(a).toFixed(2), +nrm.getZ(a).toFixed(2)],
              });
            }
          }
        });
        return { triangles, backFacing, samples };
      },
      setBreath(v) { player.breath = clamp(Number(v) || 0, 0, CFG.BREATH_MAX); },
      setStamina(v) { player.stamina = clamp(Number(v) || 0, 0, CFG.STAMINA_MAX); },
      setLevel(name) {
        if (!LEVELS.includes(name)) return null;
        settings.level = name;
        saveSettings();
        return buildLevel(settings.seed).then(() => startGame());
      },
      toExit() { $('br-debug').querySelector('[data-dbg="exit"]').click(); },
      look(yaw, pitch = 0) {
        player.yaw = yaw;
        player.pitch = clampPitch(pitch);
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

    // --- level ------------------------------------------------------------
    // Switching level is a full rebuild — different generator, different
    // materials, different roster — so it ends at the menu like every other
    // rebuild rather than dropping you into a silently different world.
    const levelSel = $('br-level');
    LEVELS_PANES.lobby = $('br-roster-lobby');
    LEVELS_PANES.pools = $('br-roster-pools');
    levelSel.value = settings.level;
    const syncRoster = () => {
      for (const key of Object.keys(LEVELS_PANES)) {
        LEVELS_PANES[key].classList.toggle('br-hidden', key !== settings.level);
      }
    };
    levelSel.addEventListener('change', async () => {
      const v = levelSel.value;
      settings.level = LEVELS.includes(v) ? v : 'lobby';
      levelSel.value = settings.level;
      syncRoster();
      saveSettings();
      $('br-end').classList.add('br-hidden');
      await buildLevel(settings.seed);
      toMenu();
    });

    // --- entities --------------------------------------------------------
    // One binding for every entity in the game, driven off the roster table:
    // adding an entity means adding it to ROSTER and to the markup, and never
    // touching this.
    const entToggle = (key) => {
      const el = $(`br-e-${key}`);
      if (!el) return;
      el.checked = settings.entities[key];
      el.addEventListener('change', () => {
        settings.entities[key] = el.checked;
        saveSettings();
        // Only the roster for the level actually loaded can be acted on live.
        if (!director || !ROSTER[settings.level].includes(key)) return;
        if (!el.checked) {
          director.remove(key);
          return;
        }
        if (director.has(key)) return;
        const rnd = mulberry32(hashSeed(`${settings.seed}:${key}:${Date.now()}`));
        const e = makeEntity(key, rnd);
        if (e) director.add(e, SPAWN_DISTANCE[key] ?? 12);
      });
    };
    for (const kinds of Object.values(ROSTER)) for (const k of kinds) entToggle(k);
    syncRoster();

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
