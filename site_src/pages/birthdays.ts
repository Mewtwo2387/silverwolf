import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import { MONTHS, type BirthdayUser } from '../bot-bridge';

const birthdayExtras = raw(`
<style>
  @keyframes month-glow {
    from { box-shadow: 0 0 6px 1px var(--glow-faint), 0 0 0 1px var(--accent); }
    to   { box-shadow: 0 0 18px 4px var(--glow-bright), 0 0 0 1px var(--accent-light); }
  }
  
  .month-card {
    position: relative;
    background: rgba(10, 14, 28, 0.45);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.25rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: border-color 0.3s, box-shadow 0.3s;
    overflow: hidden;
  }
  .month-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 4px; height: 100%;
    background: var(--ink-600);
  }
  .month-card:hover {
    border-color: rgba(34, 211, 255, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 10px rgba(34, 211, 255, 0.05);
  }
  .month-card.month-current {
    border-color: var(--accent) !important;
    animation: month-glow 2s ease-in-out infinite alternate;
  }
  .month-card.month-current::before {
    background: var(--accent);
  }
  
  /* Circuit Nodes aesthetic on the month card */
  .month-node-dot {
    position: absolute;
    width: 6px;
    height: 6px;
    background: var(--ink-600);
    border-radius: 50%;
    z-index: 2;
  }
  .month-card.month-current .month-node-dot {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
  }
  .month-node-dot.top-left { top: 8px; left: -1px; }
  .month-node-dot.bottom-left { bottom: 8px; left: -1px; }

  .bday-user {
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  .bday-user:hover {
    transform: translateY(-1px);
    border-color: var(--accent) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 8px var(--glow-faint);
  }
  .bday-user:active {
    transform: translateY(0);
  }

  .bday-user-upcoming {
    border-color: var(--danger) !important;
    box-shadow: 0 0 8px 2px var(--danger-glow);
  }
  .upcoming-tag {
    position: absolute;
    bottom: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--danger);
    color: var(--ink-900);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
    line-height: 1.5;
  }

  /* ── Hover tooltip ─────────────────────────────────────────────────────── */
  .bday-user::after {
    content: attr(data-next);
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink-700);
    color: var(--fog-200);
    border: 1px solid var(--ink-500);
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 5px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  .bday-user:hover::after {
    opacity: 1;
  }

  /* ── Birthday modal (Holographic Transmitter Theme) ────────────────────── */
  #bday-modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(4, 6, 13, 0.75);
    backdrop-filter: blur(8px) saturate(180%);
    -webkit-backdrop-filter: blur(8px) saturate(180%);
  }
  #bday-modal {
    position: relative;
    width: 100%;
    max-width: 24rem;
    background: rgba(10, 14, 28, 0.75);
    border: 1px solid var(--accent);
    border-radius: 1rem;
    padding: 1.75rem;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 
      0 24px 64px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 30px var(--glow-faint);
    overflow: hidden;
  }
  #bday-modal::before {
    content: '// HOLO_TRANSMITTER_ACTIVE';
    position: absolute;
    top: 0; left: 0; right: 0;
    background: linear-gradient(90deg, rgba(34, 211, 255, 0.1), transparent);
    border-bottom: 1px solid rgba(34, 211, 255, 0.2);
    padding: 6px 1.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--accent);
    letter-spacing: 0.08em;
  }
  #bday-modal-close {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    background: transparent;
    border: none;
    color: var(--danger);
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(255, 107, 138, 0.2);
    background: rgba(255, 107, 138, 0.05);
  }
  #bday-modal-close:hover { 
    color: #ffffff; 
    background: var(--danger); 
    border-color: var(--danger);
    box-shadow: 0 0 10px rgba(255, 107, 138, 0.5);
  }
  #bday-modal-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.25rem;
    padding-top: 1.2rem;
  }
  #bday-modal-avatar {
    flex-shrink: 0;
    width: 5.5rem;
    height: 5.5rem;
    border-radius: 50%;
    overflow: hidden;
    background: var(--ink-900);
    border: 3px solid var(--accent);
    box-shadow: 
      0 0 20px var(--glow-bright),
      inset 0 0 8px rgba(0,0,0,0.8);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  #bday-modal:hover #bday-modal-avatar {
    transform: scale(1.05) rotate(5deg);
  }
  #bday-modal-avatar img { width: 100%; height: 100%; object-fit: cover; }
  #bday-modal-text { 
    width: 100%; 
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  #bday-modal-name {
    color: #ffffff;
    font-weight: 800;
    font-size: 1.5rem;
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin: 0;
  }
  #bday-modal-when {
    color: var(--accent-light);
    font-size: 1rem;
    font-weight: 500;
    margin: 0;
    line-height: 1.3;
    text-transform: uppercase;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.02em;
  }
  #bday-modal-date {
    color: var(--fog-300);
    font-size: 0.8rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin: 0;
    line-height: 1.5;
    background: rgba(6, 8, 15, 0.55);
    border: 1px solid var(--ink-600);
    padding: 4px 10px;
    border-radius: 6px;
    display: inline-block;
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
  }
</style>
`);

function daysUntil(nextBirthday: string): number {
  if (nextBirthday.startsWith('Today')) return 0;
  if (nextBirthday.startsWith('Tomorrow')) return 1;
  const m = nextBirthday.match(/\(in (\d+) days\)/);
  return m ? parseInt(m[1], 10) : Infinity;
}

function renderUser(u: BirthdayUser, upcoming = false) {
  const avatar = u.avatarURL
    ? html`<img src="${u.avatarURL}" alt="" class="w-[22px] h-[22px] rounded-full object-cover bg-ink-500 shrink-0" />`
    : html`<div class="w-[22px] h-[22px] rounded-full bg-ink-500 shrink-0"></div>`;
  const upcomingClass = upcoming ? ' bday-user-upcoming' : '';
  const upcomingBadge = upcoming
    ? html`<span class="upcoming-tag">Upcoming!</span>`
    : '';
  return html`
    <span
      class="bday-user${upcomingClass} relative inline-flex items-center gap-[0.4rem] pl-1 pr-[0.6rem] py-[0.2rem] bg-ink-700 border border-ink-600 rounded-full text-[0.85rem] cursor-pointer select-none transition-colors hover:border-ink-500"
      data-username="${u.username}"
      data-avatar="${u.avatarURL ?? ''}"
      data-next="${u.nextBirthday}"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
    >
      ${upcomingBadge}${avatar}<span>${u.username}</span>
    </span>
  `;
}

// Server-rendered modal shell — always hidden via CSS until JS opens it
const birthdayModal = raw(`
<div id="bday-modal-backdrop" role="presentation">
  <div id="bday-modal" role="dialog" aria-modal="true" aria-labelledby="bday-modal-name">
    <button id="bday-modal-close" aria-label="Close">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"
           fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
      </svg>
    </button>
    <div id="bday-modal-body">
      <div id="bday-modal-avatar"></div>
      <div id="bday-modal-text">
        <p id="bday-modal-name"></p>
        <p id="bday-modal-when"></p>
        <p id="bday-modal-date"></p>
      </div>
    </div>
  </div>
</div>
`);

const birthdayModalScript = (nonce: string) => raw(`
<script nonce="${nonce}">
(() => {
  const backdrop = document.getElementById('bday-modal-backdrop');
  const modal    = document.getElementById('bday-modal');
  const closeBtn = document.getElementById('bday-modal-close');
  const avatarEl = document.getElementById('bday-modal-avatar');
  const nameEl   = document.getElementById('bday-modal-name');
  const whenEl   = document.getElementById('bday-modal-when');
  const dateEl   = document.getElementById('bday-modal-date');
  if (!backdrop || !modal || !closeBtn) return;

  // Move modal to <body> so it escapes any stacking context inside <main>
  document.body.appendChild(backdrop);

  let closeTimer = null;

  function openModal(el) {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

    const username = el.dataset.username || '';
    const avatar   = el.dataset.avatar   || '';
    const next     = el.dataset.next     || '';

    // Parse the nextBirthday string from bot-bridge into (when, date) parts
    var when = '', date = '';
    if (next.startsWith('Today')) {
      when = 'birthday is today!';
      var sep = next.indexOf(' \u2014 ');
      date = sep >= 0 ? next.slice(sep + 3) : next;
    } else if (next.startsWith('Tomorrow')) {
      when = 'birthday is tomorrow';
      var sep2 = next.indexOf(' \u2014 ');
      date = sep2 >= 0 ? next.slice(sep2 + 3) : next;
    } else {
      var dm = next.match(/\\(in (\\d+) days\\)/);
      var days = dm ? dm[1] : '?';
      when = 'birthday is in ' + days + (days === '1' ? ' day' : ' days');
      date = next.replace(/\\s*\\(in \\d+ days\\)$/, '');
    }

    nameEl.textContent  = username + '\u2019s';
    whenEl.textContent  = when;
    dateEl.textContent  = '\u0040 ' + date;

    avatarEl.innerHTML = '';
    if (avatar) {
      var img = document.createElement('img');
      img.src = avatar; img.alt = '';
      avatarEl.appendChild(img);
    }

    // Animate in
    modal.style.transition = 'none';
    modal.style.transform  = 'scale(0.94) translateY(8px)';
    modal.style.opacity    = '0';
    backdrop.style.display = 'flex';
    backdrop.classList.add('open');

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        modal.style.transition = 'transform 0.22s cubic-bezier(0.22,1,0.36,1), opacity 0.18s ease';
        modal.style.transform  = 'scale(1) translateY(0)';
        modal.style.opacity    = '1';
      });
    });

    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    if (closeTimer) return;
    if (!backdrop.classList.contains('open')) return;
    backdrop.classList.remove('open');
    modal.style.transition = 'transform 0.15s cubic-bezier(0.4,0,1,1), opacity 0.15s ease';
    modal.style.transform  = 'scale(0.94) translateY(6px)';
    modal.style.opacity    = '0';
    closeTimer = setTimeout(function() {
      backdrop.style.display       = 'none';
      modal.style.transition       = 'none';
      modal.style.transform        = '';
      modal.style.opacity          = '';
      document.body.style.overflow = '';
      closeTimer = null;
    }, 160);
  }

  // Pill clicks (delegated)
  document.addEventListener('click', function(e) {
    var pill = e.target.closest('.bday-user');
    if (pill) { openModal(pill); return; }
    if (e.target === backdrop) closeModal();
  });

  closeBtn.addEventListener('click', closeModal);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) { closeModal(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      var pill = document.activeElement && document.activeElement.closest('.bday-user');
      if (pill) { e.preventDefault(); openModal(pill); }
    }
  });
})();
</script>
`);

export function BirthdaysPage(opts: {
  grouped: Record<string, BirthdayUser[]>;
  error?: string;
  nonce: string;
  lv999?: boolean;
  user?: import('../components/navbar').NavUser | null;
}) {
  const {
    grouped, error, nonce, lv999, user,
  } = opts;

  const currentMonth = MONTHS[new Date().getUTCMonth()];

  const allUsers = MONTHS.flatMap((m) => grouped[m] ?? []);
  let minDays = Infinity;
  const userDays = new Map<string, number>();
  for (const u of allUsers) {
    const d = daysUntil(u.nextBirthday);
    userDays.set(u.id, d);
    if (d < minDays) minDays = d;
  }
  const upcomingIds = new Set<string>();
  if (Number.isFinite(minDays)) {
    for (const [id, d] of userDays) if (d === minDays) upcomingIds.add(id);
  }

  const body = error
    ? html`
        <h1 class="text-center">Birthdays</h1>
        <p class="text-danger text-center font-mono my-8">${error}</p>
      `
    : html`
        <h1 class="text-center">Birthdays</h1>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 mt-6">
          ${MONTHS.map((month) => {
            const users = grouped[month] ?? [];
            const isCurrent = month === currentMonth;
            return html`
              <section class="${`month-card ${isCurrent ? 'month-current' : ''}`}">
                <div class="month-node-dot top-left"></div>
                <div class="month-node-dot bottom-left"></div>
                <h3 class="text-accent-light font-mono text-sm tracking-wider uppercase mb-1">// ${month}</h3>
                ${users.length === 0
                  ? html`<div class="text-fog-500 text-[0.85rem] font-mono mt-2">&gt; NO RECORDED BIRTHDAYS</div>`
                  : html`<div class="flex flex-wrap gap-[0.45rem] pt-3">${users.map((u) => renderUser(u, upcomingIds.has(u.id)))}</div>`}
              </section>
            `;
          })}
        </div>
        ${birthdayModal}
        ${birthdayModalScript(nonce)}
      `;

  return Layout({
    title: 'Silverwolf — Birthdays',
    active: 'birthdays',
    extraHead: birthdayExtras as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
    nonce,
    lv999,
    user,
  });
}
