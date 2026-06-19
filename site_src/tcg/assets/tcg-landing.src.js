import { setupTeamPicker } from './tcg-team-picker.lib.js';

(() => {
  const dataEl = document.getElementById('tcg-landing-data');
  if (!dataEl) return;
  let ctx;
  try { ctx = JSON.parse(dataEl.textContent); } catch { return; }

  const CSRF = ctx.csrf || '';
  const DEFAULTS = ctx.defaults || [];
  const DECK_LEGAL = !!ctx.deckLegal;
  let mode = 'pvp';

  const modesEl = document.getElementById('tcg-modes');
  const createBtn = document.getElementById('tcg-create');
  const errEl = document.getElementById('tcg-err');
  if (!createBtn) return;

  // Declared with `let` (not `const`) so refreshCreate — which setupTeamPicker
  // invokes synchronously via onChange during construction — can read `picker`
  // without hitting the temporal dead zone.
  let picker = null;
  picker = setupTeamPicker({ defaults: DEFAULTS, onChange: refreshCreate });

  function refreshCreate() {
    const ok = !!picker && picker.isComplete() && DECK_LEGAL;
    createBtn.toggleAttribute('disabled', !ok);
    if (errEl && ok) errEl.textContent = '';
  }
  refreshCreate();

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
    const team = picker ? picker.getTeam() : [];
    if (team.length !== 3) { errEl.textContent = 'Pick three characters.'; return; }
    createBtn.setAttribute('disabled', 'disabled');
    try {
      const res = await fetch('/games/tcg/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, mode, team }),
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
