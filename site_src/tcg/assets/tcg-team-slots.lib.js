/**
 * Team-slot bar shared by the create + join pages: five saved loadout slots
 * (lineup + deck), one active. Battles play from the active slot server-side.
 *
 * Switching slots is **optimistic**: the picker swaps to the locally-known lineup
 * instantly and the select POST settles in the background (serialized, reverting the
 * UI to the last server-confirmed slot on failure). Lineup saves are debounced and
 * **slot-tagged**, so a fast switch mid-edit can never write into the wrong slot.
 * Callers must `await flush()` before create/join so the server state is settled.
 */

const SAVE_DEBOUNCE_MS = 600;

/**
 * @param {{
 *   csrf: string,
 *   state: { active: number, slots: { team: string[] }[] },
 *   picker: { setTeam: (values: string[]) => void },
 *   errEl?: HTMLElement | null,
 *   onDeckLegal?: (legal: boolean) => void,
 * }} opts
 * @returns {{ scheduleSave: (team: string[]) => void, flush: () => Promise<void> } | null}
 */
export function setupSlotBar(opts) {
  const bar = document.getElementById('tcg-slotbar');
  if (!bar || !opts || !opts.picker) return null;

  const csrf = opts.csrf || '';
  const deckSize = (opts.state && opts.state.deckSize) || 25;
  const state = {
    active: (opts.state && opts.state.active) || 0,
    slots: (opts.state && Array.isArray(opts.state.slots) ? opts.state.slots : [])
      .map((s) => ({
        team: (s && Array.isArray(s.team)) ? s.team.slice() : [],
        deckCount: (s && typeof s.deckCount === 'number') ? s.deckCount : deckSize,
        deckLegal: !s || s.deckLegal !== false,
      })),
  };
  while (state.slots.length < 5) state.slots.push({ team: [], deckCount: deckSize, deckLegal: true });

  let serverActive = state.active; // last slot the server confirmed as active
  let selectChain = Promise.resolve(); // serializes select settles in click order
  let saveTimer = null;
  let pending = null; // { slot, team } — debounced lineup save
  let applying = false; // true while we push a slot's lineup into the picker

  function err(msg) { if (opts.errEl) opts.errEl.textContent = msg || ''; }

  async function post(path, payload) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ csrf }, payload)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : 'Request failed.');
    }
    return data;
  }

  function applyToPicker(team) {
    applying = true;
    try { opts.picker.setTeam(team); } finally { applying = false; }
  }

  async function flushLineup() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!pending) return;
    const p = pending;
    pending = null;
    try {
      await post('/games/tcg/teams/lineup', p);
    } catch (e) {
      err(e.message);
    }
  }

  function scheduleSave(team) {
    if (applying) return; // a slot switch is loading its lineup — not a user edit
    err('');
    const slot = state.active;
    state.slots[slot].team = team.slice();
    render();
    // Edits for a *different* slot than the pending save: send the old one off now.
    if (pending && pending.slot !== slot) flushLineup();
    pending = { slot, team: team.slice() };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushLineup, SAVE_DEBOUNCE_MS);
  }

  async function settleSelect(i) {
    if (serverActive === i) return;
    try {
      const data = await post('/games/tcg/teams/select', { slot: i });
      serverActive = data.active;
      state.slots[data.active].deckLegal = !!data.deckLegal;
      // Adopt the server's copy of the lineup unless the user already edited it here.
      if (Array.isArray(data.team) && (!pending || pending.slot !== data.active)) {
        state.slots[data.active].team = data.team.slice();
        if (state.active === data.active) { applyToPicker(data.team.slice()); }
      }
      if (opts.onDeckLegal && state.active === data.active) opts.onDeckLegal(!!data.deckLegal);
      render();
    } catch (e) {
      // Only revert if this failed click is still the latest intent.
      if (state.active === i) {
        state.active = serverActive;
        applyToPicker(state.slots[serverActive].team.slice());
        render();
      }
      err(e.message || 'Slot switch failed.');
    }
  }

  function select(i) {
    if (i === state.active) return;
    err('');
    // Optimistic: local copy is authoritative (edits auto-save), swap instantly.
    state.active = i;
    applyToPicker(state.slots[i].team.slice());
    render();
    selectChain = selectChain.then(() => settleSelect(i)).catch(() => {});
  }

  function render() {
    bar.replaceChildren();
    state.slots.forEach((slot, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tcg-slotchip' + (i === state.active ? ' active' : '');
      chip.setAttribute('aria-pressed', i === state.active ? 'true' : 'false');

      const name = document.createElement('span');
      name.className = 'sc-name';
      name.textContent = 'Team ' + (i + 1);
      chip.appendChild(name);

      // Lineup readiness (x/3) and deck readiness (y/25) — red = not battle-ready.
      const count = document.createElement('span');
      count.className = 'sc-count' + (slot.team.length === 3 ? ' good' : ' bad');
      count.textContent = slot.team.length + '/3';
      chip.appendChild(count);

      const deck = document.createElement('span');
      deck.className = 'sc-deck' + (slot.deckLegal ? ' good' : ' bad');
      deck.textContent = slot.deckCount + '/' + deckSize;
      deck.title = slot.deckLegal ? 'Deck legal' : 'Deck illegal';
      chip.appendChild(deck);

      chip.addEventListener('click', () => select(i));
      bar.appendChild(chip);
    });
  }
  render();

  return {
    scheduleSave,
    // Battles play from the server's active slot: settle any in-flight slot switch,
    // then persist the last lineup edit.
    flush: async () => {
      try { await selectChain; } catch (e) { /* handled in settleSelect */ }
      await flushLineup();
    },
  };
}
