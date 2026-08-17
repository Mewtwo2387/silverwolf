// Backrooms — entities: models, senses and behaviour.
//
// TWO RULES GOVERN EVERY ENTITY HERE.
//
// 1. They are physically bound. Movement goes through the same Collider the
//    player uses, and navigation is a BFS flow field over the open-cell graph,
//    so a route only ever exists where a wall does not. There is no "cheat"
//    movement mode, not even for the jumpscare — that repositions the chaser to
//    a legal, reachable cell and then makes it *run*, it does not fly at you
//    through the wallpaper. A stuck-detector re-plans rather than teleporting.
//
// 2. They do not know where you are. Nothing reads the player's position
//    directly for decision-making; each entity keeps a `belief` cell, updated
//    only by senses it actually has:
//      - SIGHT: line of sight (the same DDA that walls block) within a range,
//        and for the chaser within a facing cone. While seen, belief is exact —
//        it is looking right at you.
//      - HEARING: the player emits a noise level (crouch 0.25 / walk 1 /
//        sprint 2.4). Audible radius scales with it. A heard player fixes belief
//        to a cell *near* theirs, with error growing with distance and shrinking
//        with noise — so sprinting past a Lifeform tells it exactly where you
//        are, and creeping tells it only roughly.
//      - MEMORY: belief decays. On losing you the entity commits to the last
//        known cell, searches around it, then falls back to patrol.
//
// Sources for the entity concepts are listed on the game's References tab.

import * as THREE from 'three';
import { CELL, hash2 } from './backrooms-maze.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (ax, az, bx, bz) => ((ax - bx) ** 2) + ((az - bz) ** 2);

// ---------------------------------------------------------- base agent ----

class Agent {
  constructor(level, collider, opts) {
    this.level = level;
    this.collider = collider;
    this.radius = opts.radius ?? 0.45;
    this.speed = opts.speed ?? 3;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.state = 'patrol';
    this.stateTime = 0;

    // Belief: what the entity *thinks* it knows, never the truth.
    this.belief = { x: 0, y: 0 };
    this.confidence = 0; // 1 = seeing you now, decays once you're out of sight
    this.timeSinceSeen = 999;
    this.field = null; // cached BFS flow field toward `belief`
    this.fieldKey = '';

    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.group = new THREE.Group();
    this.alive = true;
    this.frozen = false; // debug harness / entity-specific holds
  }

  placeAtCell(x, y) {
    const c = this.level.centre(x, y);
    this.pos.set(c.x, this.pos.y, c.z);
    this.belief = { x, y };
    this.lastPos.copy(this.pos);
    // Sync the visual immediately rather than waiting for the next update():
    // a freshly spawned or frozen entity would otherwise sit at the world
    // origin until it next gets a tick.
    this.group.position.copy(this.pos);
  }

  cell() { return this.level.cellAt(this.pos.x, this.pos.z); }

  /** Refresh (or reuse) the flow field that leads to the belief cell. */
  fieldTo(x, y) {
    const key = `${x},${y}`;
    if (this.fieldKey !== key || !this.field) {
      this.field = this.level.distanceField([{ x, y }]);
      this.fieldKey = key;
    }
    return this.field;
  }

  /**
   * One nav step toward `target` cell, with lookahead smoothing: if the cell
   * after next is directly visible, steer at that instead, so entities cut
   * corners like something with eyes rather than tracing cell centres.
   */
  waypointTo(tx, ty) {
    const here = this.cell();
    if (here.x === tx && here.y === ty) return this.level.centre(tx, ty);
    const field = this.fieldTo(tx, ty);
    const first = this.level.stepDownhill(here.x, here.y, field);
    if (!first) return null;
    const second = this.level.stepDownhill(first.x, first.y, field);
    if (second) {
      const c2 = this.level.centre(second.x, second.y);
      if (this.level.lineOfSight(this.pos.x, this.pos.z, c2.x, c2.z)) return c2;
    }
    return this.level.centre(first.x, first.y);
  }

  /** Move toward a world point, collide, and track heading. */
  steer(target, dt, speed) {
    if (!target || this.frozen) {
      this.vel.multiplyScalar(0.8);
      return 0;
    }
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return 0;
    const vx = (dx / d) * speed;
    const vz = (dz / d) * speed;
    // Smooth the velocity so entities lean into turns instead of snapping.
    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * 6);
    this.vel.z += (vz - this.vel.z) * Math.min(1, dt * 6);

    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const r = this.collider.resolve(nx, nz, this.radius);
    this.pos.x = r.x;
    this.pos.z = r.z;
    if (Math.hypot(this.vel.x, this.vel.z) > 0.1) {
      this.heading = Math.atan2(this.vel.x, this.vel.z);
    }
    return d;
  }

  /**
   * Anti-trap. If an entity wants to move but hasn't for a second, its plan is
   * wrong (a doorway it can't fit through, a corner it's grinding on) — throw
   * the cached field away and re-target rather than leaving it stuck forever.
   */
  checkStuck(dt, wantsToMove, onStuck) {
    if (!wantsToMove) {
      this.stuckTimer = 0;
      this.lastPos.copy(this.pos);
      return;
    }
    if (this.pos.distanceToSquared(this.lastPos) < 0.0025) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1) {
        this.stuckTimer = 0;
        this.field = null;
        this.fieldKey = '';
        if (onStuck) onStuck();
      }
    } else {
      this.stuckTimer = 0;
      this.lastPos.copy(this.pos);
    }
  }

  /** A random reachable cell within `radius` cells of (cx, cy). */
  wanderTarget(cx, cy, radius, rnd) {
    const field = this.level.distanceField([{ x: cx, y: cy }]);
    const options = [];
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.level.h - 1, cy + radius); y += 1) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.level.w - 1, cx + radius); x += 1) {
        const d = field[this.level.cellIndex(x, y)];
        if (d > 1 && d <= radius) options.push({ x, y });
      }
    }
    if (!options.length) return { x: cx, y: cy };
    return options[Math.floor(rnd() * options.length)];
  }

  /**
   * Update belief from the senses this entity has. `player` carries position
   * and a noise level; nothing else about it is consulted.
   */
  sense(player, dt, cfg, rnd) {
    this.timeSinceSeen += dt;
    const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);

    let sawIt = false;
    if (d < cfg.sight) {
      if (this.level.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
        if (cfg.fov >= Math.PI) {
          sawIt = true;
        } else {
          // Facing cone: something looking the other way genuinely misses you.
          const ang = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
          let diff = ang - this.heading;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          sawIt = Math.abs(diff) < cfg.fov * 0.5;
        }
      }
    }

    if (sawIt) {
      const pc = this.level.cellAt(player.pos.x, player.pos.z);
      this.belief = pc;
      this.confidence = 1;
      this.timeSinceSeen = 0;
      return { seen: true, heard: false, dist: d };
    }

    // Hearing: audible radius grows with how much noise the player is making.
    const audible = cfg.hearing * (0.35 + player.noise * 0.9);
    let heard = false;
    if (d < audible) {
      heard = true;
      const pc = this.level.cellAt(player.pos.x, player.pos.z);
      // Positional error: worse far away, better when you're loud. Never zero —
      // sound alone should never hand over an exact fix.
      const err = clamp((d / Math.max(1, audible)) * 3.2 / Math.max(0.4, player.noise), 0.6, 4);
      const jitter = () => Math.round((rnd() * 2 - 1) * err);
      const bx = clamp(pc.x + jitter(), 0, this.level.w - 1);
      const by = clamp(pc.y + jitter(), 0, this.level.h - 1);
      // Only commit if that guess is somewhere it could actually walk to.
      const f = this.level.distanceField([this.cell()]);
      if (f[this.level.cellIndex(bx, by)] >= 0) this.belief = { x: bx, y: by };
      this.confidence = Math.max(this.confidence, 0.55);
    }

    // Memory fades.
    this.confidence = Math.max(0, this.confidence - dt * cfg.forget);
    return { seen: false, heard, dist: d };
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * Presentation only — orientation and anything else that must stay correct
   * even when behaviour is paused. The debug harness freezes AI to inspect a
   * scene, and a billboard that stops facing the camera turns edge-on and
   * disappears, which looks exactly like the entity failing to render.
   */
  present() {}
}

// ------------------------------------------------------- PNG chaser ----

export const CHASER_MODES = ['auto', 'stalk', 'chase', 'patrol', 'jumpscare'];

/**
 * The nextbot. A camera-facing billboard that slides along the floor — the
 * Garry's Mod lineage the Backrooms videos borrowed, where the horror is a flat
 * image moving with intent.
 *
 * Four behaviours, selectable in the menu or mixed by `auto`:
 *   patrol    — lost you: sweeps the area around where you were last known
 *   stalk     — keeps its distance and freezes whenever you look at it
 *   chase     — commits and runs you down once it is close and certain
 *   jumpscare — repositions out of sight, sprints the corridor into your face,
 *               screeches, and is gone. Costs you nerve, not health.
 */
export class PngChaser extends Agent {
  constructor(level, collider, texture, rnd, opts = {}) {
    super(level, collider, { radius: 0.42, speed: 3.4 });
    this.rnd = rnd;
    this.kind = 'chaser';
    this.name = 'PNG chaser';
    this.mode = opts.mode || 'auto';
    this.height = 1.95;

    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: true,
    });
    this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(this.height, this.height), this.material);
    this.sprite.position.y = this.height * 0.5 + 0.05;
    this.group.add(this.sprite);
    this.pos.y = 0;

    this.wander = null;
    this.jumpCooldown = 18 + rnd() * 20;
    this.jumpTarget = null;
    this.observed = false;
    this.onScare = null; // set by the director
    this.contact = 0.85;
  }

  setTexture(tex) {
    this.material.map = tex;
    this.material.needsUpdate = true;
  }

  /** Is the player looking more or less straight at it, with sight to it? */
  isObserved(player) {
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 34) return false;
    if (!this.level.lineOfSight(player.pos.x, player.pos.z, this.pos.x, this.pos.z)) return false;
    const dot = ((dx / d) * player.forward.x) + ((dz / d) * player.forward.z);
    return dot > 0.9; // ~25 degrees off centre
  }

  update(dt, player, api) {
    this.stateTime += dt;
    const cfg = {
      sight: 30, fov: Math.PI * 1.15, hearing: 22, forget: 0.14,
    };
    const s = this.sense(player, dt, cfg, this.rnd);
    this.observed = this.isObserved(player);

    if (this.mode !== 'auto' && this.mode !== 'jumpscare') this.setState(this.mode);
    else if (this.mode === 'jumpscare' && this.state !== 'jumpscare') this.beginJumpscare(player);

    if (this.mode === 'auto') {
      this.jumpCooldown -= dt;
      if (this.state !== 'jumpscare') {
        if (this.jumpCooldown <= 0 && this.confidence > 0.3) {
          this.beginJumpscare(player);
        } else if (s.seen && s.dist < 15) {
          this.setState('chase');
        } else if (this.confidence > 0.45) {
          this.setState('stalk');
        } else if (this.state !== 'patrol' && this.confidence < 0.15) {
          this.setState('patrol');
        }
      }
    }

    switch (this.state) {
      case 'chase': this.doChase(dt, s); break;
      case 'stalk': this.doStalk(dt, player, s); break;
      case 'jumpscare': this.doJumpscare(dt, player, api); break;
      default: this.doPatrol(dt); break;
    }

    // Kill on contact — but never mid-jumpscare, which is theatre, not damage.
    if (this.state !== 'jumpscare'
      && dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z) < this.contact ** 2
      && this.level.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
      api.kill('The PNG chaser caught you.');
    }

    this.group.position.copy(this.pos);
    this.present(player);
  }

  /** Y-billboard: yaw to the camera only, so it never tips as you look down. */
  present(player) {
    if (!player) return;
    this.sprite.rotation.y = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
  }

  doPatrol(dt) {
    if (!this.wander || this.stateTime > 9
      || dist2(this.pos.x, this.pos.z, this.wanderWorld.x, this.wanderWorld.z) < 1.2) {
      // Sweep the neighbourhood of the last place it believed you were, rather
      // than wandering the whole level — a searcher, not a tourist.
      this.wander = this.wanderTarget(this.belief.x, this.belief.y, 7, this.rnd);
      this.wanderWorld = this.level.centre(this.wander.x, this.wander.y);
      this.stateTime = 0;
    }
    const wp = this.waypointTo(this.wander.x, this.wander.y);
    this.steer(wp, dt, 2.4);
    this.checkStuck(dt, true, () => { this.wander = null; });
  }

  doStalk(dt, player, s) {
    // Weeping-angel clause: while you are looking at it, it does not move.
    if (this.observed) {
      this.vel.set(0, 0, 0);
      return;
    }
    // Hold a ring 9-16 m from where it believes you are: close enough to be
    // seen at the end of a corridor, never close enough to feel like an attack.
    const bc = this.level.centre(this.belief.x, this.belief.y);
    const d = Math.hypot(this.pos.x - bc.x, this.pos.z - bc.z);
    let target = this.belief;
    if (d < 9) {
      // Too close — back off to a cell further from the belief.
      const away = this.wanderTarget(this.cell().x, this.cell().y, 4, this.rnd);
      target = away;
    }
    const wp = this.waypointTo(target.x, target.y);
    this.steer(wp, dt, d > 18 ? 4.6 : 2.6);
    this.checkStuck(dt, true, null);
    if (s.seen && s.dist < 9) this.setState('chase');
  }

  doChase(dt, s) {
    const wp = this.waypointTo(this.belief.x, this.belief.y);
    // A shade under a sprinting player, so a straight run buys you distance but
    // every corner you fumble gives it back. It never gets tired; you do.
    this.steer(wp, dt, 5.35);
    this.checkStuck(dt, true, null);
    if (this.mode === 'auto' && this.confidence < 0.2 && !s.seen) this.setState('patrol');
  }

  /**
   * Reposition to a legal cell the player cannot currently see, 12-22 m away by
   * path distance, then run the corridor at them. Physically bound throughout:
   * it takes a real route, it just takes it very fast.
   */
  beginJumpscare(player) {
    const pc = this.level.cellAt(player.pos.x, player.pos.z);
    const field = this.level.distanceField([pc]);
    const options = [];
    for (let y = 0; y < this.level.h; y += 1) {
      for (let x = 0; x < this.level.w; x += 1) {
        const d = field[this.level.cellIndex(x, y)];
        if (d < 3 || d > 6) continue;
        const c = this.level.centre(x, y);
        if (this.level.lineOfSight(player.pos.x, player.pos.z, c.x, c.z)) continue;
        options.push({ x, y });
      }
    }
    if (options.length) {
      const pick = options[Math.floor(this.rnd() * options.length)];
      this.placeAtCell(pick.x, pick.y);
      this.field = null;
      this.fieldKey = '';
    }
    this.setState('jumpscare');
    this.jumpPhase = 'rush';
  }

  doJumpscare(dt, player, api) {
    const pc = this.level.cellAt(player.pos.x, player.pos.z);
    this.belief = pc; // committed: this is a scripted beat, and it is brief
    const wp = this.waypointTo(pc.x, pc.y);
    this.steer(wp, dt, 13.5);
    this.checkStuck(dt, true, null);

    const d = Math.hypot(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
    if (d < 1.6 || this.stateTime > 6) {
      if (d < 2.6) api.scare(this.pos.clone());
      // Gone. It reappears somewhere else, patrolling, on a long cooldown.
      const far = this.wanderTarget(pc.x, pc.y, 12, this.rnd);
      this.placeAtCell(far.x, far.y);
      this.jumpCooldown = 30 + this.rnd() * 40;
      this.confidence = 0.2;
      this.setState(this.mode === 'jumpscare' ? 'patrol' : 'patrol');
    }
  }
}

// --------------------------------------------------------- Lifeform ----

/**
 * The Lifeform ("bacteria"): a tall black stick-figure of tangled tendrils,
 * built from tapered cylinders and TubeGeometry so it moves as one articulated
 * thing rather than a sprite.
 *
 * Behaviour follows the source: an aimless hive-hunter, nearly blind, that
 * hunts by sound and mimics a human cry for help through a repurposed throat —
 * so it is slow enough to walk away from, and the voice you hear is bait, not a
 * position you can trust.
 */
export class Lifeform extends Agent {
  constructor(level, collider, rnd) {
    super(level, collider, { radius: 0.55, speed: 2.5 });
    this.rnd = rnd;
    this.kind = 'lifeform';
    this.name = 'Lifeform';
    this.callTimer = 4 + rnd() * 8;
    this.wander = null;
    this.phase = rnd() * TAU;
    this.contact = 1.15;
    this.buildModel();
  }

  /**
   * The source puts this thing at about eleven feet. Level 0's ceiling is
   * 3.15 m, so it cannot stand up in here — and rather than shrink it or let it
   * clip through the tiles, it STOOPS: hips at 1.9 m, spine raked forward, head
   * hanging below shoulder height and thrust ahead of the body. It stands about
   * 2.9 m folded, which is a good deal worse to meet than a neat 2 m biped.
   */
  buildModel() {
    const skin = new THREE.MeshStandardMaterial({
      color: 0x07070a, roughness: 0.55, metalness: 0.05,
    });
    const g = this.group;
    const HIP = 1.92;

    // Legs: hip down to the floor, long and spindly, with a backward knee.
    this.legs = [];
    for (let i = 0; i < 2; i += 1) {
      const leg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 1.02, 6), skin);
      upper.position.y = -0.51;
      leg.add(upper);
      const lower = new THREE.Group();
      lower.position.y = -1.02;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.032, 0.9, 6), skin);
      shin.position.y = -0.45;
      lower.add(shin);
      leg.add(lower);
      leg.position.set(i ? 0.19 : -0.19, HIP, 0);
      leg.userData.lower = lower;
      g.add(leg);
      this.legs.push(leg);
    }

    // Spine: a single group raked forward, so the whole upper body reads as one
    // bent thing and the sway animation can rotate it from the hips.
    this.spine = new THREE.Group();
    this.spine.position.y = HIP;
    this.spine.rotation.x = 0.42; // leaning into the corridor
    g.add(this.spine);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.05, 7), skin);
    torso.position.y = 0.5;
    this.spine.add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.1, 0.42, 6), skin);
    neck.position.set(0, 1.12, 0.12);
    neck.rotation.x = 0.55;
    this.spine.add(neck);

    // A featureless bulb of a head — nothing to read, which is the point.
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
    this.head.scale.set(0.85, 1.25, 0.8);
    this.head.position.set(0, 1.3, 0.26);
    this.spine.add(this.head);

    // Arms as curved tubes: a hand-built spline per arm, so they hang and drag
    // like wire rather than articulating like a doll. Hung from the shoulders,
    // they reach past the knees — the fingers nearly scrape the carpet.
    this.arms = [];
    for (let i = 0; i < 2; i += 1) {
      const side = i ? 1 : -1;
      const arm = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.3, -0.55, 0.06),
        new THREE.Vector3(side * 0.38, -1.15, -0.06),
        new THREE.Vector3(side * 0.27, -1.7, 0.1),
        new THREE.Vector3(side * 0.2, -2.05, 0.04),
      ]);
      arm.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.055, 5, false), skin));
      // Fingers: three thin tapers off the end of each arm.
      for (let f = 0; f < 3; f += 1) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.005, 0.42, 4), skin);
        finger.position.set(side * 0.2 + (f - 1) * 0.05, -2.26, 0.04 + (f - 1) * 0.04);
        finger.rotation.z = (f - 1) * 0.22;
        arm.add(finger);
      }
      // Shoulders sit on the raked spine, so the arms swing from the stoop.
      arm.position.set(side * 0.21, 1.02, 0);
      this.spine.add(arm);
      this.arms.push(arm);
    }
    this.height = 2.9;
  }

  update(dt, player, api) {
    this.stateTime += dt;
    // Near-blind, superb hearing, and a long memory — it does not lose interest.
    const cfg = {
      sight: 9, fov: Math.PI * 2, hearing: 34, forget: 0.05,
    };
    const s = this.sense(player, dt, cfg, this.rnd);

    if (this.confidence > 0.3) this.setState('hunt');
    else this.setState('drift');

    let wantsMove = true;
    if (this.state === 'hunt') {
      const wp = this.waypointTo(this.belief.x, this.belief.y);
      this.steer(wp, dt, 2.9);
    } else {
      if (!this.wander || this.stateTime > 12
        || dist2(this.pos.x, this.pos.z, this.wanderWorld.x, this.wanderWorld.z) < 1.5) {
        this.wander = this.wanderTarget(this.cell().x, this.cell().y, 9, this.rnd);
        this.wanderWorld = this.level.centre(this.wander.x, this.wander.y);
        this.stateTime = 0;
      }
      const wp = this.waypointTo(this.wander.x, this.wander.y);
      this.steer(wp, dt, 1.5);
      wantsMove = true;
    }
    this.checkStuck(dt, wantsMove, () => { this.wander = null; });

    // The lure. Calls out from where it is — which is exactly why following the
    // voice is a mistake.
    this.callTimer -= dt;
    if (this.callTimer <= 0) {
      this.callTimer = 9 + this.rnd() * 16;
      api.mimic(this.pos.clone());
    }

    this.animate(dt);

    if (dist2(this.pos.x, this.pos.z, player.pos.x, player.pos.z) < this.contact ** 2) {
      api.kill('The Lifeform found you.');
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  animate(dt) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (1.1 + speed * 1.15);
    const swing = Math.sin(this.phase) * (0.22 + speed * 0.1);
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    // Knees only ever bend one way.
    this.legs[0].userData.lower.rotation.x = Math.max(0, -swing * 1.6);
    this.legs[1].userData.lower.rotation.x = Math.max(0, swing * 1.6);
    this.arms[0].rotation.x = -swing * 0.55;
    this.arms[1].rotation.x = swing * 0.55;
    this.arms[0].rotation.z = Math.sin(this.phase * 0.6) * 0.09;
    this.arms[1].rotation.z = -Math.sin(this.phase * 0.6 + 1) * 0.09;
    // A slow, wrong sway through the whole body. The spine rocks around its
    // stoop rather than straightening — it never gets to stand up in here.
    this.group.position.y = Math.sin(this.phase * 2) * 0.045;
    this.spine.rotation.x = 0.42 + Math.sin(this.phase * 0.47) * 0.08;
    this.spine.rotation.z = Math.sin(this.phase * 0.29) * 0.06;
    this.head.rotation.y = Math.sin(this.phase * 0.31) * 0.5;
  }
}

// -------------------------------------------------------- Entity 96 ----

/**
 * Entity 96, "The Neighborhood Watch": a drifting eye that sees well, hears
 * nothing, and does not chase. Catch its gaze and it charges a beam of light;
 * hold still in that light and you are dust. Break line of sight and it loses
 * the lock entirely — the counter-play is a corner, not a sprint.
 *
 * It also corrupts electronics nearby, which the HUD wears as static.
 */
export class Entity96 extends Agent {
  constructor(level, collider, rnd, texture) {
    super(level, collider, { radius: 0.5, speed: 1.35 });
    this.rnd = rnd;
    this.kind = 'watcher';
    this.name = 'Entity 96';
    this.charge = 0;
    this.chargeTime = 2.1;
    this.lockCooldown = 0;
    this.wander = null;
    this.beamSound = null;
    this.hoverPhase = rnd() * TAU;
    this.buildModel(texture);
  }

  buildModel(irisTex) {
    const g = this.group;
    const R = 0.52;
    const EYE_Y = 1.85;

    // Sclera: a plain sphere. The iris is deliberately NOT on this texture —
    // a square canvas wrapped equirectangularly pinches at the poles and turns
    // a round pupil into a slit.
    this.eye = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0xe8e3d2, roughness: 0.28, metalness: 0, emissive: 0x1a1206, emissiveIntensity: 0.35,
      }),
    );
    this.eye.position.y = EYE_Y;
    g.add(this.eye);

    // Cornea: the iris drawn onto a disc that faces the entity's forward (+Z),
    // bulged out to the sphere's surface. CircleGeometry clips the square
    // texture to a circle, so the iris stays round from every angle it matters.
    const CORNEA_R = 0.31;
    this.iris = new THREE.Mesh(
      new THREE.CircleGeometry(CORNEA_R, 28),
      new THREE.MeshStandardMaterial({
        map: irisTex, roughness: 0.12, metalness: 0, emissive: 0x0a0600, emissiveIntensity: 0.4,
      }),
    );
    this.iris.position.set(0, EYE_Y, Math.sqrt((R * R) - (CORNEA_R * CORNEA_R)) + 0.008);
    g.add(this.iris);

    // A wet membrane over the whole globe — reads as an eye, not a marble.
    this.sheen = new THREE.Mesh(
      new THREE.SphereGeometry(R + 0.015, 20, 14),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.5,
      }),
    );
    this.sheen.position.y = EYE_Y;
    g.add(this.sheen);

    // Beam: a cone that grows out of the pupil as it charges.
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.34, 1, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2d0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      }),
    );
    this.beam.visible = false;
    g.add(this.beam);

    this.light = new THREE.PointLight(0xffe9c0, 0, 14, 2);
    this.light.position.y = 1.85;
    g.add(this.light);
    this.height = 2.4;
  }

  update(dt, player, api) {
    this.stateTime += dt;
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);
    // Keen sight and touch, no hearing and no smell — hearing is exactly zero.
    const cfg = {
      sight: 24, fov: Math.PI * 0.95, hearing: 0, forget: 0.3,
    };
    const s = this.sense(player, dt, cfg, this.rnd);

    const locked = s.seen && this.lockCooldown <= 0;
    if (locked) {
      this.setState('lock');
      this.charge += dt;
      // Turn to face what it is burning.
      const want = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      this.heading += clamp(diff, -dt * 2.4, dt * 2.4);
      this.vel.multiplyScalar(0.85);

      if (this.charge === dt || !this.beamSound) {
        this.beamSound = api.beamCharge(this.pos.clone(), this.chargeTime);
      }
      this.showBeam(player, this.charge / this.chargeTime);
      if (this.charge >= this.chargeTime) {
        api.kill('Entity 96 caught you in its light.');
      }
    } else {
      if (this.charge > 0) {
        // Lost you: the lock drops, and it will not re-acquire immediately.
        this.charge = 0;
        this.lockCooldown = 2.6;
        if (this.beamSound) {
          this.beamSound.stop();
          this.beamSound = null;
        }
      }
      this.setState('drift');
      this.hideBeam();
      if (!this.wander || this.stateTime > 14
        || dist2(this.pos.x, this.pos.z, this.wanderWorld.x, this.wanderWorld.z) < 1.4) {
        this.wander = this.wanderTarget(this.cell().x, this.cell().y, 8, this.rnd);
        this.wanderWorld = this.level.centre(this.wander.x, this.wander.y);
        this.stateTime = 0;
      }
      const wp = this.waypointTo(this.wander.x, this.wander.y);
      this.steer(wp, dt, 1.35);
      this.checkStuck(dt, true, () => { this.wander = null; });
    }

    // Interference bleeds into the HUD (and the audio bus) with proximity.
    api.interference(clamp(1 - s.dist / 15, 0, 1) * (locked ? 1 : 0.55));

    this.hoverPhase += dt * 0.9;
    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(this.hoverPhase) * 0.12;
    this.group.rotation.y = this.heading;
  }

  showBeam(player, t) {
    const from = this.group.position.clone().setY(this.pos.y + 1.85);
    const to = player.pos.clone().setY(player.eyeY);
    const len = from.distanceTo(to);
    this.beam.visible = true;
    this.beam.material.opacity = 0.12 + t * 0.5;
    this.beam.scale.set(0.5 + t, len, 0.5 + t);
    // Point the cylinder (Y-aligned by default) down the beam, in local space.
    const localTo = this.group.worldToLocal(to.clone());
    const mid = localTo.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 1.85, 0).multiplyScalar(0.5));
    this.beam.position.copy(mid);
    this.beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      localTo.clone().sub(new THREE.Vector3(0, 1.85, 0)).normalize(),
    );
    this.beam.scale.y = len;
    this.light.intensity = 8 + t * 44;
  }

  hideBeam() {
    this.beam.visible = false;
    this.light.intensity = 1.5;
  }
}

// --------------------------------------------------------- director ----

/**
 * Owns the roster: spawns entities far from the player, keeps them apart at
 * the start, and gives each one the small API it is allowed to affect the
 * world through (kill / scare / mimic / beam / interference). Entities never
 * touch the game state directly.
 */
export class Director {
  constructor(level, collider, scene, rnd) {
    this.level = level;
    this.collider = collider;
    this.scene = scene;
    this.rnd = rnd;
    this.entities = [];
    this.paused = false;
  }

  /** A cell at least `minSteps` away from the player's spawn, by path. */
  spawnCell(minSteps) {
    const field = this.level.distanceField([this.level.spawn]);
    const options = [];
    for (let y = 0; y < this.level.h; y += 1) {
      for (let x = 0; x < this.level.w; x += 1) {
        if (field[this.level.cellIndex(x, y)] >= minSteps) options.push({ x, y });
      }
    }
    if (!options.length) return { x: this.level.exit.x, y: this.level.exit.y };
    return options[Math.floor(this.rnd() * options.length)];
  }

  add(entity, minSteps = 12) {
    const c = this.spawnCell(minSteps);
    entity.placeAtCell(c.x, c.y);
    this.entities.push(entity);
    this.scene.add(entity.group);
    return entity;
  }

  remove(kind) {
    this.entities = this.entities.filter((e) => {
      if (e.kind !== kind) return true;
      this.scene.remove(e.group);
      return false;
    });
  }

  has(kind) { return this.entities.some((e) => e.kind === kind); }

  get(kind) { return this.entities.find((e) => e.kind === kind); }

  update(dt, player, api) {
    for (const e of this.entities) {
      if (!this.paused && !e.frozen) e.update(dt, player, api);
      // Presentation runs regardless: a paused scene should still look right.
      e.present(player);
    }
  }

  /** Nearest entity distance — drives the heartbeat and the dread bed. */
  nearest(pos) {
    let best = Infinity;
    let which = null;
    for (const e of this.entities) {
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < best) {
        best = d;
        which = e;
      }
    }
    return { dist: best, entity: which };
  }

  dispose() {
    for (const e of this.entities) this.scene.remove(e.group);
    this.entities = [];
  }
}

/** Deterministic per-entity spice so two levels never feel identically staffed. */
export function entityJitter(seedNum, i) {
  return hash2(seedNum, i * 17, 4242);
}

export { CELL };
