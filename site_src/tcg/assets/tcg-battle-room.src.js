import { formatBattleSide, formatSkillCategory } from './tcg-labels.lib.js';

(() => {
  const dataEl = document.getElementById('tcg-battle-data');
  if (!dataEl) return;
  let raw;
  try { raw = JSON.parse(dataEl.textContent); } catch { return; }
  const CTX = {
    matchId: raw.matchId,
    csrf: raw.csrf,
    selfId: raw.selfDiscordId,
    initial: raw.snapshot,
  };

  const MAX_EQUIP = 3;
  const TURN_TIMER_MS = 90000; // mirrors server TCG_TURN_TIMER_MS (for the timer ring)
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewEl = document.getElementById('tcg-view');
if (!viewEl) return;

let state = CTX.initial;            // TcgRoomSnapshot | null
let ws = null;
let wsRetryDelayMs = 1500;
let wsClosedByServer = false;
let serverError = null;
let countdownTimer = null;
let armedSkill = null;              // { slot, index, targetKind }
let armedItem = null;               // hand slotId
const logLines = [];
let lastLogSig = '';
// Action animation hints derived from the most recent ingest.
let newLogThisIngest = false;       // a brand-new action arrived this state update
let pendingActorName = null;        // attacker name parsed from the action log

// Persistent battle board: card DOM is built once per battle and updated in place
// so HP bars animate and attack/damage effects can fire across state updates.
let boardEl = null;
let boardSig = '';
const boardCards = { p1: [], p2: [] };
const nodeByName = {};              // name -> card node (for attacker lookup)
const sideLabels = {};
const prevHp = {};
const prevKo = {};

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'style') e.setAttribute('style', attrs[k]);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
  }
  if (children != null) {
    const list = Array.isArray(children) ? children : [children];
    for (const c of list) { if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  }
  return e;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

function openWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = proto + '//' + location.host + '/games/tcg/ws/' + encodeURIComponent(CTX.matchId);
  let socket;
  try { socket = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
  ws = socket;
  socket.addEventListener('open', () => { wsRetryDelayMs = 1500; send({ type: 'join', csrf: CTX.csrf }); });
  socket.addEventListener('message', (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg && msg.type === 'state' && msg.room) { serverError = null; ingest(msg.room); render(); }
    else if (msg && msg.type === 'error') { serverError = msg.code || 'unknown'; render(); }
  });
  socket.addEventListener('close', (ev) => {
    ws = null;
    if (ev.code === 1008 || ev.code === 1003) { wsClosedByServer = true; render(); return; }
    if (state && state.status === 'ended') return;
    scheduleRetry();
  });
}
function scheduleRetry() { setTimeout(openWS, wsRetryDelayMs); wsRetryDelayMs = Math.min(15000, wsRetryDelayMs * 2); }
function send(p) { if (!ws || ws.readyState !== 1) return false; try { ws.send(JSON.stringify(p)); return true; } catch { return false; } }

// Pull the attacker name out of the most recent action line ("X used [Skill] on Y").
function parseActor(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e && e.kind === 'action' && typeof e.text === 'string') {
      const idx = e.text.indexOf(' used ');
      if (idx > 0) return e.text.slice(0, idx).trim();
    }
  }
  return null;
}

function ingest(room) {
  state = room;
  const b = room.battle;
  newLogThisIngest = false;
  pendingActorName = null;
  if (b && b.lastActionLog && b.lastActionLog.length) {
    const sig = b.currentTurn + '|' + b.lastActionLog.map((e) => (e && e.text != null ? e.text : String(e))).join('␟');
    if (sig !== lastLogSig) {
      lastLogSig = sig;
      for (const e of b.lastActionLog) logLines.push(e);
      if (logLines.length > 200) logLines.splice(0, logLines.length - 200);
      newLogThisIngest = true;
      pendingActorName = parseActor(b.lastActionLog);
    }
  }
  // Reset stale selections if it's not actionable.
  if (!myTurn()) { armedSkill = null; armedItem = null; }
}

function mySide() { return state ? state.yourSide : null; }
function oppSide() { const s = mySide(); return s === 'p1' ? 'p2' : 'p1'; }
function myTurn() {
  const b = state && state.battle;
  return !!(b && state.status === 'active' && mySide() && b.currentPlayer === mySide());
}

// ── pieces ──────────────────────────────────────────────────────────────
function avatarEl(p) {
  if (p && p.avatarURL) return el('img', { class: 'tcg-avatar', src: p.avatarURL, alt: p.username, width: '34', height: '34' });
  const letter = p && p.username ? p.username.charAt(0).toUpperCase() : '?';
  return el('div', { class: 'tcg-avatar ph' }, letter);
}

function spPips(side) {
  const meta = state.battle.sides[side];
  const cap = Math.max(meta.skillPointsCap, meta.skillPoints);
  const wrap = el('div', { class: 'tcg-sp-pips', title: 'Skill Points ' + meta.skillPoints + '/' + meta.skillPointsCap });
  for (let i = 0; i < cap; i++) {
    wrap.appendChild(el('span', { class: 'tcg-sp-pip' + (i < meta.skillPoints ? ' on' : '') }));
  }
  return wrap;
}

// Compact top HUD: each player with avatar, SP pips, deck/hand counts; center
// holds round + status + turn timer. Replaces the old players/status/sp/timer rows.
function hudPlayer(side, align) {
  const b = state.battle;
  const p = state.players[side];
  const isYou = p && p.discordId === CTX.selfId;
  const isTurn = b && state.status === 'active' && b.currentPlayer === side;
  const meta = b.sides[side];
  const cls = ['tcg-hud-player', align, isYou ? 'you' : '', isTurn ? 'turn' : '', (p && !p.connected) ? 'disc' : '', !p ? 'empty' : ''].filter(Boolean).join(' ');
  const nameTxt = p ? ('@' + p.username + (isYou ? ' (you)' : '')) : 'waiting…';
  const idline = el('div', { class: 'tcg-hud-id' }, [
    avatarEl(p),
    el('div', { class: 'tcg-hud-namecol' }, [
      el('span', { class: 'tcg-hud-name' }, nameTxt),
      el('span', { class: 'tcg-hud-side' }, formatBattleSide(side)),
    ]),
  ]);
  const stats = el('div', { class: 'tcg-hud-stats' }, [
    spPips(side),
    el('span', { class: 'tcg-hud-cards', title: meta.handSize + ' in hand · ' + meta.deckSize + ' in deck' }, [
      el('span', { class: 'tcg-hud-card-ico' }, '🂠'),
      el('span', null, meta.handSize + ' / ' + meta.deckSize),
    ]),
  ]);
  return el('div', { class: cls }, [idline, stats]);
}

function hudCenter() {
  const b = state.battle;
  const round = el('div', { class: 'tcg-hud-round' }, [el('span', { class: 'rl' }, 'ROUND'), el('b', null, String(b.currentTurn))]);
  const center = el('div', { class: 'tcg-hud-center' }, [round]);
  const st = statusLine();
  if (st) center.appendChild(st);
  const t = timerLine();
  if (t) center.appendChild(t);
  return center;
}

function hudBar() {
  if (!state.battle) {
    // lobby has no battle yet: simple player strip
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    const simple = (p, side, align) => {
      const cls = ['tcg-hud-player', align, !p ? 'empty' : ''].filter(Boolean).join(' ');
      return el('div', { class: cls }, [el('div', { class: 'tcg-hud-id' }, [avatarEl(p), el('div', { class: 'tcg-hud-namecol' }, [el('span', { class: 'tcg-hud-name' }, p ? '@' + p.username : 'waiting…'), el('span', { class: 'tcg-hud-side' }, formatBattleSide(side))])])]);
    };
    const center = el('div', { class: 'tcg-hud-center' }, statusLine());
    return el('div', { class: 'tcg-hud' }, [simple(p1, 'p1', 'left'), center, simple(p2, 'p2', 'right')]);
  }
  return el('div', { class: 'tcg-hud' }, [hudPlayer(oppSide(), 'left'), hudCenter(), hudPlayer(mySide(), 'right')]);
}

// ── persistent battle board ────────────────────────────────────────────────
function curCh(side, slot) {
  return ((state.battle && state.battle.teams[side]) || [])[slot] || null;
}
function ultSkillOf(ch) {
  return ch && ch.skills ? ch.skills.find((s) => s.category === 'ultimate') : null;
}

function makeCardNode(side, slot) {
  const root = el('div', { class: 'tcg-char' });
  const img = el('img', { class: 'art', loading: 'lazy', decoding: 'async', alt: '' });
  const activeTag = el('span', { class: 'tcg-active-tag' }, 'ACTIVE');
  const ko = el('div', { class: 'tcg-ko-badge' }, 'KO');

  // Equipment slot pips, top-right over the art.
  const pips = el('div', { class: 'tcg-equip-pips' });
  const pipEls = [];
  for (let i = 0; i < MAX_EQUIP; i++) { const p = el('span', { class: 'tcg-equip-pip' }); pipEls.push(p); pips.appendChild(p); }

  // Ultimate energy orb, bottom-right over the art.
  const orbFill = el('span', { class: 'orb-fill' });
  const orbGlyph = el('span', { class: 'orb-glyph' }, '⚡');
  const orbVal = el('span', { class: 'orb-val' });
  const ult = el('button', { type: 'button', class: 'tcg-ult-orb', title: 'Ultimate' }, [orbFill, orbGlyph, orbVal]);

  const flash = el('div', { class: 'tcg-flash' });
  const slash = el('div', { class: 'tcg-slash' });
  const fx = el('div', { class: 'tcg-fx-layer' });
  const art = el('div', { class: 'tcg-char-art' }, [img, activeTag, ko, pips, ult, flash, slash, fx]);

  const name = el('span', { class: 'tcg-char-name' });
  const nameRow = el('div', { class: 'tcg-char-namerow' }, [name]);
  const hpFill = el('div', { class: 'tcg-hp-fill' });
  const hpVal = el('span', { class: 'tcg-hp-val' }, '');
  const hpBar = el('div', { class: 'tcg-hp-bar' }, [hpFill, hpVal]);
  const effects = el('div', { class: 'tcg-effects' });
  const info = el('div', { class: 'tcg-char-info' }, [nameRow, hpBar, effects]);

  root.appendChild(art);
  root.appendChild(info);

  root.addEventListener('click', () => {
    const ch = curCh(side, slot);
    if (ch) onCharClick(ch, side, side === mySide());
  });
  ult.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const ch = curCh(side, slot);
    const u = ultSkillOf(ch);
    if (u) onSkillClick(ch, u);
  });

  const node = {
    root, art, img, activeTag, ko, flash, slash, fx, name,
    pips, pipEls, ult, orbFill, orbVal,
    hpFill, hpVal, effects, slug: null, _side: side,
  };
  return node;
}

function flashCard(node, type) {
  node.flash.classList.remove('dmg', 'heal');
  void node.flash.offsetWidth; // restart the animation
  node.flash.classList.add(type);
}
function shakeCard(node) {
  node.root.classList.remove('hit');
  void node.root.offsetWidth;
  node.root.classList.add('hit');
  setTimeout(() => node.root.classList.remove('hit'), 480);
}
function slashCard(node) {
  node.slash.classList.remove('go');
  void node.slash.offsetWidth;
  node.slash.classList.add('go');
}
function floatNum(node, delta) {
  const heal = delta > 0;
  const n = el('div', { class: 'tcg-floatnum ' + (heal ? 'heal' : 'dmg') }, (heal ? '+' : '−') + Math.abs(delta));
  // small horizontal jitter so stacked hits don't overlap perfectly
  n.style.setProperty('--dx', (Math.round((node.fx.childElementCount % 3) - 1) * 22) + 'px');
  node.fx.appendChild(n);
  n.addEventListener('animationend', () => { if (n.parentNode) n.parentNode.removeChild(n); });
  setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 1400);
}

function lungeCard(node) {
  const dir = node._side === mySide() ? 'lunge-up' : 'lunge-down';
  node.root.classList.remove('lunge-up', 'lunge-down');
  void node.root.offsetWidth;
  node.root.classList.add(dir);
  setTimeout(() => node.root.classList.remove(dir), 560);
}

// Orchestrate one action's animation: attacker lunges, victims react on impact,
// and a freshly KO'd victim only greys out *after* the hit lands.
function animateAction(actorNode, hits) {
  const reduce = reduceMotion();
  if (actorNode && !reduce) lungeCard(actorNode);
  const fire = () => {
    for (const h of hits) {
      if (h.delta !== 0) floatNum(h.node, h.delta);
      if (h.delta < 0) {
        flashCard(h.node, 'dmg');
        if (!reduce) { shakeCard(h.node); slashCard(h.node); }
      } else if (h.delta > 0) {
        flashCard(h.node, 'heal');
      }
      if (h.ko) {
        const koNode = h.node;
        setTimeout(() => koNode.root.classList.add('ko'), reduce ? 0 : 430);
      }
    }
  };
  if (actorNode && !reduce && hits.length) setTimeout(fire, 160);
  else fire();
}

function updateEffects(container, effects) {
  clear(container);
  const max = 6;
  effects.slice(0, max).forEach((e) => {
    const dur = e.duration < 999 ? ' ' + e.duration : '';
    container.appendChild(el('span', {
      class: 'tcg-eff ' + (e.positive ? 'buff' : 'debuff'),
      title: e.name + ': ' + e.description,
    }, e.name + dur));
  });
  if (effects.length > max) {
    container.appendChild(el('span', { class: 'tcg-eff more', title: 'more effects' }, '+' + (effects.length - max)));
  }
}

function updateEquipPips(node, ch) {
  const eqs = ch.equipments || [];
  const count = Math.min(ch.equipmentCount || 0, MAX_EQUIP);
  node.pips.classList.toggle('empty', count === 0);
  node.pipEls.forEach((p, i) => {
    const on = i < count;
    p.classList.toggle('on', on);
    p.title = on ? (eqs[i] ? eqs[i].name : 'Equipped') : 'Empty slot';
  });
}

function updateUltOrb(node, ch, side) {
  const mine = side === mySide();
  const ult = ultSkillOf(ch);
  if (!ult || ult.energyCost <= 0) { node.ult.style.display = 'none'; return; }
  node.ult.style.display = '';
  const cost = ult.energyCost;
  const pct = Math.max(0, Math.min(100, (100 * ch.energy) / cost));
  node.orbFill.style.setProperty('--pct', pct);
  const full = ch.energy >= cost && !ch.isKnockedOut;
  node.orbVal.textContent = Math.min(ch.energy, cost) + '/' + cost;
  const armed = !!(armedSkill && armedSkill.slot === ch.slot && armedSkill.index === ult.index && side === mySide());
  const ready = mine && myTurn() && ult.available;
  node.ult.className = 'tcg-ult-orb' + (full ? ' full' : '') + (ready ? ' ready' : '') + (armed ? ' armed' : '') + (mine ? '' : ' foe');
  node.ult.disabled = !ready;
  node.ult.title = ult.name + (mine ? (!ult.available && ult.reason ? ' — ' + ult.reason : (ready ? ' — ready!' : '')) : ' (enemy)');
}

function updateCard(node, ch, side) {
  const mine = side === mySide();
  const b = state.battle;

  if (node.slug !== ch.slug) {
    node.img.src = '/static/tcg/char/' + encodeURIComponent(ch.slug) + '.png';
    node.img.alt = ch.name;
    node.slug = ch.slug;
  }
  node.name.textContent = ch.name;

  const isActive = state.status === 'active' && b.currentPlayer === side && b.activeSlot === ch.slot && !ch.isKnockedOut;
  let targetable = false;
  if (armedSkill && myTurn() && !ch.isKnockedOut) {
    if (armedSkill.targetKind === 'opponent' && !mine) targetable = true;
    else if (armedSkill.targetKind === 'ally' && mine) targetable = true;
  }
  if (armedItem != null && myTurn() && mine && !ch.isKnockedOut) targetable = true;
  node.root.classList.toggle('active', isActive);
  node.root.classList.toggle('ko', ch.isKnockedOut);
  node.root.classList.toggle('targetable', targetable);
  node.root.classList.toggle('ally', targetable && mine);
  node.root.classList.toggle('inspect', !targetable);

  const hpPct = Math.max(0, Math.min(100, (100 * ch.currentHp) / Math.max(1, ch.maxHp)));
  node.hpFill.style.width = hpPct + '%';
  node.hpFill.classList.toggle('low', hpPct <= 30);
  node.hpVal.textContent = Math.max(0, Math.round(ch.currentHp)) + ' / ' + ch.maxHp;

  updateEquipPips(node, ch);
  updateUltOrb(node, ch, side);
  updateEffects(node.effects, ch.effects || []);
}

function boardSignature() {
  const sl = (side) => ((state.battle && state.battle.teams[side]) || []).map((c) => c.slug).join(',');
  return oppSide() + ':' + sl(oppSide()) + '|' + mySide() + ':' + sl(mySide());
}

function buildBoard() {
  boardEl = el('div', { class: 'tcg-arena' });
  boardCards.p1 = [];
  boardCards.p2 = [];
  for (const k in prevHp) delete prevHp[k];
  for (const k in prevKo) delete prevKo[k];
  for (const k in nodeByName) delete nodeByName[k];
  const sideEls = [];
  for (const side of [oppSide(), mySide()]) {
    const team = state.battle.teams[side] || [];
    const turn = el('span', { class: 'tcg-side-turn' }, '');
    const label = el('div', { class: 'tcg-side-label' }, [
      el('span', { class: 'tcg-side-dot' }),
      el('span', null, side === mySide() ? 'Your team' : oppLabel()),
      turn,
    ]);
    sideLabels[side] = { label, turn };
    const row = el('div', { class: 'tcg-row' });
    boardCards[side] = team.map((ch, slot) => {
      const node = makeCardNode(side, slot);
      nodeByName[ch.name] = node;
      row.appendChild(node.root);
      return node;
    });
    sideEls.push(el('div', { class: 'tcg-side' + (side === mySide() ? ' mine' : ' foe'), 'data-side': side }, [label, row]));
  }
  boardEl.appendChild(sideEls[0]);
  boardEl.appendChild(el('div', { class: 'tcg-arena-divider' }, el('span', { class: 'tcg-arena-vs' }, 'VS')));
  boardEl.appendChild(sideEls[1]);
  boardSig = boardSignature();
}

function updateBoard() {
  const b = state.battle;
  const hits = [];
  for (const side of ['p1', 'p2']) {
    const lab = sideLabels[side];
    if (lab) {
      const acting = state.status === 'active' && b.currentPlayer === side;
      lab.label.classList.toggle('acting', acting);
      lab.turn.textContent = acting ? (side === mySide() ? 'your turn' : 'their turn') : '';
    }
    const team = b.teams[side] || [];
    const nodes = boardCards[side] || [];
    team.forEach((ch, slot) => {
      const node = nodes[slot];
      if (!node) return;
      const key = side + ':' + slot;
      const prev = prevHp[key];
      const wasKo = prevKo[key];
      updateCard(node, ch, side);
      const freshKo = newLogThisIngest && ch.isKnockedOut && !wasKo;
      if (newLogThisIngest && ((prev != null && ch.currentHp !== prev) || freshKo)) {
        const delta = prev != null ? Math.round(ch.currentHp - prev) : 0;
        hits.push({ node, delta, ko: freshKo });
        // Hold the grey-out / KO badge so the hit lands on a still-standing card;
        // animateAction re-applies `.ko` once the damage has played.
        if (freshKo) node.root.classList.remove('ko');
      }
      prevHp[key] = ch.currentHp;
      prevKo[key] = ch.isKnockedOut;
    });
  }
  if (newLogThisIngest && (hits.length || pendingActorName)) {
    const actor = pendingActorName ? nodeByName[pendingActorName] : null;
    animateAction(actor, hits);
  }
  // consume so re-renders triggered by UI (arming/targeting) don't replay it
  newLogThisIngest = false;
}

function onCharClick(ch, side, mine) {
  if (myTurn() && armedSkill) {
    if (armedSkill.targetKind === 'opponent' && !mine && !ch.isKnockedOut) {
      send({ type: 'use_skill', charIndex: armedSkill.slot, skillIndex: armedSkill.index, target: ch.slot });
      armedSkill = null; render(); return;
    }
    if (armedSkill.targetKind === 'ally' && mine && !ch.isKnockedOut) {
      send({ type: 'use_skill', charIndex: armedSkill.slot, skillIndex: armedSkill.index, target: ch.slot });
      armedSkill = null; render(); return;
    }
  }
  if (myTurn() && armedItem != null && mine && !ch.isKnockedOut) {
    send({ type: 'use_item', handSlotId: armedItem, charIndex: ch.slot });
    armedItem = null; render(); return;
  }
  globalThis.TcgDetail.showBattleCharacter(ch, side, { onFocus: null });
}

function skillIcon(cat) {
  if (cat === 'charged') return '◈';   // ◈
  if (cat === 'ultimate') return '⚡';   // ⚡
  return '⚔';                            // ⚔
}

function skillPanel() {
  // Only the active character takes a main action, and only on your turn — so the
  // skill list is just the active character's normal/charged skills. Ultimates live
  // as per-card orbs (any alive ally can ult), so they're excluded here.
  if (!myTurn()) return null;
  const team = state.battle.teams[mySide()] || [];
  const ch = team[state.battle.activeSlot];
  if (!ch) return null;
  const wrap = el('div', { class: 'tcg-controls' });
  if (ch.isKnockedOut) {
    wrap.appendChild(el('p', { class: 'tcg-section-title' }, 'Active — ' + ch.name + ' (KO)'));
    wrap.appendChild(el('div', { class: 'tcg-hand-empty' }, 'Active character is knocked out — end your turn.'));
    return wrap;
  }
  wrap.appendChild(el('p', { class: 'tcg-section-title' }, [
    el('span', { class: 'tcg-active-chip' }, 'ACTIVE'),
    el('span', null, ' ' + ch.name),
  ]));
  if (state.battle.mainActionUsedThisPhase) {
    wrap.appendChild(el('div', { class: 'tcg-mainaction-note' }, 'Main action used — ultimates, items & end turn still available.'));
  }
  const mainSkills = ch.skills.filter((s) => s.category !== 'ultimate');
  const list = el('div', { class: 'tcg-skill-list' });
  for (const sk of mainSkills) {
    const btn = el('button', { type: 'button', class: 'tcg-skill ' + sk.category + (armedSkill && armedSkill.slot === ch.slot && armedSkill.index === sk.index ? ' armed' : '') }, [
      el('span', { class: 'sk-ico' }, skillIcon(sk.category)),
      el('span', { class: 'sk-body' }, [
        el('span', { class: 'sk-name' }, [
          el('span', null, sk.name),
          sk.damageText && sk.damageText !== '--' ? el('span', { class: 'sk-dmg' }, sk.damageText) : null,
        ]),
        el('span', { class: 'sk-meta' }, [
          el('span', { class: 'sk-cat ' + sk.category }, formatSkillCategory(sk.category)),
          costChip(sk),
        ]),
        el('span', { class: 'sk-desc' }, sk.description),
        (!sk.available && sk.reason) ? el('span', { class: 'sk-reason' }, sk.reason) : null,
      ]),
    ]);
    btn.disabled = !(myTurn() && sk.available);
    btn.addEventListener('click', () => onSkillClick(ch, sk));
    list.appendChild(btn);
  }
  wrap.appendChild(list);
  return wrap;
}

function costChip(sk) {
  if (sk.category === 'charged' && sk.spCost > 0) return el('span', { class: 'sk-cost cost-sp' }, '-' + sk.spCost + ' SP');
  if (sk.category === 'normal' && sk.spGranted > 0) return el('span', { class: 'sk-cost cost-spplus' }, '+' + sk.spGranted + ' SP');
  return null;
}

function onSkillClick(ch, sk) {
  if (!myTurn() || !sk.available) {
    globalThis.TcgDetail.showBattleCharacter(ch, mySide(), { onFocus: null });
    return;
  }
  armedItem = null;
  if (sk.needsTarget) {
    if (armedSkill && armedSkill.slot === ch.slot && armedSkill.index === sk.index) armedSkill = null;
    else armedSkill = { slot: ch.slot, index: sk.index, targetKind: sk.targetKind };
    render();
    return;
  }
  armedSkill = null;
  send({ type: 'use_skill', charIndex: ch.slot, skillIndex: sk.index, target: null });
}

function handTray() {
  const hand = (state.battle.hand) || [];
  const wrap = el('div', { class: 'tcg-controls' });
  wrap.appendChild(el('p', { class: 'tcg-section-title' }, [el('span', null, 'Your Hand'), el('span', { class: 'tcg-count-badge' }, String(hand.length))]));
  if (hand.length === 0) { wrap.appendChild(el('div', { class: 'tcg-hand-empty' }, 'No item cards in hand.')); return wrap; }
  const row = el('div', { class: 'tcg-hand' });
  for (const card of hand) {
    const c = el('div', { class: 'tcg-hand-card' + (armedItem === card.slotId ? ' armed' : ''), title: card.name + ' — ' + card.description }, [
      el('img', { src: '/static/tcg/item/' + encodeURIComponent(card.id) + '.png', alt: card.name, loading: 'lazy', decoding: 'async' }),
      el('span', { class: 'tcg-hand-kind ' + (card.kind === 'equipment' ? 'eq' : 'con') }, card.kind === 'equipment' ? 'EQ' : 'USE'),
    ]);
    c.addEventListener('click', () => {
      globalThis.TcgDetail.showBattleItem(card, {
        onPlay: myTurn()
          ? (slotId) => { armedSkill = null; armedItem = slotId; render(); }
          : null,
      });
    });
    row.appendChild(c);
  }
  wrap.appendChild(row);
  return wrap;
}

function actionBar() {
  const bar = el('div', { class: 'tcg-actionbar' });
  const end = el('button', { type: 'button', class: 'tcg-btn tcg-btn-end' }, [el('span', { class: 'ab-ico' }, '⏭'), el('span', null, 'End Turn')]);
  end.disabled = !myTurn();
  end.addEventListener('click', () => { armedSkill = null; armedItem = null; send({ type: 'end_turn' }); });
  bar.appendChild(end);
  const leave = el('button', { type: 'button', class: 'tcg-btn danger' }, [el('span', { class: 'ab-ico' }, '✕'), el('span', null, 'Leave')]);
  leave.addEventListener('click', () => { send({ type: 'leave' }); setTimeout(() => { window.location.href = '/games/tcg'; }, 200); });
  bar.appendChild(leave);
  return bar;
}

function statusLine() {
  const b = state.battle;
  if (state.status === 'lobby') return el('div', { class: 'tcg-status' }, state.mode === 'pvp' ? 'Waiting for an opponent to join…' : 'Setting up…');
  if (state.status === 'active') {
    if (myTurn()) return el('div', { class: 'tcg-status you' }, 'Your turn');
    const opp = state.players[oppSide()];
    if (opp && !opp.connected) return el('div', { class: 'tcg-status warn' }, 'Opponent reconnecting…');
    return el('div', { class: 'tcg-status' }, 'Opponent’s turn…');
  }
  if (state.status === 'ended') {
    const r = state.result || {};
    if (r.winner === 'draw' || r.winner == null) return el('div', { class: 'tcg-status draw' }, r.winner === 'draw' ? 'Draw!' : 'Battle ended');
    const won = r.winner === mySide();
    const tail = r.reason === 'timeout' ? ' (timeout)' : r.reason === 'disconnect' ? ' (disconnect)' : r.reason === 'forfeit' ? ' (forfeit)' : '';
    if (state.mode === 'solo') return el('div', { class: 'tcg-status win' }, formatBattleSide(r.winner) + ' wins' + tail);
    return won ? el('div', { class: 'tcg-status win' }, 'Victory!' + tail) : el('div', { class: 'tcg-status lose' }, 'Defeat.' + tail);
  }
  return null;
}

function timerLine() {
  if (state.status !== 'active' || !state.turnDeadline) return null;
  const wrap = el('div', { class: 'tcg-timer' });
  const ring = el('span', { class: 'tcg-timer-ring' });
  const count = el('span', { class: 'count' }, '—');
  wrap.appendChild(ring);
  wrap.appendChild(count);
  const tick = () => {
    const ms = Math.max(0, state.turnDeadline - Date.now());
    const remaining = Math.ceil(ms / 1000);
    count.textContent = remaining + 's';
    wrap.classList.toggle('urgent', remaining <= 10);
    ring.style.setProperty('--pct', Math.max(0, Math.min(100, (100 * ms) / TURN_TIMER_MS)));
  };
  tick();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 250);
  return wrap;
}

function inviteBlock() {
  const url = location.origin + '/games/tcg/' + encodeURIComponent(CTX.matchId);
  const wrap = el('div', { class: 'tcg-invite' });
  wrap.appendChild(el('div', { style: 'color: var(--fog-300); text-align:center;' }, 'Share this link with your opponent:'));
  wrap.appendChild(el('div', { class: 'tcg-invite-url' }, url));
  const copy = el('button', { class: 'tcg-btn', type: 'button' }, '[ copy link ]');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); const p = copy.textContent; copy.textContent = '[ copied! ]'; setTimeout(() => { copy.textContent = p; }, 1500); }
    catch { window.prompt('Copy this link:', url); }
  });
  wrap.appendChild(copy);
  return wrap;
}

function endActions() {
  const wrap = el('div', { class: 'tcg-end-actions' });
  const me = mySide() ? state.players[mySide()] : null;
  if (state.mode === 'solo' || (me && !me.rematchAccepted)) {
    const rematch = el('button', { class: 'tcg-btn', type: 'button' }, '[ rematch ]');
    rematch.addEventListener('click', () => send({ type: 'rematch_request' }));
    wrap.appendChild(rematch);
  } else if (me && me.rematchAccepted) {
    wrap.appendChild(el('div', { style: 'flex-basis:100%; text-align:center; color: var(--fog-300);' }, 'Waiting for opponent to accept rematch…'));
  }
  wrap.appendChild(el('a', { href: '/games/tcg', class: 'tcg-btn' }, '[ new battle ]'));
  const leave = el('button', { class: 'tcg-btn danger', type: 'button' }, '[ leave ]');
  leave.addEventListener('click', () => { send({ type: 'leave' }); setTimeout(() => { window.location.href = '/games/tcg'; }, 200); });
  wrap.appendChild(leave);
  return wrap;
}

// Build one styled log line. When the entry carries a `detail` (effect/ability/item/
// skill description), each [bracketed] reference becomes a hoverable tooltip.
function logLineEl(e) {
  const kind = (e && e.kind) || 'info';
  const text = (e && e.text != null) ? e.text : String(e);
  const div = el('div', { class: 'tcg-log-line tcg-log-' + kind });
  const detail = e && e.detail;
  if (detail && text.indexOf('[') !== -1) {
    const re = /\[[^\]]+\]/g;
    let last = 0;
    let m = re.exec(text);
    while (m !== null) {
      if (m.index > last) div.appendChild(document.createTextNode(text.slice(last, m.index)));
      div.appendChild(el('span', { class: 'tcg-log-ref', title: detail }, m[0]));
      last = re.lastIndex;
      m = re.exec(text);
    }
    if (last < text.length) div.appendChild(document.createTextNode(text.slice(last)));
  } else {
    div.textContent = text;
  }
  return div;
}

function logPanel() {
  if (logLines.length === 0) return null;
  const panel = el('div', { class: 'tcg-panel tcg-log-panel' });
  panel.appendChild(el('p', { class: 'tcg-section-title' }, 'Battle Log'));
  const logEl = el('div', { class: 'tcg-log' });
  // column-reverse keeps newest pinned at the bottom; iterate newest→oldest so the
  // DOM order reads chronologically top→bottom. Each line is styled by its kind.
  for (let i = logLines.length - 1; i >= 0; i--) logEl.appendChild(logLineEl(logLines[i]));
  panel.appendChild(logEl);
  return panel;
}

function connectingEl() {
  return el('p', { class: 'tcg-connecting' }, 'Connecting…');
}

function oppLabel() {
  const opp = state.players[oppSide()];
  return opp && opp.username ? '@' + opp.username : 'Opponent';
}

function targetingBanner() {
  if (!myTurn()) return null;
  let ally = false;
  let text = null;
  if (armedSkill) {
    ally = armedSkill.targetKind === 'ally';
    text = 'Select a ' + (ally ? 'friendly' : 'enemy') + ' target';
  } else if (armedItem != null) {
    ally = true;
    text = 'Select one of your characters';
  } else {
    return null;
  }
  const cancel = el('button', { type: 'button', class: 'tcg-target-cancel' }, 'cancel');
  cancel.addEventListener('click', () => { armedSkill = null; armedItem = null; render(); });
  return el('div', { class: 'tcg-target-banner ' + (ally ? 'ally' : 'enemy') }, [
    el('span', { class: 'tt-icon' }, '\u{1f3af}'),
    el('span', { class: 'tt-text' }, text),
    cancel,
  ]);
}

function renderError() {
  const codeMap = {
    not_a_player: 'You are not a participant in this battle.',
    bad_csrf: 'Session expired. Reload the page.',
    auth_required: 'Authentication required. Reload the page.',
    room_not_found: 'This battle no longer exists.',
    rate_limited: "You're sending actions too quickly.",
  };
  clear(viewEl);
  viewEl.appendChild(el('p', { class: 'tcg-subtitle' }, 'Error'));
  viewEl.appendChild(el('p', { style: 'text-align:center; color: var(--danger); margin: 0 0 1rem;' }, codeMap[serverError] || ('Server error: ' + serverError)));
  viewEl.appendChild(el('div', { style: 'display:flex; justify-content:center;' }, el('a', { href: '/games/tcg', class: 'tcg-btn' }, '[ back to lobby ]')));
}

function render() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (wsClosedByServer && serverError) { renderError(); return; }
  if (!state) { clear(viewEl); viewEl.appendChild(connectingEl()); return; }

  clear(viewEl);
  viewEl.appendChild(hudBar());

  if (state.status === 'lobby') {
    if (state.mode === 'pvp') viewEl.appendChild(inviteBlock());
    const extra = logPanel(); attachExtra(extra);
    return;
  }

  if (state.battle) {
    const tb = targetingBanner();
    if (tb) viewEl.appendChild(tb);
    // Persistent arena (opponent on top, your team on the bottom). Attach BEFORE
    // updating so the bars are connected and their width changes animate.
    if (!boardEl || boardSig !== boardSignature()) buildBoard();
    viewEl.appendChild(boardEl);
    updateBoard();

    if (state.status === 'active') {
      const dock = el('div', { class: 'tcg-dock' });
      const sp = skillPanel(); if (sp) dock.appendChild(sp);
      dock.appendChild(handTray());
      dock.appendChild(actionBar());
      viewEl.appendChild(dock);
    } else if (state.status === 'ended') {
      viewEl.appendChild(endActions());
    }
  }

  if (serverError) viewEl.appendChild(el('div', { class: 'tcg-err' }, 'Server: ' + serverError));

  attachExtra(logPanel());
}

// Keep the battle log in its own panel (right column on wide screens).
let extraPanel = null;
function attachExtra(node) {
  const root = document.getElementById('tcg-root');
  if (extraPanel && extraPanel.parentNode) extraPanel.parentNode.removeChild(extraPanel);
  extraPanel = node;
  if (root && node) root.appendChild(node);
}

render();
openWS();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (globalThis.TcgDetail && globalThis.TcgDetail.close()) return;
    armedSkill = null; armedItem = null; render();
  }
});
window.addEventListener('beforeunload', () => { try { ws && ws.close(1000, 'unload'); } catch {} });
})();
