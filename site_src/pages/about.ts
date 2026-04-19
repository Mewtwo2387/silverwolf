import { html } from 'hono/html';
import { Layout } from '../components/layout';

const aboutStyles = html`
  <style>
    .about-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 3rem;
      align-items: center;
      min-height: calc(100vh - 180px);
    }
    .about-text { max-width: 32rem; }
    .about-text h1 {
      font-size: clamp(3rem, 7vw, 5.5rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
      margin: 0 0 1.25rem;
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
      justify-content: center;
      align-items: center;
    }
    .about-image img {
      width: 100%;
      max-width: 460px;
      height: auto;
      -webkit-mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, #000 55%, transparent 100%);
              mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, #000 55%, transparent 100%);
    }
    @media (max-width: 800px) {
      .about-wrap { grid-template-columns: 1fr; text-align: left; }
      .about-image { order: -1; }
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

  return Layout({ title: 'Silverwolf — About', active: 'about', extraStyles: aboutStyles, body });
}
