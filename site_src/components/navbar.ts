import { html, raw } from 'hono/html';

const navbarExtras = raw(`
<style>
  .nav-link.active { border-bottom-color: #6d7cff; }
  .nav-links.js-ready .nav-link.active { border-bottom-color: transparent; }
</style>
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
  const base = 'nav-link text-[0.95rem] px-[0.1rem] py-1 border-b-2 border-transparent transition-colors no-underline';
  const link = (href: string, label: string, key: string) => {
    const isActive = active === key;
    const state = isActive ? 'text-white active' : 'text-fog-200 hover:text-white';
    return html`<a href="${href}" class="${base} ${state}">${label}</a>`;
  };

  return html`
    <nav class="flex items-center justify-between py-[0.9rem] px-[clamp(1rem,4vw,3rem)] border-b border-ink-600 bg-ink-800">
      <div class="font-bold tracking-[0.02em]">Silverwolf</div>
      <div class="nav-links flex gap-5 relative" id="nav-links">
        ${link('/about', 'About', 'about')}
        ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
        ${link('/birthdays', 'Birthdays', 'birthdays')}
        <span class="nav-underline absolute left-0 h-[2px] w-0 bg-accent rounded-sm opacity-0 pointer-events-none" style="bottom:-2px;" aria-hidden="true"></span>
      </div>
    </nav>
    ${navbarExtras}
  `;
}
