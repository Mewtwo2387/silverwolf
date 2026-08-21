// Backrooms — the player's own body.
//
// Until now the player was a camera and nothing else: look down and there was
// carpet where your legs should be. This module hangs an actual rigged figure
// off the same position the camera reads, so you can see yourself, and so the
// game can offer a third-person view of the thing that is being chased.
//
// The asset is player.glb, assembled from two CC0 Quaternius packs (see
// pages/games/backrooms-credits.ts and scripts/build-player.ts in the notes):
// the Universal Base Characters body, dressed by a texture whose garments were
// cut geometrically rather than painted, and twelve clips lifted off the
// Universal Animation Library. Both packs use the identical 65-bone UE rig, so
// the clips drive this skeleton with no retargeting at all.
//
// Two things here are worth knowing before changing anything:
//
//   * In first person the head is removed by swapping the mesh's index buffer
//     for one with the head triangles cut out, not by hiding or shrinking the
//     head bone. See the long note above that code for why the obvious
//     approaches fail.
//   * The two views want opposite facing rules and get them. First person
//     locks the body to the camera so your hands stay put on screen; third
//     person lets the camera orbit freely and turns the avatar toward where it
//     is being driven. Do not unify them.
//   * In first person the body is placed to keep the *neck* a fixed distance
//     from the camera, not the hips. The run cycles pitch the torso a long way
//     forward, and a fixed hip offset puts the shoulders in front of the lens.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { backroomsUrl } from './backrooms-textures.js';

/** Clip names baked into player.glb, and what puts the player in each. */
export const PLAYER_STATES = [
  'idle', 'walk', 'jog', 'sprint', 'crouchIdle', 'crouchWalk',
  'swim', 'tread', 'jumpStart', 'jumpLoop', 'jumpLand', 'death',
];

// The rig stands 1.81 m; the game's standing eye height is 1.66 m, which is
// about right for a 1.81 m person, so the model needs no rescaling. Kept
// explicit because the two numbers living in different files is exactly how a
// player ends up sunk into the floor after someone tunes one of them.
const MODEL_HEIGHT = 1.81;
const EYE_RATIO = 1.66 / MODEL_HEIGHT;

const FADE = 0.18; // seconds to cross-fade between clips

// This rig faces +Z (measured off the rest pose: foot_l sits at z = +0.13), so
// facing a direction is atan2(x, z) with no sign flip. The camera looks down
// -Z, which is why the idle case aims at player.forward rather than player.yaw
// — mixing the two conventions is what had the body standing backwards.

// How far the body is pushed back from the camera in first person. The camera
// sits on the player's *centre line*, but eyes are at the front of a head, so
// without this the lens is buried in the middle of the torso and looking down
// shows shoulders and inside surfaces. Roughly half a head's depth.
const BODY_SETBACK = 0.16;


/**
 * Load and wire the player figure.
 *
 * Resolves null on any failure. A missing body must never stop the game — the
 * camera worked on its own for the entire life of this level before now.
 */
export async function loadPlayerModel() {
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(backroomsUrl('player', 'glb'));
  } catch (_) {
    return null;
  }

  const root = gltf.scene;
  const group = new THREE.Group();
  group.add(root);

  const skinned = [];
  // The bone the first-person camera is anchored behind — see setbackFor().
  let neckBone = null;
  root.traverse((o) => {
    if (o.isBone && o.name === 'neck_01') neckBone = o;
    if (o.isSkinnedMesh) {
      skinned.push(o);
      // The figure is lit by the same fixtures as the walls; frustum culling on
      // a skinned mesh uses the *bind pose* bounds, which are wrong the moment
      // an animation moves a limb, and pops the body out of view at the edges.
      o.frustumCulled = false;
      // The source material is double-sided, which on a closed body mesh only
      // ever costs fill rate — until the camera is inside it, and then it shows
      // you the inside of your own chest.
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m) m.side = THREE.FrontSide;
      }
    }
  });
  if (!skinned.length) return null;

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    actions.set(clip.name, action);
  }
  let current = null;

  /** Cross-fade to a clip. Re-requesting the running clip is a no-op. */
  function play(name, { loop = true, timeScale = 1 } = {}) {
    const next = actions.get(name);
    if (!next || next === current) {
      if (next) next.timeScale = timeScale;
      return;
    }
    next.reset();
    next.timeScale = timeScale;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.enabled = true;
    if (current) next.crossFadeFrom(current, FADE, false);
    next.play();
    current = next;
  }

  // ------------------------------------------------------- hiding the head ----
  //
  // Scaling the head bone to zero is the obvious trick and it does not work
  // here: the skull vertices are co-weighted to neck_01, so collapsing Head
  // flattens the face into a disc 20 cm from the lens instead of removing it,
  // and the clips animate bone scale so it has to be re-applied every frame
  // anyway. Cutting the triangles out of the index buffer once, at load, is
  // exact, costs nothing per frame, and cannot fight the animation.
  //
  // Both index buffers are kept and the mesh simply swaps between them.
  // Head *and* neck. The neck stump is visible looking down and reads as a
  // severed throat; cutting triangles (rather than scaling the bone, which
  // drags co-weighted collar vertices into a funnel) removes it cleanly.
  const HEAD_BONES = ['Head', 'neck_01'];
  const headless = new Map();
  for (const mesh of skinned) {
    const bones = mesh.skeleton?.bones || [];
    const headIdx = HEAD_BONES.map((n) => bones.findIndex((b) => b.name === n))
      .filter((i) => i >= 0);
    if (!headIdx.length) continue;
    const geo = mesh.geometry;
    const idx = geo.getIndex();
    const si = geo.getAttribute('skinIndex');
    const sw = geo.getAttribute('skinWeight');
    if (!idx || !si || !sw) continue;

    // A vertex belongs to the head if the head bone owns most of it.
    const isHead = new Uint8Array(si.count);
    for (let v = 0; v < si.count; v += 1) {
      let w = 0;
      for (let k = 0; k < 4; k += 1) {
        if (headIdx.includes(si.getComponent(v, k))) w += sw.getComponent(v, k);
      }
      // Deliberately low: a vertex only *part* owned by the neck still sits in
      // front of the lens, and the collar looks better cut back than left as a
      // ring of shards.
      isHead[v] = w > 0.25 ? 1 : 0;
    }
    // Drop a triangle if any corner is head. Keeping partially-head triangles
    // would leave exactly the stretched shards this approach exists to avoid.
    const src = idx.array;
    const kept = [];
    for (let t = 0; t < src.length; t += 3) {
      if (isHead[src[t]] || isHead[src[t + 1]] || isHead[src[t + 2]]) continue;
      kept.push(src[t], src[t + 1], src[t + 2]);
    }
    if (kept.length === src.length) continue; // no head in this mesh
    const Arr = src.constructor;
    headless.set(mesh, {
      full: idx,
      cut: new THREE.BufferAttribute(Arr.from(kept), 1),
      // A mesh that is *entirely* head (the hair cap) has nothing left to draw.
      empty: kept.length === 0,
    });
  }

  let firstPerson = true;

  /**
   * Switch views. First person swaps in the head-less index buffers so you are
   * not looking at the inside of your own face; third person puts them back.
   */
  function setFirstPerson(on) {
    firstPerson = on;
    for (const [mesh, alt] of headless) {
      if (on && alt.empty) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.geometry.setIndex(on ? alt.cut : alt.full);
    }
  }
  setFirstPerson(true);

  // Body yaw is smoothed toward the direction of travel; see the note at the
  // top about why it does not follow the camera.
  let bodyYaw = 0;
  // Non-null while pose() is holding the rig still for inspection.
  let frozen = null;
  let frozenTime = 0;

  /**
   * Drive the figure from the game's own player object.
   *
   * `state` is the caller's summary of what the player is doing, not something
   * re-derived here: the movement code already knows whether you are swimming,
   * crouching or dead, and duplicating those thresholds is how the animation
   * ends up disagreeing with the physics.
   */
  function update(dt, player, state) {
    const vx = player.vel.x;
    const vz = player.vel.z;
    const speed = Math.hypot(vx, vz);

    // Facing. The two views want opposite things and get them.
    //
    // First person locks the body to the camera, exactly and without smoothing:
    // that is what keeps your own hands still on screen while you look around,
    // and it is what lets backing away be a reversed walk cycle rather than the
    // body spinning to chase its own velocity.
    //
    // Third person does the conventional thing instead — the camera orbits
    // freely and the avatar ignores it, turning only toward where the stick is
    // pushing it. You can walk one way and look another, which is the whole
    // point of the view. Standing still it simply holds its last heading.
    if (firstPerson) {
      bodyYaw = Math.atan2(player.forward.x, player.forward.z);
    } else if (speed > 0.12) {
      const want = Math.atan2(vx, vz);
      let d = want - bodyYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      bodyYaw += d * Math.min(1, dt * 10);
    }
    group.rotation.y = bodyYaw;

    // Which way you are travelling relative to that facing. Only ever non-1 in
    // first person, where the body is pinned to the camera; in third person the
    // body has already turned to face its own velocity.
    const facingDot = speed > 0.12
      ? (vx * Math.sin(bodyYaw) + vz * Math.cos(bodyYaw)) / speed
      : 1;
    const reversing = facingDot < -0.35;

    if (!frozen) {
      // Every locomotion clip in the library runs forwards, so a reversed
      // timeScale is what backing away looks like. There is no strafe clip, so
      // sidestepping plays the forward walk — visibly a compromise, but a much
      // smaller one than spinning the body to face its own velocity.
      const dir = reversing ? -1 : 1;
      if (state === 'death') play('death', { loop: false });
      else if (state === 'swim') play(speed > 0.3 ? 'swim' : 'tread', { timeScale: dir });
      else if (state === 'air') play('jumpLoop');
      else if (state === 'crouch') {
        play(speed > 0.15 ? 'crouchWalk' : 'crouchIdle', { timeScale: speed > 0.15 ? dir : 1 });
      } else if (speed > 3.4) play('sprint', { timeScale: dir });
      else if (speed > 1.9) play('jog', { timeScale: dir });
      else if (speed > 0.15) play('walk', { timeScale: Math.max(0.6, speed / 1.4) * dir });
      else play('idle');
    }

    if (frozen) mixer.setTime(frozenTime);
    else mixer.update(dt);

    // Placing the body comes last, because in first person how far back it goes
    // depends on the pose the mixer just produced. See neckLean().
    const back = firstPerson ? setbackFor(dt) : 0;
    group.position.set(
      player.pos.x - Math.sin(bodyYaw) * back,
      player.y,
      player.pos.z - Math.cos(bodyYaw) * back,
    );
  }

  // Where the neck sits, front-to-back, in the rig's own space when standing
  // still. Everything is measured against this.
  const NECK_REST_Z = -0.02;
  // Gap kept between the camera and the neck. Tuned on the idle pose, where it
  // is the difference between the lens being inside the collar and just clear
  // of it.
  const NECK_CLEARANCE = 0.18;
  const MAX_SETBACK = 0.55;
  let smoothedBack = BODY_SETBACK;
  const neckPos = new THREE.Vector3();

  /**
   * How far behind the player's centre line to put the body, this frame.
   *
   * A fixed offset is only right for a pose that stands upright. The run cycles
   * pitch the whole torso forward — the neck travels from 2 cm *behind* the
   * rig's origin at idle to 30 cm in front of it at a sprint — so with a fixed
   * offset the shoulders end up ahead of the lens and you are looking out from
   * inside your own chest.
   *
   * So the body is placed to keep the *neck* a constant distance from the
   * camera rather than the hips: measure where the pose actually put it and
   * push back by that much. This is the head-bone camera constraint that true
   * first-person rigs use, done in reverse — the camera is pinned by the game,
   * so the body moves to meet it instead.
   *
   * Smoothed, because the lean arrives with the animation blend and a hard step
   * would read as the world lurching.
   */
  function setbackFor(dt) {
    let want = BODY_SETBACK;
    if (neckBone) {
      group.updateMatrixWorld(true);
      neckBone.getWorldPosition(neckPos);
      group.worldToLocal(neckPos);
      want = Math.min(MAX_SETBACK, Math.max(BODY_SETBACK, neckPos.z + NECK_CLEARANCE));
    }
    smoothedBack += (want - smoothedBack) * Math.min(1, dt * 8);
    return smoothedBack;
  }





  /**
   * Freeze the rig on one clip at one time, for inspection. Returns false for
   * an unknown clip. `pose(null)` hands control back to update().
   */
  function pose(clip, t = 0) {
    if (clip === null) { frozen = null; return true; }
    const action = actions.get(clip);
    if (!action) return false;
    for (const a of actions.values()) a.stop();
    action.reset();
    action.play();
    action.paused = true;
    action.time = t;
    current = action;
    frozen = action;
    frozenTime = t;
    mixer.update(0);
    return true;
  }

  /** Where the camera sits on the model, for the third-person orbit to aim at. */
  function eyeHeight() {
    return MODEL_HEIGHT * EYE_RATIO;
  }

  function dispose() {
    mixer.stopAllAction();
    for (const m of skinned) {
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.map?.dispose();
        mat.normalMap?.dispose();
        mat.roughnessMap?.dispose();
        mat.dispose();
      }
    }
  }

  return {
    group, play, update, setFirstPerson, eyeHeight, dispose, mixer, pose,
    get firstPerson() { return firstPerson; },
  };
}
