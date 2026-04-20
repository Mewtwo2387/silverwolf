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
    background: linear-gradient(180deg, var(--heading-top) 0%, var(--heading-bottom) 100%);
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

  /* eidolon sections */
  .eidolon-section { padding-top: clamp(4rem, 8vw, 7rem); padding-bottom: clamp(4rem, 8vw, 7rem); padding-left: clamp(1rem, 4vw, 3rem); padding-right: clamp(1rem, 4vw, 3rem); }
  .eid-txt h2 {
    background: linear-gradient(180deg, var(--heading-top) 0%, var(--heading-bottom) 100%);
    -webkit-background-clip: text;
            background-clip: text;
    color: transparent;
  }
  .eid-txt, .eid-img { opacity: 0; }
  .eid-from-left.is-visible  { animation: about-slide-left  1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .eid-from-right.is-visible { animation: about-slide-right 1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
</style>
<noscript>
  <style>
    .about-text, .about-image { opacity: 1 !important; transform: none !important; }
    .eid-txt, .eid-img { opacity: 1 !important; transform: none !important; }
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

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.eid-txt, .eid-img').forEach((el) => observer.observe(el));
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
  const eidolonData = [
    {
      n: 1,
      title: 'Lorem Ipsum',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vehicula urna vel felis tincidunt, at lacinia nulla fringilla. Pellentesque habitant morbi tristique senectus et netus.',
    },
    {
      n: 2,
      title: 'Dolor Sit Amet',
      text: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.',
    },
    {
      n: 3,
      title: 'Consectetur',
      text: 'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti. Quis autem vel eum iure reprehenderit qui in ea voluptate velit.',
    },
    {
      n: 4,
      title: 'Adipiscing Elit',
      text: 'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat. Temporibus autem quibusdam et aut officiis debitis rerum necessitatibus.',
    },
    {
      n: 5,
      title: 'Sed Do Eiusmod',
      text: 'Quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit.',
    },
    {
      n: 6,
      title: 'Tempor Incididunt',
      text: 'Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio nam libero tempore.',
    },
  ];

  const eidolonSections = eidolonData.map(({ n, title, text }) => {
    const imgLeft = n % 2 === 1;
    const imgEl = html`
      <div class="eid-img ${imgLeft ? 'eid-from-left' : 'eid-from-right'} flex justify-center items-center max-[800px]:order-[-1]">
        <img src="/static/eidolons/Character_Silver_Wolf_Eidolon_${n}.webp" alt="Silver Wolf Eidolon ${n}" class="w-full h-auto max-w-[28rem]" />
      </div>`;
    const txtEl = html`
      <div class="eid-txt ${imgLeft ? 'eid-from-right' : 'eid-from-left'} max-w-[38rem] ${imgLeft ? 'justify-self-end' : 'justify-self-start'}">
        <h2 class="font-script font-normal tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(3rem, 8vw, 6rem);">${title}</h2>
        <p class="text-[1.1rem] leading-[1.6] text-fog-200">${text}</p>
      </div>`;
    return html`
      <section class="eidolon-section grid grid-cols-2 gap-12 items-center max-[800px]:grid-cols-1 max-[800px]:text-left">
        ${imgLeft ? html`${imgEl}${txtEl}` : html`${txtEl}${imgEl}`}
      </section>`;
  });

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
    ${eidolonSections}
  `;

  return Layout({
    title: 'Silverwolf — About',
    active: 'about',
    extraStyles: aboutExtras as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
  });
}
