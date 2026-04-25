import { html, raw } from 'hono/html';

const STICKER_IMAGES = [
  '/static/stickers/Sticker_PPG_04_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_19_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_02_Silver_Wolf_01.webp',
  '/static/stickers/Sticker_PPG_04_Silver_Wolf_02.webp',
];

const STICKER_IMAGES_LV999 = [
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_01.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_02.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_03.webp',
  '/static/stickers/Sticker_PPG_27_Silver_Wolf_LV.999_04.webp',
];

const navbarExtras = (nonce: string) => raw(`
<style>
  /* Responsive nav — defined in CSS to avoid Tailwind scan dependency */
  #nav-links  { display: none; }
  #nav-toggle { display: flex;  flex-direction: column; justify-content: center; }
  #nav-mobile { display: none; }
  @media (min-width: 640px) {
    #nav-links  { display: flex; }
    #nav-toggle { display: none; }
  }

  .nav-link.active { border-bottom-color: var(--accent); }
  .nav-links.js-ready .nav-link.active { border-bottom-color: transparent; }

  /* Desktop nav link spacing */
  #nav-links { gap: 1.75rem; }

  /* Hamburger bars */
  .ham-top, .ham-mid, .ham-bot {
    display: block;
    width: 1.5rem;
    height: 2px;
    background: var(--fog-200);
    border-radius: 9999px;
    transition: transform 0.2s, opacity 0.2s;
    transform-origin: center;
  }
  #nav-toggle { gap: 5px; }

  /* Hamburger → × animation */
  #nav-toggle[aria-expanded="true"] .ham-top { transform: translateY(7px) rotate(45deg); }
  #nav-toggle[aria-expanded="true"] .ham-mid { opacity: 0; transform: scaleX(0); }
  #nav-toggle[aria-expanded="true"] .ham-bot { transform: translateY(-7px) rotate(-45deg); }
</style>
<script nonce="${nonce}">
(() => {
  // ── Desktop sliding underline ──────────────────────────────────────────────
  const container = document.getElementById('nav-links');
  if (container) {
    const underline = container.querySelector('.nav-underline');
    const links = Array.from(container.querySelectorAll('.nav-link'));
    if (underline && links.length) {
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

      const theme = new URLSearchParams(location.search).get('theme');
      if (theme) {
        links.forEach((l) => {
          const u = new URL(l.href);
          u.searchParams.set('theme', theme);
          l.href = u.toString();
        });
      }
    }
  }

  // ── Mobile hamburger toggle ────────────────────────────────────────────────
  const toggle  = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('nav-mobile');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      mobileNav.style.display = isOpen ? 'none' : 'flex';
    });

    // Auto-close drawer when resizing to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 640) {
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.style.display = 'none';
      }
    });
  }
})();
</script>
`);

export function Navbar(active: 'about' | 'leaderboards' | 'birthdays' | 'games' | undefined, nonce: string, lv999?: boolean) {
  const base = 'nav-link text-[0.95rem] px-[0.1rem] py-1 border-b-2 border-transparent transition-colors no-underline';
  const link = (href: string, label: string, key: string) => {
    const isActive = active === key;
    const state = isActive ? 'text-fog-100 active' : 'text-fog-200 hover:text-fog-100';
    return html`<a href="${href}" class="${base} ${state}">${label}</a>`;
  };

  const mobileBase = 'nav-link block text-[1rem] px-3 py-3 border-b-2 border-transparent rounded transition-colors no-underline';
  const mobileLink = (href: string, label: string, key: string) => {
    const isActive = active === key;
    const state = isActive
      ? 'text-fog-100 active bg-ink-700'
      : 'text-fog-200 hover:text-fog-100 hover:bg-ink-700';
    return html`<a href="${href}" class="${mobileBase} ${state}">${label}</a>`;
  };

  const pool = lv999 ? STICKER_IMAGES_LV999 : STICKER_IMAGES;
  const sticker = pool[Math.floor(Math.random() * pool.length)];

  return html`
    <nav id="site-nav" class="flex items-center justify-between py-[0.9rem] px-[clamp(1rem,4vw,3rem)] border-b border-ink-600 bg-ink-800">
      <img src="${sticker}" alt="Silverwolf" width="48" height="48" style="height:3rem;width:auto;" decoding="async" />

      <!-- Desktop nav — display controlled by CSS above, not Tailwind classes -->
      <div class="nav-links relative" id="nav-links">
        ${link('/about', 'About', 'about')}
        ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
        ${link('/birthdays', 'Birthdays', 'birthdays')}
        ${link('/games', 'Games', 'games')}
        <span class="nav-underline absolute left-0 h-[2px] w-0 bg-accent rounded-sm opacity-0 pointer-events-none" style="bottom:-2px;" aria-hidden="true"></span>
      </div>

      <!-- Hamburger — display controlled by CSS above -->
      <button
        id="nav-toggle"
        class="gap-[5px] p-1 -mr-1 cursor-pointer bg-transparent border-0"
        aria-label="Toggle navigation"
        aria-expanded="false"
        aria-controls="nav-mobile"
      >
        <span class="ham-top block w-6 h-[2px] bg-fog-200 rounded-full transition-all duration-200 origin-center"></span>
        <span class="ham-mid block w-6 h-[2px] bg-fog-200 rounded-full transition-all duration-200"></span>
        <span class="ham-bot block w-6 h-[2px] bg-fog-200 rounded-full transition-all duration-200 origin-center"></span>
      </button>
    </nav>

    <!-- Mobile drawer — display controlled by JS -->
    <div id="nav-mobile" class="flex-col bg-ink-800 border-b border-ink-600 px-[clamp(0.75rem,3vw,2rem)] py-2" role="navigation" aria-label="Mobile navigation">
      ${mobileLink('/about', 'About', 'about')}
      ${mobileLink('/leaderboards', 'Leaderboards', 'leaderboards')}
      ${mobileLink('/birthdays', 'Birthdays', 'birthdays')}
      ${mobileLink('/games', 'Games', 'games')}
    </div>

    ${navbarExtras(nonce)}
  `;
}
