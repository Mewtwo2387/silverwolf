import { html } from 'hono/html';
import { Layout } from '../components/layout';

const GAMES = [
  {
    name: '8ball',
    href: '/games/8ball',
    info: 'Ask the magic 8-ball a question and let fate decide.',
  },
  {
    name: 'flip',
    href: '/games/flip',
    info: 'Flip a virtual coin. Will it be heads, tails, or... side?',
  },
  {
    name: 'fortune',
    href: '/games/fortune',
    info: 'Munch on a virtual fortune cookie to see what the future holds.',
  },
];

export function GamesPage(opts: { nonce: string }) {
  const body = html`
    <h1 class="text-center">Games</h1>
    <p class="text-center text-fog-300 mb-8">Choose a game to play!</p>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
      ${GAMES.map(
        (game) => html`
          <a
            href="${game.href}"
            class="block bg-ink-800 border border-ink-600 rounded-lg p-6 hover:border-accent transition-colors no-underline group"
          >
            <h2 class="text-accent-light group-hover:text-accent transition-colors mb-2">${game.name}</h2>
            <p class="text-fog-200 text-sm">${game.info}</p>
          </a>
        `
      )}
    </div>
  `;

  return Layout({
    title: 'Silverwolf — Games',
    active: 'games',
    body: body as any,
    nonce: opts.nonce,
  });
}
