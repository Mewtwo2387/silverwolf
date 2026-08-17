// Plane Sim — coastal-map scatter. Instanced forests (three tree archetypes by
// altitude band), rock fields on the steeps, and lakeside life (jetties + the
// odd cabin). Pure construction: builds into `landGroup` and registers collision
// volumes through the passed-in obstacle-registry sinks. Extracted from
// plane-sim.src.js.
import * as THREE from 'three';
import {
  makePineCanopyGeo, makeBroadleafCanopyGeo, makeConiferCanopyGeo,
  makeBroadleafTrunkGeo, makeJetty, makeCabin,
} from './plane-sim-models.js';
import {
  TERRAIN, terrainHeight, forestMask, fbm,
} from './plane-sim-terrain.js';
import { GFX, loadSceneryTexture } from './plane-sim-quality.js';

// env: { CFG, landGroup, addCyl, onPaved, injectWindSway }
export function scatterVegetation(env) {
  const {
    CFG, landGroup, addCyl, onPaved, injectWindSway,
  } = env;
  const types = {
    broadleaf: {
      spots: [],
      trunk: [0.5, 0.85, 3.8, 1.9],
      canopy: makeBroadleafCanopyGeo,
      hsl: () => [0.22 + Math.random() * 0.09, 0.5, 0.28 + Math.random() * 0.09],
      scale: () => 0.6 + Math.random() * 1.1,
      cr: 2.2, // collision radius + top height (× instance scale)
      ctop: 9.1,
    },
    conifer: {
      spots: [],
      trunk: [0.35, 0.65, 4.2, 2.1],
      canopy: makeConiferCanopyGeo,
      hsl: () => [0.26 + Math.random() * 0.07, 0.42 + Math.random() * 0.15, 0.2 + Math.random() * 0.1],
      scale: () => 0.7 + Math.random() * 1.3,
      cr: 2.4,
      ctop: 13,
    },
    pine: {
      spots: [],
      trunk: [0.28, 0.5, 7, 3.5],
      canopy: makePineCanopyGeo,
      hsl: () => [0.31 + Math.random() * 0.05, 0.35, 0.16 + Math.random() * 0.07],
      scale: () => 0.75 + Math.random() * 0.85,
      cr: 1.9,
      ctop: 16.7,
    },
  };
  // Type by altitude band, with fuzzy borders: broadleaf on the valley
  // floor, conifers on the slopes, slim pines toward the peaks.
  const pickType = (h) => {
    if (h > 190 + Math.random() * 70) return 'pine';
    if (h < 45 + Math.random() * 40) return Math.random() < 0.75 ? 'broadleaf' : 'conifer';
    return Math.random() < 0.8 ? 'conifer' : 'pine';
  };
  const TREE_TARGET = Math.round(1900 * GFX.treeScale);
  let placed = 0;
  let guard = 0;
  while (placed < TREE_TARGET && guard++ < 80000) {
    const x = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
    const z = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
    const h = terrainHeight(x, z);
    if (h < TERRAIN.WATER_Y + 6 || h > 380) continue;
    const e = 14;
    const slope = Math.hypot(
      terrainHeight(x + e, z) - terrainHeight(x - e, z),
      terrainHeight(x, z + e) - terrainHeight(x, z - e),
    ) / (2 * e);
    if (slope > 0.38) continue;
    const near = Math.hypot(x, z);
    if (near < 240) continue; // keep the apron clear
    if (Math.abs(x) < CFG.RUNWAY_W + 30 && Math.abs(z) < CFG.RUNWAY_LEN / 2 + 60) continue;
    if (onPaved(x, z, 12)) continue; // never seed a tree on the tarmac
    // Cluster into forests: the shared mask gates placement, and a slower
    // density channel swings the gate so woods thin out into meadows and
    // thicken into proper forest elsewhere (looser near the airfield).
    const dens = fbm(x * 0.00042 + 71.3, z * 0.00042 - 12.9, 3);
    const thresh = (near < 1600 ? 0.38 : 0.42) + 0.26 * (1 - dens);
    const mask = forestMask(x, z);
    if (mask < thresh) continue;
    types[pickType(h)].spots.push([x, h, z]);
    placed++;
    // The stronger the mask, the more satellite trees clump around the seed
    // — sparse lone trees at the wood's edge, thickets in the middle.
    const extra = Math.floor(((mask - thresh) / (1 - thresh)) * 4 * (0.5 + Math.random()));
    for (let k = 0; k < extra && placed < TREE_TARGET; k++) {
      const sx = x + (Math.random() * 2 - 1) * 42;
      const sz = z + (Math.random() * 2 - 1) * 42;
      const sh = terrainHeight(sx, sz);
      if (sh < TERRAIN.WATER_Y + 6 || sh > 380) continue;
      if (onPaved(sx, sz, 10)) continue; // satellites skip the seed tests — keep them off the tarmac too
      types[pickType(sh)].spots.push([sx, sh, sz]);
      placed++;
    }
  }

  const trunkTex = loadSceneryTexture('/static/planes/tree-bark.jpg');
  trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
  trunkTex.repeat.set(1, 3);
  trunkTex.anisotropy = GFX.aniso;

  const leafTex = loadSceneryTexture('/static/planes/tree-leaves.jpg');
  leafTex.colorSpace = THREE.SRGBColorSpace;
  leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
  leafTex.repeat.set(4, 4);
  leafTex.anisotropy = GFX.aniso;

  const trunkMat = new THREE.MeshStandardMaterial({
    map: trunkTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    roughness: 0.85,
    metalness: 0.05,
    vertexColors: true,
  });
  injectWindSway(trunkMat); // storm wind bends every tree in the vertex shader
  injectWindSway(leafMat);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  for (const t of Object.values(types)) {
    if (!t.spots.length) continue;
    let trunkGeo;
    if (t === types.broadleaf) {
      trunkGeo = makeBroadleafTrunkGeo();
    } else {
      const [rTop, rBot, tHeight, tY] = t.trunk;
      trunkGeo = new THREE.CylinderGeometry(rTop, rBot, tHeight, 5);
      trunkGeo.translate(0, tY, 0);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, t.spots.length);
    const canopies = new THREE.InstancedMesh(t.canopy(), leafMat, t.spots.length);
    for (let i = 0; i < t.spots.length; i++) {
      const [x, h, z] = t.spots[i];
      const s = t.scale();
      q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      m.compose(p.set(x, h - 0.3, z), q, sc.set(s, s * (0.85 + Math.random() * 0.4), s));
      trunks.setMatrixAt(i, m);
      canopies.setMatrixAt(i, m);
      col.setHSL(...t.hsl());
      canopies.setColorAt(i, col);
      addCyl(x, z, t.cr * s, (h - 0.3) + t.ctop * s, 'Clipped the treeline');
    }
    trunks.castShadow = true; canopies.castShadow = true; canopies.receiveShadow = true;
    landGroup.add(trunks); landGroup.add(canopies);
  }

  // Rocks: on the steeps and the high ground.
  const rocks = [];
  const ROCK_TARGET = Math.round(170 * GFX.treeScale);
  guard = 0;
  while (rocks.length < ROCK_TARGET && guard++ < 22000) {
    const x = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
    const z = (Math.random() * 2 - 1) * (CFG.BORDER + 1200);
    const h = terrainHeight(x, z);
    if (h < 60) continue;
    const e = 14;
    const slope = Math.hypot(
      terrainHeight(x + e, z) - terrainHeight(x - e, z),
      terrainHeight(x, z + e) - terrainHeight(x, z - e),
    ) / (2 * e);
    if (slope < 0.3 && h < 300) continue;
    rocks.push([x, h, z]);
  }
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  for (let i = 0; i < rocks.length; i++) {
    const [x, h, z] = rocks[i];
    const s = 2 + Math.random() * 7;
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * Math.PI * 2, Math.random()));
    m.compose(p.set(x, h + s * 0.15, z), q, sc.set(s, s * (0.6 + Math.random() * 0.5), s));
    rockMesh.setMatrixAt(i, m);
    col.setHSL(0.09, 0.06 + Math.random() * 0.06, 0.32 + Math.random() * 0.14);
    rockMesh.setColorAt(i, col);
    addCyl(x, z, s * 0.8, h + s, 'Flew into a rock');
  }
  rockMesh.castShadow = true;
  landGroup.add(rockMesh);
}

// env: { CFG, landGroup, addCyl, addBox }
export function buildCoast(env) {
  const {
    CFG, landGroup, addCyl, addBox,
  } = env;
  const { WATER_Y } = TERRAIN;
  const spots = []; // [x, z] of placed jetties, for spacing
  let cabins = 0;
  let guard = 0;
  while (spots.length < 12 && guard++ < 60000) {
    const x = (Math.random() * 2 - 1) * CFG.BORDER;
    const z = (Math.random() * 2 - 1) * CFG.BORDER;
    const h = terrainHeight(x, z);
    if (h < WATER_Y + 0.5 || h > WATER_Y + 2.2) continue; // deck sits ~1 m over the water
    const e = 10;
    const gx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
    const gz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
    const gmag = Math.hypot(gx, gz);
    if (gmag < 0.015 || gmag > 0.3) continue; // flat marsh or cliff — no pier
    const dx = -gx / gmag; const dz = -gz / gmag; // downhill = toward the water
    // Open water a short way out, dry ground a short way in.
    if (terrainHeight(x + dx * 30, z + dz * 30) > WATER_Y - 0.6) continue;
    if (terrainHeight(x - dx * 22, z - dz * 22) < WATER_Y + 1.2) continue;
    // Spread them out; skip anything close to an existing pier.
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 500)) continue;
    spots.push([x, z]);

    const len = 15 + Math.random() * 8;
    const jetty = makeJetty(len);
    // makeJetty runs along -Z from its origin; yaw -Z onto the water
    // direction (dx, dz).
    const yaw = Math.atan2(-dx, -dz);
    jetty.rotation.y = yaw;
    jetty.position.set(x, WATER_Y + 1.05, z);
    landGroup.add(jetty);
    addCyl(x + dx * len * 0.5, z + dz * len * 0.5, len * 0.55, WATER_Y + 2.2, 'Hit a jetty');

    if (cabins < 8 && Math.random() < 0.7) {
      const cd = 15 + Math.random() * 8; // set back from the shore
      const cx = x - dx * cd;
      const cz = z - dz * cd;
      const ch = terrainHeight(cx, cz);
      if (ch > WATER_Y + 0.8) {
        const cabin = makeCabin();
        cabin.rotation.y = yaw + (Math.random() - 0.5) * 0.5; // door roughly at the water
        cabin.position.set(cx, ch - 0.15, cz);
        landGroup.add(cabin);
        addBox(cx - 4, cx + 4, cz - 4, cz + 4, ch + 4.2, 'Crashed into a cabin');
        cabins++;
      }
    }
  }
}
