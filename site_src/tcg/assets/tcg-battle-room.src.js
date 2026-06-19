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

function ingest(room) {
  state = room;
  const b = room.battle;
  if (b && b.lastActionLog && b.lastActionLog.length) {
    const sig = b.currentTurn + '|' + b.lastActionLog.map((e) => (e && e.text != null ? e.text : String(e))).join('\u241f');
    if (sig !== lastLogSig) { lastLogSig = sig; for (const e of b.lastActionLog) logLines.push(e); if (logLines.length > 200) logLines.splice(0, logLines.length - 200); }
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
  if (p && p.avatarURL) return el('img', { class: 'tcg-avatar', src: p.avatarURL, alt: p.username, width: '32', height: '32' });
  const letter = p && p.username ? p.username.charAt(0).toUpperCase() : '?';
  return el('div', { class: 'tcg-avatar ph' }, letter);
}
function playerCard(p, side, align) {
  const b = state.battle;
  const isYou = p && p.discordId === CTX.selfId;
  const isTurn = b && state.status === 'active' && b.currentPlayer === side;
  const cls = ['tcg-player', align === 'right' ? 'right' : '', isYou ? 'you' : '', isTurn ? 'turn' : '', (p && !p.connected) ? 'disc' : '', !p ? 'empty' : ''].filter(Boolean).join(' ');
  if (!p) return el('div', { class: cls }, [el('div', { class: 'tcg-avatar ph' }, '?'), el('span', { class: 'tcg-pname' }, 'waiting…'), el('span', null, formatBattleSide(side))]);
  return el('div', { class: cls }, [avatarEl(p), el('span', { class: 'tcg-pname' }, '@' + p.username + (isYou ? ' (you)' : '')), el('span', { style: 'color:var(--fog-400);font-size:0.7rem;' }, formatBattleSide(side))]);
}
function playersRow() {
  return el('div', { class: 'tcg-players' }, [playerCard(state.players.p1, 'p1', 'left'), el('div', { class: 'tcg-vs' }, 'vs'), playerCard(state.players.p2, 'p2', 'right')]);
}

function ultButton(ch) {
  const ult = ch.skills.find((s) => s.category === 'ultimate');
  if (!ult) return null;
  const armed = !!(armedSkill && armedSkill.slot === ch.slot && armedSkill.index === ult.index);
  const ready = myTurn() && ult.available;
  const btn = el('button', {
    type: 'button',
    class: 'tcg-ult-btn' + (armed ? ' armed' : '') + (ready ? ' ready' : ''),
    title: ult.name + (!ult.available && ult.reason ? ' \u2014 ' + ult.reason : ''),
  }, 'ULT');
  btn.disabled = !ready;
  btn.addEventListener('click', (ev) => { ev.stopPropagation(); onSkillClick(ch, ult); });
  return btn;
}

function charCard(ch, side) {
  const mine = side === mySide();
  const b = state.battle;
  const isActiveSlot = b.currentPlayer === side && b.activeSlot === ch.slot && !ch.isKnockedOut;
  const cls = ['tcg-char'];
  if (isActiveSlot) cls.push('active');
  if (ch.isKnockedOut) cls.push('ko');

  // Targeting affordances
  let targetable = false;
  if (armedSkill && myTurn() && !ch.isKnockedOut) {
    if (armedSkill.targetKind === 'opponent' && !mine) { targetable = true; cls.push('targetable'); }
    else if (armedSkill.targetKind === 'ally' && mine) { targetable = true; cls.push('targetable', 'ally'); }
  }
  if (armedItem != null && myTurn() && mine && !ch.isKnockedOut) { targetable = true; cls.push('targetable', 'ally'); }
  if (!targetable) cls.push('inspect');

  const card = el('div', { class: cls.join(' ') });
  const img = el('img', { class: 'art', src: '/static/tcg/char/' + encodeURIComponent(ch.slug) + '.png', alt: ch.name, loading: 'lazy', decoding: 'async' });
  card.appendChild(img);

  card.appendChild(el('div', { class: 'tcg-char-top' }, [
    el('span', { class: 'tcg-char-name' }, ch.name),
  ]));

  const bottom = el('div', { class: 'tcg-char-bottom' });
  const pct = Math.max(0, Math.min(100, Math.round((100 * ch.currentHp) / Math.max(1, ch.maxHp))));
  const bar = el('div', { class: 'tcg-hp-bar' });
  const fill = el('div', { class: 'tcg-hp-fill' + (pct <= 30 ? ' low' : '') });
  fill.style.width = pct + '%';
  bar.appendChild(fill);
  bottom.appendChild(bar);
  bottom.appendChild(el('div', { class: 'tcg-hp-text' }, ch.currentHp + ' / ' + ch.maxHp));

  // Energy bar fills toward the ultimate's requirement (assume one ult/char);
  // overflow shows as full. A separate ULT button on your own alive cards fires it.
  const ult = ch.skills.find((s) => s.category === 'ultimate');
  const ultCost = ult ? ult.energyCost : 0;
  const ePct = ultCost > 0 ? Math.max(0, Math.min(100, Math.round((100 * ch.energy) / ultCost))) : 100;
  const eBar = el('div', { class: 'tcg-energy-bar' + (ePct >= 100 ? ' full' : '') });
  const eFill = el('div', { class: 'tcg-energy-fill' });
  eFill.style.width = ePct + '%';
  eBar.appendChild(eFill);
  bottom.appendChild(eBar);
  const shownEnergy = ultCost > 0 ? Math.min(ch.energy, ultCost) : ch.energy;
  bottom.appendChild(el('div', { class: 'tcg-energy-text' }, '⚡ ' + shownEnergy + (ultCost > 0 ? ' / ' + ultCost : '')));
  if (mine && !ch.isKnockedOut) { const ub = ultButton(ch); if (ub) bottom.appendChild(ub); }

  if (ch.effects && ch.effects.length) {
    const fx = el('div', { class: 'tcg-effects' });
    for (const e of ch.effects.slice(0, 6)) {
      const dur = e.duration < 999 ? ' ' + e.duration : '';
      fx.appendChild(el('span', { class: 'tcg-eff ' + (e.positive ? 'buff' : 'debuff'), title: e.name + ': ' + e.description }, e.name + dur));
    }
    bottom.appendChild(fx);
  }
  card.appendChild(bottom);
  if (ch.isKnockedOut) card.appendChild(el('div', { class: 'tcg-ko-badge' }, 'KO'));

  card.addEventListener('click', () => onCharClick(ch, side, mine));
  return card;
}

function rowFor(side) {
  const team = state.battle.teams[side] || [];
  return el('div', { class: 'tcg-row' }, team.map((ch) => charCard(ch, side)));
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

function skillPanel() {
  // Only the active character takes a main action, and only on your turn — so the
  // skill list is just the active character's normal/charged skills. Ultimates live
  // as per-card buttons (any alive ally can ult), so they're excluded here.
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
  wrap.appendChild(el('p', { class: 'tcg-section-title' }, 'Active — ' + ch.name + ' (slot ' + ch.slot + ')'));
  if (state.battle.mainActionUsedThisPhase) {
    wrap.appendChild(el('div', { class: 'tcg-mainaction-note' }, 'Main action used this phase — ultimates, items & end turn still available.'));
  }
  const mainSkills = ch.skills.filter((s) => s.category !== 'ultimate');
  const list = el('div', { class: 'tcg-skill-list' });
  for (const sk of mainSkills) {
    const btn = el('button', { type: 'button', class: 'tcg-skill' + (armedSkill && armedSkill.slot === ch.slot && armedSkill.index === sk.index ? ' armed' : '') }, [
      el('span', { class: 'sk-name' }, [
        el('span', null, sk.name),
        el('span', { class: 'sk-dmg' }, sk.damageText && sk.damageText !== '--' ? sk.damageText : ''),
      ]),
      el('span', { class: 'sk-cat ' + sk.category }, formatSkillCategory(sk.category) + costLabel(sk)),
      el('span', { class: 'sk-desc' }, sk.description),
      (!sk.available && sk.reason) ? el('span', { class: 'sk-reason' }, sk.reason) : null,
    ]);
    btn.disabled = !(myTurn() && sk.available);
    btn.addEventListener('click', () => onSkillClick(ch, sk));
    list.appendChild(btn);
  }
  wrap.appendChild(list);
  return wrap;
}

function costLabel(sk) {
  if (sk.category === 'ultimate' && sk.energyCost > 0) return ' · ' + sk.energyCost + '\u26a1';
  if (sk.category === 'charged' && sk.spCost > 0) return ' · ' + sk.spCost + ' SP';
  if (sk.category === 'normal' && sk.spGranted > 0) return ' · +' + sk.spGranted + ' SP';
  return '';
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
  wrap.appendChild(el('p', { class: 'tcg-section-title' }, 'Your Hand (' + hand.length + ')'));
  if (hand.length === 0) { wrap.appendChild(el('div', { class: 'tcg-hand-empty' }, 'No item cards in hand.')); return wrap; }
  const row = el('div', { class: 'tcg-hand' });
  for (const card of hand) {
    const c = el('div', { class: 'tcg-hand-card' + (armedItem === card.slotId ? ' armed' : ''), title: card.name + ' — ' + card.description }, [
      el('img', { src: '/static/tcg/item/' + encodeURIComponent(card.id) + '.png', alt: card.name, loading: 'lazy', decoding: 'async' }),
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

function spLine() {
  const b = state.battle;
  return el('div', { class: 'tcg-sp' }, [
    el('span', null, ['P1 SP ', el('b', null, b.sides.p1.skillPoints + '/' + b.sides.p1.skillPointsCap)]),
    el('span', null, ['Round ', el('b', null, String(b.currentTurn))]),
    el('span', null, ['P2 SP ', el('b', null, b.sides.p2.skillPoints + '/' + b.sides.p2.skillPointsCap)]),
  ]);
}

function actionBar() {
  const bar = el('div', { class: 'tcg-actionbar' });
  const end = el('button', { type: 'button', class: 'tcg-btn' }, '[ end turn ]');
  end.disabled = !myTurn();
  end.addEventListener('click', () => { armedSkill = null; armedItem = null; send({ type: 'end_turn' }); });
  bar.appendChild(end);
  const leave = el('button', { type: 'button', class: 'tcg-btn danger' }, '[ leave ]');
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
    return el('div', { class: 'tcg-status' }, 'Waiting for opponent…');
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
  wrap.appendChild(el('span', null, 'turn timer'));
  const count = el('span', { class: 'count' }, '—');
  wrap.appendChild(count);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
    count.textContent = remaining + 's';
    wrap.classList.toggle('urgent', remaining <= 10);
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

function labeledRow(side, label) {
  const b = state.battle;
  const acting = !!(b && state.status === 'active' && b.currentPlayer === side);
  const mine = side === mySide();
  const lab = el('div', { class: 'tcg-side-label' + (acting ? ' acting' : '') }, [
    el('span', { class: 'tcg-side-dot' }),
    el('span', null, label),
    acting ? el('span', { class: 'tcg-side-turn' }, mine ? 'your turn' : 'their turn') : null,
  ]);
  return el('div', { class: 'tcg-side' + (mine ? ' mine' : '') }, [lab, rowFor(side)]);
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
  viewEl.appendChild(playersRow());
  const st = statusLine(); if (st) viewEl.appendChild(st);
  const t = timerLine(); if (t) viewEl.appendChild(t);

  if (state.status === 'lobby') {
    if (state.mode === 'pvp') viewEl.appendChild(inviteBlock());
    // refresh the root panel container
    const extra = logPanel(); attachExtra(extra);
    return;
  }

  if (state.battle) {
    const tb = targetingBanner();
    if (tb) viewEl.appendChild(tb);
    // Opponent team on top, your team on the bottom (your-perspective board).
    const board = el('div', { class: 'tcg-board' }, [
      labeledRow(oppSide(), oppLabel()),
      labeledRow(mySide(), 'Your team'),
    ]);
    viewEl.appendChild(board);
    viewEl.appendChild(spLine());

    if (state.status === 'active') {
      const sp = skillPanel(); if (sp) viewEl.appendChild(sp);
      viewEl.appendChild(handTray());
      viewEl.appendChild(actionBar());
    } else if (state.status === 'ended') {
      viewEl.appendChild(endActions());
    }
  }

  if (serverError) viewEl.appendChild(el('div', { class: 'tcg-err' }, 'Server: ' + serverError));

  attachExtra(logPanel());
}

// Keep the battle log in its own panel below the main view.
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
