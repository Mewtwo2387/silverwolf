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
  // Wide layout breakpoint (mirrors the CSS @media min-width:920px). Above it the
  // Log/Chat panel sits inline as a right column; below it, it opens as a modal.
  const mq = window.matchMedia('(min-width: 920px)');
  // Floating damage-number tint per element (lowercased Element name, as it appears in the
  // log: "X took N <element> damage"). Unknown/absent element → default .dmg red via CSS.
  const ELEMENT_COLORS = {
    fairy: 'hsl(320 85% 70%)',
    quantum: 'hsl(265 90% 74%)',
    imaginary: 'hsl(45 95% 62%)',
    physical: 'hsl(210 12% 82%)',
    anemo: 'hsl(160 70% 62%)',
    electro: 'hsl(285 85% 74%)',
    cryo: 'hsl(190 85% 66%)',
    pyro: 'hsl(8 90% 66%)',
    geo: 'hsl(40 88% 60%)',
    dendro: 'hsl(110 62% 58%)',
    hydro: 'hsl(205 88% 66%)',
  };

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
let lastLogSig = '';
// Combined Log + Chat panel: one chronological feed of action-log entries and chat
// messages, appended in arrival order. Entries: { kind:'log', e } | { kind:'chat', m }.
const feed = [];
// Seed with existing chat history from the initial snapshot (counts as already-seen).
let lastFeedChatId = 0;
if (CTX.initial && Array.isArray(CTX.initial.chat)) {
  for (const m of CTX.initial.chat) { feed.push({ kind: 'chat', m }); lastFeedChatId = m.id; }
}
let chatUnread = 0;                // unread incoming chat count (narrow launcher badge)
let logModalOpen = false;          // narrow-screen modal open?
// Action animation hints derived from the most recent ingest.
let newLogThisIngest = false;       // a brand-new action arrived this state update
let pendingActorName = null;        // attacker name parsed from the action log

// Persistent battle board: card DOM is built once per battle and updated in place
// so HP bars animate and attack/damage effects can fire across state updates.
let boardEl = null;
let boardSig = '';
const boardCards = { p1: [], p2: [] };
const nodeByName = {};              // name -> card node[] (arrays: a mirror match can field same-named chars on both sides)
const sideLabels = {};
// HP baseline keyed by ABSOLUTE side:slot (stable across the solo perspective flip, which
// rebuilds the board). Used to identify which card actually changed this action — reliable
// even when two same-named characters sit on opposite sides. Reset only on a new battle.
const prevHp = {};
let prevTeamsKey = '';
let prevTurn = 0;

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
      for (const e of b.lastActionLog) feed.push({ kind: 'log', e });
      newLogThisIngest = true;
      pendingActorName = parseActor(b.lastActionLog);
    }
  }
  // Append any new chat messages to the same feed; badge unread while not visible.
  const visible = mq.matches || logModalOpen;
  const chat = Array.isArray(room.chat) ? room.chat : [];
  for (const m of chat) {
    if (m.id <= lastFeedChatId) continue;
    feed.push({ kind: 'chat', m });
    lastFeedChatId = m.id;
    if (!visible && !chatIsMine(m)) chatUnread += 1;
  }
  if (visible) chatUnread = 0;
  if (feed.length > 250) feed.splice(0, feed.length - 250);
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
  const root = el('div', { class: 'tcg-char', tabindex: '0', role: 'button' });
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

  const activateCard = () => {
    const ch = curCh(side, slot);
    if (ch) onCharClick(ch, side, side === mySide());
  };
  root.addEventListener('click', activateCard);
  // Keyboard activation: the card is a focusable role=button, so Enter/Space must
  // trigger the same selection/inspect logic as a click (preventDefault stops Space
  // from scrolling the page). The nested ult <button> handles its own keys.
  root.addEventListener('keydown', (ev) => {
    if (ev.target !== root) return;
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      activateCard();
    }
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
function floatNum(node, value, element) {
  const heal = value > 0;
  const n = el('div', { class: 'tcg-floatnum ' + (heal ? 'heal' : 'dmg') }, (heal ? '+' : '−') + Math.abs(value));
  // Damage numbers are tinted by their element; heals keep the green .heal class.
  if (!heal && element && ELEMENT_COLORS[element]) n.style.color = ELEMENT_COLORS[element];
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

function fireImpact(node, a, reduce) {
  floatNum(node, a.value, a.element);
  if (a.value < 0) {
    flashCard(node, 'dmg');
    if (!reduce) { shakeCard(node); slashCard(node); }
  } else if (a.value > 0) {
    flashCard(node, 'heal');
  }
}

// Perspective-independent identity of the two teams (fixed p1/p2 order) — changes only
// when the actual characters change, not when the solo viewer flips sides.
function teamsKey(b) {
  const sl = (s) => ((b.teams && b.teams[s]) || []).map((c) => c.slug).join(',');
  return 'p1:' + sl('p1') + '|p2:' + sl('p2');
}

// Per-victim signed amounts (one entry per logged hit/stack) for the cards that actually
// changed HP this action. The CHANGED card identifies the victim (side-precise, so a DoT
// on your own mirror-match character resolves correctly); the log supplies the per-hit
// breakdown. If a name maps to more than one changed card (both same-named chars took
// damage at once) we can't split reliably, so that card just shows its net delta.
//   `changed` = [{ node, name, delta }]
function amountsForChanged(changed, entries) {
  const countByName = new Map();
  for (const c of changed) countByName.set(c.name, (countByName.get(c.name) || 0) + 1);

  const logByName = new Map();
  for (const e of (entries || [])) {
    if (!e || typeof e.text !== 'string') continue;
    const heal = e.kind === 'heal';
    if (!heal && e.kind !== 'damage') continue;
    // Damage: "<name> took <n> <element> damage" (element optional). Heal: "<name> recovered <n> HP".
    const m = e.text.match(heal ? /^(.+?) recovered ([0-9]+(?:\.[0-9]+)?) / : /^(.+?) took ([0-9]+(?:\.[0-9]+)?) (?:(\w+) )?damage/);
    if (!m) continue;
    const nm = m[1].trim();
    const entry = { value: (heal ? 1 : -1) * parseFloat(m[2]), element: heal ? null : (m[3] || null) };
    if (!logByName.has(nm)) logByName.set(nm, []);
    logByName.get(nm).push(entry);
  }

  const byNode = new Map();
  for (const c of changed) {
    const lines = logByName.get(c.name);
    byNode.set(c.node, (lines && lines.length && countByName.get(c.name) === 1) ? lines : [{ value: c.delta, element: null }]);
  }
  return byNode;
}

// Orchestrate one action's animation: attacker lunges, then each victim reacts once
// per logged hit (staggered), and a freshly KO'd victim only greys out after its last hit.
function animateAction(actorNode, byNode, koNodes) {
  const reduce = reduceMotion();
  if (actorNode && !reduce) lungeCard(actorNode);
  const baseDelay = (actorNode && !reduce) ? 160 : 0;
  const STAGGER = 140;
  const nodes = new Set([...byNode.keys(), ...koNodes]);
  for (const node of nodes) {
    let amounts = byNode.get(node) || [];
    // Reduced motion: collapse a multi-hit flurry into one number (keep the element tint if uniform).
    if (reduce && amounts.length > 1) {
      const el0 = amounts[0].element;
      const uniform = amounts.every((a) => a.element === el0);
      amounts = [{ value: amounts.reduce((s, a) => s + a.value, 0), element: uniform ? el0 : null }];
    }
    let lastAt = baseDelay;
    amounts.forEach((a, i) => {
      const at = baseDelay + i * STAGGER;
      lastAt = at;
      if (at === 0) fireImpact(node, a, reduce);
      else setTimeout(() => fireImpact(node, a, reduce), at);
    });
    if (koNodes.has(node)) {
      const koAt = reduce ? 0 : lastAt + 300;
      if (koAt === 0) node.root.classList.add('ko');
      else setTimeout(() => node.root.classList.add('ko'), koAt);
    }
  }
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
      (nodeByName[ch.name] = nodeByName[ch.name] || []).push(node);
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
  // Drop the HP baseline only on a genuine new battle (teams changed, or a rematch reset
  // the turn counter) — NOT on the solo per-turn perspective flip, whose keys are stable.
  const tk = teamsKey(b);
  if (tk !== prevTeamsKey || b.currentTurn < prevTurn) { for (const k in prevHp) delete prevHp[k]; }
  prevTeamsKey = tk;
  prevTurn = b.currentTurn;

  const changed = [];   // [{ node, name, delta }] — cards whose HP moved this action
  const koNodes = new Set();
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
      updateCard(node, ch, side);
      if (newLogThisIngest && prev != null && ch.currentHp !== prev) {
        // Keep 2-decimal precision (matches the log's fractional damage) — Math.round would
        // drop fractions like 6.4 and turn a -0.4 delta into a "-0" indicator.
        changed.push({ node, name: ch.name, delta: Math.round((ch.currentHp - prev) * 100) / 100 });
        if (ch.isKnockedOut) {
          koNodes.add(node);
          node.root.classList.remove('ko'); // defer grey-out until the hit lands
        }
      }
      prevHp[key] = ch.currentHp;
    });
  }

  if (newLogThisIngest && (changed.length || pendingActorName)) {
    const actorSide = b.currentPlayer;
    let actor = null;
    if (pendingActorName) {
      const cands = nodeByName[pendingActorName] || [];
      actor = cands.find((n) => n._side === actorSide) || cands[0] || null;
    }
    animateAction(actor, amountsForChanged(changed, b.lastActionLog), koNodes);
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

// ── Side panel: Battle Log + Chat ─────────────────────────────────────────
// Built once and updated in place (like the board) so the chat input keeps focus
// and typed text across the frequent state-driven re-renders. On wide screens it
// docks as a right-hand column; on narrow screens it lives inside a modal opened
// from a floating launcher button.
const side = {
  panel: null, feedBox: null, chatInput: null, modalClose: null,
};
let launcherEl = null;   // floating button (narrow)
let launcherBadge = null;
let modalEl = null;      // backdrop (narrow)
let modalBodyEl = null;

// In solo one user drives both sides (mySide() flips per turn), so every message is
// the viewer's own. In pvp, "mine" is the stable seated side.
function chatIsMine(m) {
  if (!state) return false;
  if (state.mode === 'solo') return true;
  return m.side === mySide();
}

function sendChat() {
  if (!side.chatInput) return;
  const text = side.chatInput.value.replace(/\s+/g, ' ').trim();
  if (!text) return;
  if (send({ type: 'chat', text })) side.chatInput.value = '';
  try { side.chatInput.focus(); } catch (e) { /* */ }
}

function buildSidePanel() {
  const title = el('span', { class: 'tcg-side-title' }, 'Battle Log & Chat');
  side.modalClose = el('button', { type: 'button', class: 'tcg-side-close', title: 'Close' }, '✕');
  side.modalClose.addEventListener('click', closeLogModal);
  const head = el('div', { class: 'tcg-side-head' }, [title, side.modalClose]);

  // One combined chronological feed: action-log entries and chat messages interleaved.
  side.feedBox = el('div', { class: 'tcg-feed' });

  side.chatInput = el('input', {
    type: 'text', class: 'tcg-chat-input', maxlength: '300',
    placeholder: 'Message opponent…', autocomplete: 'off',
  });
  side.chatInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); sendChat(); } });
  const sendBtn = el('button', { type: 'button', class: 'tcg-chat-send', title: 'Send' }, '➤');
  sendBtn.addEventListener('click', sendChat);
  const composer = el('div', { class: 'tcg-chat-composer' }, [side.chatInput, sendBtn]);

  side.panel = el('div', { class: 'tcg-panel tcg-side-panel' }, [head, side.feedBox, composer]);
}

function chatMsgEl(m) {
  const mine = chatIsMine(m);
  // A plain "name: message" line (not a bubble), styled like the rest of the feed.
  return el('div', { class: 'tcg-chat-line' + (mine ? ' me' : '') }, [
    el('span', { class: 'tcg-chat-author' }, m.username + ': '),
    el('span', { class: 'tcg-chat-text' }, m.text),
  ]);
}

function renderFeedInto(box) {
  // Preserve the "stick to bottom" behaviour unless the user has scrolled up to read.
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  clear(box);
  if (feed.length === 0) { box.appendChild(el('div', { class: 'tcg-side-empty' }, 'No activity yet — say hi!')); return; }
  for (const item of feed) {
    box.appendChild(item.kind === 'chat' ? chatMsgEl(item.m) : logLineEl(item.e));
  }
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

function setBadge(node, n) {
  if (!node) return;
  if (n > 0) { node.textContent = n > 9 ? '9+' : String(n); node.hidden = false; }
  else { node.hidden = true; }
}

function updateSidePanel() {
  if (!side.panel) buildSidePanel();
  if (side.chatInput) side.chatInput.placeholder = (state && state.mode === 'solo') ? 'Type a message…' : 'Message opponent…';
  renderFeedInto(side.feedBox);
  setBadge(launcherBadge, logModalOpen ? 0 : chatUnread);
}

function buildLauncherAndModal() {
  launcherBadge = el('span', { class: 'tcg-tab-badge', hidden: true }, '');
  launcherEl = el('button', { type: 'button', class: 'tcg-log-launch', title: 'Battle log & chat' }, [
    el('span', { class: 'll-ico' }, '💬'),
    el('span', { class: 'll-label' }, 'Log'),
    launcherBadge,
  ]);
  launcherEl.addEventListener('click', openLogModal);
  document.body.appendChild(launcherEl);

  modalBodyEl = el('div', { class: 'tcg-logmodal-body' });
  modalEl = el('div', { class: 'tcg-logmodal' }, [modalBodyEl]);
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeLogModal(); });
  document.body.appendChild(modalEl);
}

function openLogModal() {
  logModalOpen = true;
  chatUnread = 0;
  if (modalEl) modalEl.classList.add('open');
  updateSidePanel();
}

function closeLogModal() {
  if (!logModalOpen) return;
  logModalOpen = false;
  if (modalEl) modalEl.classList.remove('open');
  updateSidePanel();
}

// Place the (single) side panel either inline as a right column (wide) or inside
// the modal (narrow). Called every render and on breakpoint changes.
function syncExtras() {
  if (!side.panel) buildSidePanel();
  if (!launcherEl) buildLauncherAndModal();
  const root = document.getElementById('tcg-root');
  if (!root) return;
  const wide = mq.matches;
  if (wide) {
    if (logModalOpen) closeLogModal();
    launcherEl.style.display = 'none';
    side.modalClose.style.display = 'none';
    side.panel.classList.remove('in-modal');
    if (side.panel.parentNode !== root) root.appendChild(side.panel);
  } else {
    launcherEl.style.display = '';
    side.modalClose.style.display = '';
    side.panel.classList.add('in-modal');
    if (side.panel.parentNode !== modalBodyEl) modalBodyEl.appendChild(side.panel);
  }
  updateSidePanel();
}

function hideExtras() {
  if (launcherEl) launcherEl.style.display = 'none';
  if (logModalOpen) closeLogModal();
  if (side.panel && side.panel.parentNode) side.panel.parentNode.removeChild(side.panel);
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
  if (wsClosedByServer && serverError) { hideExtras(); renderError(); return; }
  if (!state) { hideExtras(); clear(viewEl); viewEl.appendChild(connectingEl()); return; }

  clear(viewEl);
  viewEl.appendChild(hudBar());

  if (state.status === 'lobby') {
    if (state.mode === 'pvp') viewEl.appendChild(inviteBlock());
    syncExtras();
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

  syncExtras();
}

render();
openWS();

// Re-place the Log/Chat panel when crossing the wide/narrow breakpoint.
mq.addEventListener('change', () => { if (state) syncExtras(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (globalThis.TcgDetail && globalThis.TcgDetail.close()) return;
    if (logModalOpen) { closeLogModal(); return; }
    armedSkill = null; armedItem = null; render();
  }
});
window.addEventListener('beforeunload', () => { try { ws && ws.close(1000, 'unload'); } catch {} });
})();
