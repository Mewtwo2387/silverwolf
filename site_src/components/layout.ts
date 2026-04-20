import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar } from './navbar';
import { Footer } from './footer';

const tailwindSetup = raw(`
<script>
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t === 'flashbang' || t === 'blackout') document.documentElement.setAttribute('data-theme', t);
})();
</script>
<style>
  :root {
    --ink-900:#0f1014; --ink-800:#14151b; --ink-700:#1a1b23; --ink-600:#22232b; --ink-500:#2a2b33;
    --fog-100:#e6e6e9; --fog-200:#b8b9c2; --fog-300:#8b8c95; --fog-400:#6a6b74; --fog-500:#5a5b63;
    --accent:#6d7cff; --accent-light:#8fa1ff; --accent-pale:#a2adff;
    --danger:#f87171;
    --heading-top:#ffffff; --heading-bottom:#a2adff;
    --glow-faint:rgba(109,124,255,0.35); --glow-bright:rgba(109,124,255,0.6);
    --danger-glow:rgba(248,113,113,0.4);
  }
  [data-theme="flashbang"] {
    --ink-900:#f4f4f8; --ink-800:#e8e8f0; --ink-700:#dcdce6; --ink-600:#c8c8d4; --ink-500:#b4b4c4;
    --fog-100:#1a1a2a; --fog-200:#2e2e40; --fog-300:#484858; --fog-400:#606070; --fog-500:#808090;
    --accent:#4a58e8; --accent-light:#3a48d8; --accent-pale:#5a68f0;
    --danger:#c04040;
    --heading-top:#1a1a2a; --heading-bottom:#4a58e8;
    --glow-faint:rgba(74,88,232,0.3); --glow-bright:rgba(74,88,232,0.5);
    --danger-glow:rgba(192,64,64,0.35);
  }
  [data-theme="blackout"] {
    --ink-900:#050507; --ink-800:#080809; --ink-700:#0b0b0e; --ink-600:#101013; --ink-500:#16161c;
    --fog-100:#707080; --fog-200:#585868; --fog-300:#454555; --fog-400:#353545; --fog-500:#282838;
    --accent:#4a52c0; --accent-light:#5560d0; --accent-pale:#6070c8;
    --danger:#a05050;
    --heading-top:#707080; --heading-bottom:#4a52c0;
    --glow-faint:rgba(74,82,192,0.2); --glow-bright:rgba(74,82,192,0.35);
    --danger-glow:rgba(160,80,80,0.25);
  }
</style>
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          ink: {
            900: 'var(--ink-900)',
            800: 'var(--ink-800)',
            700: 'var(--ink-700)',
            600: 'var(--ink-600)',
            500: 'var(--ink-500)',
          },
          fog: {
            100: 'var(--fog-100)',
            200: 'var(--fog-200)',
            300: 'var(--fog-300)',
            400: 'var(--fog-400)',
            500: 'var(--fog-500)',
          },
          accent: {
            DEFAULT: 'var(--accent)',
            light: 'var(--accent-light)',
            pale: 'var(--accent-pale)',
          },
          danger: 'var(--danger)',
        },
        fontFamily: {
          sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
          mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
          script: ['Italianno', 'cursive'],
        },
      },
    },
  };
</script>
<style type="text/tailwindcss">
  @layer base {
    h1, h2, h3 { margin: 0 0 0.5em; }
    a { color: var(--accent-light); }
    table { @apply border-collapse mx-auto; }
    th, td { @apply py-[0.4rem] px-[0.9rem] border-b border-ink-600 text-left; }
    th { @apply text-fog-200 font-semibold text-[0.85rem] uppercase tracking-[0.04em]; }
    code { @apply font-mono bg-ink-700 rounded-[3px]; padding: 0.1em 0.35em; }
  }
</style>
`);

export function Layout(opts: {
  title: string;
  active?: 'about' | 'leaderboards' | 'birthdays';
  extraStyles?: HtmlEscapedString;
  body: HtmlEscapedString;
}) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${opts.title}</title>
        ${tailwindSetup}
        ${opts.extraStyles ?? ''}
      </head>
      <body class="font-sans bg-ink-900 text-fog-100 min-h-screen flex flex-col">
        ${Navbar(opts.active)}
        <main class="flex-1 w-full max-w-[1100px] mx-auto py-8 px-[clamp(1rem,4vw,3rem)]">${opts.body}</main>
        ${Footer()}
      </body>
    </html>`;
}
