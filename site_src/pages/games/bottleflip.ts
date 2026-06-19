import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';

// Bottle Flip — the classic 2016 challenge, rebuilt as a fully client-side
// canvas game. No login, no API: all physics + state live in the browser.
//
// What it models:
//  * A rigid-body 500ml bottle (body / shoulder / neck / cap) thrown with a
//    "grab a point, swing, release" lever mechanic.
//  * Smooth (non-particle) water inside: each frame the interior polygon is cut
//    by a horizontal world-space line so the surface always finds its level,
//    and the water mass lowers the bottle's centre of mass — which is exactly
//    why a partly-filled bottle self-rights and sticks the landing.
//  * Two modes: Free (no limit) and Timer (15/30/60/90s — most flips wins).
export function BottleFlipPage(opts: {
  nonce: string;
  lv999?: boolean;
  user?: import('../../components/navbar').NavUser | null;
}) {
  const { nonce, lv999, user } = opts;

  const extras = raw(`
<style>
  .bf-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .bf-stage {
    position: relative;
    width: 100%;
    max-width: 1040px;
    aspect-ratio: 1040 / 560;
    border: 1px solid color-mix(in oklab, var(--accent) 25%, var(--ink-600));
    border-radius: 0.75rem;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 18%, color-mix(in oklab, var(--accent) 9%, transparent), transparent 60%),
      linear-gradient(180deg, var(--ink-900), var(--ink-800));
    box-shadow: 0 10px 30px rgba(0,0,0,0.45), inset 0 0 30px rgba(0,0,0,0.4);
    touch-action: none;
  }
  .bf-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  .bf-stage canvas.grabbing { cursor: grabbing; }

  .bf-hud {
    position: absolute;
    top: 0; left: 0; right: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    pointer-events: none;
    font-family: 'JetBrains Mono', monospace;
  }
  .bf-stat {
    background: color-mix(in oklab, var(--ink-900) 70%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent);
    border-radius: 0.5rem;
    padding: 0.35rem 0.7rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    text-align: center;
    min-width: 70px;
  }
  .bf-stat .lbl { font-size: 0.6rem; letter-spacing: 0.08em; color: var(--fog-400); text-transform: uppercase; }
  .bf-stat .val { font-size: 1.35rem; font-weight: 800; color: var(--accent-light); line-height: 1.1; }
  .bf-stat.timer .val { color: var(--accent-pale); }

  .bf-flash {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(1.8rem, 7vw, 3.2rem);
    font-weight: 900;
    letter-spacing: 0.04em;
    opacity: 0;
    text-shadow: 0 0 18px currentColor;
  }
  .bf-flash.show { animation: bf-flash 1.1s ease-out forwards; }
  .bf-flash.win  { color: var(--accent); }
  .bf-flash.lose { color: var(--danger, #ff5d6c); }
  @keyframes bf-flash {
    0%   { opacity: 0; transform: scale(0.6); }
    20%  { opacity: 1; transform: scale(1.08); }
    70%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.02); }
  }

  .bf-hint {
    position: absolute;
    bottom: 0.6rem; left: 0; right: 0;
    text-align: center;
    pointer-events: none;
    color: var(--fog-400);
    font-size: 0.8rem;
    font-family: 'JetBrains Mono', monospace;
    transition: opacity 0.3s;
  }

  .bf-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem 2rem;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 1040px;
    padding: 1rem 1.25rem;
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--ink-800) 55%, transparent);
    font-family: 'JetBrains Mono', monospace;
  }
  .bf-field { display: flex; flex-direction: column; gap: 0.5rem; }
  .bf-field > .lbl {
    font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fog-300);
  }
  .bf-water-row { display: flex; align-items: center; gap: 0.75rem; }
  .bf-water-row input[type=range] { width: 180px; accent-color: var(--accent); }
  .bf-water-row .pct { min-width: 3ch; font-weight: 700; color: var(--accent-light); }

  .bf-segs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .bf-seg {
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--ink-600);
    border-radius: 0.45rem;
    background: transparent;
    color: var(--fog-200);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .bf-seg:hover { border-color: var(--accent); color: var(--accent-light); }
  .bf-seg.active {
    background: color-mix(in oklab, var(--accent) 18%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }
  .bf-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .bf-time-opts.hidden { display: none; }

  @media (max-width: 560px) {
    .bf-water-row input[type=range] { width: 130px; }
  }
</style>
<script nonce="${nonce}">
(() => {
  'use strict';
  const canvas = document.getElementById('bf-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1040, H = 560;
  canvas.width = W; canvas.height = H;

  const GROUND_Y = H - 56;          // table surface (world y)
  const G = 1500;                    // gravity px/s^2

  // ---- Bottle geometry (local space, origin ~ geometric centre, y down) ----
  // Right-hand profile, top(cap) -> bottom(base); left side is mirrored.
  // SCALE shrinks the whole bottle so it has plenty of room to swing/fly.
  const SCALE = 0.74;
  const CAP_TOP = -132, CAP_BOT = -112, NECK_BOT = -90, SHOULDER = -60, BODY_BOT = 104, BASE = 116;
  const half = (pts) => {
    // build closed outline: right profile down, then mirrored left profile up
    const right = pts;
    const left = pts.slice().reverse().map(p => ({ x: -p.x, y: p.y }));
    return right.concat(left).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }));
  };
  const OUTLINE = half([
    { x: 13, y: CAP_TOP }, { x: 13, y: CAP_BOT },
    { x: 10, y: CAP_BOT }, { x: 10, y: NECK_BOT },
    { x: 34, y: SHOULDER }, { x: 34, y: BODY_BOT },
    { x: 27, y: BASE }, { x: 0, y: BASE + 2 },
  ]);
  // Interior cavity that holds water (inset from the shell, opens at the neck).
  const INTERIOR = half([
    { x: 6, y: NECK_BOT + 4 },
    { x: 28, y: SHOULDER + 6 }, { x: 28, y: BODY_BOT - 2 },
    { x: 21, y: BASE - 4 }, { x: 0, y: BASE - 2 },
  ]);
  const CAP = half([
    { x: 13, y: CAP_TOP }, { x: 13, y: CAP_BOT }, { x: 0, y: CAP_BOT },
  ]);
  // lowest point of the shell in local space — used to rest the base on the floor
  const BOTTOM = Math.max(...OUTLINE.map(p => p.y));

  // ---- Polygon helpers ----
  function polyArea(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) {
      const q = p[(i + 1) % n];
      a += p[i].x * q.y - q.x * p[i].y;
    }
    return a / 2;
  }
  function polyCentroid(p) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = p.length; i < n; i++) {
      const q = p[(i + 1) % n];
      const cr = p[i].x * q.y - q.x * p[i].y;
      a += cr; cx += (p[i].x + q.x) * cr; cy += (p[i].y + q.y) * cr;
    }
    a /= 2;
    if (Math.abs(a) < 1e-6) return { x: 0, y: 0, area: 0 };
    return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
  }
  // Clip polygon to the half-plane y >= lineY (keep the part BELOW the surface,
  // since y grows downward). Sutherland-Hodgman against one edge.
  function clipBelow(poly, lineY) {
    const out = [];
    for (let i = 0, n = poly.length; i < n; i++) {
      const cur = poly[i], nxt = poly[(i + 1) % n];
      const curIn = cur.y >= lineY, nxtIn = nxt.y >= lineY;
      if (curIn) out.push(cur);
      if (curIn !== nxtIn) {
        const t = (lineY - cur.y) / (nxt.y - cur.y);
        out.push({ x: cur.x + (nxt.x - cur.x) * t, y: lineY });
      }
    }
    return out;
  }

  const INTERIOR_AREA = polyCentroid(INTERIOR).area;
  const SHELL_CENTROID = polyCentroid(OUTLINE);

  // ---- State ----
  const SHELL_MASS = 0.45;
  const FULL_WATER_MASS = 1.4;       // mass of water at 100% fill
  let waterFrac = 0.4;

  const state = {
    x: 180, y: GROUND_Y - BOTTOM,    // local-origin world position
    a: 0, vx: 0, vy: 0, w: 0,        // angle, lin/ang velocity
    mode: 'rest',                    // rest | held | flight | settled
    // --- flight tracking, set on release, used to validate a real flip ---
    launchA: 0,                      // angle at the moment of release
    airborne: false,                 // did every contact point clear the floor?
    maxClear: 0,                     // highest the base rose above the floor (px)
  };

  // A throw only counts as a flip if it genuinely left the ground, cleared a
  // minimum height, AND rotated — otherwise lifting-and-placing or a limp toss
  // would score for free.
  const MIN_CLEAR = 70;              // base must rise at least this far (px)
  const MIN_ROT = Math.PI * 0.9;     // and turn at least ~160°

  // Pointer / grab
  let grabLocal = null;              // grabbed point in local coords
  let pointer = { x: 0, y: 0 };

  // Per-attempt bookkeeping. In timer mode the headline is the score
  // (base land = 1pt, cap stand = 2pts); the streak is +1 either way.
  let flips = 0, lands = 0, caps = 0, score = 0, streak = 0, best = 0, attempts = 0;
  let settleTimer = 0;

  // Timer mode
  let timerMode = false, timeLimit = 30, timeLeft = 0, running = false;

  function rot(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }
  function toWorld(p) { const r = rot(p, state.a); return { x: r.x + state.x, y: r.y + state.y }; }

  function worldOutline() { return OUTLINE.map(toWorld); }
  function worldInterior() { return INTERIOR.map(toWorld); }

  // Water surface: find the horizontal world line so the interior area below it
  // equals the target volume; then return the clipped (smooth) water polygon.
  function waterBody() {
    const wi = worldInterior();
    const target = waterFrac * INTERIOR_AREA;
    if (target <= 0) return { poly: [], cx: state.x, cy: state.y, mass: 0 };
    let lo = Infinity, hi = -Infinity;
    for (const p of wi) { if (p.y < lo) lo = p.y; if (p.y > hi) hi = p.y; }
    // binary search the surface height
    let yLine = hi;
    for (let it = 0; it < 24; it++) {
      const mid = (lo + hi) / 2;
      const area = polyCentroid(clipBelow(wi, mid)).area;
      if (area > target) lo = mid; else hi = mid;   // higher line(=smaller y) -> more area
      yLine = mid;
    }
    const poly = clipBelow(wi, yLine);
    const c = polyCentroid(poly);
    return { poly, cx: c.x, cy: c.y, mass: waterFrac * FULL_WATER_MASS, surfaceY: yLine };
  }

  // Combined centre of mass (shell + water), world space.
  function centreOfMass(water) {
    const sc = toWorld(SHELL_CENTROID);
    const sm = SHELL_MASS, wm = water.mass;
    const m = sm + wm;
    return { x: (sc.x * sm + water.cx * wm) / m, y: (sc.y * sm + water.cy * wm) / m, m };
  }

  // ---- Physics step ----------------------------------------------------
  // One unified rigid-body integrator. Both "held" and "flight" use the same
  // dynamics; holding just adds a spring (a "mouse joint") that pulls the
  // grabbed point toward the pointer. Because the body keeps its own inertia,
  // it genuinely swings/lags behind your hand, and the release throw is just
  // whatever linear+angular momentum the swing built up — no faked launch.
  const MAX_V = 1700, MAX_W = 22;
  const RESTITUTION = 0.12;               // how much bounce survives a hit (0..1)
  const FRICTION = 0.55;

  // Apply a contact impulse at world point p with unit normal (nx,ny). Returns
  // the normal impulse magnitude (for the friction cap). Impulse-based contacts
  // CANNOT inject energy the way explicit penalty springs do, so the bounce is
  // controlled purely by RESTITUTION — this is what stops the trampolining.
  function applyImpulse(p, com, I, nx, ny, restitution, frictionCap) {
    const rx = p.x - com.x, ry = p.y - com.y;
    const vpx = state.vx - state.w * ry;
    const vpy = state.vy + state.w * rx;
    const vn = vpx * nx + vpy * ny;         // separating speed along normal
    if (vn >= 0) return 0;                   // already separating: no impulse
    const rn = rx * ny - ry * nx;            // cross(r, n)
    const denom = (1 / com.m) + (rn * rn) / I;
    const jn = -(1 + restitution) * vn / denom;
    state.vx += (jn * nx) / com.m;
    state.vy += (jn * ny) / com.m;
    state.w += (jn * rn) / I;
    if (frictionCap) {
      // tangent = normal rotated 90°
      const tx = -ny, ty = nx;
      const vpx2 = state.vx - state.w * ry;
      const vpy2 = state.vy + state.w * rx;
      const vt = vpx2 * tx + vpy2 * ty;
      const rt = rx * ty - ry * tx;
      const dt2 = (1 / com.m) + (rt * rt) / I;
      let jt = -vt / dt2;
      const lim = FRICTION * jn;
      if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim;
      state.vx += (jt * tx) / com.m;
      state.vy += (jt * ty) / com.m;
      state.w += (jt * rt) / I;
    }
    return jn;
  }

  function step(dt) {
    if (state.mode !== 'held' && state.mode !== 'flight') return;
    const grabbing = state.mode === 'held';

    const water = waterBody();
    const com = centreOfMass(water);
    const I = com.m * 1700;                 // rotational inertia (slab estimate)

    // --- forces: gravity + (optional) grab spring ("mouse joint") ---
    let Fx = 0, Fy = com.m * G, T = 0;
    if (grabbing && grabLocal) {
      const gw = toWorld(grabLocal);
      const rx = gw.x - com.x, ry = gw.y - com.y;
      const vgx = state.vx - state.w * ry;
      const vgy = state.vy + state.w * rx;
      const kG = 950, cG = 60;
      const fx = kG * (pointer.x - gw.x) - cG * vgx;
      const fy = kG * (pointer.y - gw.y) - cG * vgy;
      Fx += fx; Fy += fy;
      T += rx * fy - ry * fx;
    }
    state.vx += (Fx / com.m) * dt;
    state.vy += (Fy / com.m) * dt;
    state.w += (T / I) * dt;
    // light air drag
    state.vx *= (1 - 0.25 * dt);
    state.vy *= (1 - 0.12 * dt);
    state.w *= (1 - 0.3 * dt);

    // --- integrate position ---
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.a += state.w * dt;

    // --- resolve contacts as impulses + positional correction ---
    const outline = worldOutline();
    let penYmax = 0, penXmaxL = 0, penXmaxR = 0;
    for (const p of outline) {
      if (p.y > GROUND_Y) {
        applyImpulse(p, com, I, 0, -1, RESTITUTION, true);  // floor normal up
        if (p.y - GROUND_Y > penYmax) penYmax = p.y - GROUND_Y;
      }
      if (p.x < 6) {
        applyImpulse(p, com, I, 1, 0, RESTITUTION, false);  // left wall
        if (6 - p.x > penXmaxL) penXmaxL = 6 - p.x;
      } else if (p.x > W - 6) {
        applyImpulse(p, com, I, -1, 0, RESTITUTION, false); // right wall
        if (p.x - (W - 6) > penXmaxR) penXmaxR = p.x - (W - 6);
      }
    }
    // push the body out of penetration (no energy added — pure position fix)
    if (penYmax > 0) state.y -= penYmax;
    if (penXmaxL > 0) state.x += penXmaxL;
    if (penXmaxR > 0) state.x -= penXmaxR;

    // safety clamps so a frantic swing can never fling it into orbit
    if (state.vx > MAX_V) state.vx = MAX_V; else if (state.vx < -MAX_V) state.vx = -MAX_V;
    if (state.vy > MAX_V) state.vy = MAX_V; else if (state.vy < -MAX_V) state.vy = -MAX_V;
    if (state.w > MAX_W) state.w = MAX_W; else if (state.w < -MAX_W) state.w = -MAX_W;
  }

  function atRest() {
    return Math.abs(state.vx) < 6 && Math.abs(state.vy) < 6 && Math.abs(state.w) < 0.06;
  }
  // Classify how it came to rest: 'base' (upright, ~0°), 'cap' (balanced
  // upside-down on the lid, ~180°) — both are valid sticks — or null (on side).
  function landingResult() {
    let a = state.a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) < 0.22) return 'base';
    if (Math.abs(Math.abs(a) - Math.PI) < 0.18) return 'cap';  // cap stand: tighter, it's harder
    return null;
  }

  function evaluateLanding() {
    // Was this actually a flip? Must have left the floor, cleared MIN_CLEAR,
    // and rotated at least MIN_ROT. A nudge / lift-and-place fails all three
    // and is silently ignored — no attempt, no streak hit.
    const rotated = Math.abs(state.a - state.launchA);
    const realFlip = state.airborne && state.maxClear >= MIN_CLEAR && rotated >= MIN_ROT;
    if (!realFlip) {
      state.mode = 'settled';
      settleTimer = 0.35;
      return;
    }

    attempts++;
    flips++;
    const result = landingResult();
    if (result) {
      lands++; streak++; if (streak > best) best = streak;
      if (result === 'cap') { caps++; score += 2; flash('CAP STAND! +2', 'win'); } else { score += 1; flash('STICK!', 'win'); }
    } else {
      streak = 0;
      flash('MISS', 'lose');
    }
    syncHud();
    state.mode = 'settled';
    settleTimer = 0.7;
  }

  function resetBottle() {
    state.x = 180; state.y = GROUND_Y - BOTTOM;
    state.a = 0; state.vx = 0; state.vy = 0; state.w = 0;
    state.mode = 'rest';
  }

  // ---- Pointer handling ----
  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  function pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > pt.y) !== (b.y > pt.y)) &&
          (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }

  function onDown(e) {
    if (state.mode === 'flight' || state.mode === 'settled') return;
    if (timerMode && !running) return;
    const pt = pointerPos(e);
    const ol = worldOutline();
    // generous grab: inside the bottle, or close enough to its bounding area
    if (!pointInPoly(pt, ol)) {
      // allow grabbing if near the bottle (within ~40px of any vertex)
      let near = false;
      for (const v of ol) { if (Math.hypot(v.x - pt.x, v.y - pt.y) < 40) { near = true; break; } }
      if (!near) return;
    }
    e.preventDefault();
    // record grab point in local space
    const c = Math.cos(-state.a), s = Math.sin(-state.a);
    const dx = pt.x - state.x, dy = pt.y - state.y;
    grabLocal = { x: dx * c - dy * s, y: dx * s + dy * c };
    pointer = pt;
    state.mode = 'held';
    // don't zero velocity — let the grab spring take over smoothly
    canvas.classList.add('grabbing');
    hideHint();
  }
  function onMove(e) {
    if (state.mode !== 'held') return;
    e.preventDefault();
    pointer = pointerPos(e);
  }
  function onUp() {
    if (state.mode !== 'held') return;
    canvas.classList.remove('grabbing');
    grabLocal = null;
    // Don't count anything yet — whether this is a real flip is decided when it
    // lands (did it clear the floor + height + rotate?). Just arm the tracking.
    state.launchA = state.a;
    state.airborne = false;
    state.maxClear = 0;
    state.mode = 'flight';
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  // ---- Rendering ----
  function drawGround() {
    ctx.save();
    const grd = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    grd.addColorStop(0, 'rgba(34,211,255,0.18)');
    grd.addColorStop(1, 'rgba(34,211,255,0.02)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = 'rgba(124,220,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
    ctx.restore();
  }

  function pathPoly(poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
  }

  function drawWater(water, interiorWorld) {
    if (!water.poly.length) return;
    ctx.save();
    // clip to the interior so the (slightly wavy) water never spills past walls
    pathPoly(interiorWorld); ctx.clip();
    // wavy surface for a touch of life: draw water poly but replace the flat
    // top with a sine ripple in world space along the surface line
    ctx.beginPath();
    const p = water.poly;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (Math.abs(a.y - water.surfaceY) < 0.5 && Math.abs(b.y - water.surfaceY) < 0.5) {
        const seg = 10;
        for (let s = 1; s <= seg; s++) {
          const t = s / seg;
          const x = a.x + (b.x - a.x) * t;
          const wob = Math.sin(t * Math.PI * 3 + performance.now() / 300) * 1.6;
          ctx.lineTo(x, water.surfaceY + wob);
        }
      } else ctx.lineTo(b.x, b.y);
    }
    ctx.closePath();
    const grd = ctx.createLinearGradient(0, water.surfaceY, 0, water.surfaceY + 200);
    grd.addColorStop(0, 'rgba(120,225,255,0.85)');
    grd.addColorStop(1, 'rgba(40,150,210,0.92)');
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.restore();
  }

  function drawBottle() {
    const ol = worldOutline();
    const interior = worldInterior();
    const water = waterBody();
    const cap = CAP.map(toWorld);

    // shadow on the ground
    ctx.save();
    const com = centreOfMass(water);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(com.x, GROUND_Y + 4, 46, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // plastic body fill
    ctx.save();
    pathPoly(ol);
    const bg = ctx.createLinearGradient(state.x - 40, 0, state.x + 40, 0);
    bg.addColorStop(0, 'rgba(180,210,235,0.10)');
    bg.addColorStop(0.5, 'rgba(220,240,255,0.22)');
    bg.addColorStop(1, 'rgba(180,210,235,0.10)');
    ctx.fillStyle = bg;
    ctx.fill();

    // water (clipped to interior)
    drawWater(water, interior);

    // --- moulded detail: grip ridges + label band, clipped to the shell so
    //     nothing pokes past the silhouette. Local coords are pre-SCALE, so
    //     scale them here before transforming to world. ---
    const S = SCALE;
    const seg = (x1, y1, x2, y2) => {
      const a = toWorld({ x: x1 * S, y: y1 * S });
      const b = toWorld({ x: x2 * S, y: y2 * S });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    pathPoly(ol); ctx.clip();
    // frosted label band around the middle
    ctx.fillStyle = 'rgba(225,245,255,0.14)';
    const lab = [{ x: -34, y: -26 }, { x: 34, y: -26 }, { x: 34, y: 16 }, { x: -34, y: 16 }]
      .map((p) => toWorld({ x: p.x * S, y: p.y * S }));
    ctx.beginPath(); ctx.moveTo(lab[0].x, lab[0].y);
    for (let i = 1; i < lab.length; i++) ctx.lineTo(lab[i].x, lab[i].y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(205,238,255,0.5)'; ctx.lineWidth = 1.1;
    seg(-34, -26, 34, -26); seg(-34, 16, 34, 16);
    // lower grip ridges (a tight band of horizontal grooves)
    ctx.strokeStyle = 'rgba(120,165,200,0.5)'; ctx.lineWidth = 1.3;
    for (let y = 40; y <= 96; y += 8) seg(-33, y, 33, y);
    // shoulder grooves near the taper
    for (let y = -54; y <= -42; y += 6) seg(-29, y, 29, y);
    ctx.restore();

    // plastic outline + highlight
    pathPoly(ol);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(200,235,255,0.65)';
    ctx.stroke();
    // glossy vertical highlight down one side
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3;
    seg(-22, -56, -22, 100);
    ctx.restore();

    // cap (with knurled vertical ridges)
    ctx.save();
    pathPoly(cap);
    ctx.fillStyle = '#2bb6d6';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(220,245,255,0.7)';
    ctx.stroke();
    pathPoly(cap); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.1;
    for (let x = -11; x <= 11; x += 3.5) seg(x, CAP_TOP + 3, x, CAP_BOT - 1);
    ctx.restore();

    // grab marker while held
    if (state.mode === 'held' && grabLocal) {
      const g = toWorld(grabLocal);
      ctx.save();
      ctx.strokeStyle = 'rgba(167,139,250,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.x, g.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawBottle();
  }

  // ---- Loop ----
  let lastT = performance.now();
  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.05) dt = 0.05;

    // fixed sub-steps for stable stiff contacts
    const SUB = 10, sdt = dt / SUB;
    for (let i = 0; i < SUB; i++) step(sdt);

    if (state.mode === 'flight') {
      const outline = worldOutline();
      let lowest = -Infinity;
      for (const p of outline) if (p.y > lowest) lowest = p.y;
      const clearance = GROUND_Y - lowest;            // >0 means fully off the floor
      if (clearance > state.maxClear) state.maxClear = clearance;
      if (clearance > 6) state.airborne = true;
      if (lowest >= GROUND_Y - 0.5 && atRest()) evaluateLanding();
    } else if (state.mode === 'settled') {
      settleTimer -= dt;
      if (settleTimer <= 0) {
        if (timerMode && !running) { resetBottle(); }
        else resetBottle();
      }
    }

    if (timerMode && running) {
      timeLeft -= dt;
      if (timeLeft <= 0) endTimer();
      updateTimerHud();
    }

    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- HUD / controls wiring ----
  const elFlips = document.getElementById('bf-flips');
  const elFlipsLbl = document.getElementById('bf-flips-lbl');
  const elLands = document.getElementById('bf-lands');
  const elStreak = document.getElementById('bf-streak');
  const elBest = document.getElementById('bf-best');
  const elTimerStat = document.getElementById('bf-timer-stat');
  const elTimerVal = document.getElementById('bf-timer-val');
  const flashEl = document.getElementById('bf-flash');
  const hintEl = document.getElementById('bf-hint');

  function syncHud() {
    // First stat doubles as Score in timer mode, Flips (valid attempts) in free.
    elFlipsLbl.textContent = timerMode ? 'Score' : 'Flips';
    elFlips.textContent = timerMode ? score : flips;
    elLands.textContent = lands;
    elStreak.textContent = streak;
    elBest.textContent = best;
  }
  function updateTimerHud() {
    elTimerVal.textContent = Math.max(0, Math.ceil(timeLeft));
  }
  let flashClear = null;
  function flash(text, kind) {
    flashEl.textContent = text;
    flashEl.className = 'bf-flash show ' + kind;
    if (flashClear) clearTimeout(flashClear);
    flashClear = setTimeout(() => { flashEl.className = 'bf-flash ' + kind; }, 1100);
  }
  function hideHint() { if (hintEl) hintEl.style.opacity = '0'; }

  // water slider
  const slider = document.getElementById('bf-water');
  const pct = document.getElementById('bf-water-pct');
  slider.addEventListener('input', () => {
    waterFrac = (+slider.value) / 100;
    pct.textContent = slider.value + '%';
  });

  // mode toggle
  const modeBtns = document.querySelectorAll('[data-mode]');
  const timeOpts = document.getElementById('bf-time-opts');
  const startBtn = document.getElementById('bf-start');
  modeBtns.forEach(b => b.addEventListener('click', () => {
    modeBtns.forEach(x => x.classList.toggle('active', x === b));
    timerMode = b.dataset.mode === 'timer';
    timeOpts.classList.toggle('hidden', !timerMode);
    elTimerStat.style.display = timerMode ? '' : 'none';
    running = false;
    resetGame();
  }));

  const timeBtns = document.querySelectorAll('[data-time]');
  timeBtns.forEach(b => b.addEventListener('click', () => {
    timeBtns.forEach(x => x.classList.toggle('active', x === b));
    timeLimit = +b.dataset.time;
  }));

  function resetGame() {
    flips = 0; lands = 0; caps = 0; score = 0; streak = 0; attempts = 0;
    resetBottle();
    syncHud();
    if (timerMode) { timeLeft = timeLimit; updateTimerHud(); }
  }
  function startTimer() {
    resetGame();
    timeLeft = timeLimit;
    running = true;
    startBtn.textContent = 'Reset';
    flash('GO!', 'win');
    hideHint();
  }
  function endTimer() {
    running = false;
    timeLeft = 0;
    startBtn.textContent = 'Play again';
    flash(score + ' pts!', 'win');
  }
  startBtn.addEventListener('click', () => {
    if (running) { running = false; startBtn.textContent = 'Start'; resetGame(); }
    else startTimer();
  });

  // init
  elTimerStat.style.display = 'none';
  syncHud();
})();
</script>
  `);

  const body = html`
    <h1 class="text-center">Bottle Flip</h1>
    <p class="text-center text-fog-300">The classic 2016 challenge — grab the bottle, swing, and stick the landing.</p>
    <div class="bf-wrap">
      <div class="bf-stage">
        <canvas id="bf-canvas" aria-label="Bottle flip game"></canvas>
        <div class="bf-hud">
          <div class="bf-stat"><div class="lbl" id="bf-flips-lbl">Flips</div><div class="val" id="bf-flips">0</div></div>
          <div class="bf-stat timer" id="bf-timer-stat"><div class="lbl">Time</div><div class="val" id="bf-timer-val">30</div></div>
          <div style="display:flex; gap:0.6rem;">
            <div class="bf-stat"><div class="lbl">Lands</div><div class="val" id="bf-lands">0</div></div>
            <div class="bf-stat"><div class="lbl">Streak</div><div class="val" id="bf-streak">0</div></div>
            <div class="bf-stat"><div class="lbl">Best</div><div class="val" id="bf-best">0</div></div>
          </div>
        </div>
        <div class="bf-flash" id="bf-flash"></div>
        <div class="bf-hint" id="bf-hint">Click &amp; hold the bottle to grab a pivot — swing and release to flip</div>
      </div>

      <div class="bf-controls">
        <div class="bf-field">
          <span class="lbl">Water fill</span>
          <div class="bf-water-row">
            <input type="range" id="bf-water" min="0" max="100" value="40" step="1" aria-label="Water fill percentage" />
            <span class="pct" id="bf-water-pct">40%</span>
          </div>
        </div>
        <div class="bf-field">
          <span class="lbl">Mode</span>
          <div class="bf-segs">
            <button class="bf-seg active" type="button" data-mode="free">Free</button>
            <button class="bf-seg" type="button" data-mode="timer">Timer</button>
          </div>
        </div>
        <div class="bf-field bf-time-opts hidden" id="bf-time-opts">
          <span class="lbl">Seconds</span>
          <div class="bf-actions">
            <div class="bf-segs">
              <button class="bf-seg" type="button" data-time="15">15</button>
              <button class="bf-seg active" type="button" data-time="30">30</button>
              <button class="bf-seg" type="button" data-time="60">60</button>
              <button class="bf-seg" type="button" data-time="90">90</button>
            </div>
            <button class="btn-accent" type="button" id="bf-start">Start</button>
          </div>
        </div>
      </div>
      <p class="text-fog-400 text-sm">Tip: a bottle filled ~30–40% self-rights best. Landing balanced on the cap is worth <strong>2 points</strong> in Timer mode.</p>
    </div>
    ${extras}
  `;

  return Layout({
    title: 'Silverwolf — Bottle Flip',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
