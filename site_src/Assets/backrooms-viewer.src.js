// The Backrooms — Entity Viewer. A turntable inspector for the three things
// that live in Level 0, so they can be looked at properly instead of glimpsed
// down a corridor at 5 m/s.
//
// It imports the SAME classes the game spawns (backrooms-entities.js) and the
// SAME surface materials and world builder (backrooms-materials.js /
// backrooms-world.js), so what you turn around here is exactly what hunts you,
// standing in exactly the corridor it hunts you in. The stat cards are read out
// of the live tuning blocks (ENTITY_INFO), so they cannot quote a speed the
// game does not actually use.
//
// Entities are constructed against a real (tiny) generated level because that
// is what their constructors take — a nav substrate. Their update() is never
// called here: nothing senses, nothing hunts, nothing can reach you. Only the
// presentation paths run (the billboard yaw, the Lifeform's gait, the eye's
// hover and beam), driven by the panel instead of by an AI.
//
// Bundled to a self-hosted /static/backrooms-viewer.js (CSP is script-src
// 'self'), loaded as a module by pages/games/backrooms-entities.ts.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generate, Collider, mulberry32 } from './backrooms-maze.js';
import { buildMaterials, defaultChaserTexture, irisTexture } from './backrooms-materials.js';
import { buildWorld, updateFixtures } from './backrooms-world.js';
import {
  PngChaser, Lifeform, Entity96, ENTITY_INFO, PLAYER_SPEEDS, WATCHER,
} from './backrooms-entities.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('bv-canvas');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    const ov = $('bv-error');
    if (ov) ov.style.display = 'flex';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 220);

  // The skin the player uploaded in the game. Same storage key, read-only here:
  // if you brought your own PNG chaser, this is where you get to look at it.
  const SKIN_KEY = 'sw-backrooms-skin-v1';

  // ---- Two lighting rigs, one visible at a time -------------------------
  // STUDIO: neutral and even, for reading silhouette and construction.
  const studio = new THREE.Group();
  {
    const key = new THREE.DirectionalLight(0xfff4e2, 2.2);
    key.position.set(6, 11, 7);
    studio.add(key);
    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.75);
    fill.position.set(-7, 4, -4);
    studio.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, 3, -9);
    studio.add(rim);
    studio.add(new THREE.AmbientLight(0xffffff, 0.55));
    studio.add(new THREE.HemisphereLight(0xcfe0ff, 0x2c3324, 0.7));
  }
  scene.add(studio);

  // LEVEL 0: the game's own lighting — high amber ambient plus the fluorescent
  // pool, because half of what these things look like IS this light.
  const level0 = new THREE.Group();
  // The game's own values (backrooms.src.js): lit any brighter and the eye's
  // iris washes out to a blank sphere, which is not what it looks like in play.
  const l0Ambient = new THREE.AmbientLight(0xa08b4e, 0.85);
  level0.add(l0Ambient);
  level0.add(new THREE.HemisphereLight(0x8a7434, 0x2a2210, 0.6));
  const lightPool = [];
  for (let i = 0; i < 5; i += 1) {
    const l = new THREE.PointLight(0xfff0cc, 0, 16, 2);
    level0.add(l);
    lightPool.push(l);
  }
  scene.add(level0);

  // ---- The corridor. A small real level, built with the real builder, so the
  //      backdrop is Level 0 rather than an impression of it. ----
  const materials = buildMaterials('high');
  const bkLevel = generate({
    seed: 'viewer-hall', width: 13, height: 13, rooms: 6,
  });
  const bkCollider = new Collider(bkLevel);
  const bkWorld = buildWorld(bkLevel, materials, bkCollider);
  scene.add(bkWorld.group);

  /**
   * Pick the emptiest 3x3 block of cells in the level to stand in. A corridor
   * is one cell wide (4.2 m), so an orbit camera pointed at the middle of one
   * spends most of its arc inside the wallpaper — the entity has to be in one
   * of the open rooms, with about twelve metres of floor around it, for the
   * turntable to work at all.
   */
  function openestCell() {
    let best = { x: 1, y: 1, walls: Infinity };
    for (let cy = 1; cy < bkLevel.h - 1; cy += 1) {
      for (let cx = 1; cx < bkLevel.w - 1; cx += 1) {
        let walls = 0;
        // Interior verticals of the block, then interior horizontals.
        for (let y = cy - 1; y <= cy + 1; y += 1) {
          for (let x = cx; x <= cx + 1; x += 1) if (bkLevel.vWall[y][x]) walls += 1;
        }
        for (let y = cy; y <= cy + 1; y += 1) {
          for (let x = cx - 1; x <= cx + 1; x += 1) if (bkLevel.hWall[y][x]) walls += 1;
        }
        if (walls < best.walls) best = { x: cx, y: cy, walls };
        if (walls === 0) return best;
      }
    }
    return best;
  }
  // Everything stands in the middle of that room, and the camera orbits it —
  // so the turntable spins the entity inside the room, not the room around it.
  const home = openestCell();
  const HOME = bkLevel.centre(home.x, home.y);

  // ---- Studio floor + grid (hidden in Level 0 mode) ----------------------
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x171b15, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(HOME.x, -0.002, HOME.z);
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 40, 0x6d5c2a, 0x38301a);
  grid.position.set(HOME.x, 0.01, HOME.z);
  scene.add(grid);

  // ---- A 1.7 m person, for scale. The single most useful thing you can put
  //      next to a monster is an ordinary body. ----
  const human = new THREE.Group();
  {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7c8a93, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.75,
    });
    const add = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      human.add(m);
      return m;
    };
    add(new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), 0, 1.15, 0); // torso
    add(new THREE.SphereGeometry(0.115, 14, 10), 0, 1.58, 0); // head
    add(new THREE.CapsuleGeometry(0.055, 0.6, 4, 8), -0.245, 1.12, 0); // arms
    add(new THREE.CapsuleGeometry(0.055, 0.6, 4, 8), 0.245, 1.12, 0);
    add(new THREE.CapsuleGeometry(0.075, 0.62, 4, 8), -0.1, 0.42, 0); // legs
    add(new THREE.CapsuleGeometry(0.075, 0.62, 4, 8), 0.1, 0.42, 0);
  }
  human.position.set(HOME.x + 1.5, 0, HOME.z);
  human.visible = false;
  scene.add(human);

  // ---- Turntable ---------------------------------------------------------
  const turntable = new THREE.Group();
  turntable.position.set(HOME.x, 0, HOME.z);
  scene.add(turntable);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.8;
  controls.maxDistance = 40;
  controls.target.set(HOME.x, 1.4, HOME.z);
  camera.position.set(HOME.x + 3.4, 2.2, HOME.z + 4.2);

  // A stand-in for the player, used only by presentation code that expects one
  // (the chaser's billboard yaw, the eye's beam target). It never moves and it
  // is never sensed.
  // Placed off the default camera axis on purpose: aimed straight at you the
  // beam is a bright disc, and side-on it is a beam.
  const ghost = {
    pos: new THREE.Vector3(HOME.x - 3.4, 0, HOME.z + 2.4),
    eyeY: 1.66,
    forward: new THREE.Vector3(0, 0, -1),
    noise: 0,
  };
  // A ring on the carpet marking what the eye is burning, so the beam reads as
  // pointed AT something rather than trailing off into the room.
  const ghostMark = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffe9c0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false,
    }),
  );
  ghostMark.rotation.x = -Math.PI / 2;
  ghostMark.position.set(ghost.pos.x, 0.02, ghost.pos.z);
  ghostMark.visible = false;
  scene.add(ghostMark);

  // ---- State -------------------------------------------------------------
  const rnd = mulberry32(20250818);
  let current = null; // the live entity instance
  let currentKind = 'chaser';
  const opts = {
    autoRotate: true,
    wire: false,
    grid: true,
    animate: true,
    billboard: false,
    scale: false,
    backdrop: 'level0',
  };
  // Entity-specific dials, driven by the panel instead of by an AI.
  const pose = { gait: 0.5, charge: 0 };

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.()); else m?.dispose?.();
    });
  }

  function applyWire() {
    if (!current) return;
    current.group.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m) m.wireframe = opts.wire; });
    });
  }

  /** The uploaded skin if there is one, else the generated default face. */
  function chaserTexture(onReady) {
    let saved = null;
    try {
      const v = localStorage.getItem(SKIN_KEY);
      if (v && v.startsWith('data:image/')) saved = v;
    } catch (e) { /* private mode — the default face is fine */ }
    const fallback = defaultChaserTexture();
    if (!saved) {
      const note = $('bv-skin-note');
      if (note) note.textContent = 'Showing the built-in face. Upload a PNG in the game and it appears here.';
      return fallback;
    }
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const note = $('bv-skin-note');
      if (note) note.textContent = 'Showing your uploaded chaser skin.';
      if (onReady) onReady(tex);
    };
    return fallback;
  }

  const dimsEl = $('bv-dims');
  /**
   * Bounds over the meshes you can actually see. Box3.setFromObject does not
   * skip invisible ones, and Entity 96 carries a metre-long beam cylinder that
   * is hidden almost always — measure that and the eye reads as standing half a
   * metre into the floor.
   */
  function visibleBounds(root) {
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (o.isMesh && o.visible) box.union(new THREE.Box3().setFromObject(o));
    });
    return box;
  }

  function frameModel() {
    turntable.updateMatrixWorld(true);
    const box = visibleBounds(current.group);
    const size = box.getSize(new THREE.Vector3());
    controls.target.set(HOME.x, Math.max(0.9, size.y * 0.5), HOME.z);
    // Kept deliberately tight: the room is about twelve metres across, and a
    // "nicely framed" camera that backs out of it ends up inside the wallpaper.
    const dir = new THREE.Vector3(0.85, 0.32, 1.15).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, Math.max(size.y, 2) * 1.2 + 1);
    controls.update();
    if (dimsEl) {
      dimsEl.textContent = `${size.y.toFixed(2)} m tall · ${size.x.toFixed(2)} m wide · `
        + `${(size.y / 1.7).toFixed(1)}× your height`;
    }
  }

  /** Render the info card straight out of the live tuning blocks. */
  function renderInfo(kind) {
    const info = ENTITY_INFO[kind];
    const el = $('bv-info');
    if (!el || !info) return;
    const bars = info.stats.map((st) => {
      const pct = Math.round(4 + Math.max(0, Math.min(1, st.bar)) * 96);
      return `<div class="bv-stat-row"><span class="bv-stat-k"></span>`
        + `<span class="bv-stat-bar"><i style="width:${pct}%"></i></span>`
        + `<span class="bv-stat-v"></span></div>`;
    }).join('');
    el.innerHTML = `<div class="bv-h">Dossier</div>`
      + `<h2 class="bv-name"></h2><p class="bv-tag"></p>`
      + `<p class="bv-blurb"></p>`
      + `<p class="bv-line"><b>Senses</b> <span class="bv-senses"></span></p>`
      + `<p class="bv-line"><b>How you survive it</b> <span class="bv-counter"></span></p>`
      + `<div class="bv-h bv-h2">Numbers the game actually uses</div>${bars}`
      + `<p class="bv-src">Source: <a class="bv-srclink" target="_blank" rel="noopener noreferrer nofollow"></a></p>`;
    // Everything above is a fixed template; every value below is assigned as
    // TEXT, so nothing from the entity tables is ever parsed as markup.
    el.querySelector('.bv-name').textContent = info.label;
    el.querySelector('.bv-tag').textContent = info.tagline;
    el.querySelector('.bv-blurb').textContent = info.blurb;
    el.querySelector('.bv-senses').textContent = info.senses;
    el.querySelector('.bv-counter').textContent = info.counterplay;
    const rows = el.querySelectorAll('.bv-stat-row');
    info.stats.forEach((st, i) => {
      rows[i].querySelector('.bv-stat-k').textContent = st.k;
      rows[i].querySelector('.bv-stat-v').textContent = st.v;
    });
    const link = el.querySelector('.bv-srclink');
    link.textContent = info.origin;
    link.href = info.href;
  }

  function load(kind) {
    if (current) {
      turntable.remove(current.group);
      disposeTree(current.group);
      current = null;
    }
    currentKind = kind;
    if (kind === 'lifeform') {
      current = new Lifeform(bkLevel, bkCollider, rnd);
    } else if (kind === 'watcher') {
      current = new Entity96(bkLevel, bkCollider, rnd, irisTexture());
    } else {
      const tex = chaserTexture((live) => current?.setTexture?.(live));
      current = new PngChaser(bkLevel, bkCollider, tex, rnd, { mode: 'patrol' });
    }
    // The constructors park the entity on a cell; here it stands at the origin
    // of the turntable and stays there.
    current.pos.set(0, 0, 0);
    current.vel.set(0, 0, 0);
    current.heading = 0;
    current.group.position.set(0, 0, 0);
    current.group.rotation.set(0, 0, 0);
    turntable.rotation.y = 0;
    turntable.add(current.group);

    renderInfo(kind);
    applyWire();
    frameModel();
    // Show only the dials that mean something for this entity.
    const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? '' : 'none'; };
    show('bv-grp-chaser', kind === 'chaser');
    show('bv-grp-lifeform', kind === 'lifeform');
    show('bv-grp-watcher', kind === 'watcher');
    if (kind !== 'watcher') ghostMark.visible = false;
    document.querySelectorAll('[data-ent]').forEach((b) => b.classList.toggle('bv-active', b.dataset.ent === kind));
  }

  /** Presentation only — the AI is not running and never will be here. */
  function poseEntity(dt) {
    if (!current) return;
    if (currentKind === 'chaser') {
      // Billboard off by default: the turntable turning a flat plane edge-on is
      // the single most honest thing this page can show you about a nextbot.
      if (opts.billboard) current.present({ pos: camera.position });
      else current.sprite.rotation.y = 0;
      return;
    }
    if (currentKind === 'lifeform') {
      // animate() reads velocity for stride length, so the gait slider IS a
      // walking speed — the same relationship the game drives it with.
      current.vel.set(0, 0, opts.animate ? pose.gait * PLAYER_SPEEDS.WALK : 0);
      current.animate(dt);
      return;
    }
    // Entity 96: work the legs and bob, then charge the beam to wherever the
    // slider says. The gait slider doubles as its walking speed here, same as
    // for the Lifeform.
    if (opts.animate) {
      current.vel.set(0, 0, pose.gait * WATCHER.DRIFT_SPEED);
      current.animate(dt);
      current.hoverPhase += dt * 0.9;
    }
    current.group.position.y = Math.sin(current.hoverPhase) * 0.05;
    if (pose.charge > 0.001) {
      current.charge = pose.charge * current.chargeTime;
      // In game it turns to face what it is burning, in update(), which we do
      // not call. Do it here, and subtract the turntable's yaw so it holds its
      // target while the table spins — which is what tracking looks like.
      current.group.rotation.y = Math.atan2(ghost.pos.x - HOME.x, ghost.pos.z - HOME.z)
        - turntable.rotation.y;
      current.group.updateMatrixWorld(true);
      current.showBeam(ghost, pose.charge);
      // showBeam takes the beam's length from group.position, which is a world
      // position in the game but a turntable-local one here — so it comes out
      // as the distance from the level origin. Its orientation and midpoint go
      // through worldToLocal and are already right; only the length needs
      // redoing, against where the eye actually is.
      const eye = new THREE.Vector3(0, 1.85, 0).applyMatrix4(current.group.matrixWorld);
      current.beam.scale.y = eye.distanceTo(ghost.pos.clone().setY(ghost.eyeY));
      ghostMark.visible = true;
    } else {
      current.charge = 0;
      current.group.rotation.y = 0;
      current.hideBeam();
      ghostMark.visible = false;
    }
  }

  function applyBackdrop() {
    const inLevel = opts.backdrop === 'level0';
    bkWorld.group.visible = inLevel;
    level0.visible = inLevel;
    studio.visible = !inLevel;
    ground.visible = !inLevel;
    grid.visible = !inLevel && opts.grid;
    scene.background = new THREE.Color(inLevel ? 0x1a160b : 0x0d0f0c);
    scene.fog = inLevel ? new THREE.FogExp2(0x2b2410, 0.022) : null;
    const btn = $('bv-backdrop');
    if (btn) btn.textContent = inLevel ? 'Backdrop: Level 0' : 'Backdrop: Studio';
  }

  // ---- UI ----------------------------------------------------------------
  document.querySelectorAll('[data-ent]').forEach((b) => {
    b.addEventListener('click', () => load(b.dataset.ent));
  });
  const bindToggle = (id, key, after) => {
    const el = $(id);
    if (!el) return;
    el.checked = opts[key];
    el.addEventListener('change', () => {
      opts[key] = el.checked;
      if (after) after();
    });
  };
  bindToggle('bv-autorotate', 'autoRotate');
  bindToggle('bv-wire', 'wire', applyWire);
  bindToggle('bv-grid', 'grid', applyBackdrop);
  bindToggle('bv-animate', 'animate');
  bindToggle('bv-billboard', 'billboard');
  bindToggle('bv-scale', 'scale', () => { human.visible = opts.scale; });

  const bindSlider = (id, set) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => set(Number(el.value) / 100));
  };
  bindSlider('bv-gait', (v) => { pose.gait = v; });
  bindSlider('bv-gait2', (v) => { pose.gait = v; }); // Entity 96's own gait dial
  bindSlider('bv-charge', (v) => { pose.charge = v; });

  $('bv-backdrop')?.addEventListener('click', () => {
    opts.backdrop = opts.backdrop === 'level0' ? 'studio' : 'level0';
    applyBackdrop();
  });
  $('bv-reset')?.addEventListener('click', () => {
    pose.gait = 0.5;
    pose.charge = 0;
    ['bv-gait', 'bv-gait2'].forEach((id) => { const g = $(id); if (g) g.value = 50; });
    const c = $('bv-charge'); if (c) c.value = 0;
    load(currentKind);
  });

  // ---- Loop --------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (opts.autoRotate) turntable.rotation.y += dt * 0.32;
    poseEntity(dt);
    if (opts.backdrop === 'level0') {
      // Same fixture logic as the game, fed the camera instead of the player:
      // the tubes above whatever you are looking at are the ones that light it.
      updateFixtures(bkWorld.fixtures, lightPool, camera.position, now / 1000);
    }
    controls.update();
    renderer.render(scene, camera);
  }

  resize();
  applyBackdrop();
  load('chaser');
  requestAnimationFrame(tick);

  // Dev handle for scripted inspection, mirroring window.__pv on the plane
  // inspector: place the camera, switch entities, pose them.
  window.__bv = {
    THREE,
    camera,
    controls,
    scene,
    load,
    get entity() { return current; },
    get info() { return ENTITY_INFO; },
    pose,
    view(px, py, pz, tx = HOME.x, ty = 1.4, tz = HOME.z) {
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      controls.update();
    },
  };
})();
