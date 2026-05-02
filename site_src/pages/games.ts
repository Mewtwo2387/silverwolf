import { html, raw } from 'hono/html';
import { Layout } from '../components/layout';

const GAMES = [
  {
    name: '8ball',
    href: '/games/8ball',
    info: 'Ask the magic 8-ball a question and let fate decide.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/pool-8-ball-svgrepo-com.svg',
  },
  {
    name: 'flip',
    href: '/games/flip',
    info: 'Flip a virtual coin. Will it be heads, tails, or... side?',
    imageType: 'coin' as const,
  },
  {
    name: 'fortune',
    href: '/games/fortune',
    info: 'Munch on a virtual fortune cookie to see what the future holds.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/fortune-cookie-svgrepo-com.svg',
  },
  {
    name: 'blackjack',
    href: '/games/blackjack',
    info: 'Bet your mystic credits on a classic game of 21 against Silverwolf.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/poker-svgrepo-com.svg',
  },
  {
    name: 'roulette',
    href: '/games/roulette',
    info: 'Spin the wheel. Bet on numbers, colors, or odds and pray.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/roulette-casino-svgrepo-com.svg',
  },
  {
    name: 'slots',
    href: '/games/slots',
    info: 'Pull the lever and watch your mystic credits disappear in style.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/slots-svgrepo-com.svg',
  },
  {
    name: 'poop',
    href: '/games/poop',
    info: 'Log a bathroom visit and contribute to the leaderboard.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/pile-of-poo-svgrepo-com.svg',
  },
  {
    name: 'claim',
    href: '/games/claim',
    info: 'claim yer dinonuggies',
    imageType: 'img' as const,
    imageSrc: '/static/game-dinonuggie.webp',
  },
];

const styles = raw(`
<style>
  .games-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .games-grid { grid-template-columns: 1fr; }
  }
  @media (min-width: 701px) and (max-width: 1000px) {
    .games-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .game-card {
    display: flex;
    flex-direction: column;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  }
  .game-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.45);
    border-color: var(--accent);
    background: var(--ink-700, #1e2030);
  }

  .card-image {
    aspect-ratio: 1 / 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink-900);
    overflow: hidden;
  }
  .card-image img {
    width: 70%;
    height: 70%;
    object-fit: contain;
  }

  .card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .card-body h2 {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--accent-light);
    margin: 0;
    transition: color 0.2s;
  }
  .game-card:hover .card-body h2 {
    color: var(--accent);
  }
  .card-body p {
    font-size: 0.85rem;
    color: var(--fog-200);
    margin: 0;
  }

  /* Mini spinning coin for the flip card */
  .mini-coin-wrap {
    width: 120px;
    height: 120px;
    perspective: 400px;
  }
  .mini-coin {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    animation: mini-spin 5s linear infinite;
  }
  @keyframes mini-spin {
    from { transform: rotateY(0deg); }
    to   { transform: rotateY(360deg); }
  }
  .mini-face {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: bold;
    backface-visibility: hidden;
    border: 5px solid var(--accent);
    box-shadow: 0 0 16px var(--glow-bright);
    background: var(--ink-800);
    color: var(--accent-light);
  }
  .mini-face.tails {
    transform: rotateY(180deg);
  }

</style>
`);

function CoinImage() {
  return html`
    <div class="mini-coin-wrap">
      <div class="mini-coin">
        <div class="mini-face">Silver</div>
        <div class="mini-face tails">Wolf</div>
      </div>
    </div>
  `;
}

export function GamesPage(opts: { nonce: string; lv999?: boolean; user?: import('../components/navbar').NavUser | null }) {
  const body = html`
    ${styles}
    <h1 class="text-center">Games</h1>
    <p class="text-center text-fog-300 mb-8">Choose a game to play!</p>
    <div class="games-grid">
      ${GAMES.map(
    (game) => html`
          <a href="${game.href}" class="game-card">
            <div class="card-image">
              ${game.imageType === 'coin'
    ? CoinImage()
    : html`<img src="${(game as any).imageSrc}" alt="${game.name}" />`}
            </div>
            <div class="card-body">
              <h2>${game.name}</h2>
              <p>${game.info}</p>
            </div>
          </a>
        `,
  )}
    </div>
  `;

  return Layout({
    title: 'Silverwolf — Games',
    active: 'games',
    body: body as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}
