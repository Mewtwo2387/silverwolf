// Instanced grass for Plane Sim's ultra tier: a tile of ~45k billboarded
// blades that silently wraps around the aircraft in the vertex shader, with
// terrain height and a "grass grows here" mask baked into a texture — so the
// CPU cost per frame is two uniform writes, no matter how fast you fly.
//
// Each blade is a tapered two-triangle quad, cylindrically billboarded toward
// the camera, swaying on a per-blade phase. Blades over water, rock, steep
// slopes or the runway shrink to zero via the mask channel.
import * as THREE from 'three';

// Bake heightFn into an RGBA float texture covering the terrain square:
// R = height (m), G = grassable (0/1). 512px over ~13.6 km ≈ 27 m/texel —
// plenty for blade placement (the mesh itself stays the accurate terrain).
function bakeHeightMask(heightFn, size, waterY, exclude) {
  const N = 512;
  const data = new Float32Array(N * N * 4);
  const heights = new Float32Array(N * N);
  const step = size / (N - 1);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * size;
      const z = (j / (N - 1) - 0.5) * size;
      heights[j * N + i] = heightFn(x, z);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const idx = j * N + i;
      const h = heights[idx];
      const hx0 = heights[j * N + Math.max(0, i - 1)];
      const hx1 = heights[j * N + Math.min(N - 1, i + 1)];
      const hz0 = heights[Math.max(0, j - 1) * N + i];
      const hz1 = heights[Math.min(N - 1, j + 1) * N + i];
      const slope = Math.hypot(hx1 - hx0, hz1 - hz0) / (2 * step);
      const x = (i / (N - 1) - 0.5) * size;
      const z = (j / (N - 1) - 0.5) * size;
      let ok = (h > waterY + 2.5 && h < 320 && slope < 0.45) ? 1 : 0;
      for (const r of exclude) {
        if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { ok = 0; break; }
      }
      data[idx * 4] = h;
      data[idx * 4 + 1] = ok;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// opts: { heightFn, size, waterY, exclude: [{x0,x1,z0,z1}] }
// Returns { mesh, update(centerVec3, dt) }.
export function buildGrassField(opts) {
  const {
    heightFn, size, waterY, exclude = [],
  } = opts;
  const BLADES = 60000;
  const TILE = 200; // metres of grass around the aircraft (~1.5 blades/m²)

  const heightTex = bakeHeightMask(heightFn, size, waterY, exclude);

  // Base blade: a tapered quad, 1 m tall before per-instance scaling, with a
  // slight forward bend so it doesn't read as a flat card edge-on.
  const geo = new THREE.InstancedBufferGeometry();
  const W = 0.09;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -W, 0, 0, W, 0, 0, -W * 0.55, 0.55, 0.06,
    W, 0, 0, W * 0.55, 0.55, 0.06, -W * 0.55, 0.55, 0.06,
    -W * 0.55, 0.55, 0.06, W * 0.55, 0.55, 0.06, 0, 1, 0.14,
  ], 3));
  geo.instanceCount = BLADES;

  const offsets = new Float32Array(BLADES * 2);
  const rands = new Float32Array(BLADES * 4);
  for (let i = 0; i < BLADES; i++) {
    offsets[i * 2] = Math.random() * TILE;
    offsets[i * 2 + 1] = Math.random() * TILE;
    rands[i * 4] = 0.55 + Math.random() * 0.75; // height scale (m)
    rands[i * 4 + 1] = Math.random(); // sway phase
    rands[i * 4 + 2] = Math.random(); // tint
    rands[i * 4 + 3] = 0.8 + Math.random() * 0.7; // width scale
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rands, 4));

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uCenter: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uHeight: { value: null },
      uSize: { value: size },
      uTile: { value: TILE },
      uColorLo: { value: new THREE.Color(0x2e4418) },
      uColorHi: { value: new THREE.Color(0x7a9440) },
    },
  ]);
  uniforms.uHeight.value = heightTex; // merge() clones values; textures go in after

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      uniform vec3 uCenter;
      uniform float uTime;
      uniform sampler2D uHeight;
      uniform float uSize;
      uniform float uTile;
      attribute vec2 aOffset;
      attribute vec4 aRand;
      varying float vT;
      varying float vTint;
      void main() {
        vT = position.y;
        vTint = aRand.z;
        // Wrap the static blade grid around the follow point.
        vec2 world = uCenter.xz + mod(aOffset - uCenter.xz, uTile) - uTile * 0.5;
        vec4 hm = texture2D(uHeight, world / uSize + 0.5);
        float scale = aRand.x * hm.g;
        // Shrink out toward the tile edge so the boundary never pops.
        float d = length(world - uCenter.xz);
        scale *= 1.0 - smoothstep(uTile * 0.32, uTile * 0.47, d);
        // Cylindrical billboard: the blade plane always faces the camera.
        vec2 toCam = cameraPosition.xz - world;
        vec2 right = normalize(vec2(-toCam.y, toCam.x) + vec2(1e-4));
        float sway = sin(uTime * 1.9 + aRand.y * 6.2832 + (world.x + world.y) * 0.21)
                   * 0.16 * position.y * scale;
        vec3 p = vec3(
          world.x + right.x * position.x * aRand.w + sway,
          hm.r + position.y * scale,
          world.y + right.y * position.x * aRand.w + sway * 0.6
        );
        p.xz += vec2(0.02, 0.05) * position.z * scale; // bend offset
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColorLo;
      uniform vec3 uColorHi;
      varying float vT;
      varying float vTint;
      void main() {
        #include <logdepthbuf_fragment>
        // Dark at the roots (fake occlusion), brighter toward the sunlit tips.
        vec3 col = mix(uColorLo, uColorHi, vT * vT) * (0.78 + 0.44 * vTint);
        gl_FragColor = vec4(col * (0.72 + 0.38 * vT), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // the tile teleports with the plane; a static bound would cull it
  return {
    mesh,
    update(center, dt) {
      uniforms.uCenter.value.copy(center);
      uniforms.uTime.value += dt;
    },
  };
}
