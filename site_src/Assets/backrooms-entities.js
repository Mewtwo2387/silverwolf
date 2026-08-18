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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL, hash2 } from './backrooms-maze.js';

const TAU = Math.PI * 2;

/**
 * The player's ground speeds, in m/s. They live in this module rather than in
 * the game shell because every speed below is chosen relative to them, and a
 * balance number you have to read two files to check is a balance number that
 * drifts. backrooms.src.js imports these into its CFG; nothing else defines
 * them.
 */
export const PLAYER_SPEEDS = { WALK: 2.95, SPRINT: 5.6, CROUCH: 1.35 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (ax, az, bx, bz) => ((ax - bx) ** 2) + ((az - bz) ** 2);

// ------------------------------------------------- wire & vessel bodies ----
// The Lifeform and Entity 96 are built from thin curved limbs rather than from
// boxes and spheres, so they share three builders. Each returns ONE merged
// geometry: a leg assembled from forty loose meshes is forty draw calls, and
// nothing in either body needs to move independently below the limb level.

/**
 * A limb: short tapered cylinders chained along `curve`, with a sphere at each
 * joint. The spheres are not decoration — consecutive cylinders crack open on
 * a tight bend and the sphere fills the gap. `joint` scales them: at 1.02 they
 * vanish into the taper and the limb reads as one smooth vessel, and much above
 * that it starts to read as a beaded insect leg instead.
 */
function segmentedLimb(curve, r0, r1, segs, joint = 1.03) {
  const pts = curve.getSpacedPoints(segs);
  const up = new THREE.Vector3(0, 1, 0);
  const geos = [];
  for (let i = 0; i < segs; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const ra = r0 + (r1 - r0) * (i / segs);
    const rb = r0 + (r1 - r0) * ((i + 1) / segs);
    const h = a.distanceTo(b);
    if (h < 1e-5) continue;
    // Cylinders are built along +Y, so the top cap is the `b` end.
    const g = new THREE.CylinderGeometry(rb, ra, h, 6);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    g.applyMatrix4(new THREE.Matrix4().compose(
      a.clone().lerp(b, 0.5),
      new THREE.Quaternion().setFromUnitVectors(up, dir),
      new THREE.Vector3(1, 1, 1),
    ));
    geos.push(g);
    if (i > 0) {
      const s = new THREE.SphereGeometry(ra * joint, 8, 6);
      s.translate(a.x, a.y, a.z);
      geos.push(s);
    }
  }
  return mergeGeometries(geos, false);
}

/**
 * A spring: `turns` of wire wound around `curve`. Sampled against the curve's
 * own Frenet frames so the winding follows a bend instead of shearing through
 * it, and fattened toward the middle of the run so it reads as sprung rather
 * than printed on.
 */
function coilAround(curve, turns, coilR, wireR, samples) {
  const frames = curve.computeFrenetFrames(samples, false);
  const pts = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const j = Math.min(i, samples - 1);
    const r = coilR * (0.4 + 0.6 * Math.sin(Math.PI * t));
    const a = t * turns * TAU;
    pts.push(curve.getPointAt(t)
      .addScaledVector(frames.normals[j], Math.cos(a) * r)
      .addScaledVector(frames.binormals[j], Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), samples, wireR, 5, false);
}

/**
 * A loose tangle of wire loops, for a head that reads as scribbled rather than
 * modelled. Takes the entity's seeded rnd, so a given level always grows the
 * same tangle.
 */
function tangleBall(radius, loops, wireR, rnd) {
  const geos = [];
  for (let i = 0; i < loops; i += 1) {
    const g = new THREE.TorusGeometry(radius * (0.58 + rnd() * 0.45), wireR, 5, 20);
    g.rotateX(rnd() * TAU);
    g.rotateY(rnd() * TAU);
    g.rotateZ(rnd() * TAU);
    g.translate(
      (rnd() - 0.5) * radius * 0.55,
      (rnd() - 0.5) * radius * 0.55,
      (rnd() - 0.5) * radius * 0.55,
    );
    geos.push(g);
  }
  return mergeGeometries(geos, false);
}

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
    this.reach = null; // cached BFS field FROM this entity, for reachability
    this.reachKey = '';

    this.stuckTimer = 0;
    this.smoothOff = 0; // seconds left with corner-cutting disabled
    this.lastPos = new THREE.Vector3();
    this.group = new THREE.Group();
    this.alive = true;
    this.frozen = false; // debug harness / entity-specific holds
    // Whether this entity's materials own their textures. True for everything
    // that generates its own (Entity 96's iris is drawn for that one eye);
    // false for the chaser, whose skin belongs to the game shell and is shared
    // with the menu preview.
    this.ownsTextures = true;
  }

  /**
   * Release this entity's GPU resources. Geometry and materials are built per
   * instance and always go; textures go only when this entity owns them.
   * Entities are rebuilt on every new level, seed, size and quality change, so
   * without this each rebuild abandons the whole roster's geometry.
   */
  dispose() {
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (this.ownsTextures) m.map?.dispose();
        m.dispose();
      }
    });
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
   *
   * The smoothing is suppressed for a couple of seconds after a jam. Line of
   * sight is traced as a ray and the body is 0.42-0.55 m wide, so a diagonal
   * across a doorway can be perfectly *visible* and still not something this
   * thing fits through — and a lookahead that keeps choosing it will grind the
   * entity into the corner forever, re-planning the identical diagonal every
   * time the stuck-detector fires. Falling back to plain cell-centre stepping
   * always fits, because that is the graph the level was carved from.
   */
  waypointTo(tx, ty) {
    const here = this.cell();
    if (here.x === tx && here.y === ty) return this.level.centre(tx, ty);
    const field = this.fieldTo(tx, ty);
    const first = this.level.stepDownhill(here.x, here.y, field);
    if (!first) return null;
    const second = this.smoothOff <= 0
      ? this.level.stepDownhill(first.x, first.y, field) : null;
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
    this.smoothOff = Math.max(0, this.smoothOff - dt);
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
        // Re-planning alone is not enough — the new plan is the old plan. Take
        // the corner-cutting away too, or this repeats forever.
        this.smoothOff = 2.5;
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
      // Cached on the cell it was computed from: this is a whole-grid BFS (up
      // to 2304 cells at the largest level size) and sense() runs every frame
      // for every entity, so recomputing it per frame made hearing the most
      // expensive thing in the loop.
      const here = this.cell();
      const key = `${here.x},${here.y}`;
      if (this.reachKey !== key) {
        this.reach = this.level.distanceField([here]);
        this.reachKey = key;
      }
      if (this.reach[this.level.cellIndex(bx, by)] >= 0) this.belief = { x: bx, y: by };
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
 * Every number that decides whether the chaser is tense or simply unfair, in
 * one place. The rule they encode: a player who reacts gets away, a player who
 * dithers does not. Concretely, it must never be able to close a gap faster
 * than you can open one — the player sprints at 5.6 m/s (CFG.SPRINT) with
 * about six seconds of stamina, so nothing here exceeds that, and the chase
 * *winds up* rather than starting at full pelt. What costs you is the corner
 * you fumble, not the straight you run.
 */
export const CHASER = {
  SIGHT: 26,
  FOV: Math.PI, // 180 degrees — directly behind it is genuinely behind it
  HEARING: 20,
  FORGET: 0.16,
  PATROL_SPEED: 2.4,
  STALK_NEAR: 2.6,
  STALK_FAR: 3.6,
  // Chase: opens below a walk-into-sprint and winds up to just under one, so
  // the first seconds of a run always buy ground.
  CHASE_SPEED_MIN: 3.9,
  CHASE_SPEED_MAX: 5.15,
  CHASE_WINDUP: 3.5, // seconds from MIN to MAX
  CHASE_TRIGGER: 11, // must SEE you within this many metres to commit
  CHASE_GIVEUP: 14, // seconds chasing without a fresh sighting before it drops
  // Jumpscare: a run down a corridor, not a teleport into your face. Placed
  // 4-7 cells out (17-29 m of path) and covering it at 8 m/s takes 2-4 s —
  // long enough to hear it coming, turn round, and watch it arrive.
  JUMP_SPEED: 8,
  JUMP_MIN_CELLS: 4,
  JUMP_MAX_CELLS: 7,
  JUMP_TIMEOUT: 8.5, // abort the beat if the route was longer than expected
  JUMP_FIRST: [55, 45], // first one no sooner than 55 s, plus up to 45 s
  JUMP_AGAIN: [70, 60],
  // A settling-in period after a start or restart. Spawning into a level and
  // immediately being run down teaches you nothing about the level.
  GRACE: 25,
  CONTACT: 0.85,
};

/**
 * The nextbot. A camera-facing billboard that slides along the floor — the
 * Garry's Mod lineage the Backrooms videos borrowed, where the horror is a flat
 * image moving with intent.
 *
 * Four behaviours, selectable in the menu or mixed by `auto`:
 *   patrol    — lost you: sweeps the area around where you were last known
 *   stalk     — keeps its distance and freezes whenever you look at it
 *   chase     — commits once it can SEE you inside CHASE_TRIGGER, then winds
 *                 up from a jog to just under a sprint; gives up if it spends
 *                 CHASE_GIVEUP seconds without laying eyes on you again
 *   jumpscare — repositions out of sight, runs the corridor into your face,
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
    this.ownsTextures = false; // the skin belongs to whoever passed it in

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
    this.jumpCooldown = CHASER.JUMP_FIRST[0] + rnd() * CHASER.JUMP_FIRST[1];
    this.jumpTarget = null;
    this.observed = false;
    this.onScare = null; // set by the director
    this.contact = CHASER.CONTACT;
    // Counts down from the moment it is spawned; while it runs the chaser is
    // allowed to look for you and loom, but not to commit.
    this.grace = CHASER.GRACE;
    this.chaseSeen = 0; // stateTime of the last sighting during a chase
  }

  /** Entering a chase restarts both the wind-up and the give-up clock. */
  setState(state) {
    if (this.state !== state && state === 'chase') this.chaseSeen = 0;
    super.setState(state);
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
    this.grace = Math.max(0, this.grace - dt);
    const cfg = {
      sight: CHASER.SIGHT, fov: CHASER.FOV, hearing: CHASER.HEARING, forget: CHASER.FORGET,
    };
    const s = this.sense(player, dt, cfg, this.rnd);
    this.observed = this.isObserved(player);

    if (this.mode !== 'auto' && this.mode !== 'jumpscare') this.setState(this.mode);
    else if (this.mode === 'jumpscare' && this.state !== 'jumpscare') this.beginJumpscare(player);

    if (this.mode === 'auto') {
      this.jumpCooldown -= dt;
      if (this.state !== 'jumpscare') {
        // Everything below the grace line is atmosphere; everything above it
        // can end the run, so the grace timer gates exactly those two.
        if (this.grace <= 0 && this.jumpCooldown <= 0 && this.confidence > 0.3) {
          this.beginJumpscare(player);
        } else if (this.grace <= 0 && s.seen && s.dist < CHASER.CHASE_TRIGGER) {
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
    this.steer(wp, dt, CHASER.PATROL_SPEED);
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
    this.steer(wp, dt, d > 18 ? CHASER.STALK_FAR : CHASER.STALK_NEAR);
    this.checkStuck(dt, true, null);
    if (this.grace <= 0 && s.seen && s.dist < 9) this.setState('chase');
  }

  doChase(dt, s) {
    const wp = this.waypointTo(this.belief.x, this.belief.y);
    // Wind-up: it starts the run slower than you sprint and only reaches its
    // top speed after CHASE_WINDUP seconds, which is the whole margin the
    // player gets. Break line of sight inside that window and the give-up
    // clock is already running. It never gets tired — but it does lose you.
    const t = clamp(this.stateTime / CHASER.CHASE_WINDUP, 0, 1);
    const speed = CHASER.CHASE_SPEED_MIN + (CHASER.CHASE_SPEED_MAX - CHASER.CHASE_SPEED_MIN) * t;
    this.steer(wp, dt, speed);
    this.checkStuck(dt, true, null);
    if (s.seen) this.chaseSeen = this.stateTime;
    if (this.mode !== 'auto') return;
    if (this.confidence < 0.2 && !s.seen) this.setState('patrol');
    // Hard ceiling on a single commitment: something that has been running at
    // you for fourteen seconds on stale information is a bug, not a threat.
    else if (this.stateTime - (this.chaseSeen ?? 0) > CHASER.CHASE_GIVEUP) this.setState('stalk');
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
        if (d < CHASER.JUMP_MIN_CELLS || d > CHASER.JUMP_MAX_CELLS) continue;
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
    this.steer(wp, dt, CHASER.JUMP_SPEED);
    this.checkStuck(dt, true, null);

    const d = Math.hypot(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
    if (d < 1.6 || this.stateTime > CHASER.JUMP_TIMEOUT) {
      if (d < 2.6) api.scare(this.pos.clone());
      // Gone. It reappears somewhere else, patrolling, on a long cooldown.
      const far = this.wanderTarget(pc.x, pc.y, 12, this.rnd);
      this.placeAtCell(far.x, far.y);
      this.jumpCooldown = CHASER.JUMP_AGAIN[0] + this.rnd() * CHASER.JUMP_AGAIN[1];
      this.confidence = 0.2;
      this.setState(this.mode === 'jumpscare' ? 'patrol' : 'patrol');
    }
  }
}

// --------------------------------------------------------- Lifeform ----

/**
 * The Lifeform ("bacteria"): a tall black stick-figure of tangled wire. There
 * is no solid body on it anywhere — every limb is a thin core with coil sprung
 * along it, and the head is a scribble of loops rather than a face. Articulated
 * rather than a sprite, so it moves as one bent thing.
 *
 * Behaviour follows the source: an aimless hive-hunter, nearly blind, that
 * hunts by sound and mimics a human cry for help through a repurposed throat —
 * so it is slow enough to walk away from, and the voice you hear is bait, not a
 * position you can trust.
 */
export const LIFEFORM = {
  SIGHT: 9, // near-blind
  FOV: Math.PI * 2, // no facing to speak of — it "sees" all round, barely
  HEARING: 34,
  FORGET: 0.05, // a long memory: it does not lose interest, it loses the trail
  HUNT_SPEED: 2.9,
  DRIFT_SPEED: 1.5,
  CONTACT: 1.15,
  CALL_EVERY: [9, 16], // seconds between mimic calls: base, plus up to
};

export class Lifeform extends Agent {
  constructor(level, collider, rnd) {
    // Radius covers the ARM span (~1.7 m tip to tip), not the body. Collide on
    // the spine alone and it stands with both hands inside the wallpaper.
    super(level, collider, { radius: 0.8, speed: LIFEFORM.HUNT_SPEED });
    this.rnd = rnd;
    this.kind = 'lifeform';
    this.name = 'Lifeform';
    this.callTimer = 4 + rnd() * 8;
    this.wander = null;
    this.phase = rnd() * TAU;
    this.contact = LIFEFORM.CONTACT;
    this.buildModel();
  }

  /**
   * The source puts this thing at about eleven feet. Level 0's ceiling is
   * WALL_H = 3.15 m, so it cannot stand up in here — and rather than shrink it
   * or let it clip through the tiles, it STOOPS: hips at 1.92 m, spine raked
   * forward, head hanging below shoulder height and thrust ahead of the body.
   *
   * The rake is not a taste decision, it is the constraint: at RAKE the crown
   * of the head sits at about 2.97 m, and the sway in animate() and the walk
   * bob together can add ~0.11 m, so at its worst moment in the cycle it passes
   * under the ceiling tiles with about 7 cm to spare and no more. Straighten it
   * and the head goes through the ceiling. It stands about 2.97 m folded, which
   * is a good deal worse to meet than a neat 2 m biped.
   */
  buildModel() {
    // Not a solid body anywhere. Everything is thin black wire, and most of the
    // bulk you read is coil sprung around that wire — a thing assembled out of
    // springs and armature rather than sculpted.
    const skin = new THREE.MeshStandardMaterial({
      color: 0x08080b, roughness: 0.5, metalness: 0.08,
    });
    const g = this.group;
    const HIP = 1.92;
    // See the class comment: this angle is what keeps its head under the tiles.
    const RAKE = 0.76;
    const rnd = this.rnd;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const wire = (geo) => new THREE.Mesh(geo, skin);

    // Legs: hip to floor, spindly, with a knee that bends backward and a coil
    // sprung down each section.
    this.legs = [];
    for (let i = 0; i < 2; i += 1) {
      const side = i ? 1 : -1;
      const leg = new THREE.Group();

      const thigh = new THREE.CatmullRomCurve3([
        v(0, 0, 0), v(side * 0.02, -0.36, 0.05), v(0, -0.72, 0.03), v(0, -1.02, 0),
      ]);
      leg.add(wire(segmentedLimb(thigh, 0.032, 0.024, 12)));
      leg.add(wire(coilAround(thigh, 6.5, 0.058, 0.016, 96)));

      const lower = new THREE.Group();
      lower.position.y = -1.02;
      const shin = new THREE.CatmullRomCurve3([
        v(0, 0, 0), v(0, -0.3, -0.05), v(0, -0.58, -0.03), v(0, -0.82, 0.02),
      ]);
      lower.add(wire(segmentedLimb(shin, 0.024, 0.014, 12)));
      lower.add(wire(coilAround(shin, 5.5, 0.045, 0.014, 84)));
      // Feet are three splayed spikes and no sole. It does not stand on the
      // carpet so much as rest against it.
      for (let t = 0; t < 3; t += 1) {
        const a = (t - 1) * 0.5;
        lower.add(wire(segmentedLimb(new THREE.CatmullRomCurve3([
          v(0, -0.82, 0.02),
          v(Math.sin(a) * 0.11, -0.85, 0.02 + Math.cos(a) * 0.13),
          v(Math.sin(a) * 0.19, -0.88, 0.02 + Math.cos(a) * 0.25),
        ]), 0.016, 0.005, 5)));
      }
      leg.add(lower);
      leg.position.set(side * 0.17, HIP, 0);
      leg.userData.lower = lower;
      g.add(leg);
      this.legs.push(leg);
    }

    // Spine: a single group raked forward, so the whole upper body reads as one
    // bent thing and the sway animation can rotate it from the hips.
    this.spine = new THREE.Group();
    this.spine.position.y = HIP;
    this.spine.rotation.x = RAKE; // folded into the corridor, not leaning
    g.add(this.spine);

    // There is no torso volume — the ribcage IS the winding around the spine.
    const torso = new THREE.CatmullRomCurve3([
      v(0, 0, 0), v(0, 0.34, 0.02), v(0, 0.7, 0), v(0, 1.02, -0.02), v(0, 1.24, 0.08),
    ]);
    this.spine.add(wire(segmentedLimb(torso, 0.055, 0.03, 14)));
    this.spine.add(wire(coilAround(torso, 6, 0.155, 0.019, 130)));

    // A head of scribbled loops. Nothing to read on it, which is the point —
    // there is not even a surface to look for a face on.
    this.head = new THREE.Group();
    this.head.add(wire(tangleBall(0.155, 8, 0.015, rnd)));
    this.head.position.set(0, 1.3, 0.2);
    this.spine.add(this.head);

    // Arms: a hand-built spline per arm, coiled, hung from the shoulders and
    // counter-rotated out of the stoop so they hang toward the floor instead of
    // trailing down the rake. They reach past the knees, fingers near the
    // carpet. animate() swings them around armHang, not around zero.
    this.armHang = -RAKE * 0.62;
    this.arms = [];
    for (let i = 0; i < 2; i += 1) {
      const side = i ? 1 : -1;
      const arm = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        v(0, 0, 0),
        v(side * 0.42, -0.52, 0.08),
        v(side * 0.6, -1.12, -0.06),
        v(side * 0.55, -1.66, 0.12),
        v(side * 0.46, -2.06, 0.06),
      ]);
      arm.add(wire(segmentedLimb(curve, 0.028, 0.012, 18)));
      arm.add(wire(coilAround(curve, 10, 0.052, 0.014, 150)));
      for (let f = 0; f < 3; f += 1) {
        const a = (f - 1) * 0.45;
        arm.add(wire(segmentedLimb(new THREE.CatmullRomCurve3([
          v(side * 0.46, -2.06, 0.06),
          v(side * 0.46 + Math.sin(a) * 0.08, -2.2, 0.06 + Math.cos(a) * 0.09),
          v(side * 0.46 + Math.sin(a) * 0.13, -2.34, 0.06 + Math.cos(a) * 0.17),
        ]), 0.013, 0.004, 5)));
      }
      arm.position.set(side * 0.19, 1.0, 0);
      arm.rotation.x = this.armHang;
      this.spine.add(arm);
      this.arms.push(arm);
    }
    this.height = 2.97;
    this.rake = RAKE;
  }

  update(dt, player, api) {
    this.stateTime += dt;
    // Near-blind, superb hearing, and a long memory — it does not lose interest.
    const cfg = {
      sight: LIFEFORM.SIGHT, fov: LIFEFORM.FOV, hearing: LIFEFORM.HEARING, forget: LIFEFORM.FORGET,
    };
    const s = this.sense(player, dt, cfg, this.rnd);

    if (this.confidence > 0.3) this.setState('hunt');
    else this.setState('drift');

    let wantsMove = true;
    if (this.state === 'hunt') {
      const wp = this.waypointTo(this.belief.x, this.belief.y);
      this.steer(wp, dt, LIFEFORM.HUNT_SPEED);
    } else {
      if (!this.wander || this.stateTime > 12
        || dist2(this.pos.x, this.pos.z, this.wanderWorld.x, this.wanderWorld.z) < 1.5) {
        this.wander = this.wanderTarget(this.cell().x, this.cell().y, 9, this.rnd);
        this.wanderWorld = this.level.centre(this.wander.x, this.wander.y);
        this.stateTime = 0;
      }
      const wp = this.waypointTo(this.wander.x, this.wander.y);
      this.steer(wp, dt, LIFEFORM.DRIFT_SPEED);
      wantsMove = true;
    }
    this.checkStuck(dt, wantsMove, () => { this.wander = null; });

    // The lure. Calls out from where it is — which is exactly why following the
    // voice is a mistake.
    this.callTimer -= dt;
    if (this.callTimer <= 0) {
      this.callTimer = LIFEFORM.CALL_EVERY[0] + this.rnd() * LIFEFORM.CALL_EVERY[1];
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
    this.arms[0].rotation.x = this.armHang - swing * 0.55;
    this.arms[1].rotation.x = this.armHang + swing * 0.55;
    this.arms[0].rotation.z = Math.sin(this.phase * 0.6) * 0.09;
    this.arms[1].rotation.z = -Math.sin(this.phase * 0.6 + 1) * 0.09;
    // A slow, wrong sway through the whole body. The spine rocks around its
    // stoop rather than straightening — it never gets to stand up in here.
    this.group.position.y = Math.sin(this.phase * 2) * 0.045;
    this.spine.rotation.x = this.rake + Math.sin(this.phase * 0.47) * 0.07;
    this.spine.rotation.z = Math.sin(this.phase * 0.29) * 0.06;
    this.head.rotation.y = Math.sin(this.phase * 0.31) * 0.5;
  }
}

// -------------------------------------------------------- Entity 96 ----

/**
 * Entity 96, "The Neighborhood Watch": an eye that walks. It sees well, hears
 * nothing, and does not chase. Catch its gaze and it charges a beam of light;
 * hold still in that light and you are dust. Break line of sight and it loses
 * the lock entirely — the counter-play is a corner, not a sprint.
 *
 * The body is the eyeball; it gets about on six legs of raw vasculature that
 * arch above it and reach down to the carpet, and it moves them in alternating
 * tripods like something that has done this before.
 *
 * It also corrupts electronics nearby, which the HUD wears as static.
 */
export const WATCHER = {
  SIGHT: 24,
  FOV: Math.PI * 0.95, // it has to be facing you
  HEARING: 0, // exactly zero, per the source
  FORGET: 0.3,
  DRIFT_SPEED: 1.35,
  CHARGE_TIME: 2.1, // seconds in the beam before it disintegrates you
  LOCK_COOLDOWN: 2.6, // it will not re-acquire immediately after losing you
  INTERFERENCE_RANGE: 15,
};

export class Entity96 extends Agent {
  constructor(level, collider, rnd, texture) {
    // The radius is the leg span, not the eyeball: it stands on a ~2 m footprint
    // and anything smaller parks its feet inside the wallpaper.
    super(level, collider, { radius: 0.8, speed: WATCHER.DRIFT_SPEED });
    this.rnd = rnd;
    this.kind = 'watcher';
    this.name = 'Entity 96';
    this.charge = 0;
    this.chargeTime = WATCHER.CHARGE_TIME;
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

    // Cornea: a spherical CAP sitting just proud of the sclera and facing the
    // entity's forward (+Z), carrying the iris texture.
    //
    // Two things it must not be. Not a flat disc set at the rim's depth — flat,
    // the centre of the disc sits ~9 cm inside an opaque sclera and all you
    // ever see of the eye is the blank outer ring of the texture poking
    // through. And not a cap with its own UVs — a sphere's UVs are
    // equirectangular, which pinches a square texture at the pole and turns a
    // round pupil into a slit. So: sphere geometry for the shape, and the UVs
    // rewritten as a planar projection of x/y, which is what keeps the pupil
    // a round dot from every angle that matters.
    const CORNEA_R = 0.31;
    const CORNEA_D = R + 0.004; // just proud of the sclera, never inside it
    const corneaGeo = new THREE.SphereGeometry(
      CORNEA_D, 40, 20, 0, TAU, 0, Math.asin(CORNEA_R / CORNEA_D),
    );
    corneaGeo.rotateX(Math.PI / 2); // the cap opens along +Y; point it at +Z
    {
      const pos = corneaGeo.attributes.position;
      const uv = corneaGeo.attributes.uv;
      for (let i = 0; i < pos.count; i += 1) {
        uv.setXY(
          i,
          0.5 + pos.getX(i) / (CORNEA_R * 2),
          0.5 + pos.getY(i) / (CORNEA_R * 2),
        );
      }
      uv.needsUpdate = true;
    }
    this.iris = new THREE.Mesh(
      corneaGeo,
      new THREE.MeshStandardMaterial({
        map: irisTex, roughness: 0.12, metalness: 0, emissive: 0x0a0600, emissiveIntensity: 0.4,
      }),
    );
    this.iris.position.set(0, EYE_Y, 0);
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

    this.buildLegs(EYE_Y);
    this.height = 2.45;
  }

  /**
   * Six legs of vein. Dark and thick where they leave the body, pale and fine
   * at the tip, lumpy at every joint — segmentedLimb's joint spheres are doing
   * that, and it is why the legs read as vasculature rather than as pipes.
   *
   * Each leg hangs off its own pivot group placed at the attachment point, with
   * the geometry built relative to that point, so a single rotation about the
   * pivot swings the whole leg and lifts the foot. The first leg is offset half
   * a step around so that none of the six sits directly in front of the pupil.
   */
  buildLegs(EYE_Y) {
    const vein = new THREE.MeshStandardMaterial({
      color: 0x7d2a26, roughness: 0.62, metalness: 0.02,
      emissive: 0x1c0605, emissiveIntensity: 0.35,
    });
    this.legs = [];
    for (let i = 0; i < 6; i += 1) {
      const ang = (Math.PI / 6) + ((i * TAU) / 6);
      const dx = Math.sin(ang);
      const dz = Math.cos(ang);
      const at = (r, y) => new THREE.Vector3(dx * r, y, dz * r);
      // Out of the eye's upper flank, over the top of it, then down and out to
      // the carpet — a spider's stance, wider than the body it carries.
      // A little seeded slop per leg, so six of them do not read as one leg
      // instanced six times.
      const j = (k) => 1 + (this.rnd() - 0.5) * k;
      const root = at(0.4, EYE_Y + 0.3);
      const path = [
        root,
        at(0.66 * j(0.12), (EYE_Y + 0.48) * j(0.05)),
        at(0.92 * j(0.14), (EYE_Y - 0.18) * j(0.16)),
        at(1.0 * j(0.1), 0.32 * j(0.2)),
        at(1.02 * j(0.08), 0.02),
      ].map((q) => q.clone().sub(root));
      const leg = new THREE.Group();
      leg.position.copy(root);
      leg.add(new THREE.Mesh(
        segmentedLimb(new THREE.CatmullRomCurve3(path), 0.062, 0.01, 22),
        vein,
      ));
      // Lifting a foot means turning the leg about the horizontal axis at right
      // angles to its own outward direction.
      leg.userData.axis = new THREE.Vector3(dz, 0, -dx).normalize();
      leg.userData.phase = (i % 2) * Math.PI; // alternating tripod
      this.group.add(leg);
      this.legs.push(leg);
    }
    this.gaitPhase = this.rnd() * TAU;
  }

  /**
   * Skitter. The two tripods take turns off the floor, faster as it drifts.
   *
   * The swing is lift-ONLY — clamped at zero rather than sinusoidal about it.
   * The neutral pose already has every foot resting on the carpet, so a
   * symmetric swing spends half of each cycle driving three legs through the
   * floor.
   */
  animate(dt) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.gaitPhase += dt * (1.2 + speed * 3.4);
    const amp = 0.05 + Math.min(0.11, speed * 0.09);
    for (const leg of this.legs) {
      leg.setRotationFromAxisAngle(
        leg.userData.axis,
        -amp * Math.max(0, Math.sin(this.gaitPhase + leg.userData.phase)),
      );
    }
  }

  update(dt, player, api) {
    this.stateTime += dt;
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);
    // Keen sight and touch, no hearing and no smell — hearing is exactly zero.
    const cfg = {
      sight: WATCHER.SIGHT, fov: WATCHER.FOV, hearing: WATCHER.HEARING, forget: WATCHER.FORGET,
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
        this.lockCooldown = WATCHER.LOCK_COOLDOWN;
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
      this.steer(wp, dt, WATCHER.DRIFT_SPEED);
      this.checkStuck(dt, true, () => { this.wander = null; });
    }

    // Interference bleeds into the HUD (and the audio bus) with proximity.
    api.interference(clamp(1 - s.dist / WATCHER.INTERFERENCE_RANGE, 0, 1) * (locked ? 1 : 0.55));

    this.animate(dt);
    this.hoverPhase += dt * 0.9;
    this.group.position.copy(this.pos);
    // A shallow bob now that it has legs under it — the old float was the whole
    // suspension, and at that amplitude the feet sink through the carpet.
    this.group.position.y += Math.sin(this.hoverPhase) * 0.05;
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
      e.dispose();
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
    for (const e of this.entities) {
      this.scene.remove(e.group);
      e.dispose();
    }
    this.entities = [];
  }
}

/**
 * The roster, described for humans: what each thing is, where it came from,
 * and how you survive it. The numbers are read straight out of the tuning
 * blocks above rather than retyped, so the entity viewer can never quote a
 * speed the game does not actually use.
 */
export const ENTITY_INFO = {
  chaser: {
    label: 'PNG chaser',
    kind: 'chaser',
    tagline: 'A flat image that wants to be in the same place as you.',
    origin: "Garry's Mod nextbots",
    href: 'https://wiki.facepunch.com/gmod/NEXTBOT',
    blurb: 'A camera-facing billboard sliding along the carpet — the lineage the Backrooms '
      + 'videos borrowed, where the horror is a picture moving with intent. It is a real '
      + 'pathfinder, not a scripted patrol: it routes through the same open-cell graph you '
      + 'walk, and it cannot pass a wall you cannot.',
    senses: 'Wide cone of sight, decent hearing, short memory.',
    counterplay: 'Break line of sight and keep breaking it. Its chase starts slower than your '
      + `sprint (${CHASER.CHASE_SPEED_MIN} m/s) and takes ${CHASER.CHASE_WINDUP} s to wind up to `
      + `${CHASER.CHASE_SPEED_MAX} — a straight run always buys ground, a fumbled corner gives `
      + 'it back. While you are looking straight at it, it will not move.',
    stats: [
      { k: 'Sight', v: `${CHASER.SIGHT} m`, bar: CHASER.SIGHT / 36 },
      { k: 'Hearing', v: `${CHASER.HEARING} m`, bar: CHASER.HEARING / 36 },
      { k: 'Field of view', v: `${Math.round((CHASER.FOV * 180) / Math.PI)}°`, bar: CHASER.FOV / TAU },
      { k: 'Patrol', v: `${CHASER.PATROL_SPEED} m/s`, bar: CHASER.PATROL_SPEED / 9 },
      { k: 'Chase', v: `${CHASER.CHASE_SPEED_MIN}–${CHASER.CHASE_SPEED_MAX} m/s`, bar: CHASER.CHASE_SPEED_MAX / 9 },
      { k: 'Jumpscare', v: `${CHASER.JUMP_SPEED} m/s`, bar: CHASER.JUMP_SPEED / 9 },
    ],
  },
  lifeform: {
    label: 'Lifeform',
    kind: 'lifeform',
    tagline: 'Eleven feet of tangled wire, folded to fit under the ceiling.',
    origin: 'Kane Pixels — The Lifeform',
    href: 'https://kane-pixels-backrooms.fandom.com/wiki/The_Lifeform',
    blurb: 'Thin black wire with coil sprung along every limb — no solid body anywhere, and a '
      + 'head that is a tangle of loops rather than a face. Level 0 has a 3.15 m ceiling and '
      + 'eleven feet of this does not fit, so it folds: hips high, spine raked hard forward, '
      + 'head hung below the shoulders and thrust out ahead of the body.',
    senses: 'Nearly blind. Superb hearing. It does not forget.',
    counterplay: 'It hunts sound, so crouch. It calls for help in a human voice from wherever it '
      + 'is standing — walking toward the voice walks you into it. At '
      + `${LIFEFORM.HUNT_SPEED} m/s it is slower than your sprint, and it never sees you coming.`,
    stats: [
      { k: 'Sight', v: `${LIFEFORM.SIGHT} m`, bar: LIFEFORM.SIGHT / 36 },
      { k: 'Hearing', v: `${LIFEFORM.HEARING} m`, bar: LIFEFORM.HEARING / 36 },
      { k: 'Field of view', v: 'all round', bar: 1 },
      { k: 'Drift', v: `${LIFEFORM.DRIFT_SPEED} m/s`, bar: LIFEFORM.DRIFT_SPEED / 9 },
      { k: 'Hunt', v: `${LIFEFORM.HUNT_SPEED} m/s`, bar: LIFEFORM.HUNT_SPEED / 9 },
      { k: 'Memory', v: 'very long', bar: 1 - LIFEFORM.FORGET * 3 },
    ],
  },
  watcher: {
    label: 'Entity 96',
    kind: 'watcher',
    tagline: 'The Neighborhood Watch. It does not chase. It looks.',
    origin: 'Backrooms Wiki — Entity 96',
    href: 'https://backrooms-wiki.wikidot.com/entity-96',
    blurb: 'An eye that walks: a sclera sphere with the iris on a bulged cornea under a wet '
      + 'membrane, carried on six legs of raw vasculature that arch above it and reach down to '
      + 'the carpet, worked in alternating tripods. Catch its gaze and the pupil charges a beam '
      + 'of light. It corrupts electronics near it — that is the static creeping across your '
      + 'screen.',
    senses: 'Keen sight, and no hearing whatsoever.',
    counterplay: `You get ${WATCHER.CHARGE_TIME} s in the beam before it disintegrates you, and `
      + 'breaking line of sight drops the lock entirely — the answer is a corner, not a sprint. '
      + `It waits ${WATCHER.LOCK_COOLDOWN} s before it will re-acquire. Noise is free here: it `
      + 'cannot hear you at all.',
    stats: [
      { k: 'Sight', v: `${WATCHER.SIGHT} m`, bar: WATCHER.SIGHT / 36 },
      { k: 'Hearing', v: 'none', bar: 0 },
      { k: 'Field of view', v: `${Math.round((WATCHER.FOV * 180) / Math.PI)}°`, bar: WATCHER.FOV / TAU },
      { k: 'Drift', v: `${WATCHER.DRIFT_SPEED} m/s`, bar: WATCHER.DRIFT_SPEED / 9 },
      { k: 'Beam charge', v: `${WATCHER.CHARGE_TIME} s`, bar: WATCHER.CHARGE_TIME / 9 },
      { k: 'Interference', v: `${WATCHER.INTERFERENCE_RANGE} m`, bar: WATCHER.INTERFERENCE_RANGE / 36 },
    ],
  },
};

/** Deterministic per-entity spice so two levels never feel identically staffed. */
export function entityJitter(seedNum, i) {
  return hash2(seedNum, i * 17, 4242);
}

export { CELL };
