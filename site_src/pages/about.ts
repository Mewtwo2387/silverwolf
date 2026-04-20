import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';

const aboutExtras = raw(`
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Italianno&display=swap" rel="stylesheet" />
<style>
  main:has(.about-wrap) { max-width: 100vw; padding-right: 0; padding-left: clamp(1rem, 4vw, 3rem); }
  .about-text h1 {
    background: linear-gradient(180deg, #fff 0%, #a2adff 100%);
    -webkit-background-clip: text;
            background-clip: text;
    color: transparent;
  }
  .about-image img {
    -webkit-mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
            mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
  }
  @keyframes about-slide-left {
    0%   { opacity: 0; transform: translate3d(-5rem, 0, 0); }
    100% { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes about-slide-right {
    0%   { opacity: 0; transform: translate3d(5rem, 0, 0); }
    100% { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  .about-text  { animation: about-slide-left  1.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both !important; }
  .about-image { animation: about-slide-right 1.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both !important; }
</style>
<noscript>
  <style>
    .about-text, .about-image { opacity: 1 !important; transform: none !important; }
  </style>
</noscript>
<script>
(() => {
  const run = () => {
    const els = document.querySelectorAll('.about-text, .about-image');
    els.forEach((el) => { void el.getBoundingClientRect(); });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.forEach((el) => el.classList.add('is-in'));
      });
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
</script>
`);

export function AboutPage() {
  const body = html`
    <section class="about-wrap grid grid-cols-2 gap-12 items-center min-h-[calc(100vh-180px)] max-[800px]:grid-cols-1 max-[800px]:text-left">
      <div class="about-text max-w-[38rem] justify-self-start">
        <h1 class="font-script font-normal tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(5rem, 12vw, 9rem);">Silverwolf</h1>
        <p class="text-[1.1rem] leading-[1.6] text-fog-200">
          Silverwolf-bot is a multipurpose bot made by Ei, and XeIris.
          Mostly inside jokes, parodies and tech stack exploration,
          it runs on Bun using Typescript.
        </p>
      </div>
      <div class="about-image flex justify-start items-center max-[800px]:order-[-1]">
        <img src="/static/silverwolf.webp" alt="Silverwolf" class="w-full h-auto" />
      </div>
    </section>
  `;

  return Layout({
    title: 'Silverwolf — About',
    active: 'about',
    extraStyles: aboutExtras as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
  });
}
