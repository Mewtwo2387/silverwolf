/**
 * Interactive team picker shared by the TCG landing + join pages.
 *
 * Replaces the old three <select> dropdowns with a visual, card-driven flow:
 *  - a row of three ordered "team slots" showing the current picks, and
 *  - a searchable roster grid of character cards.
 *
 * Clicking a roster card appends a copy of that character to the next open slot
 * (the engine allows the same character in multiple slots, so duplicates are
 * supported); the ✕ on a slot removes it. The ⓘ on each card opens the shared
 * detail modal via globalThis.TcgDetail without changing the selection.
 *
 * Catalog data is read from the shared #tcg-detail-data island (the same JSON
 * the detail modal uses), so no extra data plumbing is needed.
 */

const TEAM_SIZE = 3;

// Per-element accent hue (deg) for the small element tag / card glow. Keyed by
// the catalog's elementDisplayName output. Falls back to the cyan accent.
const ELEMENT_HUES = {
  Fairy: 320,
  Quantum: 265,
  Imaginary: 45,
  Physical: 215,
  Anemo: 160,
  Electro: 285,
  Cryo: 190,
  Pyro: 10,
  Geo: 40,
  Dendro: 120,
  Hydro: 205,
};

function readCatalog() {
  const dataEl = document.getElementById('tcg-detail-data');
  if (!dataEl) return [];
  try {
    const parsed = JSON.parse(dataEl.textContent);
    return parsed && Array.isArray(parsed.catalog) ? parsed.catalog : [];
  } catch {
    return [];
  }
}

function charArtUrl(slug) {
  return '/static/tcg/char/' + encodeURIComponent(slug) + '.png';
}

/**
 * @param {{ defaults?: string[], onChange?: (team: string[]) => void }} opts
 * @returns {{ getTeam: () => string[], isComplete: () => boolean } | null}
 */
export function setupTeamPicker(opts) {
  opts = opts || {};
  const grid = document.getElementById('tcg-roster-grid');
  const slotsWrap = document.getElementById('tcg-team-slots');
  if (!grid || !slotsWrap) return null;

  const catalog = readCatalog();
  const byValue = Object.fromEntries(catalog.map((c) => [c.value, c]));
  const searchEl = document.getElementById('tcg-roster-search');
  const countEl = document.getElementById('tcg-team-count');
  const emptyEl = document.getElementById('tcg-roster-empty');

  /** ordered list of character values, length 0..3, duplicates allowed */
  const team = [];
  const cardByValue = {};

  const defaults = Array.isArray(opts.defaults) ? opts.defaults : [];
  for (const v of defaults) {
    if (team.length < TEAM_SIZE && byValue[v]) team.push(v);
  }

  function getTeam() { return team.slice(); }
  function isComplete() { return team.length === TEAM_SIZE; }
  function notify() { if (opts.onChange) opts.onChange(getTeam()); }

  function elHue(ch) {
    const h = ch && ELEMENT_HUES[ch.element];
    return typeof h === 'number' ? h : null;
  }

  function add(value) {
    if (team.length >= TEAM_SIZE || !byValue[value]) return;
    team.push(value);
    renderSlots();
    renderGridState();
    notify();
  }

  function removeAt(i) {
    if (i < 0 || i >= team.length) return;
    team.splice(i, 1);
    renderSlots();
    renderGridState();
    notify();
  }

  function renderSlots() {
    slotsWrap.replaceChildren();
    for (let i = 0; i < TEAM_SIZE; i += 1) {
      const v = team[i];
      const slot = document.createElement('div');
      slot.className = 'tcg-slot' + (v ? ' filled' : '');

      const idx = document.createElement('span');
      idx.className = 'tcg-slot-idx';
      idx.textContent = String(i + 1);
      slot.appendChild(idx);

      if (v) {
        const ch = byValue[v];
        const hue = elHue(ch);
        if (hue != null) slot.style.setProperty('--el', String(hue));

        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = ch.name;
        img.src = charArtUrl(ch.slug);
        slot.appendChild(img);

        const name = document.createElement('span');
        name.className = 'tcg-slot-name';
        name.textContent = ch.name;
        slot.appendChild(name);

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'tcg-slot-rm';
        rm.setAttribute('aria-label', 'Remove ' + ch.name);
        rm.title = 'Remove';
        rm.textContent = '✕';
        rm.addEventListener('click', () => removeAt(i));
        slot.appendChild(rm);
      } else {
        const ph = document.createElement('span');
        ph.className = 'tcg-slot-empty';
        ph.textContent = 'empty';
        slot.appendChild(ph);
      }
      slotsWrap.appendChild(slot);
    }
    if (countEl) {
      countEl.textContent = team.length + ' / ' + TEAM_SIZE;
      countEl.classList.toggle('done', team.length === TEAM_SIZE);
    }
  }

  function buildGrid() {
    grid.replaceChildren();
    for (const ch of catalog) {
      const card = document.createElement('div');
      card.className = 'tcg-roster-card';
      card.dataset.value = ch.value;
      card.dataset.name = (ch.name || '').toLowerCase();
      const hue = elHue(ch);
      if (hue != null) card.style.setProperty('--el', String(hue));

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'rc-pick';
      pick.title = ch.name + ' — tap to add';

      const art = document.createElement('span');
      art.className = 'rc-art';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = ch.name;
      img.src = charArtUrl(ch.slug);
      art.appendChild(img);
      const badge = document.createElement('span');
      badge.className = 'rc-badge';
      art.appendChild(badge);
      pick.appendChild(art);

      const name = document.createElement('span');
      name.className = 'rc-name';
      name.textContent = ch.name;
      pick.appendChild(name);

      const elTag = document.createElement('span');
      elTag.className = 'rc-el';
      elTag.textContent = ch.element;
      pick.appendChild(elTag);

      pick.addEventListener('click', () => add(ch.value));
      card.appendChild(pick);

      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'rc-info';
      info.setAttribute('aria-label', 'View ' + ch.name + ' details');
      info.title = 'View details';
      info.textContent = 'ⓘ';
      info.addEventListener('click', (e) => {
        e.stopPropagation();
        if (globalThis.TcgDetail) globalThis.TcgDetail.showCatalogCharacter(ch.value);
      });
      card.appendChild(info);

      grid.appendChild(card);
      cardByValue[ch.value] = card;
    }
  }

  function renderGridState() {
    const full = team.length >= TEAM_SIZE;
    const counts = {};
    for (const v of team) counts[v] = (counts[v] || 0) + 1;
    for (const v of Object.keys(cardByValue)) {
      const card = cardByValue[v];
      const n = counts[v] || 0;
      card.classList.toggle('picked', n > 0);
      card.classList.toggle('disabled', full && n === 0);
      const badge = card.querySelector('.rc-badge');
      if (badge) {
        badge.textContent = n > 1 ? '×' + n : (n === 1 ? '✓' : '');
        badge.classList.toggle('show', n > 0);
      }
    }
  }

  function applySearch() {
    const q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
    let shown = 0;
    for (const v of Object.keys(cardByValue)) {
      const card = cardByValue[v];
      const match = !q || card.dataset.name.indexOf(q) !== -1;
      card.classList.toggle('hidden', !match);
      if (match) shown += 1;
    }
    if (emptyEl) emptyEl.classList.toggle('show', shown === 0);
  }

  if (searchEl) searchEl.addEventListener('input', applySearch);

  buildGrid();
  renderSlots();
  renderGridState();
  notify();

  return { getTeam, isComplete };
}
