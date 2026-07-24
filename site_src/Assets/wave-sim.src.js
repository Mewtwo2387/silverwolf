// ---- Wave Simulator ------------------------------------------------------
// A standalone ocean sandbox: a real Gerstner sea you can dial in live, with a
// small boat floating on it under actual buoyancy (no animation curves — the
// hull is pushed around by the water it's sitting in).
//
// The wave field lives in wave-field.js and drives BOTH the displaced water
// mesh (on the GPU) and the boat's buoyancy sampling (on the CPU) from the same
// numbers, so the boat can't drift out of sync with the surface you see.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  defaultParams, buildWaves, sampleHeight, waveUniforms, seaStats, WAVE_GLSL, GRAVITY,
} from './wave-field.js';

const canvas = document.getElementById('ws-canvas');
const errEl = document.getElementById('ws-error');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  if (errEl) errEl.style.display = 'flex';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 12000);
camera.position.set(18, 9, 26);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.5, 0);
controls.maxPolarAngle = Math.PI * 0.495; // don't let the camera go under the sea
controls.minDistance = 4;
controls.maxDistance = 500;

// ---- Sky + lighting -------------------------------------------------------
// One canvas gradient serves as both the visible sky dome and the environment
// map the water reflects, so the reflections always match the sky you can see.
const SKY = { top: '#1f4c86', mid: '#6ea3d6', haze: '#cfe0ec' };
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, SKY.top);
  g.addColorStop(0.55, SKY.mid);
  g.addColorStop(1, SKY.haze);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const skyTex = skyTexture();
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(6000, 32, 20),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
);
scene.add(skyDome);
const envTex = skyTexture();
envTex.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envTex;
scene.fog = new THREE.Fog(new THREE.Color(SKY.haze).getHex(), 220, 1900);

const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-90, 120, 70);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd8f2, 0x0d2430, 1.1));

// ---- Sea state ------------------------------------------------------------
const params = defaultParams();
let waves = buildWaves(params);
let simTime = 0;

// ---- Water ----------------------------------------------------------------
// A finely tessellated patch carries the Gerstner displacement; a flat sea
// fills in from the patch edge to the horizon. The flat sheet has a HOLE the
// exact size of the patch — without it, the sheet spans the whole world at a
// fixed height and every wave trough that dips below it gets covered by flat,
// untextured water (which is exactly what it looked like). The patch also
// tapers its displacement to zero at the rim, so it meets the flat sea flush
// instead of ending in a step.
const PATCH = 900; const PATCH_SEG = 560; // ~1.6 m cells
const waterUniforms = waveUniforms(waves);
waterUniforms.uWaveTime = { value: 0 };
waterUniforms.uAmpSum = { value: 1 }; // total amplitude, so foam keys on relative crest height
waterUniforms.uPatchHalf = { value: PATCH / 2 };

const normalMap = new THREE.TextureLoader().load('/static/planes/water-normal.jpg');
normalMap.wrapS = THREE.RepeatWrapping;
normalMap.wrapT = THREE.RepeatWrapping;
normalMap.repeat.set(42, 42);

const waterMat = new THREE.MeshStandardMaterial({
  color: 0x11384d,
  roughness: 0.14,
  metalness: 0.02,
  normalMap,
  normalScale: new THREE.Vector2(0.65, 0.65),
});
waterMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, waterUniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${WAVE_GLSL}\nuniform float uAmpSum;\nuniform float uPatchHalf;\nvarying float vFoamK;`)
    // Displace + rebuild the normal from the analytic Gerstner derivative.
    .replace('#include <beginnormal_vertex>', `
      vec3 gDisp; vec3 gNrm;
      gerstner(position.xz, gDisp, gNrm);
      // Settle the sea to dead flat at the patch rim so it meets the far sea
      // without a step (the far sea is a flat sheet at mean water level).
      float _m = max(abs(position.x), abs(position.z)) / uPatchHalf;
      float _fade = 1.0 - smoothstep(0.80, 0.995, _m);
      gDisp *= _fade;
      vec3 objectNormal = normalize(mix(vec3(0.0, 1.0, 0.0), gNrm, _fade));
      // Relative crest height (-1..1 over the whole wave stack) — only the
      // genuinely tall crests get spray, so foam never sheets over the sea.
      vFoamK = gDisp.y / max(0.001, uAmpSum);
    `)
    .replace('#include <begin_vertex>', 'vec3 transformed = position + gDisp;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFoamK;')
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float foam = smoothstep(0.66, 0.95, vFoamK);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.88, 0.93, 0.96), foam * 0.7);
    `);
};
const waterGeo = new THREE.PlaneGeometry(PATCH, PATCH, PATCH_SEG, PATCH_SEG);
waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, waterMat);
water.frustumCulled = false;
scene.add(water);

// Far sea: mean-level water from the patch rim out to the horizon, built as a
// sheet with a square hole so it can NEVER sit underneath (and punch through)
// the displaced patch. The hole is a metre inside the patch edge so the two
// overlap slightly and leave no hairline gap.
const FAR = 6000;
const holeHalf = PATCH / 2 - 1;
const farShape = new THREE.Shape();
farShape.moveTo(-FAR, -FAR); farShape.lineTo(FAR, -FAR); farShape.lineTo(FAR, FAR); farShape.lineTo(-FAR, FAR);
farShape.closePath();
const farHole = new THREE.Path();
farHole.moveTo(-holeHalf, -holeHalf); farHole.lineTo(-holeHalf, holeHalf);
farHole.lineTo(holeHalf, holeHalf); farHole.lineTo(holeHalf, -holeHalf);
farHole.closePath();
farShape.holes.push(farHole);
const farGeo = new THREE.ShapeGeometry(farShape);
farGeo.rotateX(-Math.PI / 2);
// ShapeGeometry lays UVs out in shape units (metres), so a small repeat gives
// a sane ripple tile on the distant water instead of leaving it plastic-flat.
// Loaded separately rather than cloned: a clone made before the image arrives
// never gets the loader's needsUpdate and would stay blank.
const farNormal = new THREE.TextureLoader().load('/static/planes/water-normal.jpg');
farNormal.wrapS = THREE.RepeatWrapping;
farNormal.wrapT = THREE.RepeatWrapping;
farNormal.repeat.set(1 / 14, 1 / 14);
const farSea = new THREE.Mesh(farGeo, new THREE.MeshStandardMaterial({
  color: 0x11384d, roughness: 0.18, metalness: 0.02, normalMap: farNormal, normalScale: new THREE.Vector2(0.4, 0.4),
}));
farSea.position.y = -0.06; // a touch under the patch rim: no coplanar z-fighting
scene.add(farSea);

// ---- Boat -----------------------------------------------------------------
// A little cabin launch: extruded hull (pointed bow, square transom), deck,
// cabin, mast. Built at ~8 m so a 30 m swell dwarfs it the way it should.
function buildBoat() {
  const g = new THREE.Group();
  const paintHull = new THREE.MeshStandardMaterial({ color: 0xd8dee4, roughness: 0.45, metalness: 0.1 });
  const paintBoot = new THREE.MeshStandardMaterial({ color: 0x8e2f28, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9d7745, roughness: 0.7 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xeef2f5, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x16323f, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.6 });

  const HB = 1.35; // half-beam
  const BOW = 4.2; const STERN = 3.4;
  const s = new THREE.Shape();
  s.moveTo(-HB, -STERN);
  s.lineTo(HB, -STERN);
  s.lineTo(HB, BOW - 2.6);
  s.quadraticCurveTo(HB, BOW, 0, BOW); // fine bow
  s.quadraticCurveTo(-HB, BOW, -HB, BOW - 2.6);
  s.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false });
  hullGeo.rotateX(-Math.PI / 2);
  hullGeo.translate(0, -0.75, 0); // waterline through the middle of the topsides
  const hull = new THREE.Mesh(hullGeo, paintHull);
  g.add(hull);

  // Red boot-topping band at the waterline.
  const bootGeo = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false });
  bootGeo.rotateX(-Math.PI / 2);
  bootGeo.scale(1.02, 1, 1.01);
  bootGeo.translate(0, -0.72, 0);
  g.add(new THREE.Mesh(bootGeo, paintBoot));

  // Deck + coaming.
  const deckGeo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.scale(0.94, 1, 0.97);
  deckGeo.translate(0, 0.75, 0);
  g.add(new THREE.Mesh(deckGeo, wood));

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 2.5), cabinMat);
  cabin.position.set(0, 1.35, -0.55); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 2.7), dark);
  roof.position.set(0, 1.98, -0.55); g.add(roof);
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.7), glass);
    win.position.set(sx * 0.97, 1.5, -0.55); g.add(win);
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), glass);
  front.position.set(0, 1.5, 0.73); g.add(front);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), dark);
  mast.position.set(0, 3.5, -0.55); g.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshStandardMaterial({
    color: 0xc23b2e, roughness: 0.8, side: THREE.DoubleSide,
  }));
  flag.position.set(0.36, 4.8, -0.55); g.add(flag);

  // Gunwale rail
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.045, 6, 24), dark);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(0, 0.86, 1.9);
  rail.scale.set(1.25, 1.0, 1);
  g.add(rail);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
const boat = buildBoat();
scene.add(boat);

// Buoyancy probes: points around the hull bottom. Each one contributes an
// upward force proportional to how deep it currently is under the surface, so
// heave, pitch and roll all fall out of the water shape — nothing is scripted.
const PROBES = [
  { x: 0, z: 3.6 }, { x: 0, z: -3.0 }, // bow / stern
  { x: 1.15, z: 1.3 }, { x: -1.15, z: 1.3 },
  { x: 1.15, z: -1.5 }, { x: -1.15, z: -1.5 },
];
const probeDots = new THREE.Group();
probeDots.visible = false;
scene.add(probeDots);
for (let i = 0; i < PROBES.length; i++) {
  const d = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, depthTest: false }),
  );
  d.renderOrder = 5;
  probeDots.add(d);
}

const boatState = {
  y: 0, vy: 0, pitch: 0, wPitch: 0, roll: 0, wRoll: 0,
  buoyancy: 5.6, // force per metre of submersion, per probe
  damping: 1.7, // linear drag
  angDamping: 2.2, // rotational drag
  mass: 1,
  enabled: true,
};
const _pw = new THREE.Vector3();

function stepBoat(dt) {
  if (!boatState.enabled) return;
  const n = PROBES.length;
  let fy = -GRAVITY * boatState.mass;
  let tPitch = 0; let tRoll = 0;
  const sp = Math.sin(boatState.pitch); const sr = Math.sin(boatState.roll);
  for (let i = 0; i < n; i++) {
    const p = PROBES[i];
    // Probe height under the current attitude (small-angle: bow rises with
    // +pitch, starboard rises with +roll).
    const py = boatState.y + (-p.z * sp) + (p.x * sr);
    const surf = sampleHeight(waves, p.x, p.z, simTime);
    const sub = Math.max(0, surf - py);
    const f = boatState.buoyancy * sub;
    fy += f;
    tPitch += -p.z * f;
    tRoll += p.x * f;
    if (probeDots.visible) {
      _pw.set(p.x, surf, p.z);
      probeDots.children[i].position.copy(_pw);
    }
  }
  // Integrate (semi-implicit Euler) with drag.
  boatState.vy += (fy / boatState.mass) * dt;
  boatState.vy -= boatState.vy * Math.min(1, boatState.damping * dt);
  boatState.y += boatState.vy * dt;

  const inertia = 6;
  boatState.wPitch += (tPitch / inertia) * dt;
  boatState.wPitch -= boatState.wPitch * Math.min(1, boatState.angDamping * dt);
  boatState.pitch = THREE.MathUtils.clamp(boatState.pitch + boatState.wPitch * dt, -0.9, 0.9);

  boatState.wRoll += (tRoll / inertia) * dt;
  boatState.wRoll -= boatState.wRoll * Math.min(1, boatState.angDamping * dt);
  boatState.roll = THREE.MathUtils.clamp(boatState.roll + boatState.wRoll * dt, -0.9, 0.9);

  boat.position.y = boatState.y;
  boat.rotation.set(boatState.pitch, 0, boatState.roll);
}

// ---- UI -------------------------------------------------------------------
const el = (id) => document.getElementById(id);
const readout = {
  hs: el('ws-hs'), period: el('ws-period'), speed: el('ws-speed'), len: el('ws-len'), fps: el('ws-fps'),
};

function rebuildWaves() {
  waves = buildWaves(params);
  waveUniforms(waves, waterUniforms);
  let ampSum = 0;
  for (const w of waves) ampSum += w.amp;
  waterUniforms.uAmpSum.value = Math.max(0.001, ampSum);
  const st = seaStats(waves);
  if (readout.hs) readout.hs.textContent = `${st.hs.toFixed(2)} m`;
  if (readout.period) readout.period.textContent = `${st.period.toFixed(1)} s`;
  if (readout.speed) readout.speed.textContent = `${st.speed.toFixed(1)} m/s`;
  if (readout.len) readout.len.textContent = `${st.length.toFixed(0)} m`;
}

// Wire a slider to a params key, with a live value label. Registered so a
// preset can push new values back into every control in one call.
const seaSliders = [];
function slider(id, key, fmt) {
  const input = el(id);
  const out = el(`${id}-v`);
  if (!input) return;
  const apply = () => {
    params[key] = parseFloat(input.value);
    if (out) out.textContent = fmt(params[key]);
    rebuildWaves();
  };
  input.addEventListener('input', apply);
  input.value = params[key];
  seaSliders.push(() => { // pull the current params value back into the control
    input.value = params[key];
    if (out) out.textContent = fmt(params[key]);
  });
  apply();
}
slider('ws-amp', 'amplitude', (v) => `${v.toFixed(2)} m`);
slider('ws-len-s', 'length', (v) => `${v.toFixed(0)} m`);
slider('ws-steep', 'steepness', (v) => v.toFixed(2));
slider('ws-count', 'count', (v) => String(Math.round(v)));
slider('ws-wind', 'windDeg', (v) => `${v.toFixed(0)}°`);
slider('ws-spread', 'spreadDeg', (v) => `${v.toFixed(0)}°`);
slider('ws-falloff', 'falloff', (v) => v.toFixed(2));
slider('ws-time', 'timeScale', (v) => `${v.toFixed(2)}×`);
const syncSeaSliders = () => { for (const f of seaSliders) f(); };

function boatSlider(id, key, fmt) {
  const input = el(id); const out = el(`${id}-v`);
  if (!input) return;
  const apply = () => {
    boatState[key] = parseFloat(input.value);
    if (out) out.textContent = fmt(boatState[key]);
  };
  input.addEventListener('input', apply);
  input.value = boatState[key];
  apply();
}
boatSlider('ws-buoy', 'buoyancy', (v) => v.toFixed(1));
boatSlider('ws-drag', 'damping', (v) => v.toFixed(2));
boatSlider('ws-adrag', 'angDamping', (v) => v.toFixed(2));

const toggle = (id, fn, initial) => {
  const c = el(id);
  if (!c) return;
  c.checked = initial;
  c.addEventListener('change', () => fn(c.checked));
  fn(initial);
};
toggle('ws-wire', (on) => { waterMat.wireframe = on; }, false);
toggle('ws-boat', (on) => { boat.visible = on; boatState.enabled = on; }, true);
toggle('ws-probes', (on) => { probeDots.visible = on; }, false);
toggle('ws-detail', (on) => {
  waterMat.normalScale.set(on ? 0.65 : 0, on ? 0.65 : 0);
  waterMat.needsUpdate = true;
}, true);
toggle('ws-orbit', (on) => { controls.autoRotate = on; }, false);
controls.autoRotateSpeed = 0.5;

// Sea-state presets — the quick way to see the range.
const PRESETS = {
  calm: {
    count: 4, amplitude: 0.16, length: 18, steepness: 0.35, windDeg: 20, spreadDeg: 30, falloff: 0.62,
  },
  swell: {
    count: 4, amplitude: 1.2, length: 62, steepness: 0.55, windDeg: 35, spreadDeg: 22, falloff: 0.6,
  },
  chop: {
    count: 6, amplitude: 0.55, length: 14, steepness: 0.85, windDeg: 70, spreadDeg: 70, falloff: 0.72,
  },
  storm: {
    count: 6, amplitude: 2.6, length: 78, steepness: 0.88, windDeg: 40, spreadDeg: 55, falloff: 0.7,
  },
};
for (const btn of document.querySelectorAll('[data-preset]')) {
  btn.addEventListener('click', () => {
    Object.assign(params, PRESETS[btn.dataset.preset] || {});
    syncSeaSliders(); // push the preset back into every control + label
    rebuildWaves();
    for (const b of document.querySelectorAll('[data-preset]')) b.classList.toggle('active', b === btn);
  });
}

// ---- Loop -----------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
rebuildWaves();

let last = performance.now();
let fpsN = 0; let fpsT = last;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simTime += dt * params.timeScale;
  waterUniforms.uWaveTime.value = simTime;
  // Scroll the fine normal detail downwind so the surface texture moves with
  // the sea rather than sitting still on top of it.
  const wd = (params.windDeg * Math.PI) / 180;
  normalMap.offset.set(Math.sin(wd) * simTime * 0.004, Math.cos(wd) * simTime * 0.004);
  stepBoat(dt);
  controls.update();
  renderer.render(scene, camera);

  fpsN++;
  if (now - fpsT >= 500) {
    if (readout.fps) readout.fps.textContent = `${Math.round((fpsN * 1000) / (now - fpsT))}`;
    fpsN = 0; fpsT = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev/tooling handle — lets the harness read the sea state and drive params.
window.__wave = {
  params,
  get waves() { return waves; },
  stats: () => seaStats(waves),
  boat: boatState,
  set(k, v) { params[k] = v; rebuildWaves(); },
  heightAt: (x, z) => sampleHeight(waves, x, z, simTime),
  // Drive the sim deterministically (tooling: the buoyancy needs real frames to
  // settle, which a throttled preview can't provide). freezeWaves holds the sea
  // still so you can watch the hull converge onto a fixed surface.
  step(dt = 1 / 60, n = 1, freezeWaves = false) {
    for (let i = 0; i < n; i++) {
      if (!freezeWaves) { simTime += dt * params.timeScale; waterUniforms.uWaveTime.value = simTime; }
      stepBoat(dt);
    }
    return {
      y: +boatState.y.toFixed(3),
      surf: +sampleHeight(waves, 0, 0, simTime).toFixed(3),
      pitchDeg: +((boatState.pitch * 180) / Math.PI).toFixed(2),
      rollDeg: +((boatState.roll * 180) / Math.PI).toFixed(2),
    };
  },
  camera,
  renderer,
  scene,
};
