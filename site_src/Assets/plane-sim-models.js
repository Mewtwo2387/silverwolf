// Shared 3D model builders for Plane Sim. This is the SINGLE SOURCE OF TRUTH for
// the geometry: both the game (plane-sim.src.js) and the standalone model
// inspector (plane-viewer.src.js) import these, so what you inspect is exactly
// what flies. Each builder returns a THREE.Group at the origin; callers position
// it. Local forward is -Z, Y is up, units are metres.
import * as THREE from 'three';
import { REF_P51_PARTS, REF_ZERO_PARTS, REF_SPIT_PARTS } from './plane-sim-refmeshes.js';

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
  // Blur disc (hidden by default; the game fades it in with RPM).
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
function makeUndercarriage(metal, tailZ = 4.5, mainZ = -1.0, groundY = 1.35, attachY = 0, doorColor = 0x8f959c) {
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
  // tailwheel: short oleo + fork straddling a small wheel
  const tail = new THREE.Group();
  const tLen = groundY - 0.25;
  const tstrut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, tLen, 8), metal);
  tstrut.position.y = -tLen / 2;
  tail.add(tstrut);
  for (const fx of [-0.085, 0.085]) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.14), metal);
    tine.position.set(fx, -groundY + 0.36, 0.02);
    tine.rotation.x = 0.25;
    tail.add(tine);
  }
  const twheel = makeWheel(0.21, 0.14);
  twheel.position.y = -groundY + 0.21; // bottom at -groundY
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
      hp: 100, fireInterval: 0.085, gunDmg: 3, gunSpread: 0.006, gunRange: 900,
    },
  },
  p51: {
    label: 'P-51 Mustang',
    desc: 'Fastest in a straight line and a dive, rugged airframe — but heavy: wide turns that want airspeed. Six .50 cals hit hard.',
    stats: {
      thrust: 40, lift: 0.0048, drag0: 0.00105, pitchRate: 1.35, rollRate: 3.0, controlV: 48, hiSpeedStiff: 0, groundY: 1.6,
      hp: 115, fireInterval: 0.11, gunDmg: 5, gunSpread: 0.005, gunRange: 950,
    },
  },
  zero: {
    label: 'A6M Zero',
    desc: 'Untouchable in a slow turn fight and stalls last — but slow, unarmoured, and the controls stiffen in a dive. Two 20 mm cannon: slow to fire, savage on hit.',
    stats: {
      thrust: 33, lift: 0.0063, drag0: 0.00165, pitchRate: 2.0, rollRate: 3.8, controlV: 34, hiSpeedStiff: 0.45, groundY: 1.35,
      hp: 70, fireInterval: 0.16, gunDmg: 8, gunSpread: 0.008, gunRange: 750,
    },
  },
};

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
    const tex = new THREE.TextureLoader().load(`/static/planes/${name}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    _refTexCache[name] = tex;
  }
  return _refTexCache[name];
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
        roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide,
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

const REF_METAL = () => new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.4, metalness: 0.7 });

// The Supermarine Spitfire — the FBX reference model (RAF camouflage with
// 303 Sqn "RF-J" codes, cannon barrels, pitot, separate glass canopy). Its
// own spinner stays in the hull; the game adds spinning blades, gear and a
// pilot under the glass. Ailerons/elevator came separated in the source;
// the rudder was carved off the fin.
function buildSpitfire(opts = {}) {
  const { plane, surf } = buildRefPlane(REF_SPIT_PARTS, opts);
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
  const gear = makeUndercarriage(REF_METAL(), 4.1, -2.05, 1.5, -0.72, 0x9fae9b); // Sky-type undersides
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
  const { plane, surf } = buildRefPlane(REF_P51_PARTS, opts);
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
  const gear = makeUndercarriage(REF_METAL(), 4.3, -1.9, 1.6, -0.6, 0xb4b9bf); // natural-metal doors
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
  const { plane, surf } = buildRefPlane(REF_ZERO_PARTS, opts);
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
  const gear = makeUndercarriage(REF_METAL(), 4.0, -2.3, 1.35, -0.28, 0x9aa39b); // grey-green doors
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
  if (surf.rudder) surf.rudder.rotation.y = -rud;
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 });
  if (t === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5; tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.31 + Math.random() * 0.05, 0.35, 0.16 + Math.random() * 0.07),
      roughness: 1,
    });
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.0, 11, 7), leafMat); c.position.y = 11.2; tree.add(c);
    tree.scale.setScalar(0.8 + Math.random() * 0.9);
  } else if (t === 'broadleaf') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 3.8, 6), trunkMat);
    trunk.position.y = 1.9; tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.22 + Math.random() * 0.09, 0.5, 0.28 + Math.random() * 0.09),
      roughness: 1,
    });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), leafMat);
    canopy.scale.y = 0.85; canopy.position.y = 5.6; tree.add(canopy);
    tree.scale.setScalar(0.6 + Math.random() * 1.1);
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4.5, 6), trunkMat);
    trunk.position.y = 2.2; tree.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.45, 0.22 + Math.random() * 0.08),
      roughness: 1,
    });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(3.8, 7, 7), leafMat); c1.position.y = 6.5; tree.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5.5, 7), leafMat); c2.position.y = 9.8; tree.add(c2);
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

  // Corrugated-steel texture. On the cylinder UV, u wraps the arch (hoop) and
  // v runs along the building — so flutes that run OVER the arch (like a real
  // Nissen hut) alternate along v: horizontal stripes on the canvas. The
  // sheet-lap seams are rings around the arch: also constant-v lines, but
  // darker and widely spaced.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d848c';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) { // corrugation flutes (run over the arch)
    const grd = ctx.createLinearGradient(0, y, 0, y + 8);
    grd.addColorStop(0, 'rgba(255,255,255,0.20)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.04)');
    grd.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y, 256, 8);
  }
  for (const y of [0, 128]) { // sheet-lap seam rings
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, y + 3, 256, 1);
  }
  for (let i = 0; i < 46; i++) { // rust/grime streaks washing down the arch (u direction)
    const x = Math.random() * 256; const y = Math.random() * 256;
    const len = 30 + Math.random() * 40;
    const grad = ctx.createLinearGradient(x, 0, x + len, 0);
    grad.addColorStop(0, `rgba(96,74,52,${0.10 + Math.random() * 0.16})`);
    grad.addColorStop(1, 'rgba(96,74,52,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, len, 2 + Math.random() * 3);
  }
  const skinTex = new THREE.CanvasTexture(c);
  skinTex.colorSpace = THREE.SRGBColorSpace;
  skinTex.wrapS = skinTex.wrapT = THREE.RepeatWrapping;
  skinTex.repeat.set(4, 8); // u wraps the arch (hoop), v runs along the length
  skinTex.anisotropy = 8;
  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex, roughness: 0.85, metalness: 0.25, side: THREE.DoubleSide,
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
  const concrete = new THREE.MeshStandardMaterial({ color: 0xc2c8ce, roughness: 0.85 });
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
  const bundMat = new THREE.MeshStandardMaterial({ color: 0x8a8168, roughness: 1 });
  // Low metalness so the tank reads as pale painted steel, not a near-black
  // mirror (no environment map in the scene to reflect).
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa39c, roughness: 0.62, metalness: 0.15 });
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
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x55645b, roughness: 0.75, metalness: 0.12 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x859089, roughness: 0.6, metalness: 0.15 });
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
  const skin = new THREE.MeshStandardMaterial({
    map: corrugatedTexture('#8a8f8b', 6, 3), roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide,
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
