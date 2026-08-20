// Backrooms — the water in Level 37.
//
// Two things are going on in the same surface, and they come from different
// places on purpose.
//
//   THE SEA. The Level 37 write-up is oddly specific that the water keeps a
//   "constant, minimal rippling" even when nothing has disturbed it. That is a
//   tiny wind sea, so it is the real thing: the same Gerstner (trochoidal) wave
//   sum the site's Wave Simulator runs, imported from wave-field.js rather than
//   reimplemented, just dialled down to a few centimetres of amplitude and a
//   3 m wavelength. Crests still sharpen and troughs still flatten, which is
//   why it reads as water and not as a rippling bedsheet.
//
//   THE DISTURBANCE. Everything that enters, leaves or thrashes about in the
//   water drops a ring impulse: an expanding, decaying circular wavefront added
//   on top of the sea. Twelve of them live in a uniform array; the oldest is
//   recycled when a thirteenth is needed.
//
// ONE SOURCE OF TRUTH, as in the Wave Sim: heightAt() below evaluates exactly
// the same sea plus exactly the same ripples as the vertex shader, so the
// camera bobbing on the surface and the surface you can see can never disagree.

import * as THREE from 'three';
import { CELL } from './backrooms-maze.js';
import { WATER_Y } from './backrooms-pools.js';
import {
  buildWaves, sampleHeight, waveUniforms, WAVE_GLSL,
} from './wave-field.js';
import { waterNormalTexture } from './backrooms-materials.js';

/** How many live disturbances the surface can carry at once. */
export const RIPPLE_MAX = 12;

// Ring-wave shape. Tuned together, so change them together:
//   SPEED   how fast the ring travels outward (m/s)
//   DECAY   how fast the whole ring dies (1/s) — about 2.5 s of life
//   WIDTH   sharpness of the ring front (bigger = thinner ring)
//   FREQ    wavelets within the front
const RIPPLE = {
  SPEED: 2.3, DECAY: 1.35, WIDTH: 1.9, FREQ: 6.4, LIFE: 3.2,
};

// A deliberately calm sea: barely-there swell at roughly head-and-shoulders
// wavelength, so it moves without ever obscuring what is in the water with you.
const SEA = {
  count: 4,
  amplitude: 0.035,
  length: 3.4,
  steepness: 0.34,
  windDeg: 28,
  spreadDeg: 70,
  falloff: 0.66,
  timeScale: 1,
};

/**
 * Build the water surface over every flooded cell of a pool level.
 *
 * Only flooded cells get geometry: a single sheet across the whole grid would
 * put a pane of teal glass over the dry deck at ankle height.
 *
 * @returns {{mesh, disturb, update, heightAt, submerged, dispose}}
 */
export function buildWater(level, quality = 'high') {
  const SUB = quality === 'low' ? 3 : 6; // sub-quads per cell edge (~0.7 m)
  const waves = buildWaves(SEA);

  // ---- geometry ---------------------------------------------------------
  // Vertices are shared between neighbouring cells by keying on the GLOBAL
  // sub-grid coordinate, so a 4.2 m cell boundary has one row of vertices and
  // not two — a doubled row is a hairline crack that the wave displacement
  // opens into a visible seam the moment the sea moves.
  const pos = [];
  const uv = [];
  const index = [];
  const lookup = new Map();
  const vertexFor = (gx, gy) => {
    const key = gy * 100000 + gx;
    let i = lookup.get(key);
    if (i !== undefined) return i;
    i = pos.length / 3;
    const wx = (gx / SUB) * CELL;
    const wz = (gy / SUB) * CELL;
    pos.push(wx, WATER_Y, wz);
    uv.push(wx, wz); // world-space UVs: the normal detail never stretches
    lookup.set(key, i);
    return i;
  };

  for (let cy = 0; cy < level.h; cy += 1) {
    for (let cx = 0; cx < level.w; cx += 1) {
      if (!level.isWater(cx, cy)) continue;
      for (let sy = 0; sy < SUB; sy += 1) {
        for (let sx = 0; sx < SUB; sx += 1) {
          const gx = cx * SUB + sx;
          const gy = cy * SUB + sy;
          const a = vertexFor(gx, gy);
          const b = vertexFor(gx + 1, gy);
          const c = vertexFor(gx + 1, gy + 1);
          const d = vertexFor(gx, gy + 1);
          index.push(a, d, c, a, c, b);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  // ---- uniforms ---------------------------------------------------------
  const uniforms = waveUniforms(waves);
  uniforms.uWaveTime = { value: 0 };
  uniforms.uRipples = {
    value: Array.from({ length: RIPPLE_MAX }, () => new THREE.Vector4(0, 0, 0, 0)),
  };
  uniforms.uRippleK = {
    value: new THREE.Vector4(RIPPLE.SPEED, RIPPLE.DECAY, RIPPLE.WIDTH, RIPPLE.FREQ),
  };

  const normalMap = waterNormalTexture();
  normalMap.repeat.set(0.24, 0.24); // world-space UVs, so this is ~4 m per tile

  const material = new THREE.MeshStandardMaterial({
    color: 0x1d6f74,
    roughness: 0.06,
    metalness: 0.16,
    transparent: true,
    opacity: 0.78,
    normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    side: THREE.DoubleSide, // you spend real time under it
    // Without this the surface writes depth and hides everything below it from
    // the transparent sort — including the next water cell along.
    depthWrite: false,
  });

  const RIPPLE_GLSL = /* glsl */`
    uniform vec4 uRipples[${RIPPLE_MAX}];  // x, z, age, strength
    uniform vec4 uRippleK;                 // speed, decay, width, frequency

    // One expanding, decaying ring per live disturbance. \`w\` is the signed
    // distance to the ring's front, so the wavelet rides outward with it
    // instead of standing still and pulsing.
    float rippleAt(vec2 p) {
      float sum = 0.0;
      for (int i = 0; i < ${RIPPLE_MAX}; i++) {
        vec4 r = uRipples[i];
        if (r.w <= 0.0) continue;
        float d = distance(p, r.xy);
        float w = d - r.z * uRippleK.x;
        float env = exp(-r.z * uRippleK.y) * exp(-w * w * uRippleK.z)
                  / (1.0 + d * 0.6);
        sum += r.w * env * sin(w * uRippleK.w - r.z * 9.0);
      }
      return sum;
    }

    // Total surface height at a rest position, sea plus disturbance.
    float surfaceAt(vec2 p) {
      vec3 disp; vec3 nrm;
      gerstner(p, disp, nrm);
      return disp.y + rippleAt(p);
    }
  `;

  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WAVE_GLSL}\n${RIPPLE_GLSL}\nvarying float vCrest;`)
      .replace('#include <beginnormal_vertex>', `
        vec3 gDisp; vec3 gNrm;
        gerstner(position.xz, gDisp, gNrm);
        float rip = rippleAt(position.xz);
        // Rebuild the normal by central differences on the TOTAL height. The
        // analytic Gerstner normal alone would leave every ripple perfectly
        // flat-shaded, which is the one place the eye is actually looking.
        float e = 0.28;
        float hx = surfaceAt(position.xz + vec2(e, 0.0)) - surfaceAt(position.xz - vec2(e, 0.0));
        float hz = surfaceAt(position.xz + vec2(0.0, e)) - surfaceAt(position.xz - vec2(0.0, e));
        vec3 objectNormal = normalize(vec3(-hx, 2.0 * e, -hz));
        vCrest = gDisp.y + rip;
      `)
      .replace(
        '#include <begin_vertex>',
        'vec3 transformed = position + vec3(gDisp.x, gDisp.y + rip, gDisp.z);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCrest;')
      // Crests go pale and troughs go deep — a cheap stand-in for the fact
      // that you see further into a trough than through a crest.
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float crest = clamp(vCrest * 5.5, -1.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.72, 0.88, 0.88), max(0.0, crest) * 0.35);
        gl_FragColor.rgb *= 1.0 + min(0.0, crest) * 0.18;
      `);
  };

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2; // after the opaque tile, before the HUD sprites
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  // ---- live disturbances ------------------------------------------------
  const ripples = uniforms.uRipples.value;
  const slots = Array.from({ length: RIPPLE_MAX }, () => ({ age: Infinity }));
  let time = 0;

  /**
   * Disturb the surface at a world point. `strength` is in metres of initial
   * ring amplitude: a footfall in the shallows is ~0.03, a body hitting the
   * water off a ladder is ~0.18.
   */
  function disturb(x, z, strength) {
    if (!(strength > 0)) return;
    // Take a free slot; failing that, take the oldest, because the ring most
    // nearly finished is the one nobody will miss.
    let pick = -1;
    let oldest = -1;
    for (let i = 0; i < RIPPLE_MAX; i += 1) {
      if (slots[i].age >= RIPPLE.LIFE) { pick = i; break; }
      if (oldest < 0 || slots[i].age > slots[oldest].age) oldest = i;
    }
    if (pick < 0) pick = oldest;
    slots[pick].age = 0;
    ripples[pick].set(x, z, 0, Math.min(0.3, strength));
  }

  function update(dt) {
    time += dt;
    uniforms.uWaveTime.value = time;
    for (let i = 0; i < RIPPLE_MAX; i += 1) {
      if (slots[i].age >= RIPPLE.LIFE) continue;
      slots[i].age += dt;
      if (slots[i].age >= RIPPLE.LIFE) {
        ripples[i].w = 0; // retired: the shader skips it
      } else {
        ripples[i].z = slots[i].age;
      }
    }
    // Drift the capillary detail so the fine texture moves with the sea rather
    // than sitting on it like a decal.
    normalMap.offset.set(time * 0.006, time * 0.004);
  }

  /** CPU twin of surfaceAt() — the exact height of the surface at a point. */
  function heightAt(x, z) {
    let y = sampleHeight(waves, x, z, time);
    for (let i = 0; i < RIPPLE_MAX; i += 1) {
      const r = ripples[i];
      if (r.w <= 0) continue;
      const d = Math.hypot(x - r.x, z - r.y);
      const w = d - r.z * RIPPLE.SPEED;
      const env = Math.exp(-r.z * RIPPLE.DECAY) * Math.exp(-w * w * RIPPLE.WIDTH) / (1 + d * 0.6);
      y += r.w * env * Math.sin(w * RIPPLE.FREQ - r.z * 9);
    }
    return WATER_Y + y;
  }

  /** Is a world point below the moving surface, in a cell that has water? */
  function submerged(x, y, z) {
    const c = level.cellAt(x, z);
    if (!level.isWater(c.x, c.y)) return false;
    return y < heightAt(x, z);
  }

  return {
    mesh,
    material,
    disturb,
    update,
    heightAt,
    submerged,
    get time() { return time; },
    dispose() {
      geo.dispose();
      normalMap.dispose();
      material.dispose();
    },
  };
}
