import { setupTeamPicker } from './tcg-team-picker.lib.js';
import { setupSlotBar } from './tcg-team-slots.lib.js';

(() => {
  const dataEl = document.getElementById('tcg-join-data');
  if (!dataEl) return;
  let ctx;
  try { ctx = JSON.parse(dataEl.textContent); } catch { return; }

  const CSRF = ctx.csrf || '';
  const MATCH = ctx.matchId || '';
  const TEAM_STATE = ctx.teamState || { active: 0, slots: [] };
  let deckLegal = !!ctx.deckLegal;
  const joinBtn = document.getElementById('tcg-join');
  const errEl = document.getElementById('tcg-join-err');
  if (!joinBtn) return;

  // `let` (not `const`): setupTeamPicker calls onTeamChange synchronously via
  // onChange during construction, so these must not be in the dead zone.
  let picker = null;
  let slotBar = null;
  const activeTeam = (TEAM_STATE.slots[TEAM_STATE.active] || { team: [] }).team;
  picker = setupTeamPicker({ defaults: activeTeam, onChange: onTeamChange });
  slotBar = setupSlotBar({
    csrf: CSRF,
    state: TEAM_STATE,
    picker,
    errEl: document.getElementById('tcg-slotbar-err'),
    onDeckLegal: (legal) => {
      deckLegal = !!legal;
      const badge = document.querySelector('.tcg-badge');
      if (badge) {
        badge.className = 'tcg-badge ' + (deckLegal ? 'legal' : 'illegal');
        badge.textContent = deckLegal ? 'legal deck' : 'illegal deck';
      }
      refreshJoin();
    },
  });

  function onTeamChange() {
    if (slotBar && picker) slotBar.scheduleSave(picker.getTeam());
    refreshJoin();
  }

  function refreshJoin() {
    const ok = !!picker && picker.isComplete() && deckLegal;
    joinBtn.toggleAttribute('disabled', !ok);
    if (errEl && ok) errEl.textContent = '';
  }
  refreshJoin();

  joinBtn.addEventListener('click', async () => {
    if (joinBtn.hasAttribute('disabled')) return;
    errEl.textContent = '';
    joinBtn.setAttribute('disabled', 'disabled');
    try {
      // The battle plays from the active slot server-side — flush the last edit first.
      if (slotBar) await slotBar.flush();
      const res = await fetch('/games/tcg/' + encodeURIComponent(MATCH) + '/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        errEl.textContent = (data && data.error) ? data.error : 'Failed to join.';
        refreshJoin();
        return;
      }
      window.location.href = '/games/tcg/' + encodeURIComponent(MATCH);
    } catch (e) {
      errEl.textContent = 'Network error.';
      refreshJoin();
    }
  });
})();
