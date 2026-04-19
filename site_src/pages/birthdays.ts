import { html } from 'hono/html';
import { Layout } from '../components/layout';
import { MONTHS, type BirthdayUser } from '../bot-bridge';

export function BirthdaysPage(opts: {
  grouped: Record<string, BirthdayUser[]>;
  error?: string;
}) {
  const { grouped, error } = opts;

  const body = error
    ? html`<h1 style="text-align:center;">Birthdays</h1><p style="color:#f87171; text-align:center;">${error}</p>`
    : html`
        <h1 style="text-align:center;">Birthdays</h1>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.5rem; margin-top:1.5rem;">
          ${MONTHS.map((month) => {
    const users = grouped[month] ?? [];
    return html`
              <section style="background:#14151b; border:1px solid #22232b; border-radius:6px; padding:0.9rem 1rem;">
                <h3 style="margin:0 0 0.5rem; color:#8fa1ff;">${month}</h3>
                ${users.length === 0
    ? html`<div style="color:#5a5b63; font-size:0.85rem;">no birthdays</div>`
    : html`<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.85rem; word-break:break-word;">${users.map(u => u.username).join(', ')}</div>`}
              </section>
            `;
  })}
        </div>
      `;

  return Layout({ title: 'Silverwolf — Birthdays', active: 'birthdays', body });
}
