// Plane Sim transient particle effects: impact sparks / muzzle flashes,
// engine + explosion smoke, and kill debris. All pooled (sprite/mesh + material
// reused, not re-allocated) and self-contained — the factory takes only the
// scene, a ground-height sampler and gravity.
import * as THREE from 'three';

// A 64px radial-gradient sprite texture from [offset, cssColor] stops.
function radialTex(stops, srgb = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, stops.r0 || 1, 32, 32, 32);
  for (const [o, col] of stops.at) g.addColorStop(o, col);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFx(scene, groundAt, gravity) {
  // A pooled fade-out sprite system (sparks, smoke): spawn(pos, size, life)
  // adds one; step(dt) ages them and calls onStep(sprite, k, dt) with life
  // fraction k (1→0), recycling at k<=0.
  function spritePool(tex, matOpts, baseOpacity, onStep) {
    const live = [];
    const pool = [];
    function spawn(pos, size, life) {
      const s = pool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, ...matOpts }));
      s.material.opacity = baseOpacity;
      s.position.copy(pos);
      s.scale.setScalar(size);
      s.userData = { life, maxLife: life, size };
      scene.add(s);
      live.push(s);
    }
    function step(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.userData.life -= dt;
        const k = s.userData.life / s.userData.maxLife;
        if (k <= 0) { scene.remove(s); pool.push(s); live.splice(i, 1); continue; }
        onStep(s, k, dt);
      }
    }
    return { spawn, step };
  }

  // Impact sparks / muzzle flashes: additive sprites that pop and expand as they fade.
  const sparkFx = spritePool(
    radialTex({ at: [[0, 'rgba(255,240,200,1)'], [0.4, 'rgba(255,150,40,0.9)'], [1, 'rgba(255,80,20,0)']] }, true),
    { depthWrite: false, blending: THREE.AdditiveBlending, fog: false }, 1,
    (s, k) => { s.material.opacity = k; s.scale.setScalar(s.userData.size * (1 + (1 - k) * 1.6)); },
  );

  // Smoke: soft grey sprites that drift up, expand and fade (engine trails, aftermath).
  const smokeFx = spritePool(
    radialTex({ r0: 3, at: [[0, 'rgba(70,70,74,0.85)'], [0.7, 'rgba(60,60,64,0.35)'], [1, 'rgba(55,55,58,0)']] }),
    { depthWrite: false, transparent: true }, 0.8,
    (s, k, dt) => { s.position.y += dt * 2.5; s.material.opacity = k * 0.8; s.scale.setScalar(s.userData.size * (1 + (1 - k) * 2.2)); },
  );

  // Debris: tumbling chunks thrown by a kill, falling under gravity.
  const debris = [];
  const debrisPool = [];
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.9 });
  const debrisGeo = new THREE.BoxGeometry(1, 0.5, 1.4); // unit chunk, scaled per instance
  function spawnDebris(pos, baseVel) {
    for (let i = 0; i < 6; i++) {
      const s = 0.3 + Math.random() * 0.9;
      const d = debrisPool.pop() || new THREE.Mesh(debrisGeo, debrisMat);
      d.scale.setScalar(s);
      d.position.copy(pos);
      if (!d.userData.vel) { d.userData.vel = new THREE.Vector3(); d.userData.rot = new THREE.Vector3(); }
      d.userData.vel.copy(baseVel).multiplyScalar(0.6);
      d.userData.vel.x += (Math.random() - 0.5) * 45;
      d.userData.vel.y += Math.random() * 30;
      d.userData.vel.z += (Math.random() - 0.5) * 45;
      d.userData.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.userData.life = 2.6;
      scene.add(d);
      debris.push(d);
    }
  }
  function stepDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.userData.life -= dt;
      d.userData.vel.y -= gravity * 2 * dt;
      d.position.addScaledVector(d.userData.vel, dt);
      d.rotation.x += d.userData.rot.x * dt;
      d.rotation.y += d.userData.rot.y * dt;
      d.rotation.z += d.userData.rot.z * dt;
      if (d.userData.life <= 0 || d.position.y < groundAt(d.position.x, d.position.z)) {
        scene.remove(d);
        debrisPool.push(d);
        debris.splice(i, 1);
      }
    }
  }

  return {
    spawnSpark: sparkFx.spawn,
    stepSparks: sparkFx.step,
    spawnSmoke: smokeFx.spawn,
    stepSmokes: smokeFx.step,
    spawnDebris,
    stepDebris,
  };
}
