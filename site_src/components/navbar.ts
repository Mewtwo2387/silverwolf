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

// Inline SVG icons — fill/stroke set to currentColor so they inherit the
// link's themed text color via CSS variables.
const ICON_ABOUT = raw(
  '<svg viewBox="0 0 512 512" fill="currentColor" fill-rule="evenodd" aria-hidden="true">'
    + '<g transform="translate(42.666667, 42.666667)">'
    + '<path d="M213.333333,3.55271368e-14 C95.51296,3.55271368e-14 3.55271368e-14,95.51168 3.55271368e-14,213.333333 C3.55271368e-14,331.153707 95.51296,426.666667 213.333333,426.666667 C331.154987,426.666667 426.666667,331.153707 426.666667,213.333333 C426.666667,95.51168 331.154987,3.55271368e-14 213.333333,3.55271368e-14 Z M213.333333,384 C119.227947,384 42.6666667,307.43872 42.6666667,213.333333 C42.6666667,119.227947 119.227947,42.6666667 213.333333,42.6666667 C307.44,42.6666667 384,119.227947 384,213.333333 C384,307.43872 307.44,384 213.333333,384 Z M240.04672,128 C240.04672,143.46752 228.785067,154.666667 213.55008,154.666667 C197.698773,154.666667 186.713387,143.46752 186.713387,127.704107 C186.713387,112.5536 197.99616,101.333333 213.55008,101.333333 C228.785067,101.333333 240.04672,112.5536 240.04672,128 Z M192.04672,192 L234.713387,192 L234.713387,320 L192.04672,320 L192.04672,192 Z"/>'
    + '</g></svg>',
);

const ICON_LEADERBOARD = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M15 21H9V12.6C9 12.2686 9.26863 12 9.6 12H14.4C14.7314 12 15 12.2686 15 12.6V21Z"/>'
    + '<path d="M20.4 21H15V18.1C15 17.7686 15.2686 17.5 15.6 17.5H20.4C20.7314 17.5 21 17.7686 21 18.1V20.4C21 20.7314 20.7314 21 20.4 21Z"/>'
    + '<path d="M9 21V16.1C9 15.7686 8.73137 15.5 8.4 15.5H3.6C3.26863 15.5 3 15.7686 3 16.1V20.4C3 20.7314 3.26863 21 3.6 21H9Z"/>'
    + '<path d="M10.8056 5.11325L11.7147 3.1856C11.8314 2.93813 12.1686 2.93813 12.2853 3.1856L13.1944 5.11325L15.2275 5.42427C15.4884 5.46418 15.5923 5.79977 15.4035 5.99229L13.9326 7.4917L14.2797 9.60999C14.3243 9.88202 14.0515 10.0895 13.8181 9.96099L12 8.96031L10.1819 9.96099C9.94851 10.0895 9.67568 9.88202 9.72026 9.60999L10.0674 7.4917L8.59651 5.99229C8.40766 5.79977 8.51163 5.46418 8.77248 5.42427L10.8056 5.11325Z"/>'
    + '</svg>',
);

const ICON_BIRTHDAY = raw(
  '<svg viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">'
    + '<path d="M25 0.09375L24.21875 1.09375C23.515625 1.992188 20 6.578125 20 9C20 11.414063 21.722656 13.441406 24 13.90625L24 10C24 9.449219 24.449219 9 25 9C25.550781 9 26 9.449219 26 10L26 13.90625C28.277344 13.441406 30 11.414063 30 9C30 6.578125 26.484375 1.992188 25.78125 1.09375 Z M 23 15C21.347656 15 20 16.347656 20 18L20 26L30 26L30 18C30 16.347656 28.652344 15 27 15 Z M 11 28C8.179688 28 5.761719 29.683594 4.65625 32.09375C5.226563 33.597656 5.804688 34.398438 5.8125 34.40625C6.703125 35.59375 8.390625 37 11.40625 37C13.863281 37 15.6875 36.15625 17 34.40625L17.75 33.375L18.5625 34.375C20.042969 36.152344 22.152344 37 25 37C27.769531 37 30 36.101563 31.4375 34.375L32.25 33.375L33 34.40625C34.3125 36.15625 36.136719 37 38.59375 37C41.050781 37 42.875 36.15625 44.1875 34.40625C44.214844 34.371094 44.964844 33.414063 45.375 32.125C44.277344 29.691406 41.839844 28 39 28 Z M 4 35.3125L4 42L46 42L46 35.34375C45.875 35.523438 45.792969 35.609375 45.78125 35.625C44.113281 37.847656 41.679688 39 38.59375 39C35.941406 39 33.785156 38.167969 32.15625 36.5C30.753906 37.785156 28.5 39 25 39C22.039063 39 19.640625 38.164063 17.84375 36.5C16.214844 38.164063 14.054688 39 11.40625 39C7.5625 39 5.351563 37.144531 4.1875 35.59375C4.175781 35.578125 4.113281 35.484375 4 35.3125 Z M 0 44L0 45C0 50 4.890625 50 6.5 50L43.5 50C45.105469 50 50 50 50 45L50 44Z"/>'
    + '</svg>',
);

const ICON_GAMES = raw(
  '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">'
    + '<path d="M15.9 5.5C15.3 4.5 14.2 4 13 4H7c-1.2 0-2.3.5-2.9 1.5-2.3 3.5-2.8 8.8-1.2 9.9 1.6 1.1 5.2-3.7 7.1-3.7s5.4 4.8 7.1 3.7c1.6-1.1 1.1-6.4-1.2-9.9zM8 9H7v1H6V9H5V8h1V7h1v1h1v1zm5.4.5c0 .5-.4.9-.9.9s-.9-.4-.9-.9.4-.9.9-.9.9.4.9.9zm1.9-2c0 .5-.4.9-.9.9s-.9-.4-.9-.9.4-.9.9-.9.9.4.9.9z"/>'
    + '</svg>',
);

const ICONS: Record<string, ReturnType<typeof raw>> = {
  about: ICON_ABOUT,
  leaderboards: ICON_LEADERBOARD,
  birthdays: ICON_BIRTHDAY,
  games: ICON_GAMES,
};

const navbarExtras = (nonce: string) => raw(`
<style>
  /* Default (desktop / non-touch): top links visible, mobile dock hidden. */
  #nav-links  { display: flex; }
  #nav-mobile { display: none; }

  .nav-link.active { border-bottom-color: var(--accent); }
  .nav-links.js-ready .nav-link.active { border-bottom-color: transparent; }

  /* Caisena gradient nav surfaces — theme-aware via CSS vars */
  .nav-surface {
    background: linear-gradient(180deg, var(--ink-800) 0%, var(--ink-900) 100%);
    border-bottom: 1px solid transparent;
    border-image: linear-gradient(90deg, transparent 0%, var(--accent) 30%, var(--accent-pale) 70%, transparent 100%) 1;
  }
  .nav-underline-grad {
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-pale) 100%);
    box-shadow: 0 0 6px var(--glow-bright);
  }

  /* Desktop nav link spacing */
  #nav-links { gap: 1.75rem; }

  /* ── Touch-device dock ──────────────────────────────────────────────────
     Real touch devices (iPhone/iPad Safari) get a floating glass tab bar
     pinned to the bottom. Desktop browsers in responsive-mode preview
     keep pointer:fine, so they fall through to the desktop layout. */
  @media (hover: none) and (pointer: coarse) {
    #nav-links { display: none; }

    /* Reserve scroll space below the page content so the floating dock
       never permanently covers the footer — users can scroll past it. */
    body {
      padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
    }

    #nav-mobile {
      display: flex;
      position: fixed;
      bottom: calc(0.75rem + env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      width: min(92vw, 26rem);
      padding: 0.45rem 0.5rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.08) !important;
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-image: none !important;
      box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
      flex-direction: row;
      justify-content: space-around;
      align-items: stretch;
      gap: 0;
      z-index: 50;
      isolation: isolate;
    }

    /* Sliding pill — accent-tinted, animates between tiles, draggable */
    #nav-mobile .dock-pill {
      position: absolute;
      top: 0.4rem;
      bottom: 0.4rem;
      left: 0;
      width: 0;
      border-radius: 9999px;
      background: color-mix(in oklab, var(--accent) 30%, transparent);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.4),
        inset 0 -1px 0 rgba(0, 0, 0, 0.08),
        0 2px 10px color-mix(in oklab, var(--accent) 25%, transparent);
      pointer-events: auto;
      touch-action: none;
      cursor: grab;
      z-index: 0;
      will-change: transform, width;
    }
    #nav-mobile .dock-pill.dragging {
      cursor: grabbing;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1),
        0 4px 16px color-mix(in oklab, var(--accent) 40%, transparent);
    }

    /* Tile = icon + label, stacked. Sits above the pill in z-stack. */
    #nav-mobile .nav-link {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 0.45rem 0.25rem;
      border: 0 !important;
      border-radius: 9999px;
      background: transparent !important;
      color: var(--fog-300);
      position: relative;
      z-index: 1;
      transition: color 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #nav-mobile .nav-link svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    #nav-mobile .nav-link .label {
      font-size: 0.62rem;
      line-height: 1;
      letter-spacing: 0.02em;
      font-weight: 500;
    }
    /* Active state: text color brightens; the pill below provides the bg */
    #nav-mobile .nav-link.active { color: var(--fog-100); }
  }
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

  // ── Mobile dock: sliding pill + drag-to-focus ─────────────────────────────
  const dock = document.getElementById('nav-mobile');
  const pill = dock && dock.querySelector('.dock-pill');
  const isTouch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (dock && pill && isTouch) {
    const tiles = Array.from(dock.querySelectorAll('.nav-link'));
    const NAV_DELAY = 320;
    const SPRING = '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

    let activeIdx = tiles.findIndex((t) => t.classList.contains('active'));
    if (activeIdx < 0) activeIdx = 0;
    let pillX = 0;
    let pillW = 0;
    let pendingNav = null;

    const tileGeom = (tile) => {
      const dr = dock.getBoundingClientRect();
      const tr = tile.getBoundingClientRect();
      return { x: tr.left - dr.left, w: tr.width };
    };

    const placePill = (idx, animate) => {
      const g = tileGeom(tiles[idx]);
      pillX = g.x; pillW = g.w;
      pill.style.transition = animate ? 'transform ' + SPRING + ', width ' + SPRING : 'none';
      pill.style.width = g.w + 'px';
      pill.style.transform = 'translateX(' + g.x + 'px)';
    };

    const setActive = (idx) => {
      if (idx === activeIdx) return;
      tiles[activeIdx].classList.remove('active');
      tiles[activeIdx].removeAttribute('aria-current');
      tiles[idx].classList.add('active');
      tiles[idx].setAttribute('aria-current', 'page');
      activeIdx = idx;
    };

    const navigate = (idx) => {
      if (pendingNav) clearTimeout(pendingNav);
      pendingNav = setTimeout(() => { window.location.href = tiles[idx].href; }, NAV_DELAY);
    };

    requestAnimationFrame(() => placePill(activeIdx, false));

    // Tap a tile → slide pill + navigate (skip if it was a drag-induced click)
    tiles.forEach((tile, i) => {
      tile.addEventListener('click', (e) => {
        if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
        if (i === activeIdx) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
        e.preventDefault();
        setActive(i);
        placePill(i, true);
        navigate(i);
      });
    });

    // ── Drag the pill to slide focus ─────────────────────────────
    let dragging = false;
    let dragStartX = 0;
    let dragOriginX = 0;
    let dragMoved = false;
    let suppressClick = false;

    dock.addEventListener('pointerdown', (e) => {
      // Only initiate drag when the pointer lands on the pill itself.
      const dr = dock.getBoundingClientRect();
      const localX = e.clientX - dr.left;
      if (localX < pillX || localX > pillX + pillW) return;
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragOriginX = pillX;
      pill.classList.add('dragging');
      pill.style.transition = 'none';
      try { dock.setPointerCapture(e.pointerId); } catch (_) {}
    });

    dock.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 4) dragMoved = true;
      const dr = dock.getBoundingClientRect();
      // Pad inside the dock so the pill never overlaps the curved edge
      const pad = 4;
      const minX = pad;
      const maxX = dr.width - pillW - pad;
      let nx = dragOriginX + dx;
      if (nx < minX) nx = minX;
      if (nx > maxX) nx = maxX;
      pillX = nx;
      pill.style.transform = 'translateX(' + nx + 'px)';

      // Live preview: brighten whichever tile the pill center is closest to
      const center = nx + pillW / 2;
      let nearest = 0;
      let minDist = Infinity;
      tiles.forEach((t, i) => {
        const g = tileGeom(t);
        const c = g.x + g.w / 2;
        const d = Math.abs(c - center);
        if (d < minDist) { minDist = d; nearest = i; }
      });
      tiles.forEach((t, i) => t.classList.toggle('active', i === nearest));
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      pill.classList.remove('dragging');
      try { dock.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!dragMoved) {
        // No real drag — restore pill under the previously-active tile.
        tiles.forEach((t, i) => t.classList.toggle('active', i === activeIdx));
        if (activeIdx >= 0) tiles[activeIdx].setAttribute('aria-current', 'page');
        placePill(activeIdx, true);
        return;
      }
      // Snap to nearest tile, navigate if changed.
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      const center = pillX + pillW / 2;
      let nearest = 0;
      let minDist = Infinity;
      tiles.forEach((t, i) => {
        const g = tileGeom(t);
        const c = g.x + g.w / 2;
        const d = Math.abs(c - center);
        if (d < minDist) { minDist = d; nearest = i; }
      });
      const changed = nearest !== activeIdx;
      // Update aria-current on the new active tile
      tiles.forEach((t, i) => {
        t.classList.toggle('active', i === nearest);
        if (i === nearest) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
      });
      activeIdx = nearest;
      placePill(nearest, true);
      if (changed) navigate(nearest);
    };

    dock.addEventListener('pointerup', endDrag);
    dock.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => placePill(activeIdx, false));
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

  // Mobile dock tile: icon + small label, stacked.
  const dockLink = (href: string, label: string, key: keyof typeof ICONS) => {
    const isActive = active === key;
    const cls = `nav-link no-underline${isActive ? ' active' : ''}`;
    return html`<a href="${href}" class="${cls}" aria-label="${label}"${isActive ? raw(' aria-current="page"') : ''}>${ICONS[key]}<span class="label">${label}</span></a>`;
  };

  const pool = lv999 ? STICKER_IMAGES_LV999 : STICKER_IMAGES;
  const sticker = pool[Math.floor(Math.random() * pool.length)];

  return html`
    <nav id="site-nav" class="nav-surface flex items-center justify-between py-[0.9rem] px-[clamp(1rem,4vw,3rem)]">
      <img src="${sticker}" alt="Silverwolf" width="48" height="48" style="height:3rem;width:auto;" decoding="async" />

      <!-- Desktop nav — display controlled by CSS above, not Tailwind classes -->
      <div class="nav-links relative" id="nav-links">
        ${link('/about', 'About', 'about')}
        ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
        ${link('/birthdays', 'Birthdays', 'birthdays')}
        ${link('/games', 'Games', 'games')}
        <span class="nav-underline nav-underline-grad absolute left-0 h-[2px] w-0 rounded-sm opacity-0 pointer-events-none" style="bottom:-2px;" aria-hidden="true"></span>
      </div>
    </nav>

    <!-- Mobile bottom dock — visible only on touch devices via CSS media query -->
    <div id="nav-mobile" role="navigation" aria-label="Mobile navigation">
      <span class="dock-pill" aria-hidden="true"></span>
      ${dockLink('/about', 'About', 'about')}
      ${dockLink('/leaderboards', 'Leaderboard', 'leaderboards')}
      ${dockLink('/birthdays', 'Birthdays', 'birthdays')}
      ${dockLink('/games', 'Games', 'games')}
    </div>

    ${navbarExtras(nonce)}
  `;
}
