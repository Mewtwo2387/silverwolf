import { html } from 'hono/html';

export function Navbar(active?: 'about' | 'leaderboards' | 'birthdays') {
  const link = (href: string, label: string, key: string) => html`
    <a href="${href}" class="nav-link ${active === key ? 'active' : ''}">${label}</a>
  `;

  return html`
    <nav class="navbar">
      <div class="nav-brand">Silverwolf</div>
      <div class="nav-links">
        ${link('/about', 'About', 'about')}
        ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
        ${link('/birthdays', 'Birthdays', 'birthdays')}
      </div>
    </nav>
  `;
}
