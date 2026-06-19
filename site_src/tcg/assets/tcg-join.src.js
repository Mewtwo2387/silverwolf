import { setupTeamPicker } from './tcg-team-picker.lib.js';

(() => {
  const dataEl = document.getElementById('tcg-join-data');
  if (!dataEl) return;
  let ctx;
  try { ctx = JSON.parse(dataEl.textContent); } catch { return; }

  const CSRF = ctx.csrf || '';
  const MATCH = ctx.matchId || '';
  const DEFAULTS = ctx.defaults || [];
  const DECK_LEGAL = !!ctx.deckLegal;
  const joinBtn = document.getElementById('tcg-join');
  const errEl = document.getElementById('tcg-join-err');
  if (!joinBtn) return;

  // `let` (not `const`): setupTeamPicker calls refreshJoin synchronously via
  // onChange during construction, so `picker` must not be in the dead zone.
  let picker = null;
  picker = setupTeamPicker({ defaults: DEFAULTS, onChange: refreshJoin });

  function refreshJoin() {
    const ok = !!picker && picker.isComplete() && DECK_LEGAL;
    joinBtn.toggleAttribute('disabled', !ok);
    if (errEl && ok) errEl.textContent = '';
  }
  refreshJoin();

  joinBtn.addEventListener('click', async () => {
    if (joinBtn.hasAttribute('disabled')) return;
    errEl.textContent = '';
    const team = picker ? picker.getTeam() : [];
    if (team.length !== 3) { errEl.textContent = 'Pick three characters.'; return; }
    joinBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/tcg/' + encodeURIComponent(MATCH) + '/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, team }),
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
