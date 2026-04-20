import { html, raw } from 'hono/html';
import { Layout } from '../components/layout';

const aboutIntroScript = raw(`
<script>
(() => {
  try {
    if (!sessionStorage.getItem('about-intro-played')) {
      document.documentElement.classList.add('about-intro');
      sessionStorage.setItem('about-intro-played', '1');
    }
  } catch (_) { /* sessionStorage unavailable */ }
})();
</script>
`);

const aboutStyles = html`
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Italianno&display=swap" rel="stylesheet" />
  ${aboutIntroScript}
  <style>
    main:has(.about-wrap) { max-width: 100vw; padding-right: 0; padding-left: clamp(1rem, 4vw, 3rem); }
    .about-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 3rem;
      align-items: center;
      min-height: calc(100vh - 180px);
    }
    .about-text { max-width: 38rem; justify-self: start; }
    .about-text h1 {
      font-family: 'Italianno', cursive;
      font-size: clamp(5rem, 12vw, 9rem);
      font-weight: 400;
      letter-spacing: 0.01em;
      line-height: 0.95;
      margin: 0 0 1rem;
      background: linear-gradient(180deg, #fff 0%, #a2adff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .about-text p {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #b8b9c2;
    }
    .about-image {
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }
    .about-image img {
      width: 100%;
      height: auto;
      -webkit-mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
              mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
    }
    @media (max-width: 800px) {
      .about-wrap { grid-template-columns: 1fr; text-align: left; }
      .about-text { justify-self: start; }
      .about-image { order: -1; }
    }
    .about-intro .about-text {
      opacity: 0;
      transform: translateX(-1rem);
      animation: about-text-in 0.8s 0.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .about-intro .about-image {
      opacity: 0;
      transform: translateX(1rem);
      animation: about-image-in 0.8s 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes about-text-in { to { opacity: 1; transform: translateX(0); } }
    @keyframes about-image-in { to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .about-intro .about-text,
      .about-intro .about-image { animation: none; opacity: 1; transform: none; }
    }
  </style>
`;

export function AboutPage() {
  const body = html`
    <section class="about-wrap">
      <div class="about-text">
        <h1>Silverwolf</h1>
        <p>
          Silverwolf-bot is a multipurpose bot made by Ei, and XeIris.
          Mostly inside jokes, parodies and tech stack exploration,
          it runs on Bun using Typescript.
        </p>
      </div>
      <div class="about-image">
        <img src="/static/silverwolf.webp" alt="Silverwolf" />
      </div>
    </section>
  `;

  return Layout({
    title: 'Silverwolf — About', active: 'about', extraStyles: aboutStyles, body,
  });
}
