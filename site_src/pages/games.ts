import { html, raw } from 'hono/html';
import { Layout } from '../components/layout';

const EIGHT_BALL_SVG = raw(`<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" preserveAspectRatio="xMidYMid meet"><path d="M111.6 103.54c10.26-12.13 19.02-33.92 9.97-58.94c-4.41-12.18-9.39-18.98-15.19-23.3c-3.53-2.63-17.63-9.25-36.3-6.36c-13.65 2.12-31.88 10.73-43.73 24.74C14.86 53.29 5.99 64.04 5.58 74.48c-.53 13.43 9.59 24.97 10.82 26.84c2.19 3.32 17.13 22.3 45.2 23.27c24.78.85 40.92-10.31 50-21.05z" fill="#403d3e"></path><path d="M28.43 13.9C15.5 23.13.97 42.01 3.58 68.49c1.27 12.89 4.44 20.71 8.99 26.32c2.77 3.42 14.79 13.59 33.62 15.09c18.98 1.51 33.41-2.74 48.48-13.22c30.63-21.31 26.12-53.53 24.81-57.28S108.36 13.57 81.39 5.72c-23.8-6.92-41.52 0-52.96 8.18z" fill="#5e6367"></path><path d="M51.15 15.69c-14.21-.51-27.79 10.62-29.1 24.36c-1.31 13.73 7.19 24.19 20.43 26.32c13.24 2.12 28.55-5.92 31.63-22.76c3.18-17.35-9.39-27.43-22.96-27.92z" fill="#ffffff"></path><path d="M55.54 39.21s3.42-.71 4.1-5.75c.67-4.96-1.79-9.19-7.53-10.71c-6.24-1.65-10.47 1.78-11.57 5.39c-1.53 5.02.73 7.41.73 7.41s-6.12 1.47-6.61 8.69c-.46 6.81 4.19 10.47 8.86 11.59c5.77 1.39 12.31-.19 13.91-7.55c1.33-6.06-1.89-9.07-1.89-9.07z" fill="#303030"></path><path d="M45.92 30.03c-.55 2.07.55 4.07 2.71 4.62c2.33.59 4.45-.18 5.02-2.56c.5-2.11-.5-3.97-2.96-4.57c-2.02-.5-4.17.25-4.77 2.51z" fill="#ffffff"></path><path d="M47.68 40.32c-2.62-.81-6.08.2-6.63 3.72c-.55 3.52 1.56 5.32 4.32 5.82c2.76.5 5.37-.95 5.88-3.77c.5-2.81-.96-4.97-3.57-5.77z" fill="#ffffff"></path></svg>`);
const FORTUNE_COOKIE_SVG = raw(`<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" preserveAspectRatio="xMidYMid meet"><path fill="#FCAB40" d="M15 22s-1.15 2.749-2.15 4.749s-1.666 5.227.325 6.245c3.033 1.553 8.578.574 11.825-.994c2.724-1.316 5.179-3.085 7-6c1.746-2.794 3-6 3-8s-.147-3.591-.862-5.71c-.53-1.57-1.392-3.463-2.94-5.077c-1.819-1.896-2.635-3.805-3.582-5.158C26.806.896 26 0 24 0s-7 3-10 4s-7 2-10 6s-3 8-3 10s.062 4.885 2 6c2.305 1.327 5.575-1.634 8.045-2.356C13.392 22.958 15 22 15 22z"></path><path fill="#F4900C" d="M33.717 21.334s-2.613 3.554-4.048 4.478c-.774.498-1.62 1.01-2.703 1.515c-.694.324-3.792 1.55-4.621 1.805c-1.408.433-3.285.83-4.26.866c-.975.036-1.805-.004-3.223.179c-.872.112-2.156.615-2.192 1.193c-.036.578 1.011 1.625 3.105 1.733c2.094.108 5.997-.177 8.375-1.227c3.321-1.467 5.307-3.285 6.282-4.44c.974-1.156 2.707-4.008 3.285-6.102z"></path><path fill="#BF6952" d="M33.717 21.334s-1.733 2.166-3.149 3.353c-.936.785-2.937 2.181-4.396 2.893c-1.48.722-4.315 1.651-6.318 1.949c-1.697.253-4.345.526-5.235.722c-.859.189-1.287.458-1.047.758c.362.452 1.236.34 2.563.172c3.114-.394 5.932-.988 8.337-1.977c2.457-1.011 4.876-2.274 5.851-3.43s2.35-2.455 3.394-4.44z"></path><path fill="#F4900C" d="M22.85 3.969c-.681 1.36-2.713 4.517-3.85 6.426c-1.353 2.271-3.117 5.018-4.074 7.605c-.295.798-.935 3.768-.819 4.466c.56-.271.893-.466.893-.466s1.172-2.255 2.182-3.807c1.011-1.552 4.404-7.473 5.668-9.567c1.264-2.094 1.763-4.16 1.588-5.218c-.252-1.535-1.086-.441-1.588.561z"></path><path fill="#BF6952" d="M22.886 5.738c-.714 1.489-2.711 4.657-3.637 6.426c-.926 1.769-3.42 6.148-4.413 8.664c-.177.449-.359.977-.43 1.489C14.819 22.11 15 22 15 22s1.172-2.255 2.182-3.807c1.011-1.552 4.404-7.473 5.668-9.567c.974-1.614 1.489-3.206 1.596-4.337c-.287-1.312-1.089.467-1.56 1.449z"></path><path fill="#CCD6DD" d="M29.069 25.815c-.927.647-2.011 1.332-2.898 1.764c-1 .488-2.615 1.065-4.177 1.484l.001.003s2.491 5.527 5.969 6.769l6.068-5.855s-3.857-2.652-4.963-4.165z"></path><path fill="#9AAAB4" d="M25.454 27.9a21.505 21.505 0 0 1-.841.33a31.476 31.476 0 0 1-.822.291l-.145.048a29.75 29.75 0 0 1-1.652.495l.001.003s.151.334.428.853c.71-.214 1.397-.448 2.049-.716c1.993-.82 3.946-1.805 5.139-2.765a6.037 6.037 0 0 1-.542-.624l-.002.002c-.212.148-.432.297-.657.446l-.155.101c-.176.115-.352.227-.53.338l-.208.129c-.167.101-.33.197-.493.291l-.205.118c-.223.124-.441.241-.647.341a13.28 13.28 0 0 1-.538.244l-.18.075z"></path></svg>`);

const GAMES = [
  {
    name: '8ball',
    href: '/games/8ball',
    info: 'Ask the magic 8-ball a question and let fate decide.',
    imageType: 'svg' as const,
    svgMarkup: EIGHT_BALL_SVG,
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
    imageType: 'svg' as const,
    svgMarkup: FORTUNE_COOKIE_SVG,
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
  .card-image img, .card-image svg {
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

const PRE_RENDERED_BODY = html`
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
    : game.imageType === 'svg'
      ? game.svgMarkup
      : html`<img src="${(game as any).imageSrc}" alt="${game.name}" decoding="async" loading="lazy" />`}
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

export function GamesPage(opts: { nonce: string }) {
  return Layout({
    title: 'Silverwolf — Games',
    active: 'games',
    body: PRE_RENDERED_BODY as any,
    nonce: opts.nonce,
  });
}
