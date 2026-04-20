import { html, raw } from 'hono/html';

const navbarScript = raw(`
<script>
(() => {
  const container = document.getElementById('nav-links');
  if (!container) return;
  const underline = container.querySelector('.nav-underline');
  const links = Array.from(container.querySelectorAll('.nav-link'));
  if (!underline || !links.length) return;

  container.classList.add('js-ready');

  const place = (el, animate) => {
    const cRect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    underline.style.transition = animate
      ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';
    underline.style.width = r.width + 'px';
    underline.style.transform = 'translateX(' + (r.left - cRect.left) + 'px)';
    underline.style.opacity = '1';
  };

  const activeLink = links.find((l) => l.classList.contains('active'));
  if (activeLink) requestAnimationFrame(() => place(activeLink, false));

  links.forEach((l) => {
    l.addEventListener('click', (e) => {
      if (l.classList.contains('active')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      place(l, true);
      setTimeout(() => { window.location.href = l.href; }, 240);
    });
  });

  window.addEventListener('resize', () => {
    const current = links.find((x) => x.classList.contains('active'));
    if (current) place(current, false);
  });
})();
</script>
`);

export function Navbar(active?: 'about' | 'leaderboards' | 'birthdays') {
  const link = (href: string, label: string, key: string) => html`
    <a href="${href}" class="nav-link ${active === key ? 'active' : ''}">${label}</a>
  `;

  return html`
    <nav class="navbar">
      <div class="nav-brand">Silverwolf</div>
      <div class="nav-links" id="nav-links">
        ${link('/about', 'About', 'about')}
        ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
        ${link('/birthdays', 'Birthdays', 'birthdays')}
        <span class="nav-underline" aria-hidden="true"></span>
      </div>
    </nav>
    ${navbarScript}
  `;
}
