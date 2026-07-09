// Shared 3D model builders for Plane Sim. This is the SINGLE SOURCE OF TRUTH for
// the geometry: both the game (plane-sim.src.js) and the standalone model
// inspector (plane-viewer.src.js) import these, so what you inspect is exactly
// what flies. Each builder returns a THREE.Group at the origin; callers position
// it. Local forward is -Z, Y is up, units are metres.
import * as THREE from 'three';

// ---- Procedural camouflage -------------------------------------------------
// A canvas texture of irregular elongated blotches over a base coat — reads as
// the RAF temperate land scheme (dark earth + dark green) for the player, or a
// grey scheme for the bandits. Deterministic enough per call; the organic
// randomness is a feature (no two airframes identical).
function camoTexture(baseHex, blotchHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = `#${blotchHex.toString(16).padStart(6, '0')}`;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256; const y = Math.random() * 256;
    const rx = 22 + Math.random() * 46; const ry = 8 + Math.random() * 16;
    const rot = Math.random() * Math.PI;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    // lumpy ellipse: radius modulated as we sweep
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 14) {
      const wob = 0.75 + 0.25 * Math.sin(a * 3 + i);
      const px = Math.cos(a) * rx * wob; const py = Math.sin(a) * ry * wob;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // subtle weathering grain
  for (let i = 0; i < 900; i++) {
    const v = Math.random() * 40;
    ctx.fillStyle = `rgba(0,0,0,${(v / 40) * 0.08})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Planform functions: chord factor [0..1] at spanwise fraction t = |x|/halfSpan.
// - ELLIPTIC: the Spitfire's signature rounded wing.
// - taperedPlanform(taper, round): a straight trapezoid thinning to `taper` at
//   the tip, with the last `round` fraction of span rounded off — the P-51's
//   squared laminar wing (small round) or the Zero's blunt rounded tip (large).
const ELLIPTIC = (t) => Math.sqrt(Math.max(1 - t * t, 0.0008));
const taperedPlanform = (taper, round) => (t) => {
  const lin = 1 - (1 - taper) * t;
  if (t <= 1 - round) return lin;
  const k = (t - (1 - round)) / round;
  return lin * Math.sqrt(Math.max(1 - k * k, 0.0008));
};

// A thin airfoil surface (wings + tailplane). Built by extruding a NACA-ish
// section across the span, then tapering every spanwise station by the
// `planform` function so the wing thins toward the tips — a real aerofoil, not
// a flat slab. `dihedral` (rise per metre of span, e.g. 0.1 ≈ 5.7°) lifts the
// tips like the real Spitfire's wing. Output: span along X, chord along Z
// (leading edge toward -Z), thickness along Y, centred on the origin.
// `cutouts` ([{ x0, x1, z }], in the FINAL frame: x = signed span, z = chord
// aft) notches the trailing edge — vertices inside the span band with z past
// the cut line get clamped to it, leaving a blunt-edged recess a control
// surface slots into (like the real aileron/elevator cut-outs).
function airfoilSurface(halfSpan, chord, thickFrac, dihedral = 0, cutouts = [], planform = ELLIPTIC) {
  const N = 16;
  const yt = (x) => 5 * thickFrac
    * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const shp = new THREE.Shape();
  shp.moveTo(0, 0);
  for (let i = 1; i <= N; i++) { const x = i / N; shp.lineTo(x * chord, yt(x) * chord); }
  for (let i = N - 1; i >= 0; i--) { const x = i / N; shp.lineTo(x * chord, -yt(x) * chord); }
  shp.closePath();
  const geo = new THREE.ExtrudeGeometry(shp, { depth: halfSpan * 2, steps: 48, bevelEnabled: false });
  geo.translate(0, 0, -halfSpan);
  const pos = geo.attributes.position; const midC = chord * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const zSpan = pos.getZ(i);
    let zf = Math.abs(zSpan) / halfSpan; if (zf > 1) zf = 1;
    const cf = planform(zf);
    pos.setX(i, midC + (pos.getX(i) - midC) * cf);
    pos.setY(i, pos.getY(i) * Math.pow(cf, 0.6) + Math.abs(zSpan) * dihedral);
  }
  geo.rotateY(-Math.PI / 2); // span -> X, chord -> +Z
  geo.translate(0, 0, -chord / 2); // centre the chord (leading edge now toward -Z)
  if (cutouts.length) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      for (const cut of cutouts) {
        if (x >= cut.x0 && x <= cut.x1 && pos.getZ(i) > cut.z) pos.setZ(i, cut.z);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// National insignia as single crisp canvas decals (one mesh each, no stacked
// rings to z-fight or splay apart). polygonOffset pulls the decal in front of
// the skin it sits on, so it can hug the surface without flicker. Textures are
// cached (one per markings style, shared by every aircraft).
const _insigniaTex = {};
function insigniaTexture(kind) {
  if (_insigniaTex[kind]) return _insigniaTex[kind];
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (kind === 'raf') { // RAF type-A1 roundel: blue / white / red rings
    c.width = c.height = 256;
    const ring = (r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ring(122, '#14418f');
    ring(76, '#e8e8ec');
    ring(38, '#c01a2b');
  } else if (kind === 'usaaf') { // star-and-bar on a 2:1 canvas
    c.width = 512; c.height = 256;
    const BLUE = '#243a6b'; const WHITE = '#e9eaee';
    // blue surround: bars + disc outline drawn slightly larger, white on top
    ctx.fillStyle = BLUE;
    ctx.fillRect(64, 90, 384, 76); // bar backing (incl. outline)
    ctx.beginPath(); ctx.arc(256, 128, 86, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.fillRect(78, 102, 356, 52); // white bars
    ctx.fillStyle = BLUE;
    ctx.beginPath(); ctx.arc(256, 128, 78, 0, Math.PI * 2); ctx.fill(); // blue disc
    ctx.fillStyle = WHITE; // 5-point star, one point up
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const b = a + Math.PI / 5;
      const R1 = 62; const R2 = 24;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](256 + Math.cos(a) * R1, 128 + Math.sin(a) * R1);
      ctx.lineTo(256 + Math.cos(b) * R2, 128 + Math.sin(b) * R2);
    }
    ctx.closePath(); ctx.fill();
  } else { // 'ijn' hinomaru: red disc with a thin white outline (reads on green)
    c.width = c.height = 256;
    ctx.fillStyle = '#e7e7ea';
    ctx.beginPath(); ctx.arc(128, 128, 116, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bc1f2c';
    ctx.beginPath(); ctx.arc(128, 128, 106, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _insigniaTex[kind] = tex;
  return tex;
}
// A w×h decal quad lying flat in the XZ plane (rotate/position like the old
// roundel discs). Works for round insignia (w == h) and the USAAF bar (2:1).
function decalQuad(tex, w, h) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  g.add(m);
  return g;
}
const roundel = (radius) => decalQuad(insigniaTexture('raf'), radius * 2, radius * 2);
const hinomaru = (radius) => decalQuad(insigniaTexture('ijn'), radius * 2, radius * 2);
const starBar = (w) => decalQuad(insigniaTexture('usaaf'), w, w / 2);

// Chord at spanwise position x for a given planform (defaults elliptical).
function planformChord(x, halfSpan, chord, planform = ELLIPTIC) {
  const t = Math.min(Math.abs(x) / halfSpan, 1);
  return chord * planform(t);
}

// A control surface (aileron / elevator) whose planform follows the parent
// wing's trailing edge — a straight spanwise hinge at the front, a rear edge
// tracing the wing's planform — so it blends into the wing instead of reading
// as a bolted-on box. Returns { holder, pivot }: `holder` is the mounting
// frame (tilted by `tiltZ`/`tiltX` so the hinge line follows the wing's
// dihedral and incidence — a level flap floats above a dihedral wing at one
// end and sinks into it at the other); `pivot` hinges inside it — rotate
// pivot.rotation.x to deflect. x is span (signed), z is chord.
function buildFlap({
  xIn, xOut, halfSpan, chord, midZ, zHinge, thick, y, material, tiltZ = 0, tiltX = 0, planform = ELLIPTIC,
}) {
  const N = 10;
  const shp = new THREE.Shape();
  shp.moveTo(xIn, 0); // inboard end of the straight hinge line
  shp.lineTo(xOut, 0); // outboard end of the hinge line
  for (let i = 0; i <= N; i++) { // curved rear edge tracing the wing trailing edge
    const x = xOut + (xIn - xOut) * (i / N);
    const rear = (midZ + planformChord(x, halfSpan, chord, planform) / 2) - zHinge;
    shp.lineTo(x, Math.max(rear, 0.03));
  }
  shp.closePath();
  const geo = new THREE.ExtrudeGeometry(shp, { depth: thick, bevelEnabled: false });
  geo.translate(0, 0, -thick / 2);
  geo.rotateX(Math.PI / 2); // shape Y (aft chord) -> world +Z, extrude depth -> thickness in Y
  // Wedge section: full `thick` at the hinge tapering to a near-sharp trailing
  // edge, so it reads as a control surface rather than a flat plank.
  const fp = geo.attributes.position;
  const maxRear = Math.max(
    (midZ + planformChord(xIn, halfSpan, chord, planform) / 2) - zHinge,
    (midZ + planformChord(xOut, halfSpan, chord, planform) / 2) - zHinge,
  );
  for (let i = 0; i < fp.count; i++) {
    const aft = Math.min(Math.max(fp.getZ(i) / Math.max(maxRear, 0.001), 0), 1);
    fp.setY(i, fp.getY(i) * (1 - 0.8 * aft));
  }
  geo.computeVertexNormals();
  const holder = new THREE.Group();
  holder.position.set(0, y, zHinge);
  holder.rotation.z = tiltZ;
  holder.rotation.x = tiltX;
  const pivot = new THREE.Group();
  pivot.add(new THREE.Mesh(geo, material));
  holder.add(pivot);
  return { holder, pivot };
}

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
}) {
  const prop = new THREE.Group();
  const spinMat = new THREE.MeshStandardMaterial({ color: spinnerColor, roughness: 0.45, metalness: 0.15 });
  const profile = spinnerProfile.map(([r, y]) => new THREE.Vector2(r, y));
  const spinner = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), spinMat);
  spinner.rotation.x = -Math.PI / 2; // lathe +Y (the nose) -> -Z
  spinner.position.z = zSpinner;
  prop.add(spinner);
  const backplate = new THREE.Mesh(new THREE.CylinderGeometry(backplateR, backplateR, 0.16, 20), spinMat);
  backplate.rotation.x = Math.PI / 2;
  backplate.position.z = zSpinner + 0.03;
  prop.add(backplate);

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

// Undercarriage shared by every aircraft type (all three are taildraggers with
// the same stance): two main gear + tailwheel on retract pivots. All three
// wheel bottoms sit at y = -1.35 so a level aircraft rests cleanly on the deck.
// applyControlSurfaces animates the retract via gear.userData handles.
function makeUndercarriage(metal, tailZ = 4.5) {
  const gear = new THREE.Group();
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.9 });
  const leg = (sideX) => {
    const pivot = new THREE.Group();
    pivot.position.set(sideX * 1.45, 0, -1.0); // belly, under the wing root
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.95, 8), metal);
    strut.position.y = -0.475;
    pivot.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 16), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -0.93; // bottom at -1.35
    pivot.add(wheel);
    gear.userData[sideX < 0 ? 'left' : 'right'] = pivot;
    return pivot;
  };
  gear.add(leg(-1));
  gear.add(leg(1));
  const tail = new THREE.Group();
  const tstrut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), metal);
  tstrut.position.y = -0.55; tail.add(tstrut);
  const twheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12), tyreMat);
  twheel.rotation.z = Math.PI / 2; twheel.position.y = -1.13; tail.add(twheel); // bottom at -1.35
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
      thrust: 38, lift: 0.0054, drag0: 0.0013, pitchRate: 1.6, rollRate: 3.4, controlV: 42, hiSpeedStiff: 0,
      hp: 100, fireInterval: 0.085, gunDmg: 3, gunSpread: 0.006, gunRange: 900,
    },
  },
  p51: {
    label: 'P-51 Mustang',
    desc: 'Fastest in a straight line and a dive, rugged airframe — but heavy: wide turns that want airspeed. Six .50 cals hit hard.',
    stats: {
      thrust: 40, lift: 0.0048, drag0: 0.00105, pitchRate: 1.35, rollRate: 3.0, controlV: 48, hiSpeedStiff: 0,
      hp: 115, fireInterval: 0.11, gunDmg: 5, gunSpread: 0.005, gunRange: 950,
    },
  },
  zero: {
    label: 'A6M Zero',
    desc: 'Untouchable in a slow turn fight and stalls last — but slow, unarmoured, and the controls stiffen in a dive. Two 20 mm cannon: slow to fire, savage on hit.',
    stats: {
      thrust: 33, lift: 0.0063, drag0: 0.00165, pitchRate: 2.0, rollRate: 3.8, controlV: 34, hiSpeedStiff: 0.45,
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

// The Supermarine Spitfire: elliptical wing, duck-egg spinner, RAF temperate
// camouflage with type-A1 roundels and a fin flash.
function buildSpitfire(opts = {}) {
  const enemy = opts.paint != null;
  const markings = opts.markings !== false; // default: RAF roundels + fin flash
  const plane = new THREE.Group();
  const surf = {
    aileronL: null, aileronR: null, elevator: null, rudder: null,
    prop: null, blades: null, propDisc: null, gear: null,
  };

  // Camouflage: RAF dark-earth/dark-green for the player, two-grey for bandits.
  const camoTex = enemy
    ? camoTexture(0x686e75, 0x4d545b)
    : camoTexture(0x6f6440, 0x50633a);
  const mkCamo = (side) => new THREE.MeshStandardMaterial({
    map: camoTex, roughness: 0.6, metalness: 0.12, side: side || THREE.FrontSide,
  });
  const camo1 = mkCamo(); // wings, tail, control surfaces
  // Fuselage shell: same paint but DOUBLE-SIDED so the thin lathe can never
  // read as see-through (a single-sided open shell shows the interior/through).
  const body = mkCamo(THREE.DoubleSide);
  const metal = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xa9dcec, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.55,
  });

  // Fuselage: a smooth lathe of revolution laid along Z. Profile is (radius,
  // lathe-y) where +y becomes the TAIL (+Z) and -y the NOSE (-Z). Slim, widest
  // just forward of centre (engine/cockpit) with a long slender tail.
  const fpts = [
    [0.05, 4.8], [0.16, 4.35], [0.30, 3.4], [0.44, 2.3], [0.54, 1.0],
    [0.60, 0.2], [0.66, -1.4], [0.65, -2.2], [0.60, -3.0], [0.52, -3.7],
    [0.40, -4.25], [0.24, -4.65], [0.05, -4.85],
  ];
  const profile = fpts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), body);
  fuse.rotation.x = Math.PI / 2;
  fuse.scale.set(0.92, 1.06, 1.0); // oval section: a touch taller than wide
  plane.add(fuse);

  // Short turtledeck spine just behind the cockpit (wide front tapering aft).
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.24, 2.4, 14), body);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 0.36, 1.6);
  plane.add(spine);

  // Framed canopy: angled windscreen panel, bubble hood with visible frame
  // hoops, and a headrest fairing behind the pilot.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), glass);
  canopy.scale.set(0.88, 0.92, 1.8);
  canopy.position.set(0, 0.74, -0.05);
  plane.add(canopy);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c3436, roughness: 0.5, metalness: 0.4 });
  for (const [fz, fs] of [[-0.78, 0.78], [0.02, 1.0], [0.66, 0.82]]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.028, 6, 20, Math.PI), frameMat);
    hoop.rotation.z = Math.PI; // arc over the top
    hoop.rotation.y = Math.PI / 2;
    hoop.scale.setScalar(fs);
    hoop.position.set(0, 0.72, -0.05 + fz);
    plane.add(hoop);
  }
  const sill = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 22), frameMat);
  sill.rotation.x = Math.PI / 2; // lay the ring flat (in the X-Z plane)
  sill.scale.set(0.96, 1.9, 1); // stretch along the body (becomes Z after the rotate)
  sill.position.set(0, 0.64, -0.05);
  plane.add(sill);
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.5), body);
  headrest.position.set(0, 0.62, 0.85);
  plane.add(headrest);

  // Exhaust stacks hugging the upper sides of the engine cowl + carb intake
  // under the chin + oval radiator housings under the wings (Spitfire-style).
  const exMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.65, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), exMat);
      ex.position.set(sx * 0.52, 0.46, -2.4 - i * 0.34);
      ex.rotation.y = sx * -0.18;
      plane.add(ex);
    }
  }
  const chin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 10), exMat);
  chin.rotation.x = Math.PI / 2;
  chin.position.set(0, -0.62, -3.2);
  plane.add(chin);
  const radMat = new THREE.MeshStandardMaterial({ color: 0x565b52, roughness: 0.6, metalness: 0.4 });
  for (const sx of [-1, 1]) {
    const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.15, 10), radMat);
    rad.rotation.x = Math.PI / 2;
    rad.scale.set(1.25, 1, 0.65); // squashed oval duct
    rad.position.set(sx * 1.5, -0.34, 0.55);
    plane.add(rad);
  }

  // Wing: a single thin airfoil, elliptical planform, ~11 m span, with real
  // dihedral (tips ~0.55 m above the roots — the classic Spitfire sit).
  const WING_HALF = 5.5;
  const WING_CHORD = 2.0;
  const DIHEDRAL = 0.1; // rise per metre of span
  const AIL_IN = 2.5; const AIL_OUT = 4.7; // aileron span band
  const ailHingeZ = -0.05 + 0.30; // straight spanwise hinge line (world z)
  // Trailing edge notched over the aileron bands — the ailerons slot INTO the
  // wing (like the real cut-outs) instead of overlapping it.
  const wing = new THREE.Mesh(
    airfoilSurface(WING_HALF, WING_CHORD, 0.105, DIHEDRAL, [
      { x0: -AIL_OUT - 0.06, x1: -AIL_IN + 0.06, z: ailHingeZ + 0.05 - 0.03 },
      { x0: AIL_IN - 0.06, x1: AIL_OUT + 0.06, z: ailHingeZ + 0.05 - 0.03 },
    ]),
    camo1,
  );
  wing.position.set(0, -0.18, -0.05);
  wing.rotation.x = -0.025; // slight angle of incidence
  plane.add(wing);
  for (const side of [-1, 1]) {
    if (markings) {
      const r = roundel(0.56);
      // Hug the (dihedral-raised, cambered) wing top surface: tilt WITH the
      // dihedral (top normal leans inboard on the raised wing) and match the
      // wing's angle of incidence. Sits forward of the aileron notch so the
      // decal never overhangs the cut-out.
      r.position.set(side * 2.9, wing.position.y + 2.9 * DIHEDRAL + 0.095, wing.position.z - 0.32);
      r.rotation.z = side * Math.atan(DIHEDRAL);
      r.rotation.x = wing.rotation.x;
      plane.add(r);
    }

    // Aileron whose planform follows the wing's elliptical trailing edge so it
    // fills the notch cut into the wing (same camo). The holder is tilted with
    // the wing's dihedral + incidence so the hinge line lies IN the wing
    // surface across the whole span (a level flap floats at one end and sinks
    // at the other).
    const flap = buildFlap({
      xIn: side < 0 ? -AIL_OUT : AIL_IN,
      xOut: side < 0 ? -AIL_IN : AIL_OUT,
      halfSpan: WING_HALF,
      chord: WING_CHORD,
      midZ: wing.position.z,
      zHinge: ailHingeZ,
      thick: 0.1,
      y: wing.position.y, // root height; the dihedral tilt raises it outboard
      material: camo1,
      tiltZ: side * Math.atan(DIHEDRAL),
      tiltX: wing.rotation.x,
    });
    plane.add(flap.holder);
    if (side < 0) surf.aileronL = flap.pivot; else surf.aileronR = flap.pivot;

    plane.add(navLight(side, side * (WING_HALF - 0.12), wing.position.y + WING_HALF * DIHEDRAL, wing.position.z));
  }

  // Tail: thin elliptical tailplane + elevator, curved fin + rudder. The
  // tailplane trailing edge is notched (cut z is geometry-local) so the
  // elevator slots into it.
  const TAIL_Z = 4.5;
  const hstab = new THREE.Mesh(
    airfoilSurface(2.25, 1.0, 0.085, 0, [{ x0: -2.16, x1: 2.16, z: 0.15 }]),
    camo1,
  );
  hstab.position.set(0, 0.12, TAIL_Z);
  plane.add(hstab);
  // Elevator — conforms to the tailplane's elliptical trailing edge (one piece).
  const elevFlap = buildFlap({
    xIn: -2.1,
    xOut: 2.1,
    halfSpan: 2.25,
    chord: 1.0,
    midZ: TAIL_Z,
    zHinge: TAIL_Z + 0.18,
    thick: 0.07,
    y: 0.12,
    material: camo1,
  });
  plane.add(elevFlap.holder);
  surf.elevator = elevFlap.pivot;

  // Vertical fin: rounded leading edge but a VERTICAL trailing edge at x=FIN_TE,
  // so the rudder mounts flush against it instead of floating behind a swept
  // edge. Solid paint (not the camo map): extrude/box UVs squeeze the whole
  // texture into the part, which reads as a muddy near-black slab.
  const finMat = new THREE.MeshStandardMaterial({
    color: enemy ? 0x585e65 : 0x556036, roughness: 0.6, metalness: 0.12,
  });
  const FIN_TE = 0.95;
  // The vertical TE runs high (1.30) so the fin + rudder-horn tops form ONE
  // continuous dome across the hinge line, not two separate round lobes.
  const finShape = new THREE.Shape();
  finShape.moveTo(0.1, 0); // base leading edge
  finShape.lineTo(FIN_TE, 0); // base trailing edge
  finShape.lineTo(FIN_TE, 1.30); // top of the vertical trailing edge
  finShape.quadraticCurveTo(FIN_TE - 0.1, 1.44, 0.55, 1.38); // short top round
  finShape.quadraticCurveTo(0.16, 1.18, 0.1, 0.7); // curved leading edge
  finShape.lineTo(0.1, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, steps: 1,
  });
  finGeo.translate(-0.035, 0, -0.045);
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.rotation.y = -Math.PI / 2; // chord -> +Z, height -> Y
  fin.position.set(0, 0.06, TAIL_Z);
  plane.add(fin);
  // Rudder: a shaped extrusion continuing the fin — straight hinge edge up the
  // fin's vertical trailing edge, a rounded balance horn over the fin top, and
  // a curved trailing edge bulging aft then sweeping down to the tail cone
  // (the classic Spitfire rudder outline). Hinged about Y at the fin TE.
  const rPivot = new THREE.Group();
  rPivot.position.set(0, 0.06, TAIL_Z + FIN_TE);
  const rudShape = new THREE.Shape();
  rudShape.moveTo(0, 0.02); // bottom of the hinge line
  rudShape.lineTo(0, 1.30); // straight hinge edge (matches the fin TE height)
  rudShape.quadraticCurveTo(0.02, 1.45, 0.16, 1.46); // horn continues the fin's top curve
  rudShape.quadraticCurveTo(0.40, 1.40, 0.46, 0.95); // upper trailing edge
  rudShape.quadraticCurveTo(0.46, 0.38, 0.20, 0.05); // sweep down to the tail cone
  rudShape.lineTo(0, 0.02);
  const rudGeo = new THREE.ExtrudeGeometry(rudShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, steps: 1,
  });
  rudGeo.translate(0, 0, -0.025); // centre the thickness on the fin plane
  const rud = new THREE.Mesh(rudGeo, finMat);
  rud.rotation.y = -Math.PI / 2; // shape x -> aft (+Z), shape y -> up
  rPivot.add(rud);
  plane.add(rPivot);
  surf.rudder = rPivot;

  // Aerial: mast behind the canopy + a wire back to the FIN TIP (the fin's
  // rounded top peaks at ~(y 1.40, z TAIL_Z+0.55) in plane space — the wire
  // must land there, not float above the tail). A thin cylinder rather than a
  // 1px THREE.Line so it survives distance/AA.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 6), frameMat);
  mast.position.set(0, 0.85, 1.15);
  plane.add(mast);
  const wireFrom = new THREE.Vector3(0, 1.11, 1.16); // mast tip
  const wireTo = new THREE.Vector3(0, 1.41, TAIL_Z + 0.52); // just under the fin tip
  const wireDir = new THREE.Vector3().subVectors(wireTo, wireFrom);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, wireDir.length(), 5), frameMat);
  wire.position.copy(wireFrom).addScaledVector(wireDir, 0.5);
  wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wireDir.normalize());
  plane.add(wire);

  // RAF fin flash + fuselage roundels — pure flavour (player only).
  if (markings) {
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xc01a2b, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    for (const sx of [-1, 1]) {
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.8), flashMat);
      flash.position.set(sx * 0.08, 0.6, TAIL_Z + 0.62); // just proud of the fin skin + bevel
      flash.rotation.y = sx * (Math.PI / 2);
      plane.add(flash);
    }
    for (const sx of [-1, 1]) {
      const r = roundel(0.5);
      r.rotation.z = -sx * (Math.PI / 2); // face outward from the fuselage side
      r.position.set(sx * 0.52, 0.08, 1.15);
      plane.add(r);
    }
  }

  // Nose: rounded duck-egg spinner (the classic pale Spitfire nose; bandits
  // keep a dark one) + 4 black paddle blades with yellow tips.
  const pa = makePropAssembly({
    spinnerProfile: [
      [0.5, 0], [0.475, 0.3], [0.41, 0.62], [0.3, 0.92], [0.17, 1.12], [0.05, 1.24], [0.001, 1.27],
    ],
    spinnerColor: enemy ? 0x40454c : 0xd9dfd0,
    backplateR: 0.48,
    zSpinner: -4.45,
    zBlades: -4.8,
    count: 4,
    bladeLen: 1.5, // ~3.5 m prop disc
    bladeColor: 0x17191d,
    tipColor: 0xffd83f,
    discR: 1.7,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  const gear = makeUndercarriage(metal);
  plane.add(gear);
  surf.gear = gear;

  setShadows(plane);
  return { group: plane, surf };
}

// Subtle panel-line grid for bare-metal skins: a light aluminium base with
// faint darker panel seams and mottling, so the P-51's natural-metal finish
// reads as riveted panels instead of one smooth chrome blob.
function bareMetalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d6dade';
  ctx.fillRect(0, 0, 256, 256);
  // adjacent panels rolled from different batches: faint tonal patches
  for (let i = 0; i < 14; i++) {
    const v = 200 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},0.5)`;
    ctx.fillRect(Math.floor(Math.random() * 8) * 32, Math.floor(Math.random() * 8) * 32, 32 + Math.random() * 64, 32 + Math.random() * 64);
  }
  ctx.fillStyle = 'rgba(70,76,84,0.5)'; // panel seams
  for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 1, 256);
  for (let y = 0; y < 256; y += 43) ctx.fillRect(0, y, 256, 1);
  ctx.fillStyle = 'rgba(90,96,104,0.5)'; // rivet lines
  for (let y = 21; y < 256; y += 43) {
    for (let x = 2; x < 256; x += 7) ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// The North American P-51D Mustang: bare-metal fighter with the yellow spinner
// + nose band of the 361st FG reference, black anti-glare panel, deep belly
// radiator scoop, laminar trapezoid wing with squared tips, bubble canopy and
// a tall squared fin with a dorsal fillet. USAAF star-and-bar insignia.
function buildP51(opts = {}) {
  const enemy = opts.paint != null;
  const markings = opts.markings !== false;
  const plane = new THREE.Group();
  const surf = {
    aileronL: null, aileronR: null, elevator: null, rudder: null,
    prop: null, blades: null, propDisc: null, gear: null,
  };

  // Natural-metal skin (bandits get a dull gunmetal version of the same
  // panels). Metalness stays LOW: with no environment map a real metal only
  // reflects the handful of scene lights and renders near-black from most
  // angles — the aluminium look is carried by the pale panel texture instead.
  const metalSkin = new THREE.MeshStandardMaterial({
    map: bareMetalTexture(),
    color: enemy ? 0x878c93 : 0xfafcff,
    roughness: enemy ? 0.6 : 0.48,
    metalness: 0.06,
  });
  const body = metalSkin.clone();
  body.side = THREE.DoubleSide; // thin lathe shell must never read see-through
  // Control surfaces in a duller finish: on the glossy skin the wedge taper
  // tilts the top face into the key light and the whole surface glints white,
  // reading as a detached panel rather than a hinged part of the wing.
  const ctrlSkin = new THREE.MeshStandardMaterial({
    map: metalSkin.map, color: enemy ? 0x7b8086 : 0xd7dbe0, roughness: 0.62, metalness: 0.15,
  });
  const YELLOW = 0xdfa93c;
  const metal = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xa9dcec, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.55,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c3436, roughness: 0.5, metalness: 0.4 });

  // Fuselage: deep-bellied lathe, widest around the wing root, long slim tail
  // (the P-51's razorback is CUT DOWN behind the bubble canopy — no spine).
  const fpts = [
    [0.04, 4.85], [0.13, 4.5], [0.24, 3.7], [0.35, 2.8], [0.45, 1.7],
    [0.52, 0.7], [0.58, -0.4], [0.62, -1.5], [0.62, -2.6], [0.60, -3.3],
    [0.56, -3.9], [0.49, -4.5],
  ];
  const profile = fpts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), body);
  fuse.rotation.x = Math.PI / 2;
  fuse.scale.set(0.9, 1.12, 1.0); // deep, narrow section
  plane.add(fuse);

  // Anti-glare panel: an olive-drab arc hugging the nose top from windscreen to
  // spinner (a tapered open cylinder, scaled a touch proud of the fuselage).
  const agMat = new THREE.MeshStandardMaterial({
    color: 0x2e3325, roughness: 0.9, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const antiGlare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.63, 0.5, 3.2, 18, 1, true, Math.PI - 0.62, 1.24),
    agMat,
  );
  antiGlare.rotation.x = Math.PI / 2; // axis -> Z, arc over the top
  antiGlare.scale.set(0.92, 1.14, 1);
  antiGlare.position.z = -2.95; // windscreen base back to the spinner
  plane.add(antiGlare);

  // Yellow nose band right behind the spinner (the 361st FG group marking).
  const noseBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.575, 0.565, 0.42, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: YELLOW, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
  );
  noseBand.rotation.x = Math.PI / 2;
  noseBand.scale.set(0.93, 1.15, 1);
  noseBand.position.z = -4.26;
  if (!enemy) plane.add(noseBand);

  // Bubble canopy on the cut-down rear deck: angled windscreen wedge + one bow
  // frame + the clean teardrop hood (no hoops — that's the point of a bubble).
  const wind = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), glass);
  wind.scale.set(0.8, 0.72, 1.1);
  wind.position.set(0, 0.66, -1.18);
  plane.add(wind);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.44, 22, 16), glass);
  bubble.scale.set(0.86, 0.95, 1.85);
  bubble.position.set(0, 0.72, -0.32);
  plane.add(bubble);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 6, 20, Math.PI), frameMat);
  bow.rotation.z = Math.PI;
  bow.rotation.y = Math.PI / 2;
  bow.position.set(0, 0.7, -1.02);
  plane.add(bow);
  const sill = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 22), frameMat);
  sill.rotation.x = Math.PI / 2;
  sill.scale.set(0.95, 2.0, 1);
  sill.position.set(0, 0.6, -0.35);
  plane.add(sill);

  // Exhaust stacks: six short stubs per side along the nose.
  const exMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.65, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.24), exMat);
      ex.position.set(sx * 0.49, 0.3, -2.55 - i * 0.28);
      ex.rotation.y = sx * -0.18;
      plane.add(ex);
    }
  }

  // THE Mustang signature: the deep belly radiator scoop aft of the wing, with
  // a dark intake mouth up front.
  const scoop = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 2.1, 6, 14), body);
  scoop.rotation.x = Math.PI / 2;
  scoop.scale.set(1.08, 1, 1);
  scoop.position.set(0, -0.6, 1.35);
  plane.add(scoop);
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.27, 16),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }),
  );
  mouth.rotation.y = Math.PI; // face forward (-Z)
  mouth.scale.set(1.08, 1, 1);
  mouth.position.set(0, -0.63, 0.18);
  plane.add(mouth);
  // Carburettor chin intake tucked under the spinner.
  const chin = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.8, 4, 10), body);
  chin.rotation.x = Math.PI / 2;
  chin.scale.set(1.3, 1, 1);
  chin.position.set(0, -0.62, -3.85);
  plane.add(chin);

  // Laminar-flow wing: straight trapezoid tapering to squared tips (only the
  // last ~12% of span is rounded off), less dihedral than the Spit.
  const P51_WING = taperedPlanform(0.48, 0.12);
  const WING_HALF = 5.6;
  const WING_CHORD = 2.25;
  const DIHEDRAL = 0.09;
  const AIL_IN = 2.7; const AIL_OUT = 4.9;
  const wingY = -0.24; const wingZ = -0.15;
  const ailHingeZ = wingZ + 0.36;
  const wing = new THREE.Mesh(
    airfoilSurface(WING_HALF, WING_CHORD, 0.1, DIHEDRAL, [
      { x0: -AIL_OUT - 0.06, x1: -AIL_IN + 0.06, z: ailHingeZ + 0.02 },
      { x0: AIL_IN - 0.06, x1: AIL_OUT + 0.06, z: ailHingeZ + 0.02 },
    ], P51_WING),
    metalSkin,
  );
  wing.position.set(0, wingY, wingZ);
  wing.rotation.x = -0.02;
  plane.add(wing);
  for (const side of [-1, 1]) {
    if (markings) {
      const s = starBar(1.7);
      s.position.set(side * 3.1, wingY + 3.1 * DIHEDRAL + 0.088, wingZ - 0.3);
      s.rotation.z = side * Math.atan(DIHEDRAL);
      s.rotation.x = wing.rotation.x;
      plane.add(s);
    }
    const flap = buildFlap({
      xIn: side < 0 ? -AIL_OUT : AIL_IN,
      xOut: side < 0 ? -AIL_IN : AIL_OUT,
      halfSpan: WING_HALF,
      chord: WING_CHORD,
      midZ: wingZ,
      zHinge: ailHingeZ,
      thick: 0.09,
      y: wingY,
      material: ctrlSkin,
      tiltZ: side * Math.atan(DIHEDRAL),
      tiltX: wing.rotation.x,
      planform: P51_WING,
    });
    plane.add(flap.holder);
    if (side < 0) surf.aileronL = flap.pivot; else surf.aileronR = flap.pivot;
    plane.add(navLight(side, side * (WING_HALF - 0.12), wingY + WING_HALF * DIHEDRAL, wingZ));
  }

  // Tail: trapezoid tailplane + squared fin with the dorsal fillet.
  const TAIL_Z = 4.4;
  const P51_TAILPLANE = taperedPlanform(0.5, 0.15);
  const hstab = new THREE.Mesh(
    airfoilSurface(2.4, 1.1, 0.08, 0, [{ x0: -2.3, x1: 2.3, z: 0.18 }], P51_TAILPLANE),
    metalSkin,
  );
  hstab.position.set(0, 0.14, TAIL_Z);
  plane.add(hstab);
  const elevFlap = buildFlap({
    xIn: -2.25,
    xOut: 2.25,
    halfSpan: 2.4,
    chord: 1.1,
    midZ: TAIL_Z,
    zHinge: TAIL_Z + 0.21,
    thick: 0.07,
    y: 0.14,
    material: ctrlSkin,
    planform: P51_TAILPLANE,
  });
  plane.add(elevFlap.holder);
  surf.elevator = elevFlap.pivot;

  const finMat = new THREE.MeshStandardMaterial({
    color: enemy ? 0x7d8288 : 0xb9bec6, roughness: 0.55, metalness: 0.3,
  });
  // Angular Mustang tail: strongly swept leading edge, near-flat top, vertical
  // trailing edge the squared rudder hangs on (one continuous top line across
  // the hinge — not two round lobes).
  const FIN_TE = 0.88;
  const finShape = new THREE.Shape();
  finShape.moveTo(0.1, 0);
  finShape.lineTo(FIN_TE, 0);
  finShape.lineTo(FIN_TE, 1.42); // tall vertical trailing edge
  finShape.quadraticCurveTo(FIN_TE - 0.04, 1.5, 0.52, 1.48); // small top round
  finShape.lineTo(0.2, 0.35); // straight swept leading edge
  finShape.quadraticCurveTo(0.14, 0.12, 0.1, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, steps: 1,
  });
  finGeo.translate(-0.035, 0, -0.045);
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, 0.1, TAIL_Z);
  plane.add(fin);
  // Dorsal fillet: a low blade running up the spine into the fin's swept LE.
  const filletShape = new THREE.Shape();
  filletShape.moveTo(0, 0.08);
  filletShape.lineTo(1.75, 0.5);
  filletShape.lineTo(1.75, 0);
  filletShape.lineTo(0, -0.1);
  filletShape.closePath();
  const fillet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(filletShape, { depth: 0.09, bevelEnabled: false }),
    finMat,
  );
  fillet.geometry.translate(0, 0, -0.045);
  fillet.rotation.y = -Math.PI / 2; // shape x -> +Z (aft), y -> up
  fillet.position.set(0, 0.26, TAIL_Z - 1.6);
  plane.add(fillet);
  // Rudder: squared to match the fin — straight hinge edge, small top corner,
  // straight trailing edge tapering down to the tail cone.
  const rPivot = new THREE.Group();
  rPivot.position.set(0, 0.1, TAIL_Z + FIN_TE - 0.02);
  const rudShape = new THREE.Shape();
  rudShape.moveTo(0, 0.02);
  rudShape.lineTo(0, 1.42);
  rudShape.quadraticCurveTo(0.02, 1.5, 0.12, 1.49);
  rudShape.lineTo(0.34, 1.05); // straight upper trailing edge
  rudShape.lineTo(0.37, 0.55);
  rudShape.quadraticCurveTo(0.37, 0.25, 0.16, 0.04);
  rudShape.lineTo(0, 0.02);
  const rudGeo = new THREE.ExtrudeGeometry(rudShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, steps: 1,
  });
  rudGeo.translate(0, 0, -0.025);
  const rud = new THREE.Mesh(rudGeo, finMat);
  rud.rotation.y = -Math.PI / 2;
  rPivot.add(rud);
  plane.add(rPivot);
  surf.rudder = rPivot;

  // Whip aerial behind the canopy (no wire on the D — the bubble hood has none).
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.5, 6), frameMat);
  mast.position.set(0, 0.62, 0.95);
  mast.rotation.x = 0.15;
  plane.add(mast);

  // Fuselage star-and-bar, aft of the cockpit on both sides.
  if (markings) {
    for (const sx of [-1, 1]) {
      const s = starBar(1.35);
      // Map decal up (+Y) onto ±X (face outward) with the bar running along Z.
      s.rotation.set(-sx * (Math.PI / 2), 0, -sx * (Math.PI / 2));
      s.position.set(sx * 0.5, 0.12, 1.35);
      plane.add(s);
    }
  }

  // Nose: big pointed spinner (yellow on the player's TIKA-IV scheme) + 4 wide
  // paddle blades — black with yellow tips.
  const pa = makePropAssembly({
    spinnerProfile: [
      [0.55, 0], [0.52, 0.28], [0.44, 0.55], [0.32, 0.8], [0.17, 0.98], [0.05, 1.08], [0.001, 1.12],
    ],
    spinnerColor: enemy ? 0x40454c : YELLOW,
    backplateR: 0.55,
    zSpinner: -4.42,
    zBlades: -4.75,
    count: 4,
    bladeLen: 1.65,
    bladeWidth: 1.25, // the P-51's wide "paddle" blades
    bladeColor: 0x17191d,
    tipColor: 0xffd83f,
    rootY: 0.3,
    discR: 1.85,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  const gear = makeUndercarriage(metal, 4.4);
  plane.add(gear);
  surf.gear = gear;

  setShadows(plane);
  return { group: plane, surf };
}

// The Mitsubishi A6M Zero: black radial cowl with an exposed engine face,
// glossy IJN dark-green skin, long framed greenhouse canopy, big rounded
// wingtips with yellow leading-edge ID strips, and hinomaru insignia.
function buildZero(opts = {}) {
  const enemy = opts.paint != null;
  const markings = opts.markings !== false;
  const plane = new THREE.Group();
  const surf = {
    aileronL: null, aileronR: null, elevator: null, rudder: null,
    prop: null, blades: null, propDisc: null, gear: null,
  };

  // Glossy IJN green (bandits get a flat grey-green).
  const mkGreen = (side) => new THREE.MeshStandardMaterial({
    color: enemy ? 0x676d64 : 0x27452f,
    roughness: enemy ? 0.6 : 0.38,
    metalness: 0.15,
    side: side || THREE.FrontSide,
  });
  const green = mkGreen();
  const body = mkGreen(THREE.DoubleSide);
  const cowlMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.35, metalness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xa9dcec, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.55,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x21301f, roughness: 0.5, metalness: 0.3 });

  // Fuselage: round section, widest just behind the cowl, tapering to the tail.
  const fpts = [
    [0.05, 4.5], [0.14, 4.15], [0.26, 3.3], [0.37, 2.3], [0.47, 1.2],
    [0.55, 0.2], [0.60, -0.9], [0.62, -2.0], [0.61, -2.9], [0.58, -3.75],
  ];
  const profile = fpts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), body);
  fuse.rotation.x = Math.PI / 2;
  fuse.scale.set(0.94, 1.02, 1.0);
  plane.add(fuse);

  // Radial engine cowling: short black barrel with a rounded intake lip, a
  // dark engine face behind it and a small pale spinner poking through.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.58, 1.05, 24, 1, true), cowlMat);
  cowl.rotation.x = Math.PI / 2; // rTop -> aft (widest where it meets the fuselage)
  cowl.position.z = -4.1;
  plane.add(cowl);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 10, 24), cowlMat);
  lip.position.z = -4.62;
  plane.add(lip);
  const engFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0x191b1e, roughness: 0.85 }),
  );
  engFace.rotation.y = Math.PI;
  engFace.position.z = -4.56;
  plane.add(engFace);
  // Hint of the radial: a ring of stubby cylinder heads around the crankcase.
  const cylMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.1), cylMat);
    head.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -4.6);
    head.rotation.z = a + Math.PI / 2;
    plane.add(head);
  }

  // Turtledeck spine flowing from the canopy back to the fin.
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.22, 2.3, 14), body);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 0.32, 1.6);
  plane.add(spine);

  // Long greenhouse canopy: an elongated glass shell under a row of frame
  // hoops — the many-paned look of the real sliding hood.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), glass);
  canopy.scale.set(0.85, 0.8, 2.6);
  canopy.position.set(0, 0.66, -0.15);
  plane.add(canopy);
  for (const [fz, fs] of [[-0.98, 0.74], [-0.5, 0.94], [0.02, 1.0], [0.5, 0.94], [0.92, 0.8]]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.026, 6, 20, Math.PI), frameMat);
    hoop.rotation.z = Math.PI;
    hoop.rotation.y = Math.PI / 2;
    hoop.scale.setScalar(fs);
    hoop.position.set(0, 0.64, -0.15 + fz);
    plane.add(hoop);
  }
  const sill = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 22), frameMat);
  sill.rotation.x = Math.PI / 2;
  sill.scale.set(0.96, 2.9, 1);
  sill.position.set(0, 0.58, -0.15);
  plane.add(sill);

  // Twin exhaust stubs low on the cowl sides.
  const exMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.65, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.3), exMat);
    ex.position.set(sx * 0.52, -0.25, -3.55);
    plane.add(ex);
  }

  // Wing: generous span with big blunt rounded tips (the long-range wing that
  // made the Zero turn like nothing else), slight extra dihedral.
  const ZERO_WING = taperedPlanform(0.55, 0.28);
  const WING_HALF = 6.0;
  const WING_CHORD = 2.2;
  const DIHEDRAL = 0.105;
  const AIL_IN = 3.0; const AIL_OUT = 5.4;
  const wingY = -0.2; const wingZ = -0.1;
  const ailHingeZ = wingZ + 0.33;
  const wing = new THREE.Mesh(
    airfoilSurface(WING_HALF, WING_CHORD, 0.1, DIHEDRAL, [
      { x0: -AIL_OUT - 0.06, x1: -AIL_IN + 0.06, z: ailHingeZ + 0.02 },
      { x0: AIL_IN - 0.06, x1: AIL_OUT + 0.06, z: ailHingeZ + 0.02 },
    ], ZERO_WING),
    green,
  );
  wing.position.set(0, wingY, wingZ);
  wing.rotation.x = -0.03;
  plane.add(wing);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xd9a52e, roughness: 0.55, metalness: 0.15 });
  for (const side of [-1, 1]) {
    if (markings) {
      const h = hinomaru(0.62);
      h.position.set(side * 3.3, wingY + 3.3 * DIHEDRAL + 0.085, wingZ - 0.3);
      h.rotation.z = side * Math.atan(DIHEDRAL);
      h.rotation.x = wing.rotation.x;
      plane.add(h);
    }
    // Yellow leading-edge ID strips: two short bars wrapping the outer LE,
    // each swept to follow the tapered leading edge.
    if (!enemy) {
      for (const [x0, x1] of [[3.25, 4.2], [4.3, 5.2]]) {
        const xm = (x0 + x1) / 2;
        const le = (x) => wingZ - planformChord(x, WING_HALF, WING_CHORD, ZERO_WING) / 2 + 0.1;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.09, 0.26), stripMat);
        strip.position.set(side * xm, wingY + xm * DIHEDRAL + 0.02, le(xm));
        strip.rotation.y = side * Math.atan2(le(x1) - le(x0), x1 - x0) * -1;
        strip.rotation.z = side * Math.atan(DIHEDRAL);
        plane.add(strip);
      }
    }
    const flap = buildFlap({
      xIn: side < 0 ? -AIL_OUT : AIL_IN,
      xOut: side < 0 ? -AIL_IN : AIL_OUT,
      halfSpan: WING_HALF,
      chord: WING_CHORD,
      midZ: wingZ,
      zHinge: ailHingeZ,
      thick: 0.09,
      y: wingY,
      material: green,
      tiltZ: side * Math.atan(DIHEDRAL),
      tiltX: wing.rotation.x,
      planform: ZERO_WING,
    });
    plane.add(flap.holder);
    if (side < 0) surf.aileronL = flap.pivot; else surf.aileronR = flap.pivot;
    plane.add(navLight(side, side * (WING_HALF - 0.12), wingY + WING_HALF * DIHEDRAL, wingZ));
  }

  // Tail: rounded tailplane + the Zero's rounded, fairly upright fin.
  const TAIL_Z = 4.15;
  const hstab = new THREE.Mesh(
    airfoilSurface(2.2, 1.0, 0.085, 0, [{ x0: -2.1, x1: 2.1, z: 0.15 }]),
    green,
  );
  hstab.position.set(0, 0.14, TAIL_Z);
  plane.add(hstab);
  const elevFlap = buildFlap({
    xIn: -2.05,
    xOut: 2.05,
    halfSpan: 2.2,
    chord: 1.0,
    midZ: TAIL_Z,
    zHinge: TAIL_Z + 0.18,
    thick: 0.07,
    y: 0.14,
    material: green,
  });
  plane.add(elevFlap.holder);
  surf.elevator = elevFlap.pivot;

  const finMat = new THREE.MeshStandardMaterial({
    color: enemy ? 0x5c625a : 0x203a28, roughness: 0.45, metalness: 0.15,
  });
  // Fin TE runs high so the fin + rudder-horn tops read as ONE rounded dome
  // across the hinge line (not two lobes) — same trick as the Spitfire tail.
  const FIN_TE = 0.78;
  const finShape = new THREE.Shape();
  finShape.moveTo(0.1, 0);
  finShape.lineTo(FIN_TE, 0);
  finShape.lineTo(FIN_TE, 1.3);
  finShape.quadraticCurveTo(FIN_TE - 0.08, 1.42, 0.44, 1.36);
  finShape.lineTo(0.15, 0.45); // gently swept leading edge
  finShape.quadraticCurveTo(0.11, 0.15, 0.1, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, steps: 1,
  });
  finGeo.translate(-0.035, 0, -0.045);
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0, 0.08, TAIL_Z);
  plane.add(fin);
  const rPivot = new THREE.Group();
  rPivot.position.set(0, 0.08, TAIL_Z + FIN_TE - 0.03); // snug against the fin TE

  const rudShape = new THREE.Shape();
  rudShape.moveTo(0, 0.02);
  rudShape.lineTo(0, 1.3); // straight hinge edge matching the fin TE height
  rudShape.quadraticCurveTo(0.02, 1.43, 0.16, 1.44); // horn continues the dome
  rudShape.quadraticCurveTo(0.44, 1.26, 0.46, 0.72);
  rudShape.quadraticCurveTo(0.46, 0.26, 0.18, 0.04);
  rudShape.lineTo(0, 0.02);
  const rudGeo = new THREE.ExtrudeGeometry(rudShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, steps: 1,
  });
  rudGeo.translate(0, 0, -0.025);
  const rud = new THREE.Mesh(rudGeo, finMat);
  rud.rotation.y = -Math.PI / 2;
  rPivot.add(rud);
  plane.add(rPivot);
  surf.rudder = rPivot;

  // Aerial: mast behind the canopy + wire back to the fin tip.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 6), frameMat);
  mast.position.set(0, 0.82, 1.0);
  plane.add(mast);
  const wireFrom = new THREE.Vector3(0, 1.08, 1.01);
  const wireTo = new THREE.Vector3(0, 1.3, TAIL_Z + 0.4);
  const wireDir = new THREE.Vector3().subVectors(wireTo, wireFrom);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, wireDir.length(), 5), frameMat);
  wire.position.copy(wireFrom).addScaledVector(wireDir, 0.5);
  wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wireDir.normalize());
  plane.add(wire);

  // Fuselage hinomaru on both sides.
  if (markings) {
    for (const sx of [-1, 1]) {
      const h = hinomaru(0.4);
      h.rotation.z = -sx * (Math.PI / 2);
      h.position.set(sx * 0.48, 0.05, 1.25);
      plane.add(h);
    }
  }

  // Nose: small pale spinner poking out of the black cowl + 3 bare-metal
  // blades with yellow tips.
  const pa = makePropAssembly({
    spinnerProfile: [
      [0.17, 0], [0.14, 0.16], [0.07, 0.3], [0.001, 0.36],
    ],
    spinnerColor: 0xcfd3d6,
    backplateR: 0.17,
    zSpinner: -4.66,
    zBlades: -4.75,
    count: 3,
    bladeLen: 1.5,
    bladeWidth: 0.95,
    bladeColor: 0x7e838a,
    tipColor: 0xd9a52e,
    rootY: 0.12,
    discR: 1.62,
  });
  plane.add(pa.prop);
  surf.prop = pa.prop;
  surf.blades = pa.blades;
  surf.propDisc = pa.propDisc;

  const gear = makeUndercarriage(metal, 4.2);
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
    const r = (1 - gear) * (Math.PI / 2);
    // Main legs fold INWARD toward the fuselage centreline (rotate about the
    // fore-aft Z axis), tucking the wheels up under the wing root; the tailwheel
    // retracts forward.
    if (surf.gear.userData.left) surf.gear.userData.left.rotation.z = r;
    if (surf.gear.userData.right) surf.gear.userData.right.rotation.z = -r;
    if (surf.gear.userData.tail) surf.gear.userData.tail.rotation.x = -r;
    surf.gear.visible = gear > 0.02;
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
  // Sock: 5 frustums streaming along +Z, alternating orange/white, tapering and
  // drooping. Each segment is a short open cone; a small pitch per segment sags
  // the tail like a light-wind sock.
  const orange = new THREE.MeshStandardMaterial({ color: 0xe06a1e, roughness: 0.8, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.8, side: THREE.DoubleSide });
  const sock = new THREE.Group();
  sock.position.set(0, 6.9, 0.45);
  let z = 0; let r0 = 0.4; let pitch = 0;
  for (let i = 0; i < 5; i++) {
    const r1 = r0 * 0.82;
    const len = 0.62;
    pitch += 0.12; // progressive droop
    z += len * Math.cos(pitch);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, len, 14, 1, true),
      i % 2 ? white : orange,
    );
    seg.rotation.x = Math.PI / 2; // axis along Z
    seg.position.set(0, -Math.sin(pitch) * (i * 0.16), 0.31 + (z - len / 2));
    sock.add(seg);
    r0 = r1;
  }
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
