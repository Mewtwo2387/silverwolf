// Plane Sim — volumetric clouds. Real 3-D puffs, not billboards: each cloud is a
// cluster of silhouette-faded sphere puffs, a whole weather deck one
// InstancedMesh (one draw call). Being geometry, they never face you and you can
// fly through them; a fresnel rim fade melts overlapping spheres into cumulus.
// Three decks — 'fair', 'mid', 'storm' (dark overcast + ceiling cap) — toggled
// by the game's applyWeather. Extracted from plane-sim.src.js.
import * as THREE from 'three';

const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

// Build the three cloud decks + the storm overcast cap into `scene`. `border` is
// CFG.BORDER (the play-area half-extent); the puffs scatter a few × wider.
// Returns the handles the weather system drives: the three deck groups, the
// storm puff material (flashed by lightning via emissive), and the overcast cap
// mesh + its base colour (restored after a lightning flash).
export function buildClouds(scene, border) {
  const cloudGroups = { fair: new THREE.Group(), mid: new THREE.Group(), storm: new THREE.Group() };
  let stormDeckMat = null; // the storm puff material, flashed by lightning (emissive)
  let overcastCap = null; // the storm ceiling (one draw call of dark churn)
  let overcastBase = null;

  const puffGeo = new THREE.IcosahedronGeometry(1, 1); // 42-vert soft sphere, shared by every puff

  // Fragments fade toward the silhouette so overlapping spheres melt into one
  // soft mass. Standard-lit (tops catch sun, undersides shade); per-instance
  // greys ride instanceColor; lightning flashes the deck via emissive.
  // depthWrite off + transparent, but still occluded by terrain/airframe.
  function cloudMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
      transparent: true, depthWrite: false, fog: true, side: THREE.FrontSide,
    });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPuffN;\nvarying vec3 vPuffP;\nvarying vec3 vPuffW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
        vPuffN = normalize(transformedNormal);
        vPuffP = mvPosition.xyz;
        #ifdef USE_INSTANCING
          vPuffW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vPuffW = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
        varying vec3 vPuffN;
        varying vec3 vPuffP;
        varying vec3 vPuffW;
        float _h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float _vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(_h3(i + vec3(0,0,0)), _h3(i + vec3(1,0,0)), f.x),
                         mix(_h3(i + vec3(0,1,0)), _h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(_h3(i + vec3(0,0,1)), _h3(i + vec3(1,0,1)), f.x),
                         mix(_h3(i + vec3(0,1,1)), _h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float _fbm(vec3 p){ return 0.6 * _vn(p) + 0.3 * _vn(p * 2.03 + 11.0) + 0.15 * _vn(p * 4.01 + 27.0); }`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // Soft silhouette: front-facing centres opaque, grazing rims fade out.
        float _facing = abs(dot(normalize(vPuffN), normalize(-vPuffP)));
        float _rim = smoothstep(0.0, 0.82, _facing);
        // Ragged erosion so the perfect-sphere outline dissolves into cloud.
        float _n = _fbm(vPuffW * 0.012);
        gl_FragColor.a *= clamp(_rim * (0.4 + 1.05 * _n), 0.0, 1.0);`);
    };
    return mat;
  }

  // Assemble one deck as a single InstancedMesh from a list of puffs
  // {p:Vector3 position, s:Vector3 scale, c:Color tint}. One draw call.
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  function buildDeck(puffs, group, mat) {
    const im = new THREE.InstancedMesh(puffGeo, mat, puffs.length);
    for (let i = 0; i < puffs.length; i++) {
      const pf = puffs[i];
      _m.compose(pf.p, _q, pf.s);
      im.setMatrixAt(i, _m);
      im.setColorAt(i, pf.c);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; // a deck spans the world; whole-mesh culling is meaningless
    group.add(im);
    return im;
  }

  // Puff out one cumulus: a flattish disc of sphere puffs, domed higher and
  // fatter toward the middle, thinning at the rim. `size` ~ horizontal
  // half-extent; `height` ~ how far the crown climbs above the flat base.
  const _c = new THREE.Color();
  function cluster(out, cx, cy, cz, size, height, count, gTop, gBot) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * size * 0.9; // even fill, kept tight so puffs overlap
      const central = 1 - rad / (size * 0.9); // 1 at the core -> 0 at the rim
      const px = cx + Math.cos(ang) * rad;
      const pz = cz + Math.sin(ang) * rad * 0.9;
      const rise = central * height * (0.35 + Math.random() * 0.65);
      const py = cy + rise;
      // Fat puffs (heavy neighbour overlap) so a cluster fuses into one mass.
      const r = size * (0.44 + Math.random() * 0.22) * (0.55 + central * 0.65);
      // Tops (high rise, core) bright; undersides and rim shaded.
      const lift = clamp(rise / (height + 1) - (1 - central) * 0.3, -0.4, 1);
      _c.copy(gBot).lerp(gTop, clamp(0.3 + lift * 0.75, 0, 1));
      out.push({
        p: new THREE.Vector3(px, py, pz),
        s: new THREE.Vector3(r, r * (0.7 + Math.random() * 0.22), r),
        c: _c.clone(),
      });
    }
  }
  const span = () => (Math.random() - 0.5) * border; // a random world coord across the map
  const TOPW = new THREE.Color(0xffffff); const BOTW = new THREE.Color(0xc4cdd8);
  // Fair-weather cumulus: a properly populated sky of scattered white puffs.
  const fair = [];
  for (let i = 0; i < 70; i++) {
    cluster(fair, span() * 2.4, 300 + Math.random() * 1000, span() * 2.4,
      220 + Math.random() * 260, 130 + Math.random() * 170, 7 + Math.floor(Math.random() * 4), TOPW, BOTW);
  }
  buildDeck(fair, cloudGroups.fair, cloudMaterial());
  // Cloudy: whites plus several broken-deck patches — lower, greyer, clustered
  // — so some districts sit under cloud while the sun gets through the gaps.
  const mid = [];
  const MTOP = new THREE.Color(0xeef2f6); const MBOT = new THREE.Color(0xaeb8c4);
  for (let i = 0; i < 26; i++) {
    cluster(mid, span() * 2.4, 320 + Math.random() * 820, span() * 2.4,
      220 + Math.random() * 220, 120 + Math.random() * 130, 7 + Math.floor(Math.random() * 4), TOPW, BOTW);
  }
  for (let p = 0; p < 12; p++) {
    const px = span() * 2.0; const pz = span() * 2.0; const py = 620 + Math.random() * 300;
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      cluster(mid, px + (Math.random() - 0.5) * 1600, py + (Math.random() - 0.5) * 160,
        pz + (Math.random() - 0.5) * 1600, 260 + Math.random() * 220, 110 + Math.random() * 120,
        6 + Math.floor(Math.random() * 4), MTOP, MBOT);
    }
  }
  buildDeck(mid, cloudGroups.mid, cloudMaterial());
  // Storm: a heavy, near-total overcast built in layers. Big LOW masses you
  // fly in and among, a dense mid deck, ragged scud, and towering cells — all
  // under the overcast cap so the whole sky reads as covered. All dark greys.
  const storm = [];
  const lowT = new THREE.Color(0x6a707c); const lowB = new THREE.Color(0x4b515c);
  const deckT = new THREE.Color(0x6d727e); const deckB = new THREE.Color(0x50555f);
  const scudT = new THREE.Color(0x60656f); const scudB = new THREE.Color(0x474c56);
  const towT = new THREE.Color(0x7a808c); const towB = new THREE.Color(0x565c68);
  for (let i = 0; i < 46; i++) { // large, low, slow masses — the ones you fly through
    cluster(storm, span() * 2.6, 160 + Math.random() * 220, span() * 2.6,
      420 + Math.random() * 380, 190 + Math.random() * 220, 9 + Math.floor(Math.random() * 5), lowT, lowB);
  }
  for (let i = 0; i < 150; i++) { // the main dark deck — dense enough to cover the sky
    cluster(storm, span() * 2.8, 460 + Math.random() * 300, span() * 2.8,
      300 + Math.random() * 300, 150 + Math.random() * 160, 8 + Math.floor(Math.random() * 4), deckT, deckB);
  }
  for (let i = 0; i < 60; i++) { // ragged low scud between the big masses
    cluster(storm, span() * 2.6, 300 + Math.random() * 200, span() * 2.6,
      150 + Math.random() * 150, 80 + Math.random() * 90, 5 + Math.floor(Math.random() * 3), scudT, scudB);
  }
  for (let i = 0; i < 32; i++) { // towering cells climbing out of the deck
    cluster(storm, span() * 2.4, 720 + Math.random() * 520, span() * 2.4,
      260 + Math.random() * 220, 420 + Math.random() * 400, 12 + Math.floor(Math.random() * 6), towT, towB);
  }
  stormDeckMat = cloudMaterial();
  buildDeck(storm, cloudGroups.storm, stormDeckMat);
  // The overcast ceiling: a dark cap over most of the sky (one draw call).
  // Its churn is drawn per-pixel from the view direction (pole-safe sines, no
  // UV starburst at the zenith), sweeping zenith to ~65% toward the horizon
  // (thetaLength 0.6π) so overhead is overcast in every direction.
  const capMat = new THREE.MeshBasicMaterial({
    color: 0x2b2f37, transparent: true, opacity: 0.97,
    side: THREE.BackSide, fog: false, depthWrite: false, dithering: true,
  });
  capMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCapDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCapDir = normalize(position);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCapDir;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float _c = sin(vCapDir.x * 11.0 + vCapDir.z * 7.0)
               + 0.6 * sin(vCapDir.x * 19.0 - vCapDir.z * 23.0 + 1.7)
               + 0.4 * sin(vCapDir.z * 31.0 + vCapDir.x * 13.0 + 4.1);
      gl_FragColor.rgb *= (1.0 + _c * 0.06);`);
  };
  overcastCap = new THREE.Mesh(
    new THREE.SphereGeometry(14200, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
    capMat,
  );
  // The cap is centred at the origin, so its transparency sort-depth is wrong
  // (measured to the origin, ~where the plane is) and it would draw OVER — and
  // hide — the lower cloud sprites as you pitch. renderOrder -1 pins it behind
  // them, so the clouds no longer pop in/out with view angle.
  overcastCap.renderOrder = -1;
  overcastBase = overcastCap.material.color.clone();
  cloudGroups.storm.add(overcastCap);
  scene.add(cloudGroups.fair);
  scene.add(cloudGroups.mid);
  scene.add(cloudGroups.storm);
  cloudGroups.mid.visible = false;
  cloudGroups.storm.visible = false;

  return {
    cloudGroups, stormDeckMat, overcastCap, overcastBase,
  };
}
