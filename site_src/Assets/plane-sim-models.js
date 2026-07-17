// Shared 3D model builders for Plane Sim. This is the SINGLE SOURCE OF TRUTH for
// the geometry: both the game (plane-sim.src.js) and the standalone model
// inspector (plane-viewer.src.js) import these, so what you inspect is exactly
// what flies. Each builder returns a THREE.Group at the origin; callers position
// it. Local forward is -Z, Y is up, units are metres.
import * as THREE from 'three';
import { REF_P51_PARTS, REF_ZERO_PARTS, REF_SPIT_PARTS } from './plane-sim-refmeshes.js';
import { GFX, loadSceneryTexture } from './plane-sim-quality.js';

const setShadows = (obj) => obj.traverse((o) => {
  if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
});

// Propeller assembly shared by every aircraft type: an ogive spinner (lathe of
// `spinnerProfile` [r, y] pairs, +y toward the nose), a backplate, `count`
// paddle blades with real washout twist (coarse pitch at the root easing off
// toward the tip) and coloured tip bands via vertex colours, plus a translucent
// "blur disc" the game fades in with RPM (setPropBlur). Returns { prop, blades,
// propDisc } — add `prop` to the plane, keep the rest as animation handles.
function makePropAssembly({
  spinnerProfile, spinnerColor, backplateR, zSpinner, zBlades,
  count, bladeLen, bladeWidth = 1, bladeColor, tipColor, rootY = 0.28, discR,
  spinner = true, // false = blades/disc only (the airframe mesh has its own spinner)
}) {
  const prop = new THREE.Group();
  if (spinner) {
    const spinMat = new THREE.MeshStandardMaterial({ color: spinnerColor, roughness: 0.45, metalness: 0.15 });
    const profile = spinnerProfile.map(([r, y]) => new THREE.Vector2(r, y));
    const spin = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), spinMat);
    spin.rotation.x = -Math.PI / 2; // lathe +Y (the nose) -> -Z
    spin.position.z = zSpinner;
    prop.add(spin);
    const backplate = new THREE.Mesh(new THREE.CylinderGeometry(backplateR, backplateR, 0.16, 20), spinMat);
    backplate.rotation.x = Math.PI / 2;
    backplate.position.z = zSpinner + 0.03;
    prop.add(backplate);
  }

  // One shared blade geometry: paddle planform extruded thin, then a vertex
  // pass adds the twist and paints the tip band via vertex colours. The paddle
  // outline scales with bladeLen; bladeWidth broadens it (P-51 paddle blades).
  const L = bladeLen; const W = bladeWidth;
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.05 * W, 0);
  bladeShape.lineTo(0.05 * W, 0);
  bladeShape.quadraticCurveTo(0.105 * W, L * 0.333, 0.09 * W, L * 0.633); // widening paddle
  bladeShape.quadraticCurveTo(0.08 * W, L * 0.907, 0, L); // rounded tip
  bladeShape.quadraticCurveTo(-0.08 * W, L * 0.907, -0.09 * W, L * 0.633);
  bladeShape.quadraticCurveTo(-0.105 * W, L * 0.333, -0.05 * W, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.045, bevelEnabled: false });
  bladeGeo.translate(0, 0, -0.0225);
  const bpos = bladeGeo.attributes.position;
  const bcols = new Float32Array(bpos.count * 3);
  const cBlade = new THREE.Color(bladeColor);
  const cTip = new THREE.Color(tipColor);
  for (let i = 0; i < bpos.count; i++) {
    const t = Math.min(Math.max(bpos.getY(i) / L, 0), 1);
    const ang = 0.55 - 0.38 * t; // washout: ~32 deg at the root -> ~10 deg at the tip
    const x = bpos.getX(i); const z = bpos.getZ(i);
    bpos.setX(i, x * Math.cos(ang) + z * Math.sin(ang));
    bpos.setZ(i, -x * Math.sin(ang) + z * Math.cos(ang));
    const cc = t > 0.86 ? cTip : cBlade;
    bcols[i * 3] = cc.r; bcols[i * 3 + 1] = cc.g; bcols[i * 3 + 2] = cc.b;
  }
  bladeGeo.setAttribute('color', new THREE.BufferAttribute(bcols, 3));
  bladeGeo.computeVertexNormals();
  const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
  const blades = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / count) * Math.PI * 2;
    arm.position.z = zBlades;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = rootY; // root buried in the spinner
    arm.add(blade);
    blades.add(arm);
  }
  prop.add(blades);
  // Blur disc (hidden by default; the game fades it in with RPM). The blades'
  // painted tips smear into a coloured ring at the tip-band radius, like the
  // real-life yellow warning circle a spinning prop shows.
  const discTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, 'rgba(30,30,34,0)');
    g.addColorStop(0.55, 'rgba(30,30,34,0.28)');
    g.addColorStop(0.92, 'rgba(30,30,34,0.34)');
    g.addColorStop(1, 'rgba(30,30,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    // tip ring: blades paint their outer 14% in tipColor (t > 0.86 above)
    const tc = new THREE.Color(tipColor);
    const rgb = `${Math.round(tc.r * 255)},${Math.round(tc.g * 255)},${Math.round(tc.b * 255)}`;
    const t0 = Math.min(1, (rootY + L * 0.86) / discR);
    const t1 = Math.min(1, (rootY + L) / discR);
    const g2 = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g2.addColorStop(Math.max(0, t0 - 0.04), `rgba(${rgb},0)`);
    g2.addColorStop(t0, `rgba(${rgb},0.62)`);
    g2.addColorStop(t1 - 0.02, `rgba(${rgb},0.62)`);
    g2.addColorStop(t1, `rgba(${rgb},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const propDisc = new THREE.Mesh(
    new THREE.CircleGeometry(discR, 28),
    new THREE.MeshBasicMaterial({
      map: discTex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  propDisc.position.z = zBlades;
  propDisc.renderOrder = 9; // above the transparent water plane, like the stunt rings
  propDisc.visible = false;
  prop.add(propDisc);
  return { prop, blades, propDisc };
}

// Undercarriage shared by every aircraft type: two main gear + tailwheel on
// retract pivots. Wheel bottoms sit at y = -groundY (default 1.35; the game
// parks the aircraft origin that high) so a level aircraft rests cleanly on
// the deck. `attachY` sinks the leg pivots to the wing's underside so struts
// emerge from the wing instead of poking above it; legs shorten to match.
// Each leg is a proper oleo assembly: upper strut + polished piston, scissor
// (torque) link, a leg-mounted well door, and a torus tyre on a hub. All gear
// materials are transparent so applyControlSurfaces can fade the whole thing
// into the wing at the end of the retract (there are no wheel wells to
// swallow it — fading beats clipping through the skin).
// `stance` (radians) is the taildragger ground angle: the tailwheel gear is
// shortened so that with the aircraft pitched nose-up by `stance`, the main
// wheels and the tailwheel touch the deck together (main gear reads taller
// than the tail gear, as on the real aircraft). The game parks and taxis the
// aircraft at that pitch; the wheel-bottom maths lives in restHeight() below.
function makeUndercarriage(metal, tailZ = 4.5, mainZ = -1.0, groundY = 1.35, attachY = 0, doorColor = 0x8f959c, stance = 0) {
  const gear = new THREE.Group();
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.9 });
  const pistonMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.25, metalness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x6e747c, roughness: 0.45, metalness: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.6, metalness: 0.15 });
  const mats = [metal, tyreMat, pistonMat, hubMat, doorMat];
  for (const m of mats) m.transparent = true;
  gear.userData.mats = mats;
  const legDrop = groundY + attachY; // pivot down to the wheel's bottom
  const wheelR = 0.42;
  const makeWheel = (r, w) => {
    const g = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(r - w / 2, w / 2, 10, 22), tyreMat);
    tyre.rotation.y = Math.PI / 2; // axle along X
    g.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, w * 0.66, 14), hubMat);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    return g;
  };
  const leg = (sideX) => {
    const pivot = new THREE.Group();
    pivot.position.set(sideX * 1.45, attachY, mainZ); // wing underside, under the root
    const strutLen = legDrop - 0.36; // overlaps the wheel hub a touch
    // oleo: fatter upper barrel, slimmer polished piston sliding out of it
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, strutLen * 0.6, 10), metal);
    upper.position.y = -strutLen * 0.3;
    pivot.add(upper);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, strutLen * 0.55, 8), pistonMat);
    piston.position.y = -strutLen * 0.75;
    pivot.add(piston);
    // scissor link on the front face of the oleo (two hinged straps)
    for (const [i, tilt] of [0.6, -0.6].entries()) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.035), metal);
      strap.position.set(0, -strutLen * (0.52 + i * 0.14), -0.085);
      strap.rotation.x = tilt;
      pivot.add(strap);
    }
    // well door riding the leg, outboard of the strut (P-51/Spitfire style);
    // it covers the oleo down to the axle and stops above the tyre.
    const doorLen = strutLen + 0.18;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.035, doorLen, 0.4), doorMat);
    door.position.set(sideX * 0.15, -doorLen / 2 + 0.1, 0);
    pivot.add(door);
    // wheel sits slightly inboard of the leg on a stub axle
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), pistonMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(-sideX * 0.08, -legDrop + wheelR, 0);
    pivot.add(axle);
    const wheel = makeWheel(wheelR, 0.28);
    wheel.position.set(-sideX * 0.13, -legDrop + wheelR, 0); // bottom at -groundY (world)
    pivot.add(wheel);
    gear.userData[sideX < 0 ? 'left' : 'right'] = pivot;
    return pivot;
  };
  gear.add(leg(-1));
  gear.add(leg(1));
  // tailwheel: short oleo + fork straddling a small wheel. Its length is set
  // by the stance angle — bottom sits (tailZ - mainZ)·tan(stance) above the
  // main wheels' bottoms, so both touch when parked nose-up by `stance`.
  const tailG = groundY - (tailZ - mainZ) * Math.tan(stance);
  const tail = new THREE.Group();
  const tLen = Math.max(0.12, tailG - 0.25);
  const tstrut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, tLen, 8), metal);
  tstrut.position.y = -tLen / 2;
  tail.add(tstrut);
  for (const fx of [-0.085, 0.085]) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.14), metal);
    tine.position.set(fx, -tailG + 0.36, 0.02);
    tine.rotation.x = 0.25;
    tail.add(tine);
  }
  const twheel = makeWheel(0.21, 0.14);
  twheel.position.y = -tailG + 0.21; // bottom at -tailG (main-bottom + stance rise)
  tail.add(twheel);
  tail.position.set(0, 0, tailZ);
  gear.add(tail);
  gear.userData.tail = tail;
  return gear;
}

// Wingtip navigation lights: port red, starboard green.
function navLight(side, x, y, z) {
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({
      color: side < 0 ? 0xff3333 : 0x33ff55,
      emissive: side < 0 ? 0xcc1111 : 0x11cc33,
      emissiveIntensity: 1.4,
    }),
  );
  tip.position.set(x, y, z);
  return tip;
}

// The seated pilot borrowed from the P-51 reference model (seat + torso,
// modelled head with face, goggles and helmet — parts VIFS25..VIFS30). The
// group keeps the P-51's cockpit coordinates (head around y 0.6, z -0.75);
// callers offset/scale it into their own cockpit. Geometry is built once and
// shared between every pilot instance.
const PILOT_IDS = new Set(['VIFS25', 'VIFS26', 'VIFS27', 'VIFS28', 'VIFS29', 'VIFS30']);
let pilotProto = null;
function makeRefPilot() {
  if (!pilotProto) {
    pilotProto = [];
    for (const part of REF_P51_PARTS) {
      if (!PILOT_IDS.has(part.id)) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      geo.setIndex(part.idx);
      geo.computeVertexNormals();
      pilotProto.push({ geo, color: part.color });
    }
  }
  const g = new THREE.Group();
  for (const { geo, color } of pilotProto) {
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide })));
  }
  return g;
}

// ---- Flyable-aircraft catalogue: label, blurb and the flight/gun/hull stat
//      block for each type. This is the SINGLE SOURCE OF TRUTH for the numbers
//      — the game (plane-sim.src.js) flies them and the inspector
//      (plane-viewer.src.js) shows them, so a tweak here changes both. Stats
//      are pure data (no CFG dependency): thrust/lift/drag0 set speed & climb,
//      pitch/roll rate + controlV set agility, hiSpeedStiff is the Zero's
//      dive-control freeze, and hp/guns set durability & firepower. ----
export const PLANE_INFO = {
  spitfire: {
    label: 'Spitfire',
    desc: 'The balanced dogfighter: superb turn & climb, eight .303s — a fast, light-hitting hose of bullets.',
    stats: {
      thrust: 38, lift: 0.0054, drag0: 0.0013, pitchRate: 1.6, rollRate: 3.4, controlV: 42, hiSpeedStiff: 0, groundY: 1.5,
      stance: 0.16, gearZ: -2.05, tailZ: 4.1, bomb: { x: 2.3, y: -0.62, z: -1.7 },
      hp: 100, fireInterval: 0.085, gunDmg: 3, gunSpread: 0.006, gunRange: 900,
    },
  },
  p51: {
    label: 'P-51 Mustang',
    desc: 'Fastest in a straight line and a dive, rugged airframe — but heavy: wide turns that want airspeed. Six .50 cals hit hard.',
    stats: {
      thrust: 40, lift: 0.0048, drag0: 0.00105, pitchRate: 1.35, rollRate: 3.0, controlV: 48, hiSpeedStiff: 0, groundY: 1.6,
      stance: 0.16, gearZ: -1.9, tailZ: 4.3, bomb: { x: 2.5, y: -0.58, z: -1.5 },
      hp: 115, fireInterval: 0.11, gunDmg: 5, gunSpread: 0.005, gunRange: 950,
    },
  },
  zero: {
    label: 'A6M Zero',
    desc: 'Untouchable in a slow turn fight and stalls last — but slow, unarmoured, and the controls stiffen in a dive. Two 20 mm cannon: slow to fire, savage on hit.',
    stats: {
      thrust: 33, lift: 0.0063, drag0: 0.00165, pitchRate: 2.0, rollRate: 3.8, controlV: 34, hiSpeedStiff: 0.45, groundY: 1.35,
      stance: 0.14, gearZ: -2.3, tailZ: 4.0, bomb: { x: 2.6, y: -0.5, z: -1.95 },
      hp: 70, fireInterval: 0.16, gunDmg: 8, gunSpread: 0.008, gunRange: 750,
    },
  },
};

// Height of the aircraft origin above the deck when the main wheels are on it
// at a given nose-up pitch (radians). At pitch 0 this is stats.groundY; as the
// nose rises the mains (ahead of the origin, at z = gearZ < 0) swing up and
// the origin sinks. Parked pitch is stats.stance, where the tailwheel touches
// too (its gear is built shorter by exactly that geometry — makeUndercarriage).
export function restHeight(stats, pitch) {
  return stats.groundY * Math.cos(pitch) + (stats.gearZ || 0) * Math.sin(pitch);
}

// Derive display-friendly ratings from a raw stat block, normalised [0,1]
// across the catalogue so the inspector can draw comparable bars, plus an
// approximate top speed in knots (at top speed thrust accel balances parasitic
// drag: v = sqrt(thrust / drag0)). Shared so the numbers can never drift from
// what actually flies.
export function planeSpecs(name) {
  const all = Object.values(PLANE_INFO).map((p) => p.stats);
  const span = (sel) => {
    const vals = all.map(sel);
    return [Math.min(...vals), Math.max(...vals)];
  };
  const norm = (v, [lo, hi]) => (hi === lo ? 1 : (v - lo) / (hi - lo));
  const s = PLANE_INFO[name].stats;
  const KTS = 1.94384;
  const dps = (x) => x.gunDmg / x.fireInterval;
  return {
    topSpeedKn: Math.round(Math.sqrt(s.thrust / s.drag0) * KTS),
    ratings: {
      Speed: norm(Math.sqrt(s.thrust / s.drag0), span((x) => Math.sqrt(x.thrust / x.drag0))),
      Turn: norm(s.pitchRate, span((x) => x.pitchRate)),
      Roll: norm(s.rollRate, span((x) => x.rollRate)),
      Toughness: norm(s.hp, span((x) => x.hp)),
      Firepower: norm(dps(s), span(dps)),
    },
    hp: s.hp,
  };
}

// ---- The aircraft builders. Each returns { group, surf }, where surf holds
//      the SAME animatable handles (control-surface pivots, prop, blades,
//      propDisc, gear) so applyControlSurfaces / setPropBlur drive any type.
//      opts.type picks the airframe ('spitfire' | 'p51' | 'zero'); opts.paint
//      switches to the bandit grey scheme and opts.markings === false drops
//      the national insignia. ----
export function buildAircraft(opts = {}) {
  if (opts.type === 'p51') return buildP51(opts);
  if (opts.type === 'zero') return buildZero(opts);
  return buildSpitfire(opts);
}

// ---- Reference-mesh fighters. All three airframes are real 3D reference
// models (converted offline into plane-sim-refmeshes.js + Assets/planes/
// textures, pre-transformed to game conventions: nose -Z, prop axis y=0).
// The game attaches whatever each reference lacks — the animated prop,
// retractable undercarriage, a pilot where the canopy is clear glass — and
// hinges the control surfaces that were carved out of the meshes offline
// (each animated part carries its pivot line as hinge:[y, z]). ----

const _refTexCache = {};
function refTexture(name) {
  if (!_refTexCache[name]) {
    // The aircraft skin sheets stay full-resolution on every tier — the player
    // plane fills the screen; halving it reads as mud, not "low".
    const tex = new THREE.TextureLoader().load(`/static/planes/${name}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.max(GFX.aniso, 8);
    _refTexCache[name] = tex;
  }
  return _refTexCache[name];
}

const _detailTexCache = {};
function detailTexture(name, repeat) {
  const key = `${name}_${repeat}`;
  if (!_detailTexCache[key]) {
    const tex = loadSceneryTexture(`/static/planes/${name}.jpg`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = GFX.aniso;
    _detailTexCache[key] = tex;
  }
  return _detailTexCache[key];
}

const _treeTexCache = {};
function treeTexture(name, repeatU, repeatV) {
  const key = `${name}_${repeatU}_${repeatV}`;
  if (!_treeTexCache[key]) {
    const tex = loadSceneryTexture(`/static/planes/${name}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatU, repeatV);
    tex.anisotropy = GFX.aniso;
    _treeTexCache[key] = tex;
  }
  return _treeTexCache[key];
}

function mergeGeometries(geos) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;
  for (const g of geos) {
    const posAttr = g.attributes.position;
    const normAttr = g.attributes.normal;
    const uvAttr = g.attributes.uv;
    const indexAttr = g.index;
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      if (uvAttr) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.array[i] + vertexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + vertexOffset);
      }
    }
    vertexOffset += posAttr.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

// Canopy silhouettes scale with the graphics tier: radial segments come from
// GFX (5 low / 7 medium / 10 high), the low tier drops the smallest lobes and
// the high tier adds extra ones for a fuller, more irregular crown.
export function makePineCanopyGeo() {
  const n = GFX.coneSegs;
  const parts = [
    (() => { const g = new THREE.ConeGeometry(2.0, 7.5, n); g.translate(0, 12, 0); return g; })(),
    (() => { const g = new THREE.ConeGeometry(1.6, 6.0, n); g.translate(0.4, 9.8, 0.3); return g; })(),
  ];
  if (GFX.canopyDetail >= 1) { const g = new THREE.ConeGeometry(1.5, 5.0, n); g.translate(-0.4, 8.5, -0.4); parts.push(g); }
  if (GFX.canopyDetail >= 2) { const g = new THREE.ConeGeometry(1.1, 4.2, n); g.translate(0.15, 7.6, -0.5); parts.push(g); }
  return mergeGeometries(parts);
}

export function makeBroadleafCanopyGeo() {
  const [w, h] = GFX.sphereSegs;
  const lobe = (r, x, y, z) => {
    const g = new THREE.SphereGeometry(r, w, h); g.scale(1, 0.85, 1); g.translate(x, y, z); return g;
  };
  const parts = [lobe(2.4, 0, 5.8, 0), lobe(1.8, 1.0, 5.4, 0.8), lobe(1.8, -1.0, 5.2, -0.8)];
  if (GFX.canopyDetail >= 1) parts.push(lobe(1.6, 0.8, 5.0, -1.0), lobe(1.5, -0.8, 5.5, 1.0), lobe(1.4, 0, 6.4, 0));
  if (GFX.canopyDetail >= 2) parts.push(lobe(1.2, 0.2, 6.9, 0.6), lobe(1.1, -1.4, 6.0, 0.2), lobe(1.0, 1.3, 6.1, -0.3));
  return mergeGeometries(parts);
}

export function makeConiferCanopyGeo() {
  const n = GFX.coneSegs;
  const cone = (r, ht, x, y, z) => {
    const g = new THREE.ConeGeometry(r, ht, n); g.translate(x, y, z); return g;
  };
  const parts = [cone(3.6, 6.5, 0, 6.2, 0), cone(2.8, 5.0, 0.2, 9.2, 0.1), cone(2.0, 4.0, -0.1, 11.6, -0.2)];
  if (GFX.canopyDetail >= 1) parts.push(cone(1.2, 2.5, 0, 13.2, 0));
  if (GFX.canopyDetail >= 2) parts.push(cone(3.2, 3.4, -0.3, 7.6, 0.3), cone(0.7, 1.6, 0, 14.3, 0));
  return mergeGeometries(parts);
}

export function makeBroadleafTrunkGeo() {
  const tGeo = new THREE.CylinderGeometry(0.5, 0.85, 3.8, 6);
  tGeo.translate(0, 1.9, 0);
  const b1 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
  b1.rotateZ(-0.5);
  b1.translate(0.5, 3.5, 0.2);
  const b2 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
  b2.rotateZ(0.5);
  b2.translate(-0.5, 3.5, -0.2);
  const b3 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
  b3.rotateX(0.5);
  b3.translate(0.2, 3.5, 0.5);
  return mergeGeometries([tGeo, b1, b2, b3]);
}

// Meshes + hinge pivots for one exported parts list. Textured skin parts take
// the bandit tint (desaturated silhouette); colored parts (cockpit, pilot,
// ducts) keep their baked diffuse; lamps glow; glass goes translucent. Parts
// carrying a hinge are re-parented under a pivot Group on that line and wired
// into surf for applyControlSurfaces.
function buildRefPlane(parts, opts) {
  const enemy = opts.paint != null;
  const plane = new THREE.Group();
  const surf = {
    aileronL: null, aileronR: null, elevator: null, rudder: null,
    prop: null, blades: null, propDisc: null, gear: null,
  };
  const normalMap = detailTexture('metal-normal', 32);
  const roughnessMap = detailTexture('metal-roughness', 32);
  for (const part of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
    if (part.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
    geo.setIndex(part.idx);
    geo.computeVertexNormals();
    let mat;
    if (part.role === 'glass') {
      // Textured glass (the Zero's greenhouse) keeps its skin: the painted
      // frame lines show over the translucency, giving the caged look for
      // free. Untextured glass is the plain tinted canopy of the other two.
      mat = part.tex
        ? new THREE.MeshStandardMaterial({
          map: refTexture(part.tex), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
        })
        : new THREE.MeshStandardMaterial({
          color: 0x9fc7d8, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        });
    } else if (part.role === 'lamp') {
      mat = new THREE.MeshStandardMaterial({
        color: part.color, emissive: part.color, emissiveIntensity: 1.2, roughness: 0.4,
      });
    } else if (part.tex) {
      mat = new THREE.MeshStandardMaterial({
        map: refTexture(part.tex), color: enemy ? 0x8b939c : 0xffffff,
        roughness: opts.roughness !== undefined ? opts.roughness : 0.35,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.85,
        normalMap, roughnessMap,
        normalScale: new THREE.Vector2(0.1, 0.1),
        side: THREE.DoubleSide,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: part.color, roughness: 0.75, metalness: 0.08, side: THREE.DoubleSide,
      });
    }
    const mesh = new THREE.Mesh(geo, mat);
    if (part.hinge) {
      const [hy, hz] = part.hinge;
      const pivot = new THREE.Group();
      pivot.position.set(0, hy, hz);
      mesh.position.set(0, -hy, -hz);
      pivot.add(mesh);
      plane.add(pivot);
      if (part.role === 'aileronL') surf.aileronL = pivot;
      else if (part.role === 'aileronR') surf.aileronR = pivot;
      else if (part.role === 'elevator') surf.elevator = pivot;
      else if (part.role === 'rudder') surf.rudder = pivot;
    } else {
      plane.add(mesh);
    }
  }
  return { plane, surf };
}

const REF_METAL = () => new THREE.MeshStandardMaterial({
  color: 0x33373d,
  roughness: 0.3,
  metalness: 0.85,
  normalMap: detailTexture('metal-normal', 16),
  roughnessMap: detailTexture('metal-roughness', 16),
  normalScale: new THREE.Vector2(0.1, 0.1),
});

// The Supermarine Spitfire — the FBX reference model (RAF camouflage with
// 303 Sqn "RF-J" codes, cannon barrels, pitot, separate glass canopy). Its
// own spinner stays in the hull; the game adds spinning blades, gear and a
// pilot under the glass. Ailerons/elevator came separated in the source;
// the rudder was carved off the fin.
function buildSpitfire(opts = {}) {
  const planeOpts = { metalness: 0.3, roughness: 0.55, ...opts };
  const { plane, surf } = buildRefPlane(REF_SPIT_PARTS, planeOpts);
  const pa = makePropAssembly({
    spinner: false, // the mesh keeps its own spinner cone
    zBlades: -4.31,
    count: 4,
    bladeLen: 1.05,
    bladeWidth: 0.95,
    bladeColor: 0x241f1c,
    tipColor: 0xd9c04a,
    rootY: 0.28,
    discR: 1.35,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  // The P-51's pilot, slid aft+down to sit under the Spitfire's lower canopy.
  const pilot = makeRefPilot();
  pilot.scale.setScalar(0.9);
  pilot.position.set(0, -0.12, 0.22);
  plane.add(pilot);

  // Legs hang from the front-spar area where the wing is deepest — the pivot
  // must sit below the local top skin or the strut pokes out of the wing.
  const gear = makeUndercarriage(REF_METAL(), 4.1, -2.05, 1.5, -0.72, 0x9fae9b, PLANE_INFO.spitfire.stats.stance); // Sky undersides
  plane.add(gear);
  surf.gear = gear;

  setShadows(plane);
  return { group: plane, surf };
}

// The North American P-51D Mustang — the "Cripes A'Mighty 3rd" reference
// model (George Preddy's blue-nosed Mustang), textures and pilot included.
// Ailerons were carved from the wing; the whole tailplane pivots as the
// elevator (the mesh has no separate one).
function buildP51(opts = {}) {
  const enemy = opts.paint != null;
  const planeOpts = { metalness: 0.8, roughness: 0.35, ...opts };
  const { plane, surf } = buildRefPlane(REF_P51_PARTS, planeOpts);
  const pa = makePropAssembly({
    spinnerProfile: [[0.46, 0], [0.44, 0.2], [0.37, 0.42], [0.25, 0.6], [0.12, 0.74], [0.001, 0.79]],
    spinnerColor: enemy ? 0x40454c : 0x2f5a9e, // the 352nd FG blue nose
    backplateR: 0.46,
    zSpinner: -4.66,
    zBlades: -4.88,
    count: 4,
    bladeLen: 1.45,
    bladeWidth: 1.25, // wide "paddle" blades
    bladeColor: 0x17191d,
    tipColor: 0xffd83f,
    rootY: 0.28,
    discR: 1.65,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  // Deep radiator scoop -> tall stance; legs hang from the wing underside.
  const gear = makeUndercarriage(REF_METAL(), 4.3, -1.9, 1.6, -0.6, 0xb4b9bf, PLANE_INFO.p51.stats.stance); // natural-metal doors
  plane.add(gear);
  surf.gear = gear;

  setShadows(plane);
  return { group: plane, surf };
}

// The Mitsubishi A6M3 Zero — the papercraft-sheet reference model (hull,
// cowl, closed gear-door plates, antenna mast). Ailerons, elevator, rudder
// AND the greenhouse canopy are carved out of the single-piece hull; the
// canopy renders as glass with a pilot seated underneath.
function buildZero(opts = {}) {
  const planeOpts = { metalness: 0.35, roughness: 0.5, ...opts };
  const { plane, surf } = buildRefPlane(REF_ZERO_PARTS, planeOpts);
  const pa = makePropAssembly({
    spinnerProfile: [[0.20, 0], [0.17, 0.18], [0.09, 0.32], [0.001, 0.40]],
    spinnerColor: 0xcfd3d6,
    backplateR: 0.20,
    zSpinner: -4.58,
    zBlades: -4.66,
    count: 3,
    bladeLen: 1.5,
    bladeWidth: 0.95,
    bladeColor: 0x6b4436, // the A6M's lacquered Sumitomo prop
    tipColor: 0xd9a52e,
    rootY: 0.12,
    discR: 1.62,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  plane.add(navLight(-1, -6.45, 0.2, -2.0));
  plane.add(navLight(1, 6.45, 0.2, -2.0));

  // the greenhouse canopy is carved out as glass — the P-51's pilot sits
  // underneath, raised to the Zero's higher cockpit deck
  const pilot = makeRefPilot();
  pilot.scale.setScalar(0.9);
  pilot.position.set(0, 0.42, -0.85);
  plane.add(pilot);

  // tailwheel under the fin root, where the slim tail cone still has depth
  const gear = makeUndercarriage(REF_METAL(), 4.0, -2.3, 1.35, -0.28, 0x9aa39b, PLANE_INFO.zero.stats.stance); // grey-green doors
  plane.add(gear);
  surf.gear = gear;

  setShadows(plane);
  return { group: plane, surf };
}

// Apply control-surface deflections (radians-ish: ailerons/elevator/rudder in
// roughly [-0.4, 0.4], gear in [0,1] where 1 is down). Shared by the game and
// the inspector so the animation matches exactly.
export function applyControlSurfaces(surf, { ail = 0, elev = 0, rud = 0, gear = 1 }) {
  if (surf.aileronL) surf.aileronL.rotation.x = ail;
  if (surf.aileronR) surf.aileronR.rotation.x = -ail;
  if (surf.elevator) surf.elevator.rotation.x = -elev;
  // Positive rud = right pedal = nose right, which needs the rudder's
  // trailing edge deflected to STARBOARD (+X, pushing the tail port-wards).
  // rotation.y positive swings the TE (aft of the hinge, +Z) toward +X.
  if (surf.rudder) surf.rudder.rotation.y = rud;
  if (surf.gear) {
    // Main legs fold INWARD toward the fuselage centreline (rotate about the
    // fore-aft Z axis); the tailwheel retracts rearward. These wings are far
    // thinner than the tyres and carry no modelled wheel wells, so a full
    // 90° fold ALWAYS punches the wheels through the top skin. Instead: swing
    // gently (60° max) and fade the assembly out at 40–60% travel — while
    // opaque the tyre only ever sinks through the UNDERSIDE, which from
    // outside reads as the leg tucking into a well.
    const travel = 1 - gear;
    const r = travel * (Math.PI / 3);
    if (surf.gear.userData.left) surf.gear.userData.left.rotation.z = r;
    if (surf.gear.userData.right) surf.gear.userData.right.rotation.z = -r;
    if (surf.gear.userData.tail) surf.gear.userData.tail.rotation.x = -r;
    const fade = 1 - Math.min(1, Math.max(0, (travel - 0.4) / 0.2));
    for (const m of surf.gear.userData.mats || []) m.opacity = fade;
    surf.gear.visible = fade > 0.01;
  }
}

// Prop visual state: below ~40% RPM show the individual blades; above it, fade
// them out and fade the blur disc in. Shared so the inspector can demo it.
export function setPropBlur(surf, rpmNorm) {
  if (!surf.blades || !surf.propDisc) return;
  const blur = rpmNorm > 0.4;
  surf.blades.visible = !blur;
  surf.propDisc.visible = blur;
  if (blur) surf.propDisc.material.opacity = Math.min(1, (rpmNorm - 0.4) * 3);
}

// ---- Scenery (shared so the inspector can show them too) ----

// A tree in one of three archetypes — 'conifer' (stacked cones), 'pine' (tall
// slim cone on a bare trunk) or 'broadleaf' (round canopy). Random type when
// unspecified; foliage tint + scale are baked in so a field of these varies.
// The game's instanced forests use the same silhouettes/palettes (it can't
// reuse these Groups directly — instancing needs one geometry per mesh).
export function makeTree(type) {
  const t = type || ['conifer', 'pine', 'broadleaf'][Math.floor(Math.random() * 3)];
  const tree = new THREE.Group();
  
  const trunkTex = treeTexture('tree-bark', 1, 3);
  const leafTex = treeTexture('tree-leaves', 4, 4);

  const trunkMat = new THREE.MeshStandardMaterial({
    map: trunkTex,
    roughness: 0.9,
    metalness: 0.05,
  });

  if (t === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5; tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      color: new THREE.Color().setHSL(0.31 + Math.random() * 0.05, 0.35, 0.16 + Math.random() * 0.07),
      roughness: 0.85,
      metalness: 0.05,
    });
    const canopy = new THREE.Mesh(makePineCanopyGeo(), leafMat);
    tree.add(canopy);
    tree.scale.setScalar(0.8 + Math.random() * 0.9);
  } else if (t === 'broadleaf') {
    const tGeo = new THREE.CylinderGeometry(0.5, 0.85, 3.8, 6);
    tGeo.translate(0, 1.9, 0);
    const b1 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
    b1.rotateZ(-0.5);
    b1.translate(0.5, 3.5, 0.2);
    const b2 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
    b2.rotateZ(0.5);
    b2.translate(-0.5, 3.5, -0.2);
    const b3 = new THREE.CylinderGeometry(0.08, 0.16, 2.2, 5);
    b3.rotateX(0.5);
    b3.translate(0.2, 3.5, 0.5);
    const trunkGeo = mergeGeometries([tGeo, b1, b2, b3]);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      color: new THREE.Color().setHSL(0.22 + Math.random() * 0.09, 0.5, 0.28 + Math.random() * 0.09),
      roughness: 0.85,
      metalness: 0.05,
    });
    const canopy = new THREE.Mesh(makeBroadleafCanopyGeo(), leafMat);
    tree.add(canopy);
    tree.scale.setScalar(0.6 + Math.random() * 1.1);
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4.5, 6), trunkMat);
    trunk.position.y = 2.2; tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.45, 0.22 + Math.random() * 0.08),
      roughness: 0.85,
      metalness: 0.05,
    });
    const canopy = new THREE.Mesh(makeConiferCanopyGeo(), leafMat);
    tree.add(canopy);
    tree.scale.setScalar(0.8 + Math.random() * 1.3);
  }
  setShadows(tree);
  return tree;
}

// A Quonset-hut hangar: a hollow corrugated-steel half-tube sitting ON the
// ground (base at y=0, axis along X). Rear end closed by a gable, front open
// with the sliding doors parked at the jambs, arch ribs inside, and a concrete
// slab underfoot. Double-sided skin so the interior reads from the open end.
export function makeHangar() {
  const g = new THREE.Group();
  const R = 9; const LEN = 38;

  const skinTex = new THREE.TextureLoader().load('/static/planes/corrugated-metal.jpg');
  skinTex.colorSpace = THREE.SRGBColorSpace;
  skinTex.wrapS = skinTex.wrapT = THREE.RepeatWrapping;
  skinTex.repeat.set(6, 6); // u wraps the arch (hoop), v runs along the length
  skinTex.anisotropy = 8;
  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex, roughness: 0.8, metalness: 0.25, side: THREE.DoubleSide,
  });

  // Arch shell: open-ended half cylinder, axis rotated onto X, arch over +Y.
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 28, 3, true, 0, Math.PI), skinMat);
  shell.rotation.z = Math.PI / 2; // axis Y -> X; the theta 0..PI half becomes the +Y arch
  g.add(shell);

  // Rear gable: a half-disc closing the -X end.
  const gable = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 28, 0, Math.PI), skinMat);
  gable.rotation.y = -Math.PI / 2;
  gable.position.x = -LEN / 2 + 0.05;
  g.add(gable);

  // Interior arch ribs — sell the hollow shell from the open end.
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.7, metalness: 0.4 });
  for (const rx of [-LEN * 0.3, 0, LEN * 0.3]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R - 0.35, 0.14, 6, 20, Math.PI), ribMat);
    rib.rotation.y = Math.PI / 2; // arc in the YZ plane, spanning over +Y
    rib.position.x = rx;
    g.add(rib);
  }

  // Sliding-door front, modelled on real WWII arch hangars (Belfast/blister
  // type): the door track runs PAST the building on both sides — doors park
  // beyond the walls on outrigger frames — with two parallel tracks so the
  // panels stack, a glazed-top door leaf design, and a gable face filling the
  // arch above the door line.
  const FRONT_X = LEN / 2;

  // Door-leaf texture: planked lower body with bolt seams, glazed grid on the
  // top quarter (the classic hangar-door look).
  const dc = document.createElement('canvas');
  dc.width = 128; dc.height = 256;
  const dctx = dc.getContext('2d');
  dctx.fillStyle = '#5d646c';
  dctx.fillRect(0, 0, 128, 256);
  dctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (const px of [31, 63, 95]) dctx.fillRect(px, 64, 2, 192); // plank joints
  for (let py = 112; py < 256; py += 48) dctx.fillRect(0, py, 128, 2); // seams
  dctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let py = 70; py < 256; py += 24) { // bolt rows
    for (let px = 8; px < 128; px += 16) dctx.fillRect(px, py, 2, 2);
  }
  dctx.fillStyle = '#39404a'; // window frame band
  dctx.fillRect(0, 0, 128, 64);
  dctx.fillStyle = '#b9c8d4'; // panes in a 4x2 grid
  for (let r = 0; r < 2; r++) {
    for (let cIdx = 0; cIdx < 4; cIdx++) dctx.fillRect(6 + cIdx * 31, 6 + r * 30, 24, 22);
  }
  const doorTex = new THREE.CanvasTexture(dc);
  doorTex.colorSpace = THREE.SRGBColorSpace;
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8, metalness: 0.25 });

  // Open Belfast-truss gable above the door line: a straight bottom chord at
  // the door head, a segmented top chord following the arch, and a zigzag web
  // between them — pale members, see-through like the real lattice.
  const webMat = new THREE.MeshStandardMaterial({ color: 0xb9bfc6, roughness: 0.7, metalness: 0.2 });
  const gz = Math.sqrt(8.95 * 8.95 - 6.75 * 6.75); // arch half-width at the door head
  const GABLE_X = FRONT_X - 0.2;
  // A thin member between two points in the gable (z,y) plane.
  const member = (z1, y1, z2, y2, thick, mat) => {
    const dy = y2 - y1; const dz = z2 - z1;
    const len = Math.hypot(dy, dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
    m.position.set(GABLE_X, (y1 + y2) / 2, (z1 + z2) / 2);
    m.rotation.x = -Math.asin(dy / len);
    g.add(m);
  };
  member(-gz, 6.85, gz, 6.85, 0.2, ribMat); // bottom chord
  const N_PANEL = 6;
  const archY = (z) => Math.sqrt(8.95 * 8.95 - z * z) - 0.12; // just under the shell
  const gzs = [];
  for (let i = 0; i <= N_PANEL; i++) gzs.push(-gz + (2 * gz * i) / N_PANEL);
  for (let i = 0; i < N_PANEL; i++) { // top chord segments tracing the arch
    member(gzs[i], archY(gzs[i]), gzs[i + 1], archY(gzs[i + 1]), 0.18, ribMat);
  }
  for (let i = 1; i < N_PANEL; i++) { // verticals at each panel point
    member(gzs[i], 6.85, gzs[i], archY(gzs[i]), 0.12, webMat);
  }
  for (let i = 0; i < N_PANEL; i++) { // zigzag web diagonals
    if (i % 2 === 0) member(gzs[i], 6.85, gzs[i + 1], archY(gzs[i + 1]), 0.1, webMat);
    else member(gzs[i], archY(gzs[i]), gzs[i + 1], 6.85, 0.1, webMat);
  }

  // Header beam carrying both door tracks, running past the shell to the
  // outrigger frames.
  const RAIL_HALF = 11.2;
  const header = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, RAIL_HALF * 2), ribMat);
  header.position.set(FRONT_X + 0.45, 6.9, 0);
  g.add(header);
  // Twin floor guide tracks under the door lines.
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, RAIL_HALF * 2), ribMat);
  track.position.set(FRONT_X + 0.45, 0.18, 0);
  g.add(track);

  // Outrigger lattice towers holding the track ends up beyond the walls: two
  // posts (in the door-normal plane) with rungs and zigzag bracing, like the
  // open towers on the real thing.
  for (const sz of [-1, 1]) {
    const tz = sz * (RAIL_HALF - 0.15);
    const px = [FRONT_X - 0.35, FRONT_X + 1.25]; // post x positions
    for (const x of px) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.9, 0.18), ribMat);
      post.position.set(x, 3.45, tz);
      g.add(post);
    }
    for (let i = 0; i < 4; i++) { // rungs between the posts
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), webMat);
      rung.position.set((px[0] + px[1]) / 2, 1.2 + i * 1.8, tz);
      g.add(rung);
    }
    for (let i = 0; i < 3; i++) { // zigzag diagonals in the tower plane
      const diag = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), webMat);
      diag.position.set((px[0] + px[1]) / 2, 2.1 + i * 1.8, tz);
      diag.rotation.z = (i % 2 ? -1 : 1) * 0.85;
      g.add(diag);
    }
  }

  // Four door leaves on two stacked tracks, slid open past the doorway edges
  // (doorway half-width is ~5.9 at the door head).
  for (const sz of [-1, 1]) {
    for (const [dx, dz] of [[0.28, 5.9], [0.52, 8.9]]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.5, 3.3), doorMat);
      door.position.set(FRONT_X + dx, 3.35, sz * dz);
      g.add(door);
      for (const hz of [-1.2, 1.2]) { // hangers up to the header
        const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.18), ribMat);
        hanger.position.set(FRONT_X + dx, 6.72, sz * dz + hz);
        g.add(hanger);
      }
    }
  }

  // Concrete slab floor, slightly proud of the surrounding grass — wide enough
  // to carry the door outrigger frames beyond the walls.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(LEN + 5, 0.14, 25),
    new THREE.MeshStandardMaterial({ color: 0x565a60, roughness: 0.95 }),
  );
  slab.position.set(1.5, 0.07, 0); // extended apron out the open end
  g.add(slab);

  setShadows(g);
  return g;
}

// A control tower modelled on Singapore Changi's: a slim tapered shaft, a flared
// "mushroom" overhang up to a wide glazed control cab (with visible window
// mullions), topped by the signature golden radar dome. Layers are spaced so
// nothing z-fights, and the cab glass is light + reflective so the windows read.
export function makeControlTower() {
  const tower = new THREE.Group();
  
  const concTex = new THREE.TextureLoader().load('/static/planes/concrete.jpg');
  concTex.colorSpace = THREE.SRGBColorSpace;
  concTex.wrapS = concTex.wrapT = THREE.RepeatWrapping;
  concTex.repeat.set(2, 6);
  concTex.anisotropy = 8;

  const concrete = new THREE.MeshStandardMaterial({ map: concTex, color: 0xd2d8de, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.6, metalness: 0.3 });
  // Light, reflective glass with a faint glow so the windows stay visible even
  // when the cab is in shadow (the old near-black glass just read as a void).
  const winGlass = new THREE.MeshStandardMaterial({
    color: 0x8fbcd2, roughness: 0.12, metalness: 0.5, emissive: 0x1b2c34, emissiveIntensity: 0.6,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a44a, roughness: 0.4, metalness: 0.55 });

  // Slim tapered shaft.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.95, 22, 24), concrete);
  shaft.position.y = 11; tower.add(shaft);

  // Mushroom underside flare (narrow shaft -> wide cab).
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 1.6, 3.0, 28), concrete);
  flare.position.y = 23.5; tower.add(flare);

  // Catwalk ring + bottom frame ring.
  const catwalk = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.16, 8, 32), trim);
  catwalk.rotation.x = Math.PI / 2; catwalk.position.y = 25.0; tower.add(catwalk);
  const ringB = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.3, 32), trim);
  ringB.position.y = 25.25; tower.add(ringB);

  // Glazed control cab + vertical window mullions sitting on its surface.
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.3, 3.0, 32), winGlass);
  cab.position.y = 26.7; tower.add(cab);
  const MULLIONS = 16;
  for (let i = 0; i < MULLIONS; i++) {
    const a = (i / MULLIONS) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 0.12), trim);
    m.position.set(Math.cos(a) * 4.4, 26.7, Math.sin(a) * 4.4);
    tower.add(m);
  }
  const ringT = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.45, 0.45, 32), trim);
  ringT.position.y = 28.35; tower.add(ringT);

  // Flat roof slab + the signature golden radar dome + finial mast.
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.6, 0.5, 28), concrete);
  roof.position.y = 28.8; tower.add(roof);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.y = 29.0; tower.add(dome);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), trim);
  mast.position.y = 32; tower.add(mast);

  setShadows(tower);
  return tower;
}

// A shared corrugated-iron texture (galvanised sheet: fluted highlights/shadows
// running one way, faint lap seams the other). Used by the smaller huts.
function corrugatedTexture(base, repeatU, repeatV) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 6) {
    const grd = ctx.createLinearGradient(0, y, 0, y + 6);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.03)');
    grd.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y, 128, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatU, repeatV);
  return tex;
}

// A windsock on a mast: a lattice-topped pole with a frame hoop and a striped
// (orange/white) conical sock streaming downwind and drooping under its own
// weight. `dir` (radians about Y) aims the tail; a light breeze droop is baked
// in so it reads as fabric, not a rigid cone.
export function makeWindsock() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcdd2d6, roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), poleMat);
  pole.position.y = 3.5; g.add(pole);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), poleMat);
  hoop.rotation.y = Math.PI / 2; hoop.position.set(0, 6.9, 0.45); g.add(hoop);
  // Sock: 5 frustums streaming along +Z, alternating orange/white, tapering
  // and drooping. Built as a CHAIN of joints (each segment parents the next)
  // so userData.flutter(t) can ripple the fabric: every joint carries a
  // baseline droop plus phase-lagged sine wiggle that grows toward the tail.
  const orange = new THREE.MeshStandardMaterial({ color: 0xe06a1e, roughness: 0.8, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.8, side: THREE.DoubleSide });
  const sock = new THREE.Group();
  sock.position.set(0, 6.9, 0.45);
  const joints = [];
  let parent = sock;
  let r0 = 0.4;
  const len = 0.62;
  for (let i = 0; i < 5; i++) {
    const r1 = r0 * 0.82;
    const joint = new THREE.Group();
    joint.position.z = i === 0 ? 0.31 : len; // hang off the previous segment's end
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, len, 14, 1, true),
      i % 2 ? white : orange,
    );
    seg.rotation.x = Math.PI / 2; // axis along Z
    seg.position.z = len / 2;
    joint.add(seg);
    parent.add(joint);
    joints.push(joint);
    parent = joint;
    r0 = r1;
  }
  g.userData.flutter = (t) => {
    for (let i = 0; i < joints.length; i++) {
      const lag = i * 0.85; // ripple travels root -> tail
      const amp = 0.05 + i * 0.045; // tail flaps harder than the mouth
      joints[i].rotation.x = 0.12 + Math.sin(t * 3.1 - lag) * amp + Math.sin(t * 7.3 - lag * 1.7) * amp * 0.35;
      joints[i].rotation.y = Math.sin(t * 2.3 - lag + 1.2) * amp * 0.8;
    }
  };
  g.userData.flutter(0);
  g.add(sock);
  setShadows(g);
  return g;
}

// A bulk aviation-fuel installation: a vertical steel tank sitting inside a low
// earth/concrete blast bund (a ring wall that would contain a spill), with a
// domed top, a filler stack and an access ladder — the kind of dispersed fuel
// store a WWII airfield kept away from the hangars.
export function makeFuelTank() {
  const g = new THREE.Group();
  const concTex = new THREE.TextureLoader().load('/static/planes/concrete.jpg');
  concTex.wrapS = concTex.wrapT = THREE.RepeatWrapping;
  concTex.repeat.set(6, 1);
  const bundMat = new THREE.MeshStandardMaterial({ map: concTex, color: 0x8a847c, roughness: 0.9 });
  // Low metalness so the tank reads as pale painted steel, not a near-black
  // mirror (no environment map in the scene to reflect).
  const steel = new THREE.MeshStandardMaterial({
    color: 0x9aa39c,
    roughness: 0.35,
    metalness: 0.8,
    normalMap: detailTexture('metal-normal', 4),
    roughnessMap: detailTexture('metal-roughness', 4),
    normalScale: new THREE.Vector2(0.1, 0.1),
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.7, metalness: 0.2 });
  // Containment bund: a low open ring wall + a floor pad.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.2, 24), bundMat);
  pad.position.y = 0.1; g.add(pad);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 1.1, 24, 1, true), bundMat);
  wall.position.y = 0.55; g.add(wall);
  // The tank.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.2, 24), steel);
  tank.position.y = 2.4; g.add(tank);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  dome.position.y = 4.5; g.add(dome);
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.11, 0.06, 6, 24), dark);
  band.rotation.x = Math.PI / 2; band.position.y = 2.4; g.add(band);
  // Filler stack.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8), dark);
  stack.position.set(0, 5.3, 0); g.add(stack);
  // Access ladder: two rails + rungs (an open frame you can see through, not a
  // solid slab), hung on the tank's +Z side.
  const ladder = new THREE.Group();
  const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.4, 6);
  for (const rx of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(railGeo, dark);
    rail.position.set(rx, 2.4, 0);
    ladder.add(rail);
  }
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.52, 6);
  rungGeo.rotateZ(Math.PI / 2);
  for (let y = 0.55; y <= 4.4; y += 0.4) {
    const rung = new THREE.Mesh(rungGeo, dark);
    rung.position.set(0, y, 0);
    ladder.add(rung);
  }
  ladder.position.set(0, 0, 2.12); g.add(ladder);
  setShadows(g);
  return g;
}

// A WWII refuelling bowser (fuel tanker): a boxy cab, a horizontal cylindrical
// tank on the flatbed, a hose reel and six wheels — RAF blue-grey. Local
// forward is -Z (nose), so it parks like the aircraft.
export function makeBowser() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x55645b,
    roughness: 0.38,
    metalness: 0.75,
    normalMap: detailTexture('metal-normal', 4),
    roughnessMap: detailTexture('metal-roughness', 4),
    normalScale: new THREE.Vector2(0.1, 0.1),
  });
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0x859089,
    roughness: 0.38,
    metalness: 0.75,
    normalMap: detailTexture('metal-normal', 4),
    roughnessMap: detailTexture('metal-roughness', 4),
    normalScale: new THREE.Vector2(0.1, 0.1),
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fbccb, roughness: 0.2, metalness: 0.3 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 6.2), bodyMat);
  chassis.position.y = 0.85; g.add(chassis);
  // Cab up front (-Z).
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 1.5), bodyMat);
  cab.position.set(0, 1.55, -2.3); g.add(cab);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.08), glass);
  wind.position.set(0, 1.85, -3.02); g.add(wind);
  // Cylindrical fuel tank on the bed.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.4, 20), tankMat);
  tank.rotation.x = Math.PI / 2; tank.position.set(0, 1.55, 0.9); g.add(tank);
  for (const ry of [-0.4, 0.5, 1.4]) { // stiffening bands
    const b = new THREE.Mesh(new THREE.TorusGeometry(1.01, 0.05, 6, 20), bodyMat);
    b.position.set(0, 1.55, ry); g.add(b);
  }
  // Six wheels.
  for (const sx of [-1, 1]) {
    for (const wz of [-2.1, 0.4, 1.6]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), tyre);
      w.rotation.z = Math.PI / 2; w.position.set(sx * 0.95, 0.5, wz); g.add(w);
    }
  }
  setShadows(g);
  return g;
}

// A Nissen hut: the ubiquitous small corrugated-iron half-cylinder that housed
// airmen, stores and offices on every WWII RAF station. A brick-coloured end
// wall with a door + window closes the -Z end; the +Z end is a plain gable.
// Axis along Z, base at y=0. `len` lets a row vary.
export function makeNissenHut(len = 9) {
  const g = new THREE.Group();
  const R = 2.6;
  const skinTex = new THREE.TextureLoader().load('/static/planes/corrugated-metal.jpg');
  skinTex.colorSpace = THREE.SRGBColorSpace;
  skinTex.wrapS = skinTex.wrapT = THREE.RepeatWrapping;
  skinTex.repeat.set(2, 2);
  skinTex.anisotropy = 8;
  const skin = new THREE.MeshStandardMaterial({
    map: skinTex, roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide,
  });
  // Half-cylinder shell arching over +Y with its axis along Z. The default
  // cylinder axis is Y and the 0..π half arches over +X; rotateZ swings that
  // arch up to +Y (axis -> X, as the hangar does), then rotateY swings the axis
  // round to Z. Baking it into the geometry keeps the orientation unambiguous.
  const shellGeo = new THREE.CylinderGeometry(R, R, len, 20, 1, true, 0, Math.PI);
  shellGeo.rotateZ(Math.PI / 2);
  shellGeo.rotateY(Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, skin);
  g.add(shell);
  const endMat = new THREE.MeshStandardMaterial({ color: 0x9c6a4e, roughness: 0.95, side: THREE.DoubleSide });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x33403a, roughness: 0.8 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x9fbccb, roughness: 0.25, metalness: 0.3 });
  for (const sz of [-1, 1]) {
    // A CircleGeometry(0..π) is the upper half-disc (y 0..R) in the XY plane —
    // exactly the arch's end cross-section, so it caps the tube with no extra
    // rotation. Flip the -Z end to face outward.
    const gable = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 20, 0, Math.PI), endMat);
    if (sz < 0) gable.rotation.y = Math.PI;
    gable.position.z = sz * (len / 2 - 0.02);
    g.add(gable);
  }
  // Door + window on the -Z end.
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.1), doorMat);
  door.position.set(-0.7, 0.95, -len / 2 - 0.02); g.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.08), winMat);
  win.position.set(0.75, 1.3, -len / 2 - 0.02); g.add(win);
  setShadows(g);
  return g;
}

// ---- A stone-piered road viaduct for the stunt courses: deck runs along
// local X (length `len`), deck TOP at y = `deckY`, piers dropping to `botY`
// (put the group at water level and let the piers reach the lakebed). Open
// underneath — the whole point is flying beneath it.
export function makeBridge(len = 520, deckY = 30, botY = -30) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.92 });
  const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x565a60, roughness: 0.88 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5f6a74, roughness: 0.5, metalness: 0.55 });
  // Deck slab + wearing surface.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 11), stone);
  slab.position.y = deckY - 1.0; g.add(slab);
  const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 8.6), tarmacMat);
  road.position.y = deckY; g.add(road);
  // Side girders + railings.
  for (const sz of [-1, 1]) {
    const girder = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.6), steel);
    girder.position.set(0, deckY - 1.6, sz * 5.4); g.add(girder);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.18), steel);
    rail.position.set(0, deckY + 1.2, sz * 4.9); g.add(rail);
    // railing posts
    const postGeo = new THREE.BoxGeometry(0.16, 1.2, 0.16);
    for (let x = -len / 2 + 4; x <= len / 2 - 4; x += 12) {
      const p = new THREE.Mesh(postGeo, steel);
      p.position.set(x, deckY + 0.6, sz * 4.9); g.add(p);
    }
  }
  // Piers: tapered stone columns every ~105 m.
  const pierH = deckY - 1.8 - botY;
  const pierGeo = new THREE.CylinderGeometry(3.2, 4.6, pierH, 10);
  const capGeo = new THREE.BoxGeometry(8.5, 1.4, 12.5);
  const n = Math.max(1, Math.round(len / 105) - 1);
  for (let i = 1; i <= n; i++) {
    const x = -len / 2 + (len * i) / (n + 1);
    const pier = new THREE.Mesh(pierGeo, stone);
    pier.position.set(x, botY + pierH / 2, 0); g.add(pier);
    const cap = new THREE.Mesh(capGeo, stone);
    cap.position.set(x, deckY - 2.2, 0); g.add(cap);
  }
  // End abutments: solid stone towers under both deck ends, running all the
  // way down past botY — the span is grounded even where the bank falls away.
  const abutH = pierH + 3;
  const abutGeo = new THREE.BoxGeometry(12, abutH, 13);
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(abutGeo, stone);
    a.position.set(sx * (len / 2 - 5), botY - 3 + abutH / 2, 0);
    g.add(a);
  }
  setShadows(g);
  g.userData.dims = { len, deckY, botY };
  return g;
}

// ---- WW2 fleet aircraft carrier (Essex-ish silhouette, simplified to the
// game's low-poly idiom). Local forward is -Z (bow), origin at the WATERLINE
// on the centreline — position the group at sea level. Returns { group, deck }
// where deck = { y, w, len } (top-of-deck height and the landable rectangle,
// centred on the origin) so the game can use it for takeoff/landing/bombing.
// opts.enemy switches to the enemy scheme (dark IJN-style paint, red bow disc).
export const CARRIER = { HULL_LEN: 262, DECK_LEN: 256, DECK_W: 32, DECK_Y: 17 };
export function makeCarrier(opts = {}) {
  const enemy = !!opts.enemy;
  const g = new THREE.Group();
  const { DECK_LEN, DECK_W, DECK_Y } = CARRIER;

  const hullMat = new THREE.MeshStandardMaterial({
    color: enemy ? 0x565b52 : 0x6d7885,
    roughness: 0.55,
    metalness: 0.55,
    normalMap: detailTexture('metal-normal', 24),
    roughnessMap: detailTexture('metal-roughness', 24),
    normalScale: new THREE.Vector2(0.15, 0.15),
  });
  const supMat = new THREE.MeshStandardMaterial({ // superstructure — a shade lighter
    color: enemy ? 0x646a60 : 0x7e8894,
    roughness: 0.6,
    metalness: 0.45,
    normalMap: detailTexture('metal-normal', 12),
    roughnessMap: detailTexture('metal-roughness', 12),
    normalScale: new THREE.Vector2(0.12, 0.12),
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.7, metalness: 0.3 });

  const darkDetailMat = new THREE.MeshStandardMaterial({
    color: 0x222428,
    roughness: 0.6,
    metalness: 0.6,
    normalMap: detailTexture('metal-normal', 6),
    roughnessMap: detailTexture('metal-roughness', 6),
    normalScale: new THREE.Vector2(0.15, 0.15),
  });

  // Hull: a 2D plan outline (pointed bow, rounded stern) extruded vertically.
  // Shape is drawn in XY with y = -z(ship) so the bow (ship -Z) is shape +y;
  // extrude runs 0..H along z, then rotateX(-90°) stands it up (z -> y).
  const HW = 11.5; // hull half-beam
  const BOW = 131; const STERN = 124; // |z| extents
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-HW, -STERN + 14);
  hullShape.quadraticCurveTo(-HW, -STERN, -HW + 7, -STERN); // rounded stern corners
  hullShape.lineTo(HW - 7, -STERN);
  hullShape.quadraticCurveTo(HW, -STERN, HW, -STERN + 14);
  hullShape.lineTo(HW, BOW - 52);
  hullShape.quadraticCurveTo(HW, BOW - 14, 0, BOW); // fine bow
  hullShape.quadraticCurveTo(-HW, BOW - 14, -HW, BOW - 52);
  hullShape.closePath();
  const H = 22; // keel (below water) to hangar-deck top
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: H, bevelEnabled: false });
  hullGeo.rotateX(-Math.PI / 2);
  hullGeo.translate(0, -6, 0); // waterline at y=0: 6 m draught, 16 m freeboard
  const hull = new THREE.Mesh(hullGeo, hullMat);
  g.add(hull);

  // Flight deck: a wide, flat-front rounded-rectangle slab overhanging the hull
  const DHW = DECK_W / 2;
  const rS = 6; // stern corner radius (round-down)
  const rB = 6; // bow corner radius (flat deck front with rounded corners)
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-DHW, -125 + rS);
  deckShape.quadraticCurveTo(-DHW, -125, -DHW + rS, -125); // stern port
  deckShape.lineTo(DHW - rS, -125);
  deckShape.quadraticCurveTo(DHW, -125, DHW, -125 + rS); // stern stbd
  deckShape.lineTo(DHW, 131 - rB);
  deckShape.quadraticCurveTo(DHW, 131, DHW - rB, 131); // bow stbd
  deckShape.lineTo(-DHW + rB, 131);
  deckShape.quadraticCurveTo(-DHW, 131, -DHW, 131 - rB); // bow port
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 1.3, bevelEnabled: false });
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.translate(0, DECK_Y - 1.3, 0);
  const deckSlab = new THREE.Mesh(deckGeo, darkDetailMat);
  g.add(deckSlab);

  // Deck surface + markings: one canvas draped over the deck plan (transparent
  // outside the outline, alphaTest clips the corners). Stained wood planking,
  // white edge lines, dashed centreline, arrestor wires aft, and a bow marking
  // (white deck number / enemy red disc).
  (function deckSurface() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 1024; // x across, y along (y=0 is the BOW, -Z)
    const ctx = c.getContext('2d');
    const px = (x) => ((x + DHW) / DECK_W) * 256; // ship x -> canvas x
    const pz = (z) => ((131 - z) / 256) * 1024; // ship z -> canvas y
    ctx.clearRect(0, 0, 256, 1024);
    // Deck plan silhouette (mirrors the flat-bow deckShape).
    ctx.beginPath();
    ctx.moveTo(px(-DHW), pz(-125 + rS));
    ctx.quadraticCurveTo(px(-DHW), pz(-125), px(-DHW + rS), pz(-125));
    ctx.lineTo(px(DHW - rS), pz(-125));
    ctx.quadraticCurveTo(px(DHW), pz(-125), px(DHW), pz(-125 + rS));
    ctx.lineTo(px(DHW), pz(131 - rB));
    ctx.quadraticCurveTo(px(DHW), pz(131), px(DHW - rB), pz(131));
    ctx.lineTo(px(-DHW + rB), pz(131));
    ctx.quadraticCurveTo(px(-DHW), pz(131), px(-DHW), pz(131 - rB));
    ctx.closePath();
    ctx.save();
    ctx.clip();
    // Planking: stained deck boards running fore-aft.
    ctx.fillStyle = enemy ? '#6b5c40' : '#55534b';
    ctx.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 900; i++) {
      const v = Math.random();
      ctx.fillStyle = `rgba(${enemy ? '40,32,18' : '28,28,24'},${0.12 + v * 0.22})`;
      ctx.fillRect(Math.floor(Math.random() * 64) * 4, Math.random() * 1024, 3, 24 + Math.random() * 70);
    }
    // Edge lines.
    ctx.strokeStyle = 'rgba(235,238,240,0.85)';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Dashed centreline.
    ctx.setLineDash([28, 22]);
    ctx.beginPath(); ctx.moveTo(128, 40); ctx.lineTo(128, 990); ctx.stroke();
    ctx.setLineDash([]);
    // Arrestor wires across the aft third.
    ctx.strokeStyle = 'rgba(20,20,22,0.8)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const y = pz(-125 + 26 + k * 11);
      ctx.beginPath(); ctx.moveTo(px(-DHW + 3), y); ctx.lineTo(px(DHW - 3), y); ctx.stroke();
    }
    if (enemy) { // red disc on the bow deck
      ctx.fillStyle = 'rgba(190,40,36,0.95)';
      ctx.beginPath(); ctx.arc(128, pz(131 - 30), 34, 0, Math.PI * 2); ctx.fill();
    } else { // deck number
      ctx.fillStyle = 'rgba(235,238,240,0.9)';
      ctx.font = '700 64px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(128, pz(131 - 32));
      ctx.fillText('6', 0, 24);
      ctx.restore();
    }
    ctx.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const deckTop = new THREE.Mesh(
      new THREE.PlaneGeometry(DECK_W, DECK_LEN),
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.4,
        roughness: 0.75,
        metalness: 0.15,
        normalMap: detailTexture('metal-normal', 24),
        normalScale: new THREE.Vector2(0.08, 0.08),
      }),
    );
    deckTop.rotation.x = -Math.PI / 2;
    deckTop.position.set(0, DECK_Y + 0.02, -3);
    g.add(deckTop);
  }());

  // Island superstructure on the starboard (+X) deck edge.
  const island = new THREE.Group();
  island.position.set(DHW - 2.6, DECK_Y, -18);
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 7.5, 22), supMat);
  base.position.y = 3.75; island.add(base);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 12), supMat);
  bridge.position.set(0, 9.1, -3); island.add(bridge);
  // Bridge windows: a dark strip band.
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.9, 10.5), darkDetailMat);
  winBand.position.set(0, 9.9, -3); island.add(winBand);

  // Front bridge windows
  const frontWin = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.9, 0.1), darkDetailMat);
  frontWin.position.set(0, 9.9, -9.02); island.add(frontWin);

  // Window frames (vertical struts) on port (-X) and starboard (+X) of winBand
  const frameMat = supMat;
  const frameGeo = new THREE.BoxGeometry(0.1, 0.95, 0.1);
  for (let wz = -8.25; wz <= 2.25; wz += 1.5) {
    for (const sx of [-1, 1]) {
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(sx * 3.22, 9.9, wz);
      island.add(frame);
    }
  }
  // Front windows vertical frames
  for (let wx = -2.8; wx <= 2.8; wx += 1.4) {
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(wx, 9.9, -9.08);
    island.add(frame);
  }
  // Aft windows vertical frames
  for (let wx = -2.8; wx <= 2.8; wx += 1.4) {
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(wx, 9.9, 2.27);
    island.add(frame);
  }

  // Fences/railings helper
  const addRailing = (x0, z0, x1, z1, y, parent = island) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const rot = Math.atan2(dx, dz);

    const railG = new THREE.Group();
    railG.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    railG.rotation.y = rot;

    const railGeo = new THREE.CylinderGeometry(0.03, 0.03, len, 4);
    railGeo.rotateX(Math.PI / 2);

    const top = new THREE.Mesh(railGeo, darkDetailMat);
    top.position.y = 0.9;
    railG.add(top);

    const mid = new THREE.Mesh(railGeo, darkDetailMat);
    mid.position.y = 0.45;
    railG.add(mid);

    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4);
    const numPosts = Math.max(2, Math.floor(len / 2.5) + 1);
    const step = len / (numPosts - 1);
    for (let i = 0; i < numPosts; i++) {
      const post = new THREE.Mesh(postGeo, darkDetailMat);
      post.position.set(0, 0.45, -len / 2 + i * step);
      railG.add(post);
    }
    parent.add(railG);
  };

  // Railings around base top deck (Y = 7.5)
  addRailing(-2.7, 3.2, -2.7, 11, 7.5);
  addRailing(2.7, 3.2, 2.7, 11, 7.5);
  addRailing(-2.7, 11, 2.7, 11, 7.5);
  addRailing(-2.7, -11, 2.7, -11, 7.5);
  addRailing(-2.7, -11, -2.7, -9.2, 7.5);
  addRailing(2.7, -11, 2.7, -9.2, 7.5);

  // Railings around bridge top deck (Y = 10.7) - corrected from 12.3 to prevent levitation
  addRailing(-3.2, -9, -3.2, 3, 10.7);
  addRailing(3.2, -9, 3.2, 3, 10.7);
  addRailing(-3.2, -9, 3.2, -9, 10.7);
  addRailing(-3.2, 3, 3.2, 3, 10.7);

  // Funnel, raked aft - lowered from 12.2 to 11.0 to prevent levitation above base deck (Y=7.5)
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 7.5, 12), darkDetailMat);
  funnel.rotation.x = 0.22;
  funnel.position.set(0, 11.0, 5.5); island.add(funnel);
  // Lattice mast + yard + rotating-radar slab.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 10, 6), darkDetailMat);
  mast.position.set(0, 15.5, -6); island.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), darkDetailMat);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 18.5, -6); island.add(yard);

  // Detailed rotating radar
  const radar = new THREE.Group();
  radar.position.set(0, 20.8, -6);

  const dishBack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.1), darkDetailMat);
  radar.add(dishBack);
  for (let ry = -0.5; ry <= 0.5; ry += 0.25) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 0.15), supMat);
    rib.position.set(0, ry, 0.05);
    radar.add(rib);
  }
  for (let rx = -2; rx <= 2; rx += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.15), supMat);
    rib.position.set(rx, 0, 0.05);
    radar.add(rib);
  }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 4), darkDetailMat);
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 0, 0.4);
  radar.add(horn);

  island.add(radar);
  g.userData.radar = radar; // the game slowly spins it
  g.add(island);

  // Helper to get approximate hull half-width at any Z coordinate to avoid floating parts
  const getHullWidthAt = (z) => {
    const y = -z;
    if (y >= 79) { // bow taper Bezier curve: Y(t) = 79 + 76t - 24t^2
      // Solve 24t^2 - 76t + (y - 79) = 0 using quadratic formula
      const t = (76 - Math.sqrt(5776 - 96 * (y - 79))) / 48;
      return (1 - t * t) * HW;
    }
    if (y <= -110) { // stern rounding
      const t = (-110 - y) / 14;
      return HW * Math.sqrt(1 - t * t * 0.5);
    }
    return HW;
  };

  // AA gun tubs on sponsons along both deck edges (merged into one mesh):
  // a tub ring + a twin-barrel mount each.
  (function gunTubs() {
    const geos = [];
    const tub = () => new THREE.CylinderGeometry(1.5, 1.5, 1.4, 10, 1, true);
    const barrel = () => new THREE.CylinderGeometry(0.07, 0.09, 3.2, 5);
    for (const sx of [-1, 1]) {
      for (const tz of [-96, -52, 8, 64, 100]) {
        const t = tub();
        const x = sx * (DHW - 0.4);
        t.translate(x, DECK_Y - 1.6, tz);
        geos.push(t);
        for (const bo of [-0.35, 0.35]) {
          const b = barrel();
          b.rotateX(Math.PI / 2 - 0.35); // elevated, pointing outboard-ish
          b.rotateY(sx * (Math.PI / 2));
          b.translate(x + sx * 0.8, DECK_Y - 0.4, tz + bo);
          geos.push(b);
        }

        // Detailed Sponson support brackets - snapped to the tapered hull
        const hW = getHullWidthAt(tz);
        const gap = DHW - hW;
        const bracketWidth = Math.max(1.0, gap - 0.4);
        const bracketGeo = new THREE.BoxGeometry(bracketWidth, 0.8, 1.4);
        const bracket = new THREE.Mesh(bracketGeo, hullMat);
        bracket.position.set(sx * (DHW - bracketWidth / 2 - 0.4), DECK_Y - 2.0, tz);
        bracket.rotation.z = sx * 0.15;
        g.add(bracket);
      }
    }
    const m = new THREE.Mesh(mergeGeometries(geos), darkDetailMat);
    g.add(m);
  }());

  // Deck support girders under overhang - snapped to the tapered hull
  for (let zVal = -110; zVal <= 110; zVal += 12) {
    let nearTub = false;
    for (const tz of [-96, -52, 8, 64, 100]) {
      if (Math.abs(zVal - tz) < 4) {
        nearTub = true;
        break;
      }
    }
    if (nearTub) continue;

    for (const sx of [-1, 1]) {
      if (sx === 1 && zVal > -32 && zVal < -4) continue; // skip island area

      const hW = getHullWidthAt(zVal);
      const gap = DHW - hW;
      if (gap <= 0.5) continue; // no overhang here

      const girder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.0, 0.8), hullMat);
      girder.position.set(sx * (hW + gap / 2), DECK_Y - 2.5, zVal);
      girder.rotation.z = -sx * Math.atan2(gap, 3.5);
      g.add(girder);
    }
  }

  // Anchors on both sides of the bow - snapped to the tapered hull
  const anchorGeo = new THREE.BoxGeometry(0.3, 2.5, 0.3);
  const flukeGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 4);
  flukeGeo.rotateX(Math.PI / 2);
  const anchorZ = -112;
  const anchorHullW = getHullWidthAt(anchorZ);
  for (const sx of [-1, 1]) {
    const anchor = new THREE.Group();
    anchor.position.set(sx * (anchorHullW - 0.15), 9, anchorZ);
    anchor.rotation.y = sx * 0.25;
    anchor.rotation.z = sx * 0.12;

    const shank = new THREE.Mesh(anchorGeo, darkDetailMat);
    anchor.add(shank);

    const crown = new THREE.Mesh(flukeGeo, darkDetailMat);
    crown.position.y = -1.2;
    anchor.add(crown);

    g.add(anchor);
  }

  // Boot-topping: a black waterline band so the hull reads as sitting IN the
  // sea rather than floating on it.
  const bandGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.6, bevelEnabled: false });
  bandGeo.rotateX(-Math.PI / 2);
  bandGeo.scale(1.01, 1, 1.005);
  bandGeo.translate(0, -0.5, 0);
  g.add(new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.8 })));

  setShadows(g);
  return { group: g, deck: { y: DECK_Y, w: DECK_W, len: DECK_LEN } };
}

// A general-purpose 250 lb-ish bomb: olive body, ogive nose, tail cone with a
// box-fin ring. Hung under the wings on the Ocean map and dropped as a free
// body. Axis along Z (nose -Z, like everything else), origin at the body centre.
export function makeBomb() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x4d5442, roughness: 0.5, metalness: 0.4 });
  const fin = new THREE.MeshStandardMaterial({ color: 0x3a4036, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
  const R = 0.24; const LEN = 1.5;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN * 0.55, 10), body);
  tube.rotation.x = Math.PI / 2; g.add(tube);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 10, 8), body);
  nose.scale.set(1, 1, 2.1);
  nose.position.z = -LEN * 0.275; g.add(nose);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R, LEN * 0.35, 10), body);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = LEN * 0.45; g.add(tail);
  for (let i = 0; i < 4; i++) { // four tail fins, radial about the tail cone
    const fg = new THREE.PlaneGeometry(R * 1.4, LEN * 0.32);
    fg.rotateX(Math.PI / 2); // spans X (radial) and Z (length)
    fg.translate(R * 0.55, 0, LEN * 0.5); // stand off the tail cone
    fg.rotateZ((i * Math.PI) / 2);
    g.add(new THREE.Mesh(fg, fin));
  }
  setShadows(g);
  return g;
}

// Hang a bomb under each wing of an aircraft group, at the airframe's mount
// point (PLANE_INFO[type].stats.bomb — under the wing, ahead of the CG). Adds
// the two bombs as children of `planeGroup` and returns them [left, right] so
// the caller controls their visibility (the game hides them as they're dropped,
// the inspector toggles them). Shared by the game and the model inspector so
// the mount geometry can't drift.
export function mountWingBombs(planeGroup, type) {
  const b = (PLANE_INFO[type] && PLANE_INFO[type].stats.bomb) || { x: 2.3, y: -0.6, z: -1.6 };
  const racks = [];
  for (const sx of [-1, 1]) {
    const bomb = makeBomb();
    bomb.position.set(sx * b.x, b.y, b.z);
    planeGroup.add(bomb);
    racks.push(bomb);
  }
  return racks;
}
