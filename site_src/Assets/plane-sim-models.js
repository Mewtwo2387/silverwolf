// Shared 3D model builders for Plane Sim. This is the SINGLE SOURCE OF TRUTH for
// the geometry: both the game (plane-sim.src.js) and the standalone model
// inspector (plane-viewer.src.js) import these, so what you inspect is exactly
// what flies. Each builder returns a THREE.Group at the origin; callers position
// it. Local forward is -Z, Y is up, units are metres.
import * as THREE from 'three';

// A thin, elliptical-planform airfoil surface (wings + tailplane). Built by
// extruding a NACA-ish section across the span, then tapering every spanwise
// station elliptically so the wing thins to sharp tips — a real aerofoil, not a
// flat slab. Output: span along X, chord along Z (leading edge toward -Z),
// thickness along Y, centred on the origin.
function airfoilSurface(halfSpan, chord, thickFrac) {
  const N = 16;
  const yt = (x) => 5 * thickFrac
    * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const shp = new THREE.Shape();
  shp.moveTo(0, 0);
  for (let i = 1; i <= N; i++) { const x = i / N; shp.lineTo(x * chord, yt(x) * chord); }
  for (let i = N - 1; i >= 0; i--) { const x = i / N; shp.lineTo(x * chord, -yt(x) * chord); }
  shp.closePath();
  const geo = new THREE.ExtrudeGeometry(shp, { depth: halfSpan * 2, steps: 26, bevelEnabled: false });
  geo.translate(0, 0, -halfSpan);
  const pos = geo.attributes.position; const midC = chord * 0.5;
  for (let i = 0; i < pos.count; i++) {
    let zf = pos.getZ(i) / halfSpan; if (zf > 1) zf = 1; else if (zf < -1) zf = -1;
    const cf = Math.sqrt(Math.max(1 - zf * zf, 0.0008)); // elliptical chord factor
    pos.setX(i, midC + (pos.getX(i) - midC) * cf);
    pos.setY(i, pos.getY(i) * Math.pow(cf, 0.6)); // thickness thins slightly slower
  }
  geo.rotateY(-Math.PI / 2); // span -> X, chord -> +Z
  geo.translate(0, 0, -chord / 2); // centre the chord (leading edge now toward -Z)
  geo.computeVertexNormals();
  return geo;
}

function roundel(radius) {
  const g = new THREE.Group();
  const ring = (r, col) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }),
    );
    m.rotation.x = -Math.PI / 2;
    g.add(m);
    return m;
  };
  ring(radius, 0x113a8c).position.y = 0.001;
  ring(radius * 0.6, 0xe8e8ec).position.y = 0.002;
  ring(radius * 0.3, 0xc01a2b).position.y = 0.003;
  return g;
}

// Elliptical chord at spanwise position x (planform half-width function).
function ellipChord(x, halfSpan, chord) {
  const t = Math.min(Math.abs(x) / halfSpan, 1);
  return chord * Math.sqrt(Math.max(1 - t * t, 0));
}

// A control surface (aileron / elevator) whose planform follows the parent
// wing's elliptical trailing edge — a straight spanwise hinge at the front, a
// curved rear edge matching the wing — so it blends into the wing instead of
// reading as a bolted-on box. Returns a pivot group hinged on its front edge;
// rotate pivot.rotation.x to deflect it. x is span (signed), z is chord.
function buildFlap({
  xIn, xOut, halfSpan, chord, midZ, zHinge, thick, y, material,
}) {
  const N = 10;
  const shp = new THREE.Shape();
  shp.moveTo(xIn, 0); // inboard end of the straight hinge line
  shp.lineTo(xOut, 0); // outboard end of the hinge line
  for (let i = 0; i <= N; i++) { // curved rear edge tracing the wing trailing edge
    const x = xOut + (xIn - xOut) * (i / N);
    const rear = (midZ + ellipChord(x, halfSpan, chord) / 2) - zHinge;
    shp.lineTo(x, Math.max(rear, 0.03));
  }
  shp.closePath();
  const geo = new THREE.ExtrudeGeometry(shp, { depth: thick, bevelEnabled: false });
  geo.translate(0, 0, -thick / 2);
  geo.rotateX(Math.PI / 2); // shape Y (aft chord) -> world +Z, extrude depth -> thickness in Y
  geo.computeVertexNormals();
  const pivot = new THREE.Group();
  pivot.position.set(0, y, zHinge);
  pivot.add(new THREE.Mesh(geo, material));
  return pivot;
}

const setShadows = (obj) => obj.traverse((o) => {
  if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
});

// ---- The Spitfire-ish prop fighter. Returns { group, surf }, where surf holds
//      the animatable handles (control-surface pivots, prop, gear). ----
export function buildAircraft() {
  const plane = new THREE.Group();
  const surf = {
    aileronL: null, aileronR: null, elevator: null, rudder: null, prop: null, gear: null,
  };

  const mkPaint = (hex, side) => new THREE.MeshStandardMaterial({
    color: hex, roughness: 0.55, metalness: 0.12, side: side || THREE.FrontSide,
  });
  const camo1 = mkPaint(0x586a39); // olive — wings, tail, control surfaces
  // Fuselage shell: same olive but DOUBLE-SIDED so the thin lathe can never
  // read as see-through (a single-sided open shell shows the interior/through).
  const body = mkPaint(0x586a39, THREE.DoubleSide);
  const metal = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xa9dcec, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.62,
  });

  // Fuselage: a smooth lathe of revolution laid along Z. Profile is (radius,
  // lathe-y) where +y becomes the TAIL (+Z) and -y the NOSE (-Z). Slim, widest
  // just forward of centre (engine/cockpit) with a long slender tail — much
  // closer to the real Spitfire's fineness than the old blimp shape.
  const fpts = [
    [0.05, 4.8], [0.20, 4.2], [0.36, 3.2], [0.50, 1.8], [0.60, 0.2],
    [0.66, -1.4], [0.64, -2.6], [0.54, -3.6], [0.34, -4.3], [0.05, -4.8],
  ];
  const profile = fpts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const fuse = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), body);
  fuse.rotation.x = Math.PI / 2;
  fuse.scale.set(0.92, 1.06, 1.0); // oval section: a touch taller than wide
  plane.add(fuse);

  // Short turtledeck spine just behind the cockpit (wide front tapering aft);
  // kept short so it doesn't float above the slender tapering tail.
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.26, 2.6, 14), body);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 0.42, 1.7);
  plane.add(spine);

  // Framed bubble canopy, raised so it clearly sits ON TOP of the (now slimmer)
  // fuselage and reads as a cockpit. An opaque oval sill ring frames its base.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 16), glass);
  canopy.scale.set(0.9, 0.95, 1.85);
  canopy.position.set(0, 0.74, -0.05);
  plane.add(canopy);
  const sill = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 22), metal);
  sill.rotation.x = Math.PI / 2; // lay the ring flat (in the X-Z plane)
  sill.scale.set(0.96, 1.9, 1); // stretch along the body (becomes Z after the rotate)
  sill.position.set(0, 0.64, -0.05); // ring the canopy where it meets the fuselage top
  plane.add(sill);

  // Exhaust stacks hugging the upper sides of the engine cowl (placed inside the
  // cowl radius so they sit flush, not floating) + a radiator under the wing.
  const exMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.65, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), exMat);
      ex.position.set(sx * 0.52, 0.46, -2.4 - i * 0.34);
      ex.rotation.y = sx * -0.18;
      plane.add(ex);
    }
  }
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 1.5), metal);
  rad.position.set(1.55, -0.5, 0.6);
  plane.add(rad);

  // Wing: a single thin airfoil, elliptical planform, ~11 m span.
  const WING_HALF = 5.5;
  const WING_CHORD = 2.0;
  const wing = new THREE.Mesh(airfoilSurface(WING_HALF, WING_CHORD, 0.105), camo1);
  wing.position.set(0, -0.12, -0.05);
  wing.rotation.x = -0.025; // slight angle of incidence
  plane.add(wing);
  const ailHingeZ = wing.position.z + 0.30; // straight spanwise hinge line
  for (const side of [-1, 1]) {
    const r = roundel(0.78);
    r.position.set(side * 3.25, 0.0, wing.position.z);
    plane.add(r);

    // Aileron whose planform follows the wing's elliptical trailing edge so it
    // blends into the wing (same colour) instead of being a bolted-on box.
    const flap = buildFlap({
      xIn: side < 0 ? -4.7 : 2.5,
      xOut: side < 0 ? -2.5 : 4.7,
      halfSpan: WING_HALF,
      chord: WING_CHORD,
      midZ: wing.position.z,
      zHinge: ailHingeZ,
      thick: 0.05,
      y: wing.position.y,
      material: camo1,
    });
    plane.add(flap);
    if (side < 0) surf.aileronL = flap; else surf.aileronR = flap;
  }

  // Tail: thin elliptical tailplane + elevator, curved fin + rudder.
  const TAIL_Z = 4.5;
  const hstab = new THREE.Mesh(airfoilSurface(2.25, 1.0, 0.085), camo1);
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
    thick: 0.045,
    y: 0.12,
    material: camo1,
  });
  plane.add(elevFlap);
  surf.elevator = elevFlap;

  // Vertical fin: rounded leading edge but a VERTICAL trailing edge at x=FIN_TE,
  // so the rudder mounts flush against it instead of floating behind a swept edge.
  const FIN_TE = 1.35;
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); // base leading edge
  finShape.lineTo(FIN_TE, 0); // base trailing edge
  finShape.lineTo(FIN_TE, 1.55); // top of the vertical trailing edge
  finShape.quadraticCurveTo(FIN_TE - 0.18, 1.96, 0.55, 1.9); // rounded top
  finShape.quadraticCurveTo(0.06, 1.66, 0, 1.0); // curved leading edge
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, steps: 1,
  });
  finGeo.translate(-0.035, 0, -0.045);
  const fin = new THREE.Mesh(finGeo, camo1);
  fin.rotation.y = -Math.PI / 2; // chord -> +Z, height -> Y
  fin.position.set(0, 0.06, TAIL_Z);
  plane.add(fin);
  // Rudder: flush against the fin's vertical trailing edge, hinged about Y.
  const rPivot = new THREE.Group();
  rPivot.position.set(0, 0.06, TAIL_Z + FIN_TE);
  const rud = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.62), camo1);
  rud.position.set(0, 0.78, 0.31); // span up from the base, extending aft of the hinge
  rPivot.add(rud);
  plane.add(rPivot);
  surf.rudder = rPivot;

  // RAF fin flash — pure flavour.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xc01a2b, roughness: 0.8, side: THREE.DoubleSide }),
  );
  flash.position.set(0.06, 0.9, TAIL_Z + 0.95);
  flash.rotation.y = Math.PI / 2;
  plane.add(flash);

  // Nose: pointed spinner + backplate + 3 pitched blades on a spin pivot.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 20), metal);
  spinner.rotation.x = -Math.PI / 2; // point -Z
  spinner.position.z = -5.05;
  prop.add(spinner);
  const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.16, 20), metal);
  backplate.rotation.x = Math.PI / 2;
  backplate.position.z = -4.55;
  prop.add(backplate);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 3) * Math.PI * 2; // 120° apart
    arm.position.z = -4.8;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.05), bladeMat);
    blade.position.y = 0.86; // extend outward from the hub (~3.2 m prop disc)
    blade.rotation.y = 0.34; // blade pitch
    arm.add(blade);
    prop.add(arm);
  }
  plane.add(prop);
  surf.prop = prop;

  // Undercarriage: two main gear + tailwheel on retract pivots. All three wheel
  // bottoms sit at y = -1.35 so a level aircraft rests cleanly on the deck.
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
  tail.position.set(0, 0, 4.5);
  gear.add(tail);
  gear.userData.tail = tail;
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

// ---- Scenery (shared so the inspector can show them too) ----

// A tree: trunk + two stacked, colour-varied cones. Random foliage tint + scale
// are baked in so a field of these varies; the caller just sets position.
export function makeTree() {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4.5, 6), trunkMat);
  trunk.position.y = 2.2; tree.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.45, 0.22 + Math.random() * 0.08),
    roughness: 1,
  });
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(3.8, 7, 7), leafMat); c1.position.y = 6.5; tree.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5.5, 7), leafMat); c2.position.y = 9.8; tree.add(c2);
  tree.scale.setScalar(0.8 + Math.random() * 1.3);
  setShadows(tree);
  return tree;
}

// A Quonset-hut hangar: a full cylinder on its side. Designed to sit half-buried
// — the lower half is hidden by the ground plane, leaving a clean curved
// half-tube above the deck.
export function makeHangar() {
  const g = new THREE.Group();
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x7f858d, roughness: 0.92 });
  const hut = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 38, 20), hutMat);
  hut.rotation.z = Math.PI / 2; // lay the axis along X
  g.add(hut);
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
