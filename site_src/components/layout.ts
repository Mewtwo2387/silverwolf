import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar } from './navbar';
import { Footer } from './footer';

const tailwindSetup = raw(`
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          ink: {
            900: '#0f1014',
            800: '#14151b',
            700: '#1a1b23',
            600: '#22232b',
            500: '#2a2b33',
          },
          fog: {
            100: '#e6e6e9',
            200: '#b8b9c2',
            300: '#8b8c95',
            400: '#6a6b74',
            500: '#5a5b63',
          },
          accent: {
            DEFAULT: '#6d7cff',
            light: '#8fa1ff',
            pale: '#a2adff',
          },
          danger: '#f87171',
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
    a { color: #8fa1ff; }
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
