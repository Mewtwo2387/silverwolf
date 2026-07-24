// Plane Sim transient particle effects: impact sparks / muzzle flashes,
// engine + explosion smoke, and kill debris. All three are pooled (sprite +
// material pairs are reused, not re-allocated) and fully self-contained — the
// factory takes only the scene, a ground-height sampler and gravity.
import * as THREE from 'three';

// One shared factory so the three pools live together. Returns spawn/step
// pairs; call sites are unchanged from when these were inline in the game.
export function createFx(scene, groundAt, gravity) {
  // ---- Impact sparks / muzzle flashes: additive sprites that pop and fade. ----
  const sparkTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.4, 'rgba(255,150,40,0.9)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const sparks = [];
  const sparkPool = [];
  function spawnSpark(pos, size, life) {
    const s = sparkPool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTex, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.material.opacity = 1;
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.userData = { life, maxLife: life, size };
    scene.add(s);
    sparks.push(s);
  }
  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.userData.life -= dt;
      const k = s.userData.life / s.userData.maxLife; // 1 -> 0
      if (k <= 0) {
        scene.remove(s);
        sparkPool.push(s);
        sparks.splice(i, 1);
        continue;
      }
      s.material.opacity = k;
      s.scale.setScalar(s.userData.size * (1 + (1 - k) * 1.6)); // expand as it fades
    }
  }

  // ---- Smoke: soft grey sprites that drift up, expand and fade (engine trails,
  //      explosion aftermath). ----
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    g.addColorStop(0, 'rgba(70,70,74,0.85)');
    g.addColorStop(0.7, 'rgba(60,60,64,0.35)');
    g.addColorStop(1, 'rgba(55,55,58,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const smokes = [];
  const smokePool = [];
  function spawnSmoke(pos, size, life) {
    const s = smokePool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, depthWrite: false, transparent: true,
    }));
    s.material.opacity = 0.8;
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.userData = { life, maxLife: life, size };
    scene.add(s);
    smokes.push(s);
  }
  function stepSmokes(dt) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.userData.life -= dt;
      const k = s.userData.life / s.userData.maxLife;
      if (k <= 0) {
        scene.remove(s); smokePool.push(s); smokes.splice(i, 1);
        continue;
      }
      s.position.y += dt * 2.5;
      s.material.opacity = k * 0.8;
      s.scale.setScalar(s.userData.size * (1 + (1 - k) * 2.2));
    }
  }

  // ---- Debris: tumbling chunks thrown by a kill, falling under gravity. ----
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
    spawnSpark, stepSparks, spawnSmoke, stepSmokes, spawnDebris, stepDebris,
  };
}
