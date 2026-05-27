import { readFileSync } from 'fs';
import path from 'path';
import { html, raw } from 'hono/html';
import { Layout } from '../components/layout';

export const GAMES = [
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
    name: 'love',
    href: '/games/love',
    info: 'Calculate your compatibility or incompatibility with someone.',
    imageType: 'img' as const,
    imageSrc: '/static/svg/love-heart-svgrepo-com.svg',
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
  {
    name: 'dinonuggie_upgrades',
    href: '/games/dinonuggie-upgrades',
    info: 'a hub for eating and upgrading',
    imageType: 'composite' as const,
    imageSrc: '/static/game-dinonuggie.webp',
    overlaySrc: '/static/svg/wrench-screwdriver-svgrepo-com.svg',
  },
  {
    name: 'awdangit',
    href: '/games/awdangit',
    info: '99% chance to earn $1M, 1% chance to become a girl.',
    imageType: 'img' as const,
    imageSrc: '/static/game-awdangit.jpeg',
  },
  {
    name: 'fakequote',
    href: '/games/fakequote',
    info: 'create your very real totally accurate quotes!',
    imageType: 'img' as const,
    imageSrc: '/static/game-fakequote.webp',
  },
  {
    name: 'ai slop',
    href: '/games/ai-slop',
    info: 'chat with ai slop or something idk',
    imageType: 'ai-slop' as const,
  },
  {
    name: 'cyclic ttt',
    href: '/games/cyclic-tictactoe',
    info: 'Tic-tac-toe where your oldest marks expire. Outlast the bot.',
    imageType: 'cyclic' as const,
  },
];

const styles = raw(`
<style>
  .games-header {
    position: relative;
    margin-bottom: 2rem;
  }
  .games-header h1 { margin: 0 0 0.25rem 0; }
  .games-header p { margin: 0; }

  .layout-switcher {
    position: absolute;
    top: 0;
    right: 0;
  }
  @media (max-width: 700px) {
    .layout-switcher {
      position: static;
      display: flex;
      justify-content: flex-end;
      margin-top: 0.75rem;
    }
  }

  .layout-switcher-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: color-mix(in oklab, var(--ink-800) 75%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    color: var(--fog-200);
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
  }
  .layout-switcher-btn:hover {
    border-color: var(--accent);
    color: var(--accent-light);
    box-shadow: 0 0 8px var(--glow-faint);
  }
  .layout-switcher-btn svg { width: 18px; height: 18px; }
  .layout-switcher-btn .chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
  }
  .layout-switcher.open .layout-switcher-btn .chevron {
    transform: rotate(180deg);
  }

  .layout-switcher-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    right: 0;
    background: color-mix(in oklab, var(--ink-800) 90%, transparent);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    padding: 0.25rem;
    display: none;
    flex-direction: column;
    min-width: 170px;
    z-index: 10;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(34, 211, 255, 0.05);
  }
  .layout-switcher.open .layout-switcher-menu { display: flex; }
  .layout-switcher-menu button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.35rem;
    color: var(--fog-200);
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
    transition: background 0.15s, color 0.15s;
  }
  .layout-switcher-menu button:hover {
    background: color-mix(in oklab, var(--ink-700) 80%, transparent);
    color: var(--accent-light);
  }
  .layout-switcher-menu button.active {
    background: color-mix(in oklab, var(--accent) 15%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
  }
  .layout-switcher-menu button svg { width: 16px; height: 16px; flex-shrink: 0; }

  .games-grid {
    display: grid;
    /* minmax(0, 1fr) — the 0 minimum lets columns shrink past their content's
       intrinsic min-width, which is what stops long words ("Silverwolf",
       fixed-width children like .mini-coin-wrap) from blowing out the row
       on narrower tablet/smart-display widths. */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
  }
  .games-grid.grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .games-grid.list-view {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 700px) {
    .games-grid,
    .games-grid.grid-4 { grid-template-columns: minmax(0, 1fr); }
  }
  @media (min-width: 701px) and (max-width: 1000px) {
    .games-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .games-grid.grid-4 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  /* Sci-Fi Glassmorphic TCG Card Design */
  .game-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: color-mix(in oklab, var(--ink-800) 45%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    font-family: 'JetBrains Mono', monospace;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 
      0 8px 24px rgba(0, 0, 0, 0.35),
      0 0 12px rgba(34, 211, 255, 0.03);
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), 
                box-shadow 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), 
                border-color 0.2s, 
                background 0.2s;
    position: relative;
  }
  .game-card:hover {
    transform: translateY(-6px);
    box-shadow: 
      0 16px 36px rgba(0,0,0,0.55),
      0 0 20px var(--glow-bright),
      inset 0 0 12px rgba(34, 211, 255, 0.1);
    border-color: var(--accent);
    background: color-mix(in oklab, var(--ink-700) 60%, transparent);
  }

  .card-image {
    aspect-ratio: 1 / 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in oklab, var(--ink-900) 65%, transparent);
    overflow: hidden;
    position: relative;
    border-bottom: 1px solid color-mix(in oklab, var(--accent) 15%, transparent);
  }
  .card-image img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    transition: transform 0.3s ease;
    z-index: 1;
  }
  .game-card:hover .card-image img {
    transform: scale(1.05);
  }

  /* Diagonal linear-gradient holographic shine sweep effect */
  .card-image::after {
    content: '';
    position: absolute;
    top: 0; left: -150%;
    width: 100%; height: 100%;
    background: linear-gradient(
      120deg,
      transparent 30%,
      rgba(34, 211, 255, 0.2) 40%,
      rgba(167, 139, 250, 0.35) 50%,
      rgba(34, 211, 255, 0.2) 60%,
      transparent 70%
    );
    transition: left 0.6s ease;
    z-index: 2;
    pointer-events: none;
  }
  .game-card:hover .card-image::after {
    left: 150%;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .card-header-bar {
    position: relative;
    display: flex;
    width: 100%;
    border-bottom: 1px solid color-mix(in oklab, var(--accent) 15%, transparent);
    background: transparent;
  }
  .card-title-tab {
    position: relative;
    padding: 0.35rem 1.5rem 0.35rem 0.75rem;
    background: color-mix(in oklab, var(--accent) 8%, transparent);
    border-top: 1px solid color-mix(in oklab, var(--accent) 25%, transparent);
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0 100%);
    display: flex;
    align-items: center;
    transition: background-color 0.2s, border-color 0.2s;
  }
  .game-card:hover .card-title-tab {
    background: color-mix(in oklab, var(--accent) 15%, transparent);
    border-color: var(--accent);
  }
  .card-title-tab h2 {
    font-size: 1rem;
    font-weight: bold;
    color: var(--accent-light);
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
    transition: color 0.2s;
  }
  .game-card:hover .card-title-tab h2 {
    color: var(--accent);
  }
  .card-title-tab h2::before {
    content: '> ';
    color: var(--accent);
    opacity: 0.75;
    margin-right: 0.3rem;
    transition: opacity 0.2s;
  }
  .game-card:hover .card-title-tab h2::before {
    opacity: 1;
    text-shadow: 0 0 6px var(--accent);
  }

  .card-body {
    padding: 1rem 1.25rem 1.25rem 1.25rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
  .card-body p {
    font-size: 0.85rem;
    color: var(--fog-200);
    margin: 0;
    line-height: 1.4;
  }

  /* 4x4 grid: tighter padding so smaller cards don't feel cramped */
  .games-grid.grid-4 .card-body { padding: 0.75rem 0.9rem 0.9rem 0.9rem; }
  .games-grid.grid-4 .card-title-tab {
    padding: 0.25rem 1.2rem 0.25rem 0.6rem;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%);
  }
  .games-grid.grid-4 .card-title-tab h2 { font-size: 0.9rem; }
  .games-grid.grid-4 .card-body p { font-size: 0.8rem; }

  /* List view: horizontal layout with small icon and truncated description */
  .games-grid.list-view .game-card {
    flex-direction: row;
    align-items: stretch;
  }
  .games-grid.list-view .game-card:hover {
    transform: translateY(-2px);
  }
  .games-grid.list-view .card-image {
    width: 88px;
    height: 88px;
    flex-shrink: 0;
    aspect-ratio: 1 / 1;
    border-bottom: none;
    border-right: 1px solid color-mix(in oklab, var(--accent) 15%, transparent);
  }
  .games-grid.list-view .card-image img {
    width: 70%;
    height: 70%;
  }
  .games-grid.list-view .card-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .games-grid.list-view .card-header-bar {
    border-bottom: 1px solid color-mix(in oklab, var(--accent) 15%, transparent);
  }
  .games-grid.list-view .card-title-tab {
    padding: 0.2rem 1rem 0.2rem 0.75rem;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%);
  }
  .games-grid.list-view .card-title-tab h2 { font-size: 0.95rem; }
  .games-grid.list-view .card-body {
    padding: 0.5rem 0.75rem;
    justify-content: center;
  }
  .games-grid.list-view .card-body p {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .games-grid.list-view .mini-coin-wrap {
    width: 64px;
    height: 64px;
  }
  .games-grid.list-view .mini-face { font-size: 0.6rem; border-width: 3px; }

  /* Composite icon: base image with svg overlay in bottom-left corner */
  .composite-icon {
    position: relative;
    width: 70%;
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .composite-icon .base {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .composite-icon .overlay {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 38%;
    height: 38%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
  }

  /* AI Slop card: thin-stroke node graph rotating over a morphing gradient blob. */
  .ai-slop-wrap {
    width: 78%;
    aspect-ratio: 1 / 1;
    position: relative;
    display: block;
  }
  .ai-slop-wrap::before {
    content: '';
    position: absolute;
    inset: 6%;
    background: radial-gradient(circle at 32% 28%, var(--accent) 0%, var(--accent-pale) 45%, transparent 75%);
    filter: blur(14px);
    opacity: 0.55;
    border-radius: 50% 60% 45% 55% / 55% 45% 60% 50%;
    animation: ai-slop-blob 9s ease-in-out infinite;
    z-index: 0;
    pointer-events: none;
  }
  @keyframes ai-slop-blob {
    0%, 100% { border-radius: 50% 60% 45% 55% / 55% 45% 60% 50%; transform: scale(1) rotate(0deg); }
    33%      { border-radius: 65% 40% 55% 45% / 45% 60% 40% 60%; transform: scale(1.06) rotate(45deg); }
    66%      { border-radius: 45% 55% 65% 40% / 60% 50% 45% 55%; transform: scale(0.96) rotate(-30deg); }
  }
  .ai-slop-svg {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
    animation: ai-slop-spin 16s linear infinite;
    overflow: visible;
  }
  @keyframes ai-slop-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .ai-slop-svg .ln {
    stroke: var(--accent-light);
    stroke-width: 1.2;
    fill: none;
    opacity: 0.55;
  }
  .ai-slop-svg .node {
    stroke: var(--accent-light);
    stroke-width: 1.4;
    fill: var(--ink-900);
  }
  .ai-slop-svg .core {
    fill: var(--accent-light);
    stroke: var(--accent);
    stroke-width: 1.2;
    animation: ai-slop-pulse 2.4s ease-in-out infinite;
  }
  @keyframes ai-slop-pulse {
    0%, 100% { r: 4.6; opacity: 0.9; }
    50%      { r: 5.6; opacity: 1; }
  }
  .ai-slop-svg .n1 { transform-origin: 34.52px 11.43px; animation: ai-slop-orbit-a 3.6s ease-in-out infinite; }
  .ai-slop-svg .n2 { transform-origin: 53.63px 31.6px;  animation: ai-slop-orbit-b 4.2s ease-in-out infinite; }
  .ai-slop-svg .n3 { transform-origin: 34.52px 50.57px; animation: ai-slop-orbit-a 3.9s ease-in-out infinite reverse; }
  .ai-slop-svg .n4 { transform-origin: 15.16px 42.03px; animation: ai-slop-orbit-b 4.5s ease-in-out infinite reverse; }
  .ai-slop-svg .n5 { transform-origin: 15.16px 19.27px; animation: ai-slop-orbit-a 4.1s ease-in-out infinite; }
  @keyframes ai-slop-orbit-a {
    0%, 100% { transform: translate(0, 0); }
    25%      { transform: translate(2.4px, -1.6px); }
    50%      { transform: translate(0, -2.6px); }
    75%      { transform: translate(-2.4px, -1.6px); }
  }
  @keyframes ai-slop-orbit-b {
    0%, 100% { transform: translate(0, 0); }
    25%      { transform: translate(-2px, 1.8px); }
    50%      { transform: translate(0, 2.8px); }
    75%      { transform: translate(2px, 1.8px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-slop-svg,
    .ai-slop-svg .core,
    .ai-slop-svg .n1, .ai-slop-svg .n2, .ai-slop-svg .n3, .ai-slop-svg .n4, .ai-slop-svg .n5,
    .ai-slop-wrap::before { animation: none; }
  }

  /* Cyclic tic-tac-toe card: 3x3 grid with marks, the oldest one fading out */
  .cyc-thumb {
    width: 72%;
    aspect-ratio: 1 / 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 5px;
    background: color-mix(in oklab, var(--accent) 14%, var(--ink-700));
    border-radius: 0.5rem;
    border: 1px solid color-mix(in oklab, var(--accent) 25%, transparent);
  }
  .cyc-thumb span {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink-900);
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 800;
    font-size: 1.1rem;
    line-height: 1;
  }
  .cyc-thumb .x { color: var(--accent-light); text-shadow: 0 0 8px var(--glow-bright); }
  .cyc-thumb .o { color: var(--danger); text-shadow: 0 0 8px var(--danger-glow); }
  .cyc-thumb .fade { animation: cyc-thumb-fade 2.4s ease-in-out infinite; }
  @keyframes cyc-thumb-fade {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.12; }
  }
  .games-grid.list-view .cyc-thumb { font-size: 0.7rem; gap: 2px; padding: 3px; }
  @media (prefers-reduced-motion: reduce) {
    .cyc-thumb .fade { animation: none; opacity: 0.4; }
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

  /* ---- Holographic SVG treatment ---------------------------------------
     The flat svgrepo icons are inlined (see HoloIcon) and restyled here into
     translucent, accent-outlined schematics so they read as sci-fi HUD glyphs
     rather than cartoon stickers. Original fill colours are kept (faint) so
     each icon is still recognisable; the outline + glow use the live --accent,
     so the treatment tracks whatever theme (default / flashbang / blackout)
     is active. PNG/JPEG/WebP icons and the bespoke cards are untouched. */
  .holo-icon {
    /* Per-icon glow colour. The inline script (holoScript) sets it to each
       icon's dominant source colour; --fog-400 is a neutral pre-JS fallback so
       the glow never defaults to the UI accent blue. */
    --holo-glow: var(--fog-400);
    width: 70%;
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    filter:
      drop-shadow(0 0 5px var(--holo-glow))
      drop-shadow(0 0 1.5px var(--holo-glow));
    transition: filter 0.3s ease, transform 0.3s ease;
  }
  .holo-svg {
    width: 100%;
    height: 100%;
    overflow: visible; /* let the stroke glow spill past the viewBox edge */
  }
  /* Every painted node: hollow the fill to a translucent tint of its original
     colour, then trace it with a constant-width accent outline.
     non-scaling-stroke keeps that outline the same visual weight whether the
     source viewBox is 24 or 512 units across. */
  .holo-svg * {
    /* Fill keeps each shape's ORIGINAL colour, just translucent. holoScript
       sets each shape's stroke to its own (brightened-if-too-dark) colour;
       --fog-200 is the neutral no-JS fallback so outlines never default to the
       UI accent — that's what made every icon read as blue. */
    fill-opacity: 0.4;
    stroke: var(--fog-200);
    stroke-width: 1.4;
    stroke-opacity: 1;
    vector-effect: non-scaling-stroke;
  }
  /* Shapes inside <defs>/<mask>/<clipPath> aren't drawn directly — they define
     masks/clips. Restyling them (e.g. fading a white mask fill) would erase the
     artwork they gate, so leave those subtrees alone. */
  .holo-svg defs *,
  .holo-svg mask *,
  .holo-svg clipPath *,
  .holo-svg symbol * {
    fill-opacity: 1;
    stroke: none;
  }
  .game-card:hover .holo-icon {
    transform: scale(1.05);
    filter:
      drop-shadow(0 0 9px var(--holo-glow))
      drop-shadow(0 0 3px var(--holo-glow));
  }

  /* Composite card (dinonuggie upgrades): keep the WebP base, holo only the
     svg wrench badge and pin it to the bottom-left corner. */
  .composite-icon .holo-overlay {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 38%;
    height: 38%;
  }
  .game-card:hover .composite-icon .holo-overlay { transform: none; }

  .games-grid.list-view .holo-icon { width: 70%; height: 70%; }

</style>
`);

const ICON_GRID_3 = raw('<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>');
const ICON_GRID_4 = raw('<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3"  y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="13" y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="18" y="3"  width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="13" y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="18" y="8"  width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="13" width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="13" width="3.5" height="3.5" rx="0.6"/><rect x="13" y="13" width="3.5" height="3.5" rx="0.6"/><rect x="18" y="13" width="3.5" height="3.5" rx="0.6"/><rect x="3"  y="18" width="3.5" height="3.5" rx="0.6"/><rect x="8"  y="18" width="3.5" height="3.5" rx="0.6"/><rect x="13" y="18" width="3.5" height="3.5" rx="0.6"/><rect x="18" y="18" width="3.5" height="3.5" rx="0.6"/></svg>');
const ICON_LIST = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="0.6" fill="currentColor"/><circle cx="4.5" cy="12" r="0.6" fill="currentColor"/><circle cx="4.5" cy="18" r="0.6" fill="currentColor"/></svg>');
const ICON_CHEVRON = raw('<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');

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

// AI Slop card thumbnail
function AiSlopImage() {
  return raw(`
    <div class="ai-slop-wrap" aria-hidden="true">
      <svg class="ai-slop-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
        <line class="ln" x1="20.17" y1="16.3"  x2="28.9"  y2="12.93" />
        <line class="ln" x1="38.6"  y1="15.59" x2="49.48" y2="27.52" />
        <line class="ln" x1="50.07" y1="36.2"  x2="38.67" y2="46.49" />
        <line class="ln" x1="18.36" y1="24.13" x2="30.91" y2="46.01" />
        <line class="ln" x1="20.31" y1="44.74" x2="28.7"  y2="48.63" />
        <line class="ln" x1="17.34" y1="36.63" x2="31.37" y2="16.32" />
        <line class="ln" x1="20.52" y1="21.55" x2="30.34" y2="27.1"  />
        <line class="ln" x1="39.22" y1="29.8"  x2="47.81" y2="30.45" />
        <line class="ln" x1="34.51" y1="33.98" x2="34.52" y2="44.74" />
        <circle class="node n1" cx="34.52" cy="11.43" r="5.4" />
        <circle class="node n2" cx="53.63" cy="31.6"  r="5.4" />
        <circle class="node n3" cx="34.52" cy="50.57" r="5.4" />
        <circle class="node n4" cx="15.16" cy="42.03" r="5.4" />
        <circle class="node n5" cx="15.16" cy="19.27" r="5.4" />
        <circle class="core"     cx="34.51" cy="29.27" r="4.6" />
      </svg>
    </div>
  `);
}

// Cyclic tic-tac-toe card thumbnail: a frozen mid-game 3x3 board where the
// oldest mark (the X bottom-right) blinks to hint at the expiry mechanic.
function CyclicImage() {
  return raw(`
    <div class="cyc-thumb" aria-hidden="true">
      <span class="x">X</span><span class="o">O</span><span></span>
      <span></span><span class="x">X</span><span class="o">O</span>
      <span class="o">O</span><span></span><span class="x fade">X</span>
    </div>
  `);
}

const SVG_DIR = path.join(import.meta.dir, '..', 'Assets', 'svg');

// Game icons ship as flat, multi-colour svgrepo art that reads too "comical"
// for the sci-fi UI. Rather than show them as <img>, we inline the source SVG
// so the stylesheet can reach inside (see the .holo-svg rules) and turn every
// shape into a translucent, accent-outlined "schematic" with a glow. Each file
// is read + sanitized once and cached for the lifetime of the process.
const holoSvgCache = new Map<string, string | null>();
function getHoloSvg(fileName: string): string | null {
  if (!holoSvgCache.has(fileName)) {
    try {
      let svg = readFileSync(path.join(SVG_DIR, fileName), 'utf8')
        .replace(/<\?xml[\s\S]*?\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '');
      // On the opening <svg> tag only: drop the file's hard-coded width/height
      // (CSS sizes it) and its own class, then tag it so .holo-svg rules apply.
      const openTag = svg.match(/<svg\b[^>]*>/i);
      if (openTag) {
        const styled = `${openTag[0]
          .replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '')
          .replace(/\sclass\s*=\s*"[^"]*"/i, '')
          .replace(/\s*>$/, '')} class="holo-svg" focusable="false">`;
        svg = svg.replace(openTag[0], styled);
      }
      holoSvgCache.set(fileName, svg);
    } catch {
      holoSvgCache.set(fileName, null);
    }
  }
  return holoSvgCache.get(fileName) ?? null;
}

// Inlined, theme-styled SVG markup, or null if the file can't be read (callers
// fall back to a plain <img>). `extraClass` lets the composite card pin the
// icon as a corner badge.
function HoloIcon(fileName: string, extraClass = '') {
  const svg = getHoloSvg(fileName);
  if (svg == null) return null;
  const cls = extraClass ? `holo-icon ${extraClass}` : 'holo-icon';
  return raw(`<span class="${cls}" aria-hidden="true">${svg}</span>`);
}

// Map a public /static/svg/... URL back to its source filename.
const svgFileName = (src: string): string => src.split('/').pop() ?? '';

const layoutScript = (nonce: string) => raw(`
<script nonce="${nonce}">
(function(){
  var KEY = 'games-layout';
  var VALID = ['grid-3', 'grid-4', 'list-view'];
  var grid = document.querySelector('.games-grid');
  var switcher = document.querySelector('.layout-switcher');
  if (!grid || !switcher) return;
  var btn = switcher.querySelector('.layout-switcher-btn');
  var menu = switcher.querySelector('.layout-switcher-menu');
  var btnIcon = btn.querySelector('.btn-icon');
  var btnLabel = btn.querySelector('.btn-label');
  var options = menu.querySelectorAll('button[data-layout]');

  function apply(layout) {
    grid.classList.remove('grid-3', 'grid-4', 'list-view');
    if (layout !== 'grid-3') grid.classList.add(layout);
    options.forEach(function(o) {
      o.classList.toggle('active', o.dataset.layout === layout);
    });
    var active = menu.querySelector('button[data-layout="' + layout + '"]');
    if (active && btnIcon && btnLabel) {
      var srcIcon = active.querySelector('svg');
      var srcLabel = active.querySelector('.label');
      if (srcIcon) btnIcon.innerHTML = srcIcon.outerHTML;
      if (srcLabel) btnLabel.textContent = srcLabel.textContent;
    }
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (VALID.indexOf(saved) === -1) saved = 'grid-3';
  apply(saved);

  var closeMenu = function() {
    switcher.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var opened = switcher.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(opened));
  });
  options.forEach(function(o) {
    o.addEventListener('click', function() {
      var layout = o.dataset.layout;
      try { localStorage.setItem(KEY, layout); } catch (e) {}
      apply(layout);
      closeMenu();
    });
  });
  document.addEventListener('click', function(e) {
    if (!switcher.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenu();
  });
})();
</script>
`);

// Recolour the inlined holo SVGs from their source art. CSS can't copy a
// shape's own fill onto its stroke, so we do it here: for every painted shape
// we read its computed fill and use that (lifted toward visibility if it's very
// dark, e.g. the black 8-ball, so the outline doesn't vanish on the dark UI) as
// its stroke. We also pick each icon's dominant colour (by painted area) to
// drive --holo-glow, so the glow matches the art instead of the accent blue.
const holoScript = (nonce: string) => raw(`
<script nonce="${nonce}">
(function(){
  var SHAPES = 'path,circle,rect,ellipse,polygon,polyline,line';
  function parseRGB(s){
    var m = s && s.match(/rgba?\\(([^)]+)\\)/);
    if(!m) return null;
    var p = m[1].split(',');
    var r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
    if(isNaN(r) || isNaN(g) || isNaN(b)) return null;
    if(p.length > 3 && parseFloat(p[3]) === 0) return null; // fully transparent
    return [r, g, b];
  }
  function lum(c){ return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; }
  // Lift only very dark colours up to a luminance floor, scaling channels so
  // the hue is preserved; pure black becomes neutral grey.
  function brighten(c){
    var floor = 105, L = lum(c);
    if(L >= floor) return c;
    var mx = Math.max(c[0], c[1], c[2]);
    if(mx < 2) return [floor, floor, floor];
    var k = Math.min(floor / L, 255 / mx);
    return [c[0]*k, c[1]*k, c[2]*k];
  }
  function css(c){ return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }

  document.querySelectorAll('.holo-svg').forEach(function(svg){
    var area = {}, val = {}, best = null, bestArea = -1;
    svg.querySelectorAll(SHAPES).forEach(function(el){
      if(el.closest('defs,mask,clipPath,symbol')) return; // not drawn directly
      var c = parseRGB(getComputedStyle(el).fill);
      if(!c) return; // none / gradient: leave the neutral CSS fallback outline
      el.style.stroke = css(brighten(c));
      var a = 1;
      try { var bb = el.getBBox(); a = Math.max(1, bb.width * bb.height); } catch(e){}
      var key = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
      area[key] = (area[key] || 0) + a;
      val[key] = brighten(c);
      if(area[key] > bestArea){ bestArea = area[key]; best = key; }
    });
    var wrap = svg.closest('.holo-icon');
    if(best && wrap) wrap.style.setProperty('--holo-glow', css(val[best]));
  });
})();
</script>
`);

export function GamesPage(opts: { nonce: string; lv999?: boolean; user?: import('../components/navbar').NavUser | null }) {
  const body = html`
    ${styles}
    <div class="games-header">
      <h1 class="text-center">Games</h1>
      <p class="text-center text-fog-300">Choose a game to play!</p>
      <div class="layout-switcher">
        <button class="layout-switcher-btn" type="button" aria-haspopup="true" aria-label="Change layout">
          <span class="btn-icon">${ICON_GRID_3}</span>
          <span class="btn-label">Grid 3×3</span>
          ${ICON_CHEVRON}
        </button>
        <div class="layout-switcher-menu" role="menu">
          <button type="button" data-layout="grid-3" role="menuitem">
            ${ICON_GRID_3}<span class="label">Grid 3×3</span>
          </button>
          <button type="button" data-layout="grid-4" role="menuitem">
            ${ICON_GRID_4}<span class="label">Grid 4×4</span>
          </button>
          <button type="button" data-layout="list-view" role="menuitem">
            ${ICON_LIST}<span class="label">List</span>
          </button>
        </div>
      </div>
    </div>
    <div class="games-grid">
      ${GAMES.map(
    (game) => html`
          <a href="${game.href}" class="game-card">
            <div class="card-image">
              ${(() => {
    if (game.imageType === 'coin') return CoinImage();
    if (game.imageType === 'ai-slop') return AiSlopImage();
    if (game.imageType === 'cyclic') return CyclicImage();
    if (game.imageType === 'composite') {
      const overlaySrc = (game as any).overlaySrc as string;
      const overlay = overlaySrc.endsWith('.svg')
        ? HoloIcon(svgFileName(overlaySrc), 'holo-overlay')
        : null;
      return html`<div class="composite-icon">
              <img class="base" src="${(game as any).imageSrc}" alt="${game.name}" />
              ${overlay ?? html`<img class="overlay" src="${overlaySrc}" alt="" />`}
            </div>`;
    }
    const src = (game as any).imageSrc as string;
    if (src?.endsWith('.svg')) {
      const holo = HoloIcon(svgFileName(src));
      if (holo) return holo;
    }
    return html`<img src="${src}" alt="${game.name}" />`;
  })()}
            </div>
            <div class="card-content">
              <div class="card-header-bar">
                <div class="card-title-tab">
                  <h2>${game.name}</h2>
                </div>
              </div>
              <div class="card-body">
                <p>${game.info}</p>
              </div>
            </div>
          </a>
        `,
  )}
    </div>
    ${layoutScript(opts.nonce)}
    ${holoScript(opts.nonce)}
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
