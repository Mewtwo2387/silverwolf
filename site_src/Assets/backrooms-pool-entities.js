// Backrooms — the Poolrooms roster.
//
// The same two rules govern these as govern the Level 0 entities (see the top
// of backrooms-entities.js): they are physically bound, and they do not know
// where you are. Level 37 adds a third:
//
//   3. THEY ARE BOUND TO THEIR TERRAIN. Each of these carries a navFilter, so
//      the BFS flow field it steers on genuinely does not contain the cells it
//      has no business in. A Smiler cannot follow you into a lit room because
//      no route through one exists for it, not because a check somewhere says
//      "don't". That is what makes the counterplay real rather than scripted:
//      light and dry tile are cover in the same way a wall is.
//
// The canon level is famously empty — "no encounters with entities recorded" —
// so all three of these are documented Backrooms entities brought here from
// elsewhere in the mythos, each picked because its behaviour only makes sense
// in water or in the dark. Sources are on the game's References tab.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from './backrooms-maze.js';
import { Agent, segmentedLimb, PLAYER_SPEEDS } from './backrooms-entities.js';
import {
  DECK, WATER_Y, DECK_Y, SHALLOW_Y, DEEP_Y,
} from './backrooms-pools.js';
import { glowTexture } from './backrooms-materials.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (ax, az, bx, bz) => ((ax - bx) ** 2) + ((az - bz) ** 2);

// ============================================================ DROWNER ====

/**
 * Every number that decides whether the Drowner is a reason to get out of the
 * water or simply an unfair thing in it.
 *
 * The rule they encode: the water is its house. In it, it is faster than you
 * swim (SWIM is 2.15 m/s) and you cannot escape by swimming — only by getting
 * OUT. On the deck it is slower than you walk, so the moment your feet are on
 * tile the encounter is over unless you dawdle. The grab is survivable, and
 * survivable twice as fast on land, so being caught at the pool edge is a
 * scare and being caught mid-pit is a death sentence you had warning of.
 */
export const DROWNER = {
  SIGHT: 13, // sunken eyes, and it is looking through water
  FOV: Math.PI * 1.4,
  HEARING: 30, // water carries everything you do straight to it
  FORGET: 0.09, // "surprisingly persistent"
  LURK_SPEED: 0.55, // idling on the bottom of a pit
  WATER_SPEED: 3.35, // anomalously unimpeded — faster than you can swim
  LAND_SPEED: 1.65, // lumbering; slower than a walk
  RISE_RANGE: 9, // how close you get before it comes up off the bottom
  CONTACT: 1.0,
  // The grab. DROWN_TIME is how long you have before your lungs fill;
  // STRUGGLE is how much of a bar one direction-change adds back.
  DROWN_TIME: 4.2,
  DROWN_TIME_LAND: 2.6, // on tile you mostly just have to shove it off
  STRUGGLE: 0.22,
  STUN: 3.4, // how long it flounders after you break free
  GRACE: 18,
};

/**
 * Entity 232, "Drowners". A lanky thing in a weathered yellow raincoat that
 * lies on the bottom of a pit until you are close enough, then comes up.
 *
 * The tell is deliberate and it is the whole encounter: while it is lurking it
 * is invisible under the water, but it disturbs the surface above itself. A
 * patch of pool rippling with nothing in it is the only warning you get, and
 * it is enough — if you are looking at the water instead of across it.
 */
export class Drowner extends Agent {
  constructor(level, collider, rnd) {
    super(level, collider, {
      radius: 0.5,
      speed: DROWNER.WATER_SPEED,
      // It hunts through water but WILL follow you out, so nothing is filtered
      // away — the terrain shows up in its speed, not in its map.
      navFilter: null,
    });
    this.rnd = rnd;
    this.kind = 'drowner';
    this.name = 'Drowner';
    this.state = 'lurk';
    this.contact = DROWNER.CONTACT;
    this.grabbing = false;
    this.stun = 0;
    this.grace = DROWNER.GRACE;
    this.wader = 0; // phase for the wade/swim animation
    this.wander = null;
    this.height = 1.95;
    // Spawn preference: in a pit, where it belongs.
    this.spawnWants = (x, y) => level.terrainAt(x, y) === 2;
    this.buildModel();
  }

  /**
   * A hooded figure: lanky, gaunt, and wearing the one thing every account of
   * one agrees on.
   *
   * Three things it has to get right, and the first draft of this got all
   * three wrong in the same way — by being too round.
   *
   *  1. THE COAT IS A COAT, NOT A DUVET. A cylinder with a big sphere on top
   *     reads as a snowman in a mac. The torso here is narrow (19 cm at the
   *     chest) and only flares at the hem, and the shoulders are a flattened
   *     ellipsoid barely wider than the chest — the source says 6 ft 6 and
   *     110 lb, which is a coat hanging off a frame.
   *  2. THE HOOD SITS ON THE SHOULDERS. A detached dome above the collar is a
   *     bowler hat, and once you have seen the hat you cannot unsee it. So the
   *     hood is a shell that continues the line of the coat, with a collar
   *     cone joining the two and a rim around a real opening.
   *  3. THERE IS A FACE IN IT. Not a void — the source is specific: gaunt,
   *     sunken eyes, rotted human-like teeth. Set far enough back in the hood
   *     that you only get it at conversational distance, which is the distance
   *     at which it already has hold of you.
   */
  buildModel() {
    const g = this.group;
    const coatMat = new THREE.MeshStandardMaterial({
      // Weathered yellow: the source is explicit that the coat is never clean
      // and never absent.
      color: 0xb59122, roughness: 0.78, metalness: 0.03,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x24261f, roughness: 0.85, metalness: 0.02,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x121310, roughness: 0.55, metalness: 0.05,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x6a6a62, roughness: 0.9, metalness: 0,
    });
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x070806 });
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xb9ae90, roughness: 0.5, emissive: 0x120f08, emissiveIntensity: 0.4,
    });

    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const HIP = 1.02;

    // ---- legs: work trousers into rubber boots -------------------------
    this.legs = [];
    for (let i = 0; i < 2; i += 1) {
      const side = i ? 1 : -1;
      const leg = new THREE.Group();
      const trouser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.062, 0.66, 8), darkMat,
      );
      trouser.position.y = -0.33;
      leg.add(trouser);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.32, 10), rubberMat);
      boot.position.y = -0.8;
      leg.add(boot);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.085, 0.24), rubberMat);
      toe.position.set(0, -0.955, 0.07);
      leg.add(toe);
      leg.position.set(side * 0.12, HIP, 0);
      g.add(leg);
      this.legs.push(leg);
    }

    // ---- the coat -------------------------------------------------------
    this.body = new THREE.Group();
    this.body.position.y = HIP;
    g.add(this.body);

    // Narrow through the chest, flared at the hem. Open at both ends and
    // double-sided, so the hem reads as cloth rather than as a solid.
    const coat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.245, 0.78, 14, 3, true), coatMat,
    );
    coat.material.side = THREE.DoubleSide;
    coat.position.y = 0.26;
    this.body.add(coat);
    // Storm flap down the front — the one detail that stops the coat reading
    // as a plain tube.
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.03), coatMat);
    flap.position.set(0, 0.28, 0.2);
    flap.rotation.x = -0.04;
    this.body.add(flap);

    // Shoulders: flattened, and barely wider than the chest.
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), coatMat);
    shoulders.scale.set(1.34, 0.5, 0.92);
    shoulders.position.y = 0.64;
    this.body.add(shoulders);

    // ---- the hood -------------------------------------------------------
    this.head = new THREE.Group();
    this.head.position.y = 0.68;
    this.body.add(this.head);
    // Collar: a short cone continuing the shoulders up into the hood, which is
    // what stops the hood reading as a separate object sitting on top.
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.215, 0.16, 14, 1, true), coatMat,
    );
    collar.material.side = THREE.DoubleSide;
    collar.position.y = 0.05;
    this.head.add(collar);
    // The hood shell. The opening is cut out of the geometry rather than
    // faked: a sphere swept through every angle EXCEPT a wedge facing forward,
    // which leaves a real hole to see a face through. (Three's sphere starts
    // phi at -X and reaches +Z at a quarter turn, hence the offset.) A closed
    // dome, however carefully shaded, always reads as a helmet.
    const GAP = 0.62; // half-width of the opening, radians
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.205, 24, 16, Math.PI / 2 + GAP, TAU - GAP * 2, 0, Math.PI * 0.72,
      ),
      coatMat,
    );
    hood.material.side = THREE.DoubleSide;
    hood.rotation.x = -0.26;
    hood.scale.set(1, 1.14, 1.2);
    hood.position.y = 0.15;
    this.head.add(hood);
    // The cowl: the rolled edge of the opening. A plain torus lying IN the
    // plane of the opening — which is the hood's own tilt and nothing else,
    // since a torus already faces +Z by default.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.032, 7, 22), coatMat);
    rim.rotation.x = -0.26;
    rim.position.set(0, 0.152, 0.115);
    this.head.add(rim);
    // The inside of the hood BEHIND the face — a shallow cap, not a shell. A
    // full shell at this radius swallows the face it was meant to sit behind,
    // and the opening goes back to being a black hole with nothing in it.
    const shade = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 16, 10, 0, TAU, 0, Math.PI * 0.55), socketMat,
    );
    shade.rotation.x = Math.PI / 2 + 0.26; // cap opening toward the face
    shade.position.set(0, 0.15, -0.055);
    this.head.add(shade);

    // ---- the face, set back in the hood ---------------------------------
    const face = new THREE.Group();
    face.position.set(0, 0.145, 0.075);
    this.head.add(face);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), skinMat);
    skull.scale.set(0.86, 1.12, 0.92);
    face.add(skull);
    // Sunken eyes: sockets pushed INTO the skull rather than eyes stuck onto
    // it, which is the whole difference between gaunt and cartoonish.
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 8), socketMat);
      socket.scale.set(1.1, 0.78, 0.7);
      socket.position.set(sx * 0.038, 0.026, 0.074);
      face.add(socket);
    }
    // Cheekbones, which is what makes the rest read as hollow.
    for (const sx of [-1, 1]) {
      const bone = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), skinMat);
      bone.scale.set(1, 0.7, 0.8);
      bone.position.set(sx * 0.062, -0.012, 0.055);
      face.add(bone);
    }
    // A slack jaw with a few bad teeth in it.
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
    jaw.scale.set(0.9, 0.75, 0.85);
    jaw.position.set(0, -0.085, 0.045);
    face.add(jaw);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), socketMat);
    mouth.scale.set(1.1, 0.62, 0.55);
    mouth.position.set(0, -0.062, 0.078);
    face.add(mouth);
    const teeth = [];
    for (let i = 0; i < 7; i += 1) {
      const t = (i / 6 - 0.5) * 0.062;
      const tooth = new THREE.BoxGeometry(0.0075, 0.014 + (i % 2) * 0.006, 0.006);
      tooth.translate(t, -0.055 - (i % 3) * 0.003, 0.09);
      teeth.push(tooth);
    }
    face.add(new THREE.Mesh(mergeGeometries(teeth, false), toothMat));

    // ---- arms -----------------------------------------------------------
    // Long, and straight enough to be built from plain tapered cylinders. The
    // segmented builder is kept for the fingers alone: at sleeve thickness its
    // joint spheres bulge between the segments and the arm reads as a caterpillar.
    this.arms = [];
    for (let i = 0; i < 2; i += 1) {
      const side = i ? 1 : -1;
      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.56, 8), coatMat);
      sleeve.position.set(side * 0.02, -0.28, 0);
      arm.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.048, 0.05, 10), coatMat);
      cuff.position.set(side * 0.03, -0.55, 0);
      arm.add(cuff);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.3, 8), skinMat);
      forearm.position.set(side * 0.035, -0.72, 0.015);
      arm.add(forearm);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), skinMat);
      palm.scale.set(1, 0.8, 0.62);
      palm.position.set(side * 0.038, -0.885, 0.02);
      arm.add(palm);
      // Fingers, splayed. They are the last thing you see.
      const fingers = [];
      for (let f = 0; f < 4; f += 1) {
        const a = (f - 1.5) * 0.36;
        const bx = side * 0.038 + Math.sin(a) * 0.03;
        fingers.push(segmentedLimb(new THREE.CatmullRomCurve3([
          v(bx, -0.905, 0.02 + Math.cos(a) * 0.02),
          v(bx + Math.sin(a) * 0.03, -0.965, 0.035 + Math.cos(a) * 0.05),
          v(bx + Math.sin(a) * 0.05, -1.005, 0.05 + Math.cos(a) * 0.085),
        ]), 0.0125, 0.006, 4, 1));
      }
      arm.add(new THREE.Mesh(mergeGeometries(fingers, false), skinMat));
      // Clear of the coat, not inside it: at the chest radius the whole
      // sleeve disappears and the thing appears to have no arms until the
      // hands emerge below the hem.
      arm.position.set(side * 0.208, 0.55, 0.012);
      this.body.add(arm);
      this.arms.push(arm);
    }
    // Hips at 1.02 plus 0.68 of body to the hood plus the hood itself: it
    // stands a shade under two metres, which in a 3.5 m room is exactly as
    // tall as a person you would rather not be in a room with.
    this.height = 1.98;
  }

  /** Terrain code under it right now. */
  terrain() {
    const c = this.cell();
    return this.level.terrainAt(c.x, c.y);
  }

  update(dt, player, api) {
    this.stateTime += dt;
    this.grace = Math.max(0, this.grace - dt);
    this.stun = Math.max(0, this.stun - dt);

    const cfg = {
      sight: DROWNER.SIGHT,
      fov: DROWNER.FOV,
      // Hearing is halved when it is out of the water: the medium that carries
      // your splashing to it is the medium it is lying in.
      hearing: this.terrain() === DECK ? DROWNER.HEARING * 0.45 : DROWNER.HEARING,
      forget: DROWNER.FORGET,
    };
    const s = this.sense(player, dt, cfg, this.rnd);

    const inWater = this.terrain() !== DECK;
    const playerCell = this.level.cellAt(player.pos.x, player.pos.z);
    const playerInWater = this.level.terrainAt(playerCell.x, playerCell.y) !== DECK;

    if (this.grabbing) {
      this.doGrab(dt, player, api);
    } else if (this.stun > 0) {
      // Floundering: it thrashes where it is and cannot chase.
      this.setState('stunned');
      this.vel.multiplyScalar(0.85);
      api.ripple(this.pos.x, this.pos.z, 0.16);
    } else if (this.state === 'lurk' && (s.dist > DROWNER.RISE_RANGE || this.confidence < 0.25)) {
      this.doLurk(dt, api);
    } else {
      if (this.state === 'lurk') this.setState('rise');
      this.doHunt(dt, api, inWater, playerInWater);
    }

    // Vertical: it stands on whatever is under it, and floats to the surface
    // in water deep enough to swim in.
    const ground = this.level.groundAt(this.pos.x, this.pos.z);
    const depth = WATER_Y - ground;
    let wantY = ground;
    if (this.state === 'lurk') {
      wantY = ground; // flat on the bottom
    } else if (depth > 1.9) {
      // Swimming: shoulders at the surface, coat trailing under it.
      wantY = WATER_Y - 1.32 + Math.sin(this.wader * 0.9) * 0.05;
    }
    this.pos.y += (wantY - this.pos.y) * Math.min(1, dt * 4.5);

    this.animate(dt, depth);

    // Contact. Grabs only ever start when it can actually reach you: the
    // vertical gap matters, or a Drowner on a pit floor pulls you off a deck
    // two and a half metres over its head.
    if (!this.grabbing && this.stun <= 0 && this.grace <= 0
      && dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z) < this.contact ** 2
      && Math.abs((this.pos.y + 1.4) - (player.pos.y + player.eyeY)) < 1.9) {
      this.beginGrab(player, api);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  /**
   * On the bottom of a pit, barely moving — and giving itself away. The ripple
   * it pushes up is the player's only warning, so it is emitted every time
   * regardless of state, at an amplitude that reads at ten metres and does not
   * scream at two.
   */
  doLurk(dt, api) {
    this.setState('lurk');
    this.vel.multiplyScalar(0.9);
    // A slow crawl around the pit so it is not a fixed hazard you can memorise.
    if (!this.wander || this.stateTime > 11) {
      this.wander = this.wanderTarget(this.cell().x, this.cell().y, 3, this.rnd);
      this.stateTime = 0;
    }
    const wp = this.waypointTo(this.wander.x, this.wander.y);
    this.steer(wp, dt, DROWNER.LURK_SPEED);
    this.checkStuck(dt, true, () => { this.wander = null; });
    this.rippleTimer = (this.rippleTimer || 0) - dt;
    if (this.rippleTimer <= 0) {
      this.rippleTimer = 0.5 + this.rnd() * 0.5;
      api.ripple(this.pos.x, this.pos.z, 0.05);
    }
  }

  doHunt(dt, api, inWater, playerInWater) {
    this.setState(inWater ? 'swim' : 'lumber');
    const wp = this.waypointTo(this.belief.x, this.belief.y);
    const speed = inWater ? DROWNER.WATER_SPEED : DROWNER.LAND_SPEED;
    this.steer(wp, dt, speed);
    this.checkStuck(dt, true, null);

    // Its wake. Only in water, and only when it is actually moving.
    if (inWater) {
      const v = Math.hypot(this.vel.x, this.vel.z);
      this.rippleTimer = (this.rippleTimer || 0) - dt;
      if (v > 0.6 && this.rippleTimer <= 0) {
        this.rippleTimer = 0.22;
        api.ripple(this.pos.x, this.pos.z, 0.07);
      }
    }
    // If it has lost you and you are nowhere near the water, it goes home.
    if (this.confidence < 0.12 && !playerInWater && !inWater) {
      const back = this.nearestWaterCell();
      if (back) {
        this.belief = back;
        this.field = null;
        this.fieldKey = '';
      }
      this.setState('lurk');
    }
  }

  /** The closest cell of standing water, for going home to. */
  nearestWaterCell() {
    const here = this.cell();
    const field = this.level.distanceField([here]);
    let best = null;
    let bestD = Infinity;
    for (let y = 0; y < this.level.h; y += 1) {
      for (let x = 0; x < this.level.w; x += 1) {
        if (this.level.terrainAt(x, y) === DECK) continue;
        const d = field[this.level.cellIndex(x, y)];
        if (d >= 0 && d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  beginGrab(player, api) {
    const c = this.level.cellAt(player.pos.x, player.pos.z);
    const inWater = this.level.terrainAt(c.x, c.y) !== DECK;
    const seconds = inWater ? DROWNER.DROWN_TIME : DROWNER.DROWN_TIME_LAND;
    // The API says no if the player is already held, invulnerable, or the run
    // is over — the entity does not get to decide that.
    if (!api.grab(this, seconds, DROWNER.STRUGGLE)) return;
    this.grabbing = true;
    this.setState('grab');
  }

  doGrab(dt, player, api) {
    // Held: it stays on you and does nothing else. The game shell drives the
    // timer and tells us how it ended through releaseGrab().
    this.vel.set(0, 0, 0);
    // Hold it at exactly arm's length — pushed OUT as well as pulled in. A
    // grab that closes to zero puts the model inside the camera, and the whole
    // point of the beat is looking at the thing that has hold of you.
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const REACH = 0.9;
    if (d > 1e-3) {
      const k = Math.min(1, dt * 7);
      this.pos.x += dx * (1 - REACH / d) * k;
      this.pos.z += dz * (1 - REACH / d) * k;
    } else {
      // Dead centre: shove it out along the player's own facing.
      this.pos.x += player.forward.x * REACH;
      this.pos.z += player.forward.z * REACH;
    }
    this.heading = Math.atan2(dx, dz);
    api.ripple(this.pos.x, this.pos.z, 0.13);
  }

  /** Called by the game shell when a grab ends, either way. */
  releaseGrab(brokeFree) {
    this.grabbing = false;
    if (brokeFree) {
      this.stun = DROWNER.STUN;
      this.confidence = 0.4;
      this.setState('stunned');
    }
  }

  animate(dt, depth) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.wader += dt * (1.4 + speed * 1.5);
    const swimming = depth > 1.9 && this.state !== 'lurk';

    if (this.state === 'grab') {
      // Both arms up and forward, holding on.
      for (let i = 0; i < 2; i += 1) {
        this.arms[i].rotation.x = -1.5 + Math.sin(this.wader * 5) * 0.12;
        this.arms[i].rotation.z = (i ? -1 : 1) * 0.42;
      }
      this.body.rotation.x = 0.18;
      return;
    }
    if (this.state === 'stunned') {
      for (let i = 0; i < 2; i += 1) {
        this.arms[i].rotation.x = Math.sin(this.wader * 7 + i * 2) * 0.9;
        this.arms[i].rotation.z = (i ? -1 : 1) * (0.5 + Math.sin(this.wader * 5) * 0.4);
      }
      this.body.rotation.z = Math.sin(this.wader * 4) * 0.24;
      return;
    }

    if (swimming) {
      // A poor, heavy stroke: it does not swim so much as haul itself along.
      this.body.rotation.x = 0.62;
      this.body.rotation.z = Math.sin(this.wader * 0.8) * 0.1;
      for (let i = 0; i < 2; i += 1) {
        const ph = this.wader * 1.6 + i * Math.PI;
        this.arms[i].rotation.x = -0.9 + Math.sin(ph) * 1.5;
        this.arms[i].rotation.z = (i ? -1 : 1) * 0.34;
        this.legs[i].rotation.x = Math.sin(ph * 1.2) * 0.28 - 0.5;
      }
      return;
    }

    // Walking or wading. Below the surface the stride shortens and the arms
    // come up — the drag is doing to it what it does to you.
    const drag = clamp(depth / 1.3, 0, 1);
    const swing = Math.sin(this.wader * 1.5) * (0.42 - drag * 0.22);
    this.body.rotation.x = 0.08 + drag * 0.06;
    this.body.rotation.z = Math.sin(this.wader * 0.7) * 0.05;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.55 - drag * 0.9;
    this.arms[1].rotation.x = swing * 0.55 - drag * 0.9;
    this.arms[0].rotation.z = 0.1 + drag * 0.35;
    this.arms[1].rotation.z = -0.1 - drag * 0.35;
    this.head.rotation.y = Math.sin(this.wader * 0.4) * 0.24;
  }
}

// ============================================================= SMILER ====

/**
 * The Smiler's numbers, and the inversion they encode.
 *
 * The PNG chaser freezes while you look at it. The Smiler is the other way
 * round, and it is straight out of the source: survivors get away by holding
 * eye contact and backing off slowly, and get killed by panicking, running, or
 * making noise. So LOOKING AT IT IS THE SAFE STATE. Turn your back inside
 * PATIENCE seconds, or sprint anywhere near it, and it comes.
 *
 * Its one hard limit is light. It lives in the unlit cells and its navFilter
 * contains nothing else, so a lit room is not a place it chooses not to enter
 * — it is a place with no route into it.
 */
export const SMILER = {
  SIGHT: 30, // it is all eyes
  FOV: Math.PI * 2,
  HEARING: 22,
  FORGET: 0.12,
  WATCH_RANGE: 15, // inside this it is aware of you and you of it
  PATIENCE: 1.5, // seconds of your back turned before it commits
  NOISE_TRIGGER: 1.8, // sprinting (2.45) trips this; walking (1.0) does not
  DRIFT_SPEED: 0.9,
  CHARGE_SPEED: 6.4, // faster than your sprint — but only through the dark
  RETREAT_SPEED: 2.6,
  CONTACT: 1.0,
  GRACE: 20,
};

export class Smiler extends Agent {
  constructor(level, collider, rnd) {
    super(level, collider, {
      radius: 0.42,
      speed: SMILER.DRIFT_SPEED,
      // The dark, and nothing but. Both ends of every edge must be unlit, so
      // it cannot even cut a corner through a lit cell.
      navFilter: (x, y, nx, ny) => level.isDark(x, y) && level.isDark(nx, ny),
    });
    this.rnd = rnd;
    this.kind = 'smiler';
    this.name = 'Smiler';
    this.contact = SMILER.CONTACT;
    this.watched = 0; // seconds the player has been looking at it
    this.unwatched = 0; // seconds since they last did
    this.grace = SMILER.GRACE;
    this.glow = 0;
    this.wander = null;
    this.height = 2.1;
    this.spawnWants = (x, y) => level.isDark(x, y);
    this.buildModel();
  }

  /**
   * There is no body. The source is clear that nobody has ever established
   * what a Smiler actually looks like — only "reflective eyes and teeth
   * gleaming in the dark" — so that is all there is here: two eyes and a grin,
   * on unlit additive material, floating at head height.
   *
   * Modelling a body and hiding it in shadow would be worse, not better: the
   * moment any light fell on it the mystery would be over.
   */
  buildModel() {
    const g = this.group;
    this.eyeMat = new THREE.MeshBasicMaterial({
      color: 0xdfeee8,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      fog: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.toothMat = new THREE.MeshBasicMaterial({
      color: 0xf2f0e2,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      fog: true,
      depthWrite: false,
    });

    this.face = new THREE.Group();
    this.face.position.y = 1.96;
    g.add(this.face);

    // SCALE IS THE WHOLE READ. A Smiler is not a face on a person, it is a
    // grin roughly a metre across hanging in a dark room, and the first
    // version of this was built at human proportions — two 7 cm eyes 38 cm
    // apart, which at any real distance merge into one white smudge over a
    // zigzag you cannot resolve. Everything here is about twice that.

    // Eyes: wide, flattened, and canted inward, which is what turns two
    // glowing ovals into an expression.
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), this.eyeMat);
      eye.scale.set(1.2, 0.56, 0.4);
      // Set WIDE and well above the grin. Any closer and additive blending
      // welds the pair into one lozenge, which is a headlight, not a stare.
      eye.position.set(sx * 0.42, 0.44, 0.03);
      eye.rotation.z = sx * -0.24;
      this.face.add(eye);
      this.eyes.push(eye);
    }

    // The grin: a row of tapered teeth around a wide arc, upper and lower,
    // meshing. Built as one merged geometry — a mouth is not something any
    // part of which needs to move on its own. The arc carries the teeth BACK
    // as it goes wide, so the grin wraps around a head that is not there
    // rather than sitting flat on a plane.
    const teeth = [];
    const N = 19;
    for (let i = 0; i < N; i += 1) {
      const t = i / (N - 1);
      const a = (t - 0.5) * 1.9; // the arc of the smile, in radians
      const wide = Math.cos(a * 0.62); // 1 at the middle, less at the corners
      for (const up of [1, -1]) {
        const h = (0.075 + wide * 0.075) * (up > 0 ? 1 : 0.8);
        const geo = new THREE.ConeGeometry(0.026 + wide * 0.012, h, 5);
        // Upper teeth point down, lower teeth point up.
        geo.rotateX(up > 0 ? Math.PI : 0);
        geo.translate(
          Math.sin(a) * 0.47,
          // The smile line: corners lifted, which is the difference between a
          // grin and a set of jaws.
          -0.02 + (1 - wide) * 0.16 + up * h * 0.5,
          0.05 - (1 - Math.cos(a)) * 0.3,
        );
        teeth.push(geo);
      }
    }
    this.grin = new THREE.Mesh(mergeGeometries(teeth, false), this.toothMat);
    for (const geo of teeth) geo.dispose();
    this.face.add(this.grin);

    // Everything it emits is its own glow — there is no light source in the
    // dark cells it lives in, so without this it is genuinely invisible.
    this.lamp = new THREE.PointLight(0xbfe0d4, 0, 6, 2);
    this.lamp.position.y = 1.94;
    g.add(this.lamp);
  }

  /** Is the player looking more or less at it, with a clear line? */
  isWatched(player) {
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > SMILER.WATCH_RANGE + 8) return false;
    if (!this.level.lineOfSight(player.pos.x, player.pos.z, this.pos.x, this.pos.z)) return false;
    const dot = ((dx / d) * player.forward.x) + ((dz / d) * player.forward.z);
    return dot > 0.82; // ~35 degrees — you have to actually face it
  }

  update(dt, player, api) {
    this.stateTime += dt;
    this.grace = Math.max(0, this.grace - dt);
    const cfg = {
      sight: SMILER.SIGHT, fov: SMILER.FOV, hearing: SMILER.HEARING, forget: SMILER.FORGET,
    };
    const s = this.sense(player, dt, cfg, this.rnd);

    const watched = this.isWatched(player);
    if (watched) {
      this.watched += dt;
      this.unwatched = 0;
    } else {
      this.unwatched += dt;
      this.watched = 0;
    }

    // The two provocations, straight from the source: turning away, and noise.
    const near = s.dist < SMILER.WATCH_RANGE;
    const panicked = near && this.unwatched > SMILER.PATIENCE && this.confidence > 0.3;
    const loud = player.noise >= SMILER.NOISE_TRIGGER && s.dist < SMILER.HEARING;

    if (this.grace <= 0 && (panicked || loud) && this.state !== 'charge') {
      this.setState('charge');
    } else if (this.state === 'charge' && (watched && s.dist > 3.5)) {
      // Meeting its eyes even mid-rush calls it off — but not once it is on
      // top of you, or "look at it" would be a dodge button.
      this.setState('retreat');
    }

    switch (this.state) {
      case 'charge': this.doCharge(dt, api); break;
      case 'retreat': this.doRetreat(dt); break;
      default: this.doLurk(dt, player, s); break;
    }

    // Visibility. It glows only when it has decided you can see it: dim while
    // it watches, blazing while it comes. Being able to see one across a dark
    // room is the entire warning.
    const wantGlow = this.state === 'charge' ? 1
      : (near && this.confidence > 0.25 ? 0.45 : 0.06);
    this.glow += (wantGlow - this.glow) * Math.min(1, dt * 3.5);
    this.eyeMat.opacity = this.glow;
    this.toothMat.opacity = this.glow * 0.9;
    this.lamp.intensity = this.glow * 5;

    // It always faces you — that is what the eye contact is with.
    const want = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    this.heading += clamp(diff, -dt * 5, dt * 5);

    // It hovers at head height above whatever floor is under it.
    const ground = this.level.groundAt(this.pos.x, this.pos.z);
    this.pos.y += (Math.max(ground, WATER_Y - 0.9) - this.pos.y) * Math.min(1, dt * 3);

    if (this.grace <= 0
      && dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z) < this.contact ** 2) {
      api.kill('You looked away.');
    }

    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(this.stateTime * 1.6) * 0.05;
    this.group.rotation.y = this.heading;
  }

  doLurk(dt, player, s) {
    this.setState('lurk');
    // While you are looking at it, it is perfectly still. While you are not,
    // it drifts closer through the dark — slowly enough that turning back
    // finds it nearer rather than on top of you.
    if (this.watched > 0.1 || s.dist > SMILER.SIGHT) {
      this.vel.multiplyScalar(0.8);
      return;
    }
    // The source says Smilers are drawn to light. There is no torch in Level
    // 37, but there is a shoal of Will o' Waves, and it will follow that.
    const shoal = this.director?.get('willo');
    let target = this.belief;
    if (shoal && this.confidence < 0.3) {
      const c = this.level.cellAt(shoal.pos.x, shoal.pos.z);
      if (this.level.isDark(c.x, c.y)) target = c;
    }
    const wp = this.waypointTo(target.x, target.y);
    if (wp) {
      this.steer(wp, dt, SMILER.DRIFT_SPEED);
    } else {
      // Nowhere dark leads to where it wants to be: wander its own patch.
      if (!this.wander || this.stateTime > 8) {
        this.wander = this.wanderTarget(this.cell().x, this.cell().y, 5, this.rnd);
        this.stateTime = 0;
      }
      this.steer(this.waypointTo(this.wander.x, this.wander.y), dt, SMILER.DRIFT_SPEED);
    }
    this.checkStuck(dt, true, () => { this.wander = null; });
  }

  doCharge(dt, api) {
    const wp = this.waypointTo(this.belief.x, this.belief.y);
    if (!wp) {
      // You are standing somewhere it cannot reach — under a light. It waits
      // at the edge of the dark, which is exactly what it should do.
      this.vel.multiplyScalar(0.9);
      if (this.stateTime > 4) this.setState('lurk');
      return;
    }
    this.steer(wp, dt, SMILER.CHARGE_SPEED);
    this.checkStuck(dt, true, null);
    api.smilerRush(this.pos.clone(), this.stateTime);
    if (this.stateTime > 9) this.setState('retreat');
  }

  doRetreat(dt) {
    if (!this.wander || this.stateTime > 5) {
      this.wander = this.wanderTarget(this.cell().x, this.cell().y, 6, this.rnd);
      this.stateTime = 0;
    }
    this.steer(this.waypointTo(this.wander.x, this.wander.y), dt, SMILER.RETREAT_SPEED);
    this.checkStuck(dt, true, () => { this.wander = null; });
    if (this.stateTime > 3.5) this.setState('lurk');
  }
}

// ====================================================== WILL O' WAVES ====

/**
 * Entity 207. The only friendly thing in either level.
 *
 * Docile bioluminescent crustaceans that travel in single file down watery
 * channels, and — this is the mechanically interesting part of the source —
 * following a shoal "will often lead travellers to exits and passageways that
 * are otherwise hard to find". So that is exactly what they do: they path
 * through the water toward the level's exit, and if you swim with them they
 * are a compass.
 *
 * Two costs keep that from being a free win. They only go where there is
 * water, so the route they show you is a swimmer's route, not the safe one.
 * And they are a light source in a level whose other resident is drawn to
 * light.
 */
export const WILLO = {
  COUNT: 54,
  SPEED: 1.55, // dawdling; you can overtake them, and lose them
  HUM_SPEED: 2.2,
  SPACING: 0.52, // metres between individuals in the file
  GLOW: 0.38,
  HUM_GLOW: 0.85,
  HUM_RANGE: 14, // how far a hum carries to them
};

export class WillOWaves extends Agent {
  constructor(level, collider, rnd) {
    super(level, collider, {
      radius: 0.22,
      speed: WILLO.SPEED,
      // Water only. A shoal of shrimp does not cross a dry deck.
      navFilter: (x, y, nx, ny) => level.isWater(x, y) && level.isWater(nx, ny),
    });
    this.rnd = rnd;
    this.kind = 'willo';
    this.name = "Will o' Waves";
    this.harmless = true;
    this.state = 'lead';
    this.hum = 0; // 0..1, how excited they currently are
    this.startled = 0;
    this.height = 0.3;
    this.spawnWants = (x, y) => level.isWater(x, y);
    // The head of the file leaves a breadcrumb trail; everyone else follows it
    // at a fixed spacing, which is what makes a shoal read as single file
    // rather than as a cloud that happens to be moving.
    this.trail = [];
    this.buildModel();
  }

  buildModel() {
    const pos = new Float32Array(WILLO.COUNT * 3);
    const col = new Float32Array(WILLO.COUNT * 3);
    for (let i = 0; i < WILLO.COUNT; i += 1) {
      col[i * 3] = 0.24;
      col[i * 3 + 1] = 0.66;
      col[i * 3 + 2] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.pointsMat = new THREE.PointsMaterial({
      // A Will o' Wave is 13-15 cm long. Anything much bigger and fifty of
      // them additively blended stop being a shoal and become one white smear
      // — which is what the first pass at this looked like.
      size: 0.13,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    // The shoal is positioned in WORLD space per individual, so the group it
    // hangs off must not also move it.
    this.points.matrixAutoUpdate = false;
    this.group.add(this.points);

    this.lamp = new THREE.PointLight(0x3f8fff, 1, 7, 2);
    this.group.add(this.lamp);
    this.attr = geo.getAttribute('position');
    this.colAttr = geo.getAttribute('color');
  }

  /** Where the shoal is heading: the exit, through water. */
  retarget() {
    // The exit cell itself is dry (the generator guarantees it), so aim at the
    // wettest cell adjacent to it — but only if this shoal's own stretch of
    // water actually connects to it. A goal on the far side of a dry deck is a
    // goal with no route, and the shoal would grind against the pool wall
    // forever re-planning the same impossible swim.
    const here = this.cell();
    const reach = this.level.distanceField([here], this.navFilter);
    const goals = [];
    for (const n of this.level.neighbours(this.level.exit.x, this.level.exit.y)) {
      if (this.level.isWater(n.x, n.y) && reach[this.level.cellIndex(n.x, n.y)] >= 0) goals.push(n);
    }
    if (goals.length) {
      this.goal = goals[Math.floor(this.rnd() * goals.length)];
      this.knowsWayOut = true;
      return;
    }
    // Landlocked in a pool that does not reach the exit: they tour it instead,
    // which is honest — a shoal is a hint, not a guarantee.
    this.knowsWayOut = false;
    this.goal = this.wanderTarget(here.x, here.y, 12, this.rnd);
  }

  update(dt, player, api) {
    this.stateTime += dt;
    this.startled = Math.max(0, this.startled - dt);
    // They neither hunt nor flee, so they have no belief to maintain — the one
    // entity in the game that genuinely does not care where you are.
    this.confidence = 0;

    const humming = player.humming && this.distTo(player) < WILLO.HUM_RANGE;
    this.hum += ((humming ? 1 : 0) - this.hum) * Math.min(1, dt * 2.4);

    if (!this.goal || this.stateTime > 22
      || dist2(this.pos.x, this.pos.z, ...this.goalWorld()) < 2) {
      this.retarget();
      this.stateTime = 0;
    }

    // Humming draws them: they come to you and then lead off again, which is
    // how you ask them for directions.
    let target = this.goal;
    if (this.hum > 0.5) {
      const pc = this.level.cellAt(player.pos.x, player.pos.z);
      if (this.level.isWater(pc.x, pc.y)) target = pc;
    }
    const wp = this.waypointTo(target.x, target.y);
    this.steer(wp, dt, WILLO.SPEED + this.hum * (WILLO.HUM_SPEED - WILLO.SPEED));
    this.checkStuck(dt, true, () => { this.goal = null; });

    // Swim mid-water: deep enough to be under the surface, high enough off the
    // bottom to be visible from above it.
    const ground = this.level.groundAt(this.pos.x, this.pos.z);
    const wantY = Math.min(WATER_Y - 0.35, ground + 0.55);
    this.pos.y += (wantY - this.pos.y) * Math.min(1, dt * 2.5);

    this.updateShoal(dt);
    if (this.hum > 0.05) api.ripple(this.pos.x, this.pos.z, 0.03 * this.hum);
  }

  distTo(player) {
    return Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
  }

  goalWorld() {
    if (!this.goal) return [1e6, 1e6];
    const c = this.level.centre(this.goal.x, this.goal.y);
    return [c.x, c.z];
  }

  /**
   * Lay out the whole file behind the head in a straight line.
   *
   * Called whenever the shoal is (re)placed. Without it the trail starts empty,
   * every individual resolves to the same point, and fifty additively blended
   * sprites stacked on one pixel is a searchlight — which is exactly what the
   * first version looked like for the twenty seconds it took the leader to lay
   * down enough breadcrumbs.
   */
  seedTrail() {
    this.trail = [];
    const need = WILLO.COUNT * WILLO.SPACING + 2;
    const dx = -Math.sin(this.heading);
    const dz = -Math.cos(this.heading);
    for (let d = 0; d <= need; d += 0.25) {
      this.trail.push({ x: this.pos.x + dx * d, y: this.pos.y, z: this.pos.z + dz * d });
    }
  }

  placeAtCell(x, y) {
    super.placeAtCell(x, y);
    this.seedTrail();
  }

  /**
   * Lay a breadcrumb behind the leader and hang every individual off it at a
   * fixed distance back along the trail, with a small sideways wobble each so
   * the file breathes instead of looking like beads on a wire.
   */
  updateShoal(dt) {
    const need = WILLO.COUNT * WILLO.SPACING;
    const last = this.trail[0];
    if (!last || dist2(last.x, last.z, this.pos.x, this.pos.z) > 0.04) {
      this.trail.unshift({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    }
    // Keep only as much trail as the tail of the file can be sitting on.
    let run = 0;
    for (let i = 1; i < this.trail.length; i += 1) {
      run += Math.hypot(
        this.trail[i].x - this.trail[i - 1].x, this.trail[i].z - this.trail[i - 1].z,
      );
      if (run > need + 2) {
        this.trail.length = i + 1;
        break;
      }
    }

    const glow = WILLO.GLOW + this.hum * (WILLO.HUM_GLOW - WILLO.GLOW);
    this.phase = (this.phase || 0) + dt * (2.2 + this.hum * 5);
    for (let i = 0; i < WILLO.COUNT; i += 1) {
      const want = i * WILLO.SPACING;
      // Walk back along the trail to the point `want` metres behind the head.
      let acc = 0;
      let p = this.trail[0] || this.pos;
      let found = false;
      for (let j = 1; j < this.trail.length; j += 1) {
        const seg = Math.hypot(
          this.trail[j].x - this.trail[j - 1].x, this.trail[j].z - this.trail[j - 1].z,
        );
        if (acc + seg >= want) {
          const t = seg > 1e-6 ? (want - acc) / seg : 0;
          p = {
            x: this.trail[j - 1].x + (this.trail[j].x - this.trail[j - 1].x) * t,
            y: this.trail[j - 1].y + (this.trail[j].y - this.trail[j - 1].y) * t,
            z: this.trail[j - 1].z + (this.trail[j].z - this.trail[j - 1].z) * t,
          };
          found = true;
          break;
        }
        acc += seg;
        p = this.trail[j];
      }
      // Ran off the end of the breadcrumbs: carry on in the direction the tail
      // was already going rather than parking everyone left over on the last
      // crumb, which piles the back half of the shoal onto one point.
      if (!found && this.trail.length > 1) {
        const a = this.trail[this.trail.length - 2];
        const b = this.trail[this.trail.length - 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const over = want - acc;
        p = { x: b.x + ((b.x - a.x) / len) * over, y: b.y, z: b.z + ((b.z - a.z) / len) * over };
      }
      const wob = this.phase + i * 0.7;
      this.attr.setXYZ(
        i,
        p.x + Math.sin(wob) * 0.12,
        p.y + Math.sin(wob * 1.7) * 0.09,
        p.z + Math.cos(wob * 0.9) * 0.12,
      );
      // The blue dorsal flash runs down the file rather than pulsing in unison
      // — a shoal flashing as one body would read as a single object.
      const flash = 0.5 + 0.5 * Math.sin(this.phase * 1.8 - i * 0.42);
      const k = glow * flash;
      // Kept well clear of white: additive blending plus ACES tone mapping
      // will desaturate anything near 1 in all three channels, and a blue
      // shoal that renders white is just a light.
      this.colAttr.setXYZ(i, 0.05 * k, 0.32 * k, 1.0 * k);
    }
    this.attr.needsUpdate = true;
    this.colAttr.needsUpdate = true;

    this.lamp.position.copy(this.pos);
    // Kept low on purpose. The shoal should tint the tile it swims over, not
    // light the room — a lamp bright enough to read by blows the water out to
    // white and takes the level's darkness with it.
    this.lamp.intensity = 0.7 + glow * 2.2;
    this.lamp.distance = 7 + this.hum * 5;
  }

  /** Nothing to orient: the shoal is positioned per individual in world space. */
  present() {}

  /**
   * The base sweep only releases meshes, and the shoal is a THREE.Points with
   * its own generated glow sprite — without this, every level rebuild leaks a
   * buffer geometry, a material and a texture.
   */
  dispose() {
    super.dispose();
    this.points.geometry.dispose();
    this.pointsMat.map?.dispose();
    this.pointsMat.dispose();
  }
}

// ============================================================== roster ====

/**
 * The Poolrooms roster, described for humans. Numbers are read out of the
 * tuning blocks above rather than retyped, so a stat card cannot quote a speed
 * the game does not use.
 */
export const POOL_ENTITY_INFO = {
  drowner: {
    label: 'Drowner',
    kind: 'drowner',
    tagline: 'A yellow raincoat, lying on the bottom, waiting.',
    origin: 'Backrooms Wiki — Entity 232',
    href: 'https://backrooms-wiki.wikidot.com/entity-232',
    blurb: 'Six feet of lanky grey nothing in a weathered yellow raincoat and rubber boots — '
      + 'autopsies find no organs, only brackish water filling every cavity. It lies submerged '
      + 'in the pits indefinitely and comes up when something swims over it. In water it moves '
      + 'anomalously unimpeded; on tile it lumbers.',
    senses: 'Poor eyes. Hearing that the water carries straight to it.',
    counterplay: `It swims at ${DROWNER.WATER_SPEED} m/s and you swim at ${PLAYER_SPEEDS.SWIM} — you `
      + `cannot outswim it, so get OUT. On the deck it manages ${DROWNER.LAND_SPEED} m/s and you `
      + `walk at ${PLAYER_SPEEDS.WALK}. While it is lurking it disturbs the surface above itself: `
      + 'a patch of water rippling with nothing in it is the warning. If it grabs you, thrash — '
      + 'change direction over and over — and it lets go.',
    stats: [
      { k: 'Sight', v: `${DROWNER.SIGHT} m`, bar: DROWNER.SIGHT / 36 },
      { k: 'Hearing', v: `${DROWNER.HEARING} m`, bar: DROWNER.HEARING / 36 },
      { k: 'In water', v: `${DROWNER.WATER_SPEED} m/s`, bar: DROWNER.WATER_SPEED / 9 },
      { k: 'On land', v: `${DROWNER.LAND_SPEED} m/s`, bar: DROWNER.LAND_SPEED / 9 },
      { k: 'Drowns you in', v: `${DROWNER.DROWN_TIME} s`, bar: DROWNER.DROWN_TIME / 9 },
      { k: 'Stunned for', v: `${DROWNER.STUN} s`, bar: DROWNER.STUN / 9 },
    ],
  },
  smiler: {
    label: 'Smiler',
    kind: 'smiler',
    tagline: 'Eyes and teeth. Safe while you are looking at it.',
    origin: 'Backrooms Wiki — Entity 3',
    href: 'https://backrooms-wiki.wikidot.com/entity-3',
    blurb: 'Nobody has established what a Smiler is, only what shows: reflective eyes and a long '
      + 'grin of teeth gleaming in the dark. It is modelled as exactly that and nothing else. It '
      + 'lives in the unlit stretches of the level and physically cannot route through a lit '
      + 'room — the light is not a deterrent, it is a wall.',
    senses: 'It sees everything. It hears you panic.',
    counterplay: 'The inverse of the chaser: hold eye contact and it will not move. Turn your '
      + `back for ${SMILER.PATIENCE} s inside ${SMILER.WATCH_RANGE} m, or sprint anywhere near `
      + `it, and it charges at ${SMILER.CHARGE_SPEED} m/s — faster than you sprint, but only `
      + 'through darkness. Walk backwards, quietly, into the light.',
    stats: [
      { k: 'Sight', v: `${SMILER.SIGHT} m`, bar: SMILER.SIGHT / 36 },
      { k: 'Hearing', v: `${SMILER.HEARING} m`, bar: SMILER.HEARING / 36 },
      { k: 'Field of view', v: 'all round', bar: 1 },
      { k: 'Drift', v: `${SMILER.DRIFT_SPEED} m/s`, bar: SMILER.DRIFT_SPEED / 9 },
      { k: 'Charge', v: `${SMILER.CHARGE_SPEED} m/s`, bar: SMILER.CHARGE_SPEED / 9 },
      { k: 'Patience', v: `${SMILER.PATIENCE} s`, bar: SMILER.PATIENCE / 9 },
    ],
  },
  willo: {
    label: "Will o' Waves",
    kind: 'willo',
    tagline: 'A shoal of glowing shrimp that knows the way out.',
    origin: 'Backrooms Wiki — Entity 207',
    href: 'https://backrooms-wiki.wikidot.com/entity-207',
    blurb: 'Semi-crustacean, about 14 cm long, with bioluminescent dorsal spines that flash '
      + `bright blue. They travel in single file — ${WILLO.COUNT} of them here — down watery `
      + 'channels, entirely docile, and are considered a good omen: following a shoal tends to '
      + 'lead to resources, safe ground and exits that are otherwise hard to find.',
    senses: 'None that concern you. They do not care where you are.',
    counterplay: 'Nothing to survive — they are the level\'s one kindness. They swim toward the '
      + 'way out, so follow them. The source says they can be encouraged to shine brighter by '
      + 'soft humming, so hum and they will come to you and lead off again. Two catches: their '
      + 'route is a swimmer\'s route, and their light is exactly what a Smiler is drawn to.',
    stats: [
      { k: 'Shoal', v: `${WILLO.COUNT} individuals`, bar: 0.6 },
      { k: 'Hostility', v: 'none', bar: 0 },
      { k: 'Cruise', v: `${WILLO.SPEED} m/s`, bar: WILLO.SPEED / 9 },
      { k: 'When hummed at', v: `${WILLO.HUM_SPEED} m/s`, bar: WILLO.HUM_SPEED / 9 },
      { k: 'Hears a hum at', v: `${WILLO.HUM_RANGE} m`, bar: WILLO.HUM_RANGE / 36 },
      { k: 'Leads to', v: 'the exit', bar: 1 },
    ],
  },
};

export { DECK_Y, SHALLOW_Y, DEEP_Y, CELL };
