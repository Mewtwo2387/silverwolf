import { html, raw } from 'hono/html';
import { STICKER_STEMS, STICKER_STEMS_LV999, stickerWebpUrl } from '../stickers';

const STICKER_IMAGES = STICKER_STEMS.map(stickerWebpUrl);
const STICKER_IMAGES_LV999 = STICKER_STEMS_LV999.map(stickerWebpUrl);

// Inline SVG icons — fill/stroke set to currentColor so they inherit the
// link's themed text color via CSS variables.
const ICON_HOME = raw(
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 11.2 12 4l9 7.2"/>'
    + '<path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>'
    + '</svg>',
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
  about: ICON_HOME,
  leaderboards: ICON_LEADERBOARD,
  birthdays: ICON_BIRTHDAY,
  games: ICON_GAMES,
};

export type NavActive = 'about' | 'leaderboards' | 'birthdays' | 'games';

export interface NavUser {
  username: string;
  avatarURL: string | null;
  // Per-session token embedded in the logout form. Validated server-side
  // against WebSession.csrf_token to prevent forged POST /auth/logout
  // calls (defence-in-depth on top of SameSite=Lax).
  csrf: string;
}

export function Navbar(active: NavActive | undefined, lv999?: boolean, user?: NavUser | null) {
  const base = 'nav-link text-[0.95rem] px-[0.1rem] py-1 border-b-2 border-transparent transition-colors no-underline font-mono';
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

  // The "Home" tab was retired — the public tab now goes to /about for everyone,
  // and /me is reached by clicking the profile chip on the right.
  const aboutHref = '/about';
  const pool = lv999 ? STICKER_IMAGES_LV999 : STICKER_IMAGES;
  const sticker = pool[Math.floor(Math.random() * pool.length)];

  return html`
    <nav id="site-nav" class="nav-surface font-mono">
      <!-- Desktop window header: only visible on desktop -->
      <div class="nav-window-header flex items-center justify-between px-[1.5rem] py-2 border-b border-[rgba(34,211,255,0.12)] select-none">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#ff6b8a] opacity-60"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#f59e0b] opacity-60"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#10b981] opacity-60"></span>
          <span class="ml-2 text-[0.7rem] font-semibold text-accent opacity-75 tracking-widest font-mono">SYS.NAVBAR.EXE</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-led status-led-green w-1.5 h-1.5"></span>
          <span class="text-[#10b981] text-[0.7rem] font-bold tracking-widest font-mono">[ONLINE]</span>
        </div>
      </div>

      <!-- Window content (main flex layout) -->
      <div class="nav-window-content flex items-center justify-between py-[0.9rem] px-[clamp(1rem,4vw,3rem)]">
        <img src="${sticker}" alt="Silverwolf" width="48" height="48" style="height:3rem;width:auto;" decoding="async" />

        <!-- Desktop nav — display controlled by CSS above, not Tailwind classes -->
        <div class="nav-links relative font-mono" id="nav-links">
          ${link(aboutHref, 'About', 'about')}
          ${link('/leaderboards', 'Leaderboards', 'leaderboards')}
          ${link('/birthdays', 'Birthdays', 'birthdays')}
          ${link('/games', 'Games', 'games')}
          <span class="nav-underline nav-underline-grad absolute left-0 h-[2px] w-0 rounded-sm opacity-0 pointer-events-none" style="bottom:-2px;" aria-hidden="true"></span>
        </div>

        ${user
    ? html`
        <div id="nav-auth-desktop">
          <div class="nav-auth font-mono">
            <a href="/me" class="nav-profile-link font-mono" aria-label="Open your dashboard">
              ${user.avatarURL ? html`<img class="nav-avatar" src="${user.avatarURL}" alt="${user.username}" width="32" height="32" />` : ''}
              <span class="nav-username font-mono">@${user.username}</span>
            </a>
            <form action="/auth/logout" method="POST" style="display:inline;margin:0;">
              <input type="hidden" name="csrf" value="${user.csrf}" />
              <button type="submit" class="nav-auth-link font-mono" style="background:none;cursor:pointer;font-family:inherit;">[logout]</button>
            </form>
          </div>
        </div>`
    : html`
        <div id="nav-auth-desktop">
          <div class="nav-auth font-mono">
            <a href="/auth/discord/login" class="nav-login-link font-mono" style="cursor:pointer;font-family:inherit;">[login]</a>
          </div>
        </div>`}
      </div>
    </nav>

    <!-- Mobile bottom dock — visible only on touch devices via CSS media query -->
    <div id="nav-mobile" role="navigation" aria-label="Mobile navigation" style="display:none">
      <span class="dock-pill" aria-hidden="true"></span>
      ${dockLink(aboutHref, 'About', 'about')}
      ${dockLink('/leaderboards', 'Leaderboard', 'leaderboards')}
      ${dockLink('/birthdays', 'Birthdays', 'birthdays')}
      ${dockLink('/games', 'Games', 'games')}
    </div>
  `;
}
