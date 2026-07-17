import { setupTeamPicker } from './tcg-team-picker.lib.js';
import { setupSlotBar } from './tcg-team-slots.lib.js';

(() => {
  const dataEl = document.getElementById('tcg-landing-data');
  if (!dataEl) return;
  let ctx;
  try { ctx = JSON.parse(dataEl.textContent); } catch { return; }

  const CSRF = ctx.csrf || '';
  const TEAM_STATE = ctx.teamState || { active: 0, slots: [] };
  let deckLegal = !!ctx.deckLegal; // per-slot: updated when the active slot changes
  let mode = 'pvp';

  const modesEl = document.getElementById('tcg-modes');
  const createBtn = document.getElementById('tcg-create');
  const errEl = document.getElementById('tcg-err');
  if (!createBtn) return;

  // Declared with `let` (not `const`) so onTeamChange — which setupTeamPicker
  // invokes synchronously via onChange during construction — can read them
  // without hitting the temporal dead zone.
  let picker = null;
  let slotBar = null;
  const activeTeam = (TEAM_STATE.slots[TEAM_STATE.active] || { team: [] }).team;
  picker = setupTeamPicker({ defaults: activeTeam, onChange: onTeamChange });
  slotBar = setupSlotBar({
    csrf: CSRF,
    state: TEAM_STATE,
    picker,
    errEl: document.getElementById('tcg-slotbar-err'),
    onDeckLegal: setDeckLegal,
  });

  function onTeamChange() {
    if (slotBar && picker) slotBar.scheduleSave(picker.getTeam());
    refreshCreate();
  }

  function refreshCreate() {
    const ok = !!picker && picker.isComplete() && deckLegal;
    createBtn.toggleAttribute('disabled', !ok);
    if (errEl && ok) errEl.textContent = '';
  }
  refreshCreate();

  function setDeckLegal(legal) {
    deckLegal = !!legal;
    const badge = document.querySelector('.tcg-badge');
    if (badge) {
      badge.className = 'tcg-badge ' + (deckLegal ? 'legal' : 'illegal');
      badge.textContent = deckLegal ? 'legal deck' : 'illegal deck';
    }
    refreshCreate();
  }

  if (modesEl) {
    modesEl.querySelectorAll('.tcg-mode').forEach((b) => {
      b.addEventListener('click', () => {
        mode = b.getAttribute('data-mode') || 'pvp';
        modesEl.querySelectorAll('.tcg-mode').forEach((x) => {
          const on = x === b;
          x.classList.toggle('active', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
  }

  createBtn.addEventListener('click', async () => {
    if (createBtn.hasAttribute('disabled')) return;
    errEl.textContent = '';
    createBtn.setAttribute('disabled', 'disabled');
    try {
      // The battle plays from the active slot server-side — make sure the last
      // lineup edit has landed there first.
      if (slotBar) await slotBar.flush();
      const res = await fetch('/games/tcg/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? data.error : 'Failed to create battle.';
        refreshCreate();
        return;
      }
      window.location.href = '/games/tcg/' + encodeURIComponent(data.id);
    } catch (e) {
      errEl.textContent = 'Network error.';
      refreshCreate();
    }
  });

  document.querySelectorAll('.tcg-copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-room-id');
      if (!id) return;
      const url = window.location.origin + '/games/tcg/' + encodeURIComponent(id);
      try {
        await navigator.clipboard.writeText(url);
        const prev = btn.textContent;
        btn.textContent = '[ copied! ]';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch { window.prompt('Copy this link:', url); }
    });
  });
})();
