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
    background: #0f1014;
    border: 1px solid #2a2b33;
    color: #e6e6e9;
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
    border-top-color: #2a2b33;
    z-index: 10;
    pointer-events: none;
  }
</style>
`);

function renderUser(u: BirthdayUser) {
  const avatar = u.avatarURL
    ? html`<img src="${u.avatarURL}" alt="" class="w-[22px] h-[22px] rounded-full object-cover bg-ink-500 shrink-0" />`
    : html`<div class="w-[22px] h-[22px] rounded-full bg-ink-500 shrink-0"></div>`;
  return html`
    <span
      class="bday-user relative inline-flex items-center gap-[0.4rem] pl-1 pr-[0.6rem] py-[0.2rem] bg-ink-700 border border-ink-600 rounded-full text-[0.85rem] cursor-default"
      data-next="Next birthday: ${u.nextBirthday}"
    >
      ${avatar}<span>${u.username}</span>
    </span>
  `;
}

export function BirthdaysPage(opts: {
  grouped: Record<string, BirthdayUser[]>;
  error?: string;
}) {
  const { grouped, error } = opts;

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
    return html`
              <section class="bg-ink-800 border border-ink-600 rounded-md py-[0.9rem] px-4">
                <h3 class="text-accent-light">${month}</h3>
                ${users.length === 0
    ? html`<div class="text-fog-500 text-[0.85rem]">no birthdays</div>`
    : html`<div class="flex flex-wrap gap-[0.45rem]">${users.map(renderUser)}</div>`}
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
