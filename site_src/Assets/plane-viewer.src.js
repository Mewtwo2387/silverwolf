// Plane Sim — Model Inspector. A standalone turntable viewer for the Plane Sim
// assets, so the models can be examined and iterated on outside the game. It
// imports the SAME builders the game uses (plane-sim-models.js), so what you see
// here is exactly what flies. Orbit/zoom/pan, toggle wireframe, deflect the
// control surfaces, retract the gear, and export the model to .glb / .obj (for
// Blender or any glTF viewer) or grab a .png screenshot.
//
// Bundled to a self-hosted /static/plane-viewer.js (CSP is script-src 'self').
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import {
  buildAircraft, makeTree, makeHangar, makeControlTower, applyControlSurfaces,
  makeWindsock, makeFuelTank, makeBowser, makeNissenHut, PLANE_INFO, planeSpecs,
  makeCarrier, mountWingBombs, BOMBER_INFO, makeBomb,
} from './plane-sim-models.js';

(() => {
  'use strict';

  const LIVERIES = {
    original: { label: 'Original' },
    desert: { label: 'Desert Camo' },
    winter: { label: 'Winter Camo' },
    special: {
      spitfire: { label: 'D-Day Stripes' },
      p51: { label: 'Red Tails' },
      zero: { label: 'Late-War Green' },
      bomber: { label: 'Silver Metal' },
    },
  };
  const LIVERY_KEYS = ['original', 'desert', 'winter', 'special'];

  const canvas = document.getElementById('pv-canvas');
  if (!canvas) return;

  let renderer;
  try {
    // preserveDrawingBuffer lets us read pixels back for the PNG export.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  } catch (e) {
    const ov = document.getElementById('pv-error');
    if (ov) ov.style.display = 'flex';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated (aliases to PCF, but warns every frame)

  const scene = new THREE.Scene();
  const BG = { dark: 0x10141c, light: 0xdfe6ee };
  let bgMode = 'dark';
  scene.background = new THREE.Color(BG[bgMode]);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
  camera.position.set(9, 5, 12);

  // ---- Studio lighting: key (shadow) + fill + rim + hemisphere ----
  const key = new THREE.DirectionalLight(0xfff2da, 2.6);
  key.position.set(8, 14, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.5;
  {
    const sc = key.shadow.camera;
    sc.near = 0.5; sc.far = 80; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12;
    sc.updateProjectionMatrix();
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.7);
  fill.position.set(-8, 5, -3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, 4, -10);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x35402c, 0.7));

  // ---- Floor: an opaque ground that receives the shadow, plus a grid overlay. ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  let grid = new THREE.GridHelper(80, 80, 0x3a5670, 0x243245);
  grid.position.y = 0.01;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1;
  controls.maxDistance = 200;
  controls.target.set(0, 1.5, 0);

  // The model hangs under a turntable group so auto-rotate spins it without
  // touching the model's own transform (keeps exports clean).
  const turntable = new THREE.Group();
  scene.add(turntable);

  // ---- State ----
  let current = null; // current model root
  let currentSurf = null; // control-surface handles (aircraft only)
  let currentPlaneType = null; // airframe key while an aircraft is loaded
  let currentBombs = []; // wing bombs, when the "Wing bombs" toggle is on
  let modelName = 'model';
  const opts = {
    wire: false, autoRotate: true, spinProp: true, grid: true, bombs: false,
  };
  const surfState = {
    ail: 0, elev: 0, rud: 0, gear: 1,
  };

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.()); else m?.dispose?.();
      }
    });
  }

  const dimsEl = document.getElementById('pv-dims');
  function frame(modelGroup, { sitOnGround }) {
    // load() just reset the turntable's yaw, but its matrixWorld is still the
    // one from the last rendered frame — and Box3.setFromObject refreshes the
    // object's descendants, NOT its parents. Update the chain first, or the
    // bbox is taken mid-spin and span/length come out as diagonals.
    (modelGroup.parent || modelGroup).updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(modelGroup);
    if (sitOnGround) {
      modelGroup.position.y -= box.min.y; // rest the lowest point on the floor
      box = new THREE.Box3().setFromObject(modelGroup);
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    controls.target.copy(center);
    const dir = new THREE.Vector3(1, 0.55, 1.25).normalize();
    camera.position.copy(center).addScaledVector(dir, maxDim * 1.7 + 2);
    controls.update();
    if (dimsEl) {
      dimsEl.textContent = `span ${size.x.toFixed(1)} m · length ${size.z.toFixed(1)} m · height ${size.y.toFixed(1)} m`;
    }
  }

  function applyWire() {
    if (!current) return;
    current.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m) m.wireframe = opts.wire; });
    });
  }

  // Spec sheet for the currently-loaded aircraft: the same numbers the game
  // flies (PLANE_INFO / planeSpecs), rendered as a top-speed + hull readout and
  // a row of comparative rating bars. Hidden for scenery models.
  const statsEl = document.getElementById('pv-stats');
  function renderStats(planeType) {
    if (!statsEl) return;
    if (!planeType) { statsEl.style.display = 'none'; statsEl.innerHTML = ''; return; }
    if (planeType === 'bomber') {
      // Enemy-only airframe: not in the fighter catalogue (its ratings would
      // skew the comparative bars), so it gets a plain spec card.
      const s = BOMBER_INFO.stats;
      const top = Math.round(Math.sqrt(s.thrust / s.drag0) * 1.94384);
      statsEl.style.display = 'block';
      statsEl.innerHTML = `<div class="pv-h">${BOMBER_INFO.label} — flight stats</div>`
        + `<p class="pv-stat-desc">${BOMBER_INFO.desc} Flown by the raiders on the City map — the "Bombs" toggle opens the bay.</p>`
        + `<div class="pv-stat-nums"><span><b>${top}</b> kn top</span>`
        + `<span><b>4</b> engines</span><span><b>4</b> bombs</span></div>`;
      return;
    }
    const info = PLANE_INFO[planeType];
    const spec = planeSpecs(planeType);
    const bars = Object.entries(spec.ratings).map(([k, v]) => {
      const pct = Math.round(8 + v * 92); // never a bare empty bar
      return `<div class="pv-stat-row"><span class="pv-stat-k">${k}</span>`
        + `<span class="pv-stat-bar"><i style="width:${pct}%"></i></span></div>`;
    }).join('');
    statsEl.style.display = 'block';
    statsEl.innerHTML = `<div class="pv-h">${info.label} — flight stats</div>`
      + `<p class="pv-stat-desc">${info.desc}</p>`
      + `<div class="pv-stat-nums"><span><b>${spec.topSpeedKn}</b> kn top</span>`
      + `<span><b>${spec.hp}</b> hull</span></div>${bars}`;
  }

  // Add/remove the bombs on the loaded aircraft to match the toggle. Fighters
  // hang them under the wings; the bomber racks four in the bay and swings the
  // bay doors open so you can see them.
  function applyBombs() {
    for (const b of currentBombs) { b.parent?.remove(b); disposeTree(b); }
    currentBombs = [];
    if (currentPlaneType === 'bomber' && currentSurf) {
      const swing = opts.bombs ? 1.25 : 0;
      if (currentSurf.bayL) currentSurf.bayL.rotation.z = -swing;
      if (currentSurf.bayR) currentSurf.bayR.rotation.z = swing;
      if (opts.bombs && current) {
        const bay = BOMBER_INFO.dims.bay;
        for (let i = 0; i < 4; i++) {
          const bm = makeBomb();
          bm.scale.setScalar(0.9);
          bm.position.set(((i % 2) ? 0.5 : -0.5), bay[1] + 0.25, bay[2] + 0.6 + Math.floor(i / 2) * 2.0);
          current.add(bm);
          currentBombs.push(bm);
        }
      }
      return;
    }
    if (opts.bombs && currentPlaneType && current) {
      currentBombs = mountWingBombs(current, currentPlaneType);
    }
  }

  function load(kind) {
    if (current) { turntable.remove(current); disposeTree(current); current = null; currentSurf = null; }
    currentBombs = [];
    let sitOnGround = true;
    let planeType = null;
    if (kind === 'aircraft' || kind === 'p51' || kind === 'zero' || kind === 'bomber') {
      planeType = kind === 'aircraft' ? 'spitfire' : kind;
      const skin = localStorage.getItem(`ps-skin-${planeType}`) || 'original';
      const a = buildAircraft({ type: planeType, gearDown: true, skin });
      current = a.group; currentSurf = a.surf; modelName = `plane-sim-${planeType}`;
    } else if (kind === 'carrier') {
      current = makeCarrier().group; modelName = 'plane-sim-carrier'; sitOnGround = false;
    } else if (kind === 'tree') {
      current = makeTree(); modelName = 'plane-sim-tree';
    } else if (kind === 'hangar') {
      current = makeHangar(); modelName = 'plane-sim-hangar'; sitOnGround = false; // base already at y=0
    } else if (kind === 'windsock') {
      current = makeWindsock(); modelName = 'plane-sim-windsock';
    } else if (kind === 'fueltank') {
      current = makeFuelTank(); modelName = 'plane-sim-fuel-tank'; sitOnGround = false;
    } else if (kind === 'bowser') {
      current = makeBowser(); modelName = 'plane-sim-bowser';
    } else if (kind === 'nissen') {
      current = makeNissenHut(); modelName = 'plane-sim-nissen-hut'; sitOnGround = false;
    } else {
      current = makeControlTower(); modelName = 'plane-sim-control-tower';
    }
    currentPlaneType = planeType;
    renderStats(planeType);
    turntable.rotation.y = 0;
    turntable.add(current);
    if (currentSurf) applyControlSurfaces(currentSurf, surfState);
    applyBombs();
    applyWire();
    frame(current, { sitOnGround });

    // Livery group UI handling
    const liveryGroup = document.getElementById('pv-livery-group');
    if (liveryGroup) {
      if (planeType) {
        liveryGroup.style.display = 'block';
        const skin = localStorage.getItem(`ps-skin-${planeType}`) || 'original';
        const nameEl = document.getElementById('pv-livery-name');
        const previewEl = document.getElementById('pv-livery-preview');
        const label = skin === 'special' ? LIVERIES.special[planeType].label : LIVERIES[skin].label;
        if (nameEl) nameEl.textContent = label;
        if (previewEl) previewEl.style.backgroundImage = `url('/static/planes/${planeType}-${skin}-preview.jpg')`;
      } else {
        liveryGroup.style.display = 'none';
      }
    }

    // Show the control-surface panel only for the aircraft.
    const panel = document.getElementById('pv-surfaces');
    if (panel) panel.style.display = currentSurf ? '' : 'none';
    // Reflect active model button.
    document.querySelectorAll('[data-model]').forEach((b) => b.classList.toggle('active', b.dataset.model === kind));
  }

  // ---- Exports ----
  function downloadBlob(data, filename, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function exportGLB() {
    if (!current) return;
    new GLTFExporter().parse(
      current,
      (result) => downloadBlob(result, `${modelName}.glb`, 'model/gltf-binary'),
      (err) => console.error('GLB export failed', err),
      { binary: true },
    );
  }
  function exportOBJ() {
    if (!current) return;
    downloadBlob(new OBJExporter().parse(current), `${modelName}.obj`, 'text/plain');
  }
  function exportPNG() {
    renderer.render(scene, camera); // ensure the buffer is fresh
    canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${modelName}.png`, 'image/png'); }, 'image/png');
  }

  // ---- UI wiring ----
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', () => load(b.dataset.model)));

  $('pv-livery-toggle')?.addEventListener('click', () => {
    if (!currentPlaneType) return;
    const currentSkin = localStorage.getItem(`ps-skin-${currentPlaneType}`) || 'original';
    const nextIdx = (LIVERY_KEYS.indexOf(currentSkin) + 1) % LIVERY_KEYS.length;
    const nextSkin = LIVERY_KEYS[nextIdx];
    localStorage.setItem(`ps-skin-${currentPlaneType}`, nextSkin);

    const activeBtn = document.querySelector('[data-model].active');
    const kind = activeBtn ? activeBtn.dataset.model : 'aircraft';
    load(kind);
  });

  const bindToggle = (id, key, after) => {
    const el = $(id);
    if (!el) return;
    el.checked = opts[key];
    el.addEventListener('change', () => { opts[key] = el.checked; if (after) after(); });
  };
  bindToggle('pv-wire', 'wire', () => { applyWire(); });
  bindToggle('pv-autorotate', 'autoRotate');
  bindToggle('pv-spin', 'spinProp');
  bindToggle('pv-grid', 'grid', () => { grid.visible = opts.grid; });
  bindToggle('pv-bombs', 'bombs', () => { applyBombs(); applyWire(); });

  const bindSlider = (id, key, scale) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => { surfState[key] = (+el.value) * scale; });
  };
  bindSlider('pv-ail', 'ail', 0.01); // -40..40 -> -0.4..0.4
  bindSlider('pv-elev', 'elev', 0.01);
  bindSlider('pv-rud', 'rud', 0.01);
  bindSlider('pv-gear', 'gear', 0.01); // 0..100 -> 0..1

  $('pv-reset')?.addEventListener('click', () => {
    surfState.ail = 0; surfState.elev = 0; surfState.rud = 0; surfState.gear = 1;
    ['pv-ail', 'pv-elev', 'pv-rud'].forEach((id) => { const el = $(id); if (el) el.value = 0; });
    const g = $('pv-gear'); if (g) g.value = 100;
    const active = document.querySelector('[data-model].active');
    load(active ? active.dataset.model : 'aircraft');
  });
  $('pv-glb')?.addEventListener('click', exportGLB);
  $('pv-obj')?.addEventListener('click', exportOBJ);
  $('pv-png')?.addEventListener('click', exportPNG);
  $('pv-bg')?.addEventListener('click', () => {
    bgMode = bgMode === 'dark' ? 'light' : 'dark';
    scene.background = new THREE.Color(BG[bgMode]);
    groundMat.color.set(bgMode === 'dark' ? 0x1a2230 : 0xb8c2cc);
    const btn = $('pv-bg'); if (btn) btn.textContent = bgMode === 'dark' ? 'BG: Dark' : 'BG: Light';
  });

  // ---- Loop ----
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
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (opts.autoRotate) turntable.rotation.y += dt * 0.35;
    if (currentSurf) {
      applyControlSurfaces(currentSurf, surfState);
      if (opts.spinProp && currentSurf.prop) {
        currentSurf.prop.rotation.z -= dt * 24;
        // the bomber's other three engines turn with #1
        for (const p of currentSurf.propSlaves || []) p.rotation.z = currentSurf.prop.rotation.z;
      }
    }
    if (current && current.userData.flutter) current.userData.flutter(now / 1000); // windsock
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  resize();
  load('aircraft');
  requestAnimationFrame(tick);

  // Dev handle for scripted inspection (harness/tooling): position the camera,
  // aim at a spot, switch models — without simulating mouse orbits.
  window.__pv = {
    THREE,
    camera,
    controls,
    scene,
    load,
    view(px, py, pz, tx = 0, ty = 1, tz = 0) {
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      controls.update();
    },
  };
})();
