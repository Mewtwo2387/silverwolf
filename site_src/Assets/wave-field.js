// ---- Gerstner wave field -----------------------------------------------
// A textbook deep-water Gerstner (trochoidal) wave sum: crests sharpen and
// troughs flatten because each wave displaces the surface HORIZONTALLY as well
// as vertically, which is what makes real swell read as swell instead of a
// rolling sine sheet.
//
// ONE source of truth: the same wave list drives
//   * the GPU (WAVE_GLSL, fed by waveUniforms()) for the water mesh, and
//   * the CPU (sampleHeight / sampleNormal) for buoyancy on a floating body,
// so what the boat rides can never drift from what you see.
//
// Phase speed uses the real deep-water dispersion relation, omega = sqrt(g*k):
// long waves genuinely outrun short ones, so a multi-wave sea disperses the way
// an actual ocean does rather than marching in lockstep.
import * as THREE from 'three';

export const MAX_WAVES = 8;
export const GRAVITY = 9.81;

// Sea-state controls (what the UI sliders drive).
export function defaultParams() {
  return {
    count: 5, // how many wave trains are summed
    amplitude: 1.1, // amplitude of the longest (dominant) wave, metres
    length: 38, // wavelength of the dominant wave, metres
    steepness: 0.72, // 0 = rolling sine, 1 = sharp near-breaking crests
    windDeg: 35, // heading the sea runs toward, degrees
    spreadDeg: 42, // directional spread of the shorter trains about the wind
    falloff: 0.68, // each successive train is this fraction of the previous
    timeScale: 1,
  };
}

// Build the wave train list from the sea state. Each successive train is
// `falloff` times shorter AND `falloff` times smaller, which holds a roughly
// constant steepness per train while adding finer and finer detail on top.
export function buildWaves(p) {
  const out = [];
  const n = Math.max(1, Math.min(MAX_WAVES, Math.round(p.count)));
  // Total steepness is shared across the trains, then clamped below so the
  // surface can never fold through itself into a loop.
  for (let i = 0; i < n; i++) {
    const f = p.falloff ** i;
    const len = Math.max(1.2, p.length * f);
    const amp = p.amplitude * f;
    // Fan the trains either side of the wind, widening with each octave.
    const spread = p.spreadDeg * (i / Math.max(1, n - 1) - 0.5) * 2;
    const dir = ((p.windDeg + spread) * Math.PI) / 180;
    const k = (2 * Math.PI) / len;
    out.push({
      dx: Math.sin(dir),
      dz: Math.cos(dir),
      k,
      amp,
      omega: Math.sqrt(GRAVITY * k), // deep-water dispersion
      qa: 0, // filled below
    });
  }
  // Steepness -> per-train Q*A. Clamp the SUM of Q*k*A to <1 (the Gerstner
  // self-intersection limit) so extreme settings sharpen crests without
  // tearing the surface into loops.
  let sumKA = 0;
  for (const w of out) sumKA += w.k * w.amp;
  const q = sumKA > 0 ? Math.min(p.steepness, 0.98) / sumKA : 0;
  for (const w of out) w.qa = q * w.amp;
  return out;
}

// --- CPU sampling (buoyancy) ---
// Vertical surface height for the water column whose REST position is (x, z).
// (Gerstner displaces horizontally too, so this is the standard approximation
// used for floating bodies — accurate to well within a hull's length.)
export function sampleHeight(waves, x, z, t) {
  let y = 0;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    y += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z) - w.omega * t);
  }
  return y;
}

// Analytic Gerstner normal at the same point (GPU Gems 1, ch. 1).
export function sampleNormal(waves, x, z, t, out) {
  let nx = 0; let ny = 0; let nz = 0;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    const ph = w.k * (w.dx * x + w.dz * z) - w.omega * t;
    const c = Math.cos(ph); const s = Math.sin(ph);
    const wa = w.k * w.amp;
    nx -= w.dx * wa * c;
    nz -= w.dz * wa * c;
    ny -= w.qa * w.k * s;
  }
  return (out || new THREE.Vector3()).set(nx, 1 + ny, nz).normalize();
}

// Significant wave height (crest-to-trough of the biggest waves) and the
// dominant period — the numbers an oceanographer would quote for this sea.
export function seaStats(waves) {
  let amp2 = 0;
  for (const w of waves) amp2 += w.amp * w.amp;
  const hs = 4 * Math.sqrt(amp2 / 2); // Hs = 4*sqrt(m0)
  const d = waves[0];
  return {
    hs,
    period: d ? (2 * Math.PI) / d.omega : 0,
    speed: d ? d.omega / d.k : 0, // phase speed, m/s
    length: d ? (2 * Math.PI) / d.k : 0,
  };
}

// --- GPU side ---
// Uniform payload matching WAVE_GLSL. Reuses the supplied uniform object's
// arrays in place so the material doesn't need recompiling when the sea changes.
export function waveUniforms(waves, u) {
  const uni = u || {
    uWaveA: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4()) },
    uWaveB: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector2()) },
    uWaveCount: { value: 0 },
  };
  for (let i = 0; i < MAX_WAVES; i++) {
    const w = waves[i];
    if (w) {
      uni.uWaveA.value[i].set(w.dx, w.dz, w.k, w.amp);
      uni.uWaveB.value[i].set(w.omega, w.qa);
    } else {
      uni.uWaveA.value[i].set(0, 0, 1, 0);
      uni.uWaveB.value[i].set(0, 0);
    }
  }
  uni.uWaveCount.value = Math.min(waves.length, MAX_WAVES);
  return uni;
}

// Vertex-shader chunk: identical maths to sampleHeight/sampleNormal above.
// `gerstner()` returns the full 3-D displacement and the analytic normal for a
// rest-position (x, z).
export const WAVE_GLSL = /* glsl */`
uniform vec4 uWaveA[${MAX_WAVES}];   // dirX, dirZ, k, amplitude
uniform vec2 uWaveB[${MAX_WAVES}];   // omega, Q*A
uniform int  uWaveCount;
uniform float uWaveTime;

void gerstner(vec2 p0, out vec3 disp, out vec3 nrm) {
  disp = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= uWaveCount) break;
    vec4 a = uWaveA[i];
    vec2 b = uWaveB[i];
    vec2 d = a.xy;
    float k = a.z, amp = a.w, omega = b.x, qa = b.y;
    float ph = k * dot(d, p0) - omega * uWaveTime;
    float c = cos(ph), s = sin(ph);
    disp.xz += qa * d * c;
    disp.y  += amp * s;
    float wa = k * amp;
    n.x -= d.x * wa * c;
    n.z -= d.y * wa * c;
    n.y -= qa * k * s;
  }
  nrm = normalize(n);
}
`;
