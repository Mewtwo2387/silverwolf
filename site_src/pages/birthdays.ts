import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import { MONTHS, type BirthdayUser } from '../bot-bridge';

const birthdayStyles = html`
  <style>
    .bday-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .bday-card {
      background: #14151b;
      border: 1px solid #22232b;
      border-radius: 6px;
      padding: 0.9rem 1rem;
    }
    .bday-card h3 { margin: 0 0 0.6rem; color: #8fa1ff; }
    .bday-empty { color: #5a5b63; font-size: 0.85rem; }
    .bday-users { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .bday-user {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem 0.2rem 0.25rem;
      background: #1a1b23;
      border: 1px solid #22232b;
      border-radius: 999px;
      font-size: 0.85rem;
      cursor: default;
    }
    .bday-user img,
    .bday-user .bday-avatar-fallback {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
      background: #2a2b33;
      flex-shrink: 0;
    }
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
`;

function renderUser(u: BirthdayUser) {
  const avatar = u.avatarURL
    ? html`<img src="${u.avatarURL}" alt="" />`
    : html`<div class="bday-avatar-fallback"></div>`;
  return html`
    <span class="bday-user" data-next="Next birthday: ${u.nextBirthday}">
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
    ? html`<h1 style="text-align:center;">Birthdays</h1><p style="color:#f87171; text-align:center;">${error}</p>`
    : html`
        <h1 style="text-align:center;">Birthdays</h1>
        <div class="bday-grid">
          ${MONTHS.map((month) => {
    const users = grouped[month] ?? [];
    return html`
              <section class="bday-card">
                <h3>${month}</h3>
                ${users.length === 0
    ? html`<div class="bday-empty">no birthdays</div>`
    : html`<div class="bday-users">${users.map(renderUser)}</div>`}
              </section>
            `;
  })}
        </div>
      `;

  return Layout({
    title: 'Silverwolf — Birthdays',
    active: 'birthdays',
    extraStyles: birthdayStyles as HtmlEscapedString,
    body: body as HtmlEscapedString,
  });
}
