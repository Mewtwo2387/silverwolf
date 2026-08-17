// Plane Sim — coastal airfield construction. Builds the tarmac runway (markings,
// threshold + edge paint), a glazed control tower, Quonset-hut hangars, Nissen
// huts, a dispersed fuel installation, a bowser, windsocks, a perimeter fence
// and a few parked aircraft — then registers their collision volumes and joins
// the shared dispersal/defence set. Extracted from plane-sim.src.js; receives
// the game's obstacle-registry sinks and shared groups via `env`.
import * as THREE from 'three';
import {
  makeControlTower, makeHangar, makeNissenHut, makeFuelTank, makeBowser,
  makeWindsock, buildAircraft,
} from './plane-sim-models.js';
import { fbm } from './plane-sim-terrain.js';
import { GFX, loadSceneryTexture } from './plane-sim-quality.js';

// env: { CFG, landGroup, addCyl, addBox, obBox, registerWet, windsocks, airfieldExtras }
export function buildAirfield(env) {
  const {
    CFG, landGroup, addCyl, addBox, obBox, registerWet, windsocks, airfieldExtras,
  } = env;
  const field = new THREE.Group(); // 3D structures (cast + receive shadow)
  const markings = new THREE.Group(); // flat ground paint (receive only)

  const asphaltTex = loadSceneryTexture('/static/planes/asphalt.jpg');
  asphaltTex.colorSpace = THREE.SRGBColorSpace;
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.anisotropy = GFX.aniso;

  const tarmacTex = asphaltTex.clone();
  tarmacTex.repeat.set(3, 60);

  const tarmacGeo = new THREE.PlaneGeometry(CFG.RUNWAY_W, CFG.RUNWAY_LEN, 2, 24);
  const tarmacPos = tarmacGeo.attributes.position;
  const tarmacCols = new Float32Array(tarmacPos.count * 3);
  const tarmacBase = new THREE.Color(0x8b8f95);
  for (let i = 0; i < tarmacPos.count; i++) {
      const wx = tarmacPos.getX(i);
      const wz = -tarmacPos.getY(i);
      const n1 = fbm(wx * 0.005, wz * 0.005, 2);
      const n2 = fbm(wx * 0.06, wz * 0.06, 2);
      const factor = 0.58 + n1 * 0.26 + n2 * 0.16;
      tarmacCols[i * 3] = tarmacBase.r * factor;
      tarmacCols[i * 3 + 1] = tarmacBase.g * factor;
      tarmacCols[i * 3 + 2] = tarmacBase.b * factor;
    }
  tarmacGeo.setAttribute('color', new THREE.BufferAttribute(tarmacCols, 3));

  const tarmac = new THREE.Mesh(
    tarmacGeo,
    new THREE.MeshStandardMaterial({ map: tarmacTex, color: 0xffffff, roughness: 0.88, vertexColors: true }),
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.y = 0.12;
  tarmac.receiveShadow = true;
  markings.add(tarmac);
  registerWet(tarmac.material);

  const paint = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.8 });
  registerWet(paint);
  const flat = (geo, x, z) => {
    const m = new THREE.Mesh(geo, paint);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.18, z); m.receiveShadow = true;
    markings.add(m);
  };
  for (const sx of [-1, 1]) flat(new THREE.PlaneGeometry(0.8, CFG.RUNWAY_LEN - 20), sx * (CFG.RUNWAY_W / 2 - 1.2), 0);
  for (let z = -CFG.RUNWAY_LEN / 2 + 24; z < CFG.RUNWAY_LEN / 2 - 24; z += 26) flat(new THREE.PlaneGeometry(1.1, 11), 0, z);
  for (const end of [-1, 1]) {
    for (let i = -4; i <= 4; i++) flat(new THREE.PlaneGeometry(2.2, 9), i * 3.2, end * (CFG.RUNWAY_LEN / 2 - 9));
  }

  // ---- Paved taxiways: a perimeter track down the west side linking the two
  //      runway thresholds, with spur links out to the hangar apron. Flat
  //      tarmac like the runway (receive shadow only). ----
  const taxiTex = asphaltTex.clone();
  taxiTex.repeat.set(1.5, 30);
  const taxiMat = new THREE.MeshStandardMaterial({ map: taxiTex, color: 0xffffff, roughness: 0.88, vertexColors: true });
  registerWet(taxiMat);
  const taxi = (w, l, x, z, rot = 0) => {
    const geo = new THREE.PlaneGeometry(w, l, Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(l / 10)));
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x90949a);
    const cosZ = Math.cos(rot);
    const sinZ = Math.sin(rot);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const wx = x + lx * cosZ + ly * sinZ;
      const wz = z + lx * -sinZ + ly * cosZ;
      const n1 = fbm(wx * 0.005, wz * 0.005, 2);
      const n2 = fbm(wx * 0.06, wz * 0.06, 2);
      const factor = 0.58 + n1 * 0.26 + n2 * 0.16;
      cols[i * 3] = base.r * factor;
      cols[i * 3 + 1] = base.g * factor;
      cols[i * 3 + 2] = base.b * factor;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, taxiMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    m.position.set(x, 0.13, z); m.receiveShadow = true;
    markings.add(m);
  };
  const TAXI_X = -30; // perimeter track centreline, just west of the runway
  taxi(11, CFG.RUNWAY_LEN - 40, TAXI_X, 0); // main perimeter track (N-S)
  for (const z of [40, -34]) taxi(30, 10, (TAXI_X - 42) / 2, z); // spurs to the hangars
  for (const end of [-1, 1]) { // links from the track to each runway threshold
    taxi(Math.abs(TAXI_X) + 4, 11, TAXI_X / 2 + 2, end * (CFG.RUNWAY_LEN / 2 - 30));
  }
  // Hangar apron pad.
  taxi(50, 130, -60, 3);

  const tower = makeControlTower();
  tower.position.set(46, 0, 150);
  field.add(tower);
  addCyl(46, 150, 5, 30, 'Flew into the control tower');

  for (let i = 0; i < 2; i++) {
    const hut = makeHangar();
    const hz = 40 - i * 74;
    hut.position.set(-56, 0, hz);
    field.add(hut);
    // Hangar arch: axis along X (LEN 38 -> ±19), R 9 span/height.
    addBox(-56 - 19, -56 + 19, hz - 9, hz + 9, 9, 'Flew into a hangar');
  }

  // ---- A row of Nissen huts (accommodation / stores) behind the hangars. ----
  for (let i = 0; i < 4; i++) {
    const len = 8 + (i % 2) * 3;
    const hut = makeNissenHut(len);
    const hz = -45 + i * 30;
    hut.position.set(-92, 0, hz);
    hut.rotation.y = Math.PI / 2; // ridge line runs across, doors face the apron
    field.add(hut);
    // Rotated 90°, so the length runs along X and the 2.6 m radius along Z.
    addBox(-92 - len / 2, -92 + len / 2, hz - 2.6, hz + 2.6, 2.6, 'Clipped a hut');
  }

  // ---- Dispersed bulk-fuel installation, kept well clear of the hangars in
  //      the SE corner, plus a bowser parked on the apron. ----
  for (const [fx, fz] of [[86, -60], [98, -60], [92, -74]]) {
    const tank = makeFuelTank();
    tank.position.set(fx, 0, fz);
    field.add(tank);
    addCyl(fx, fz, 3.4, 6, 'Flew into a fuel tank');
  }
  const bowser = makeBowser();
  bowser.position.set(-40, 0, 70);
  bowser.rotation.y = 1.1;
  field.add(bowser);
  addCyl(-40, 70, 3.4, 2.6, 'Flew into a bowser');

  // ---- Windsocks by each runway threshold (offset to the east side).
  //      Collected so the frame loop can flutter them in the breeze. ----
  for (const wz of [CFG.RUNWAY_LEN / 2 - 30, -(CFG.RUNWAY_LEN / 2 - 30)]) {
    const sock = makeWindsock();
    sock.position.set(34, 0, wz);
    sock.rotation.y = Math.PI * 0.15;
    sock.userData.yaw0 = sock.rotation.y; // calm-weather heading (wind steering restores it)
    field.add(sock);
    windsocks.push(sock);
  }

  // ---- Perimeter security fence around the technical site (hangars, huts,
  //      fuel), with a gate gap on the runway side for the taxi spurs. Chain
  //      link on posts: one alpha-textured panel per run + instanced posts. ----
  (function fenceCompound() {
    const lc = document.createElement('canvas');
    lc.width = lc.height = 64;
    const lx = lc.getContext('2d');
    lx.strokeStyle = 'rgba(196,201,206,0.85)';
    lx.lineWidth = 2;
    for (let o = -64; o < 64; o += 12) { // diagonal chain-link diamonds
      lx.beginPath(); lx.moveTo(o, 0); lx.lineTo(o + 64, 64); lx.stroke();
      lx.beginPath(); lx.moveTo(o + 64, 0); lx.lineTo(o, 64); lx.stroke();
    }
    const linkTex = new THREE.CanvasTexture(lc);
    linkTex.colorSpace = THREE.SRGBColorSpace;
    linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping;
    const FH = 2.3; // fence height
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b9095, roughness: 0.6, metalness: 0.4 });
    const posts = [];
    const runFence = (x1, z1, x2, z2) => {
      const dx = x2 - x1; const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const mat = new THREE.MeshStandardMaterial({
        map: linkTex.clone(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
        roughness: 0.8, metalness: 0.3, color: 0xd2d6da,
      });
      mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
      mat.map.repeat.set(len / 2, FH / 2);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, FH), mat);
      panel.position.set((x1 + x2) / 2, FH / 2, (z1 + z2) / 2);
      // Align the plane's local +X (its width) with the run direction (dx,dz).
      // A rotation.y of `a` sends local +X to (cos a, 0, -sin a), so a =
      // atan2(-dz, dx). (The old atan2(dx,dz) left N-S runs lying across X.)
      panel.rotation.y = Math.atan2(-dz, dx);
      field.add(panel);
      const n = Math.max(2, Math.round(len / 4));
      for (let i = 0; i <= n; i++) posts.push([x1 + (dx * i) / n, z1 + (dz * i) / n]);
    };
    const W = -104; const E = -24; const N = 108; const S = -96;
    runFence(W, S, W, N); // west
    runFence(W, N, E, N); // north
    runFence(W, S, E, S); // south
    runFence(E, S, E, -18); // east (lower) — gate gap between -18 and 22
    runFence(E, 22, E, N); // east (upper)
    const postGeo = new THREE.CylinderGeometry(0.09, 0.09, FH + 0.3, 6);
    postGeo.translate(0, (FH + 0.3) / 2, 0);
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    const pm = new THREE.Matrix4();
    for (let i = 0; i < posts.length; i++) {
      pm.makeTranslation(posts[i][0], 0, posts[i][1]);
      postMesh.setMatrixAt(i, pm);
    }
    postMesh.castShadow = true;
    field.add(postMesh);
  }());

  // Parked aircraft — one of each flyable type: a Spitfire and a P-51 tucked
  // inside the hangars (nose out the +X door, wheels on the 0.14 m slab) and
  // a Zero on the grass by the apron.
  for (const [type, px, py, pz, ry] of [
    ['spitfire', -58, 1.49, 40, -Math.PI / 2],
    ['p51', -58, 1.49, -34, -Math.PI / 2],
    ['zero', -42, 1.35, 96, -2.1],
  ]) {
    const parked = buildAircraft({ type });
    parked.group.position.set(px, py, pz);
    parked.group.rotation.y = ry;
    field.add(parked.group);
  }

  // The shared dispersal + defence set (pens, bunkers, pillboxes, AA pit),
  // standing on the east side; its banks/walls join the crash registry.
  landGroup.add(airfieldExtras.group);
  for (const o of airfieldExtras.obstacles) obBox.push(o);

  landGroup.add(markings);
  landGroup.add(field);
}
