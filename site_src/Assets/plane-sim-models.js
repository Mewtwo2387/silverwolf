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

// A thin, elliptical-planform airfoil surface (wings + tailplane). Built by
// extruding a NACA-ish section across the span, then tapering every spanwise
// station elliptically so the wing thins to sharp tips — a real aerofoil, not a
// flat slab. `dihedral` (rise per metre of span, e.g. 0.1 ≈ 5.7°) lifts the
// tips like the real Spitfire's wing. Output: span along X, chord along Z
// (leading edge toward -Z), thickness along Y, centred on the origin.
// `cutouts` ([{ x0, x1, z }], in the FINAL frame: x = signed span, z = chord
// aft) notches the trailing edge — vertices inside the span band with z past
// the cut line get clamped to it, leaving a blunt-edged recess a control
// surface slots into (like the real aileron/elevator cut-outs).
function airfoilSurface(halfSpan, chord, thickFrac, dihedral = 0, cutouts = []) {
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
    let zf = zSpan / halfSpan; if (zf > 1) zf = 1; else if (zf < -1) zf = -1;
    const cf = Math.sqrt(Math.max(1 - zf * zf, 0.0008)); // elliptical chord factor
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

// RAF roundel as a single crisp canvas decal (one mesh, no stacked rings to
// z-fight or splay apart). polygonOffset pulls it in front of the skin it sits
// on, so it can hug the surface without flicker.
let _roundelTex = null;
function roundelTexture() {
  if (_roundelTex) return _roundelTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const ring = (r, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ring(122, '#14418f');
  ring(76, '#e8e8ec');
  ring(38, '#c01a2b');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _roundelTex = tex;
  return tex;
}
function roundel(radius) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshStandardMaterial({
      map: roundelTexture(),
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

// Elliptical chord at spanwise position x (planform half-width function).
function ellipChord(x, halfSpan, chord) {
  const t = Math.min(Math.abs(x) / halfSpan, 1);
  return chord * Math.sqrt(Math.max(1 - t * t, 0));
}

// A control surface (aileron / elevator) whose planform follows the parent
// wing's elliptical trailing edge — a straight spanwise hinge at the front, a
// curved rear edge matching the wing — so it blends into the wing instead of
// reading as a bolted-on box. Returns { holder, pivot }: `holder` is the
// mounting frame (tilted by `tiltZ`/`tiltX` so the hinge line follows the
// wing's dihedral and incidence — a level flap floats above a dihedral wing at
// one end and sinks into it at the other); `pivot` hinges inside it — rotate
// pivot.rotation.x to deflect. x is span (signed), z is chord.
function buildFlap({
  xIn, xOut, halfSpan, chord, midZ, zHinge, thick, y, material, tiltZ = 0, tiltX = 0,
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
  // Wedge section: full `thick` at the hinge tapering to a near-sharp trailing
  // edge, so it reads as a control surface rather than a flat plank.
  const fp = geo.attributes.position;
  const maxRear = Math.max(
    (midZ + ellipChord(xIn, halfSpan, chord) / 2) - zHinge,
    (midZ + ellipChord(xOut, halfSpan, chord) / 2) - zHinge,
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

// ---- The Spitfire-ish prop fighter. Returns { group, surf }, where surf holds
//      the animatable handles (control-surface pivots, prop, blades, propDisc,
//      gear). opts.paint switches to the bandit grey scheme and
//      opts.markings === false drops the RAF roundels + fin flash. ----
export function buildAircraft(opts = {}) {
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

    // Wingtip navigation lights: port red, starboard green.
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({
        color: side < 0 ? 0xff3333 : 0x33ff55,
        emissive: side < 0 ? 0xcc1111 : 0x11cc33,
        emissiveIntensity: 1.4,
      }),
    );
    tip.position.set(side * (WING_HALF - 0.12), wing.position.y + WING_HALF * DIHEDRAL, wing.position.z);
    plane.add(tip);
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

  // Nose: pointed spinner + backplate + 4 pitched blades on a spin pivot, plus
  // a translucent "blur disc" the game shows instead of the blades at speed.
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
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2; // 90° apart
    arm.position.z = -4.8;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.55, 0.05), bladeMat);
    blade.position.y = 0.88; // extend outward from the hub (~3.3 m prop disc)
    blade.rotation.y = 0.34; // blade pitch
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
    new THREE.CircleGeometry(1.7, 28),
    new THREE.MeshBasicMaterial({
      map: discTex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  propDisc.position.z = -4.8;
  propDisc.visible = false;
  prop.add(propDisc);
  plane.add(prop);
  surf.prop = prop;
  surf.blades = blades;
  surf.propDisc = propDisc;

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
