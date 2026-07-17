(() => {
  const dataEl = document.getElementById('tcg-deck-data');
  if (!dataEl) return;
  let ctx;
  try { ctx = JSON.parse(dataEl.textContent); } catch { return; }

  const CSRF = ctx.csrf || '';
  const ITEMS = ctx.items || [];
  const CAPS = ctx.caps || {};
  const initial = ctx.composition || {};

  const counts = {};
  for (const it of ITEMS) counts[it.id] = Math.max(0, Math.min(CAPS.perCard, (initial && initial[it.id]) | 0));

  const grid = document.getElementById('tcg-deck-grid');
  const totalEl = document.getElementById('dk-total');
  const fiveEl = document.getElementById('dk-five');
  const fourEl = document.getElementById('dk-four');
  const fillEl = document.getElementById('dk-fill');
  const legalEl = document.getElementById('dk-legal');
  const syncEl = document.getElementById('dk-sync');
  const msgEl = document.getElementById('dk-msg');
  const emptyEl = document.getElementById('dk-empty');
  const cardTpl = document.getElementById('tcg-tpl-deck-card');
  const searchEl = document.getElementById('dk-search');
  const kindWrap = document.getElementById('dk-kind');
  const rarityWrap = document.getElementById('dk-rarity');
  const inDeckEl = document.getElementById('dk-indeck');
  const sortEl = document.getElementById('dk-sort');
  if (!grid || !cardTpl) return;

  const cardById = {};
  const filt = {
    q: '', kind: 'all', rarity: 'all', inDeck: false, sort: 'rarity',
  };

  function star(n) { return '★'.repeat(n); }

  function totals() {
    let total = 0; let five = 0; let four = 0;
    for (const it of ITEMS) {
      const n = counts[it.id] || 0;
      total += n;
      if (it.rarity >= 5) five += n;
      if (it.rarity >= 4) four += n;
    }
    return { total, five, four };
  }

  function validate() {
    const t = totals();
    if (t.total !== CAPS.deckSize) return { ok: false, reason: 'Deck must have exactly ' + CAPS.deckSize + ' cards (currently ' + t.total + ').' };
    if (t.five > CAPS.fiveStarMax) return { ok: false, reason: 'At most ' + CAPS.fiveStarMax + ' cards may be 5★+.' };
    if (t.four > CAPS.fourStarMax) return { ok: false, reason: 'At most ' + CAPS.fourStarMax + ' cards may be 4★+.' };
    return { ok: true };
  }

  function mkChip(label, val) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcg-chip';
    b.dataset.val = val;
    b.textContent = label;
    return b;
  }

  function buildRarityChips() {
    if (!rarityWrap) return;
    const rarities = Array.from(new Set(ITEMS.map((i) => i.rarity))).sort((a, b) => b - a);
    const all = mkChip('All', 'all');
    all.classList.add('active');
    rarityWrap.appendChild(all);
    for (const r of rarities) rarityWrap.appendChild(mkChip(star(r), String(r)));
    rarityWrap.addEventListener('click', (e) => {
      const b = e.target.closest('.tcg-chip');
      if (!b) return;
      filt.rarity = b.dataset.val;
      rarityWrap.querySelectorAll('.tcg-chip').forEach((x) => x.classList.toggle('active', x === b));
      applyFilters();
    });
  }

  function buildCards() {
    const frag = document.createDocumentFragment();
    for (const it of ITEMS) {
      const cardFrag = cardTpl.content.cloneNode(true);
      const card = cardFrag.querySelector('.tcg-card');
      if (!card) continue;
      card.dataset.id = it.id;
      card.dataset.kind = it.kind;
      card.dataset.rarity = String(it.rarity);
      card.dataset.name = (it.name || '').toLowerCase();

      const imgWrap = card.querySelector('.tcg-card-img');
      const img = card.querySelector('img');
      const rar = card.querySelector('.tcg-card-rarity');
      const kindEl = card.querySelector('.tcg-card-kind');
      const nameEl = card.querySelector('.tcg-card-name');
      if (img) {
        img.alt = it.name;
        img.src = '/static/tcg/item/' + encodeURIComponent(it.id) + '.png';
      }
      if (rar) rar.textContent = star(it.rarity);
      if (kindEl) {
        kindEl.textContent = it.kind === 'equipment' ? 'EQUIP' : 'USE';
        kindEl.classList.add(it.kind === 'equipment' ? 'eq' : 'con');
      }
      if (nameEl) nameEl.textContent = it.name;
      if (imgWrap) imgWrap.addEventListener('click', () => globalThis.TcgDetail.showCatalogItem(it));

      const minus = card.querySelector('.tcg-step-minus');
      const plus = card.querySelector('.tcg-step-plus');
      if (minus) minus.addEventListener('click', () => bump(it.id, -1));
      if (plus) plus.addEventListener('click', () => bump(it.id, 1));

      cardById[it.id] = card;
      frag.appendChild(cardFrag);
    }
    grid.appendChild(frag);
  }

  function bump(id, delta) {
    counts[id] = Math.max(0, Math.min(CAPS.perCard, (counts[id] || 0) + delta));
    refresh();
    scheduleSave();
    if (filt.inDeck) applyFilters();
    if (filt.sort === 'count') applySort();
  }

  function applyFilters() {
    let shown = 0;
    for (const it of ITEMS) {
      const card = cardById[it.id];
      if (!card) continue;
      let ok = true;
      if (filt.q && card.dataset.name.indexOf(filt.q) === -1) ok = false;
      if (ok && filt.kind !== 'all' && it.kind !== filt.kind) ok = false;
      if (ok && filt.rarity !== 'all' && String(it.rarity) !== filt.rarity) ok = false;
      if (ok && filt.inDeck && (counts[it.id] || 0) === 0) ok = false;
      card.classList.toggle('hidden', !ok);
      if (ok) shown += 1;
    }
    if (emptyEl) emptyEl.classList.toggle('show', shown === 0);
  }

  function applySort() {
    const mode = filt.sort;
    const arr = ITEMS.slice().sort((a, b) => {
      if (mode === 'name') return a.name.localeCompare(b.name);
      if (mode === 'count') {
        const d = (counts[b.id] || 0) - (counts[a.id] || 0);
        if (d) return d;
        return (b.rarity - a.rarity) || a.name.localeCompare(b.name);
      }
      return (b.rarity - a.rarity) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
    });
    const frag = document.createDocumentFragment();
    for (const it of arr) {
      const c = cardById[it.id];
      if (c) frag.appendChild(c);
    }
    grid.appendChild(frag);
  }

  let raf = 0;
  function refresh() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const t = totals();
      totalEl.textContent = String(t.total);
      fiveEl.textContent = String(t.five);
      fourEl.textContent = String(t.four);
      totalEl.classList.toggle('over', t.total > CAPS.deckSize);
      fiveEl.classList.toggle('over', t.five > CAPS.fiveStarMax);
      fourEl.classList.toggle('over', t.four > CAPS.fourStarMax);
      if (fillEl) {
        const pct = Math.min(100, Math.round((100 * t.total) / Math.max(1, CAPS.deckSize)));
        fillEl.style.width = pct + '%';
        fillEl.classList.toggle('over', t.total > CAPS.deckSize);
        fillEl.classList.toggle('full', t.total === CAPS.deckSize);
      }
      const v = validate();
      legalEl.textContent = v.ok ? 'legal' : 'illegal';
      legalEl.className = 'tcg-badge ' + (v.ok ? 'legal' : 'illegal');
      // Illegal decks sync fine (shown red; battles reject them) — nothing is blocked.
      grid.querySelectorAll('.tcg-card').forEach((card) => {
        const id = card.dataset.id;
        const n = counts[id] || 0;
        const cnt = card.querySelector('.tcg-count');
        const minus = card.querySelector('.tcg-step-minus');
        const plus = card.querySelector('.tcg-step-plus');
        if (cnt) { cnt.textContent = String(n); cnt.classList.toggle('zero', n === 0); }
        if (minus) minus.toggleAttribute('disabled', n <= 0);
        if (plus) plus.toggleAttribute('disabled', n >= CAPS.perCard);
        card.classList.toggle('has', n > 0);
      });
    });
  }

  // ── Auto-sync: every change saves after a short debounce (no save button) ──
  const SAVE_DEBOUNCE_MS = 600;
  let saveTimer = null;
  let inFlight = false;
  let pendingSave = false; // changed while a save was in flight → resend after
  let dirty = false; // unsynced local changes (drives the pagehide flush)
  let syncClearTimer = null;

  function setSync(text, cls) {
    if (!syncEl) return;
    if (syncClearTimer) { clearTimeout(syncClearTimer); syncClearTimer = null; }
    syncEl.textContent = text;
    syncEl.className = 'tcg-deck-sync' + (cls ? ' ' + cls : '');
    if (cls === 'ok') {
      syncClearTimer = setTimeout(() => { syncEl.textContent = ''; }, 1500);
    }
  }

  function snapshot() {
    const composition = {};
    for (const it of ITEMS) if (counts[it.id] > 0) composition[it.id] = counts[it.id];
    return composition;
  }

  function scheduleSave() {
    dirty = true;
    setSync('saving…', 'busy');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, SAVE_DEBOUNCE_MS);
  }

  async function doSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (inFlight) { pendingSave = true; return; }
    inFlight = true;
    do {
      pendingSave = false;
      try {
        const res = await fetch('/games/tcg/deck/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ csrf: CSRF, composition: snapshot() }),
          keepalive: true,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && data.error) ? data.error : 'Failed to save.');
        }
        if (!pendingSave) { dirty = false; setSync('saved ✓', 'ok'); msg('', ''); }
      } catch (e) {
        // Keep dirty so the next change (or leaving the page) retries.
        setSync('sync failed', 'err');
        msg(e.message + ' Your latest change isn’t saved yet — it will retry on the next edit.', 'err');
        break;
      }
    } while (pendingSave);
    inFlight = false;
  }

  // Last-ditch flush if the user leaves mid-debounce (keepalive survives unload).
  window.addEventListener('pagehide', () => {
    if (!dirty) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try {
      fetch('/games/tcg/deck/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, composition: snapshot() }),
        keepalive: true,
      });
    } catch (e) { /* page is going away */ }
  });

  function msg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'tcg-deck-msg' + (kind ? ' ' + kind : '');
  }

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      filt.q = searchEl.value.trim().toLowerCase();
      applyFilters();
    });
  }
  if (kindWrap) {
    kindWrap.addEventListener('click', (e) => {
      const b = e.target.closest('.tcg-chip');
      if (!b) return;
      filt.kind = b.dataset.kind;
      kindWrap.querySelectorAll('.tcg-chip').forEach((x) => x.classList.toggle('active', x === b));
      applyFilters();
    });
  }
  if (inDeckEl) {
    inDeckEl.addEventListener('change', () => { filt.inDeck = inDeckEl.checked; applyFilters(); });
  }
  if (sortEl) {
    sortEl.addEventListener('change', () => { filt.sort = sortEl.value; applySort(); });
  }

  buildRarityChips();
  buildCards();
  applySort();
  refresh();
})();
