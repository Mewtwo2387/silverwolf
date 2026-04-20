import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import { MONTHS, type BirthdayUser } from '../bot-bridge';

const birthdayExtras = raw(`
<style>
  .bday-user[data-next]:hover::after {
    content: attr(data-next);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink-900);
    border: 1px solid var(--ink-500);
    color: var(--fog-100);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    white-space: nowrap;
    font-size: 0.75rem;
    z-index: 10;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .bday-user[data-next]:hover::before {
    content: '';
    position: absolute;
    bottom: calc(100% + 1px);
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--ink-500);
    z-index: 10;
    pointer-events: none;
  }
  @keyframes month-glow {
    from { box-shadow: 0 0 6px 1px var(--glow-faint), 0 0 0 1px var(--accent); }
    to   { box-shadow: 0 0 18px 4px var(--glow-bright), 0 0 0 1px var(--accent-light); }
  }
  .month-current {
    border-color: var(--accent) !important;
    animation: month-glow 2s ease-in-out infinite alternate;
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
      class="bday-user${upcomingClass} relative inline-flex items-center gap-[0.4rem] pl-1 pr-[0.6rem] py-[0.2rem] bg-ink-700 border border-ink-600 rounded-full text-[0.85rem] cursor-default"
      data-next="Next birthday: ${u.nextBirthday}"
    >
      ${upcomingBadge}${avatar}<span>${u.username}</span>
    </span>
  `;
}

export function BirthdaysPage(opts: {
  grouped: Record<string, BirthdayUser[]>;
  error?: string;
}) {
  const { grouped, error } = opts;

  const currentMonth = MONTHS[new Date().getUTCMonth()];

  const allUsers = MONTHS.flatMap((m) => grouped[m] ?? []);
  const minDays = Math.min(...allUsers.map((u) => daysUntil(u.nextBirthday)));
  const upcomingDay = isFinite(minDays) ? minDays : null;
  const upcomingIds = upcomingDay !== null
    ? new Set(allUsers.filter((u) => daysUntil(u.nextBirthday) === upcomingDay).map((u) => u.id))
    : new Set<string>();

  const body = error
    ? html`
        <h1 class="text-center">Birthdays</h1>
        <p class="text-danger text-center">${error}</p>
      `
    : html`
        <h1 class="text-center">Birthdays</h1>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 mt-6">
          ${MONTHS.map((month) => {
    const users = grouped[month] ?? [];
    const isCurrent = month === currentMonth;
    return html`
              <section class="${`bg-ink-800 border border-ink-600 rounded-md py-[0.9rem] px-4${isCurrent ? ' month-current' : ''}`}">
                <h3 class="text-accent-light">${month}</h3>
                ${users.length === 0
    ? html`<div class="text-fog-500 text-[0.85rem]">no birthdays</div>`
    : html`<div class="flex flex-wrap gap-[0.45rem] pt-[1.2rem]">${users.map((u) => renderUser(u, upcomingIds.has(u.id)))}</div>`}
              </section>
            `;
  })}
        </div>
      `;

  return Layout({
    title: 'Silverwolf — Birthdays',
    active: 'birthdays',
    extraStyles: birthdayExtras as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
  });
}
