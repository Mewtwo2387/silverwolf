import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import type { NavUser } from '../components/navbar';

const aboutExtras = (nonce: string) => raw(`
<style>
  /* Desktop: hero image bleeds to the right edge; text gets the left gutter. */
  @media (min-width: 801px) {
    main:has(.about-wrap) { max-width: 100vw; padding-right: 0; padding-left: clamp(1rem, 4vw, 3rem); }
  }
  /* Mobile: drop main's side gutters entirely so images go edge-to-edge,
     and re-apply symmetric padding only on the text blocks. This avoids the
     horizontal-overflow / navbar-protrusion that 100vw + padding-right:0 caused. */
  @media (max-width: 800px) {
    main:has(.about-wrap) { max-width: 100%; padding-left: 0; padding-right: 0; }
    .about-wrap .about-text,
    .eidolon-section .eid-txt { padding-left: clamp(1rem, 4vw, 3rem); padding-right: clamp(1rem, 4vw, 3rem); }
    .eidolon-section { padding-left: 0; padding-right: 0; }
  }
  .about-text h1 {
    background: linear-gradient(180deg, var(--heading-top) 0%, var(--heading-bottom) 100%);
    -webkit-background-clip: text;
            background-clip: text;
    color: transparent;
    line-height: 1.15;
    padding-bottom: 0.15em;
  }
  /* Easter egg: ?theme=goof swaps the cursive heading for a hand-drawn
     toddler-tier signature that draws itself stroke by stroke. */
  .about-title--goof { padding-bottom: 0.1em; }
  .about-svg {
    display: block;
    width: 100%;
    max-width: 6.5em;
    height: auto;
    overflow: visible;
  }
  .about-svg .about-grad-top { stop-color: var(--heading-top); }
  .about-svg .about-grad-bot { stop-color: var(--heading-bottom); }
  .about-stroke {
    fill: none;
    stroke: url(#about-svg-grad);
    stroke-width: 13;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: about-draw 0.2s cubic-bezier(0.45, 0, 0.55, 1) forwards;
    animation-delay: calc(var(--i) * 0.145s + 0.1s);
  }
  @keyframes about-draw {
    to { stroke-dashoffset: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .about-stroke { animation: none; stroke-dashoffset: 0; }
  }
  .about-image img {
    -webkit-mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
            mask-image: radial-gradient(ellipse 110% 110% at 100% 50%, #000 35%, transparent 90%);
  }
  .about-cta-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  .about-login-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem 1.4rem;
    border-radius: 0.5rem;
    background: #5865F2;
    color: #fff;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid #4752C4;
    transition: filter 0.2s;
  }
  .about-login-cta:hover { filter: brightness(1.1); }
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
    line-height: 1.15;
    padding-bottom: 0.15em;
  }
  .eid-txt, .eid-img { opacity: 0; }
  .eid-from-left.is-visible  { animation: about-slide-left  1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .eid-from-right.is-visible { animation: about-slide-right 1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
</style>
<noscript>
  <style>
    .about-text, .about-image { opacity: 1 !important; transform: none !important; }
    .eid-txt, .eid-img { opacity: 1 !important; transform: none !important; }
    .about-stroke { animation: none !important; stroke-dashoffset: 0 !important; }
  </style>
</noscript>
<script nonce="${nonce}">
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

export function AboutPage(opts: { nonce: string; lv999?: boolean; goof?: boolean; user?: NavUser | null }) {
  const { lv999, goof, user } = opts;
  const titleBlock = goof
    ? html`
        <h1 class="about-title about-title--goof font-script font-normal tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(5rem, 12vw, 9rem);">
          <span style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Silverwolf</span>
          <svg class="about-svg" viewBox="0 0 780 200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="about-svg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" class="about-grad-top" />
                <stop offset="100%" class="about-grad-bot" />
              </linearGradient>
            </defs>
            <path class="about-stroke" pathLength="100" style="--i:0"   d="M 80,55 C 65,30 25,30 20,55 C 18,80 50,85 70,100 C 95,115 95,148 65,150 C 40,150 20,142 18,138" />
            <path class="about-stroke" pathLength="100" style="--i:1"   d="M 130,85 C 138,110 148,138 155,148" />
            <path class="about-stroke" pathLength="100" style="--i:1.5" d="M 150,65 L 156,65" />
            <path class="about-stroke" pathLength="100" style="--i:2"   d="M 175,148 C 180,120 195,80 195,55 C 195,35 215,35 212,55 C 210,75 208,110 220,148" />
            <path class="about-stroke" pathLength="100" style="--i:3"   d="M 240,80 C 245,108 258,140 268,148 C 280,138 292,108 300,82 C 302,78 306,80 310,84" />
            <path class="about-stroke" pathLength="100" style="--i:4"   d="M 325,118 C 335,98 365,98 367,118 C 367,138 340,148 330,138 C 325,132 323,123 328,118" />
            <path class="about-stroke" pathLength="100" style="--i:5"   d="M 380,148 C 387,125 393,100 400,90 C 405,85 408,92 410,100 C 412,108 420,105 425,100" />
            <path class="about-stroke" pathLength="100" style="--i:6"   d="M 445,82 C 450,108 460,140 470,148 C 478,138 485,115 490,98 C 498,115 505,140 515,148 C 525,138 532,115 540,90 C 542,85 546,88 550,92" />
            <path class="about-stroke" pathLength="100" style="--i:7"   d="M 580,105 C 568,115 565,140 585,145 C 605,148 620,128 615,110 C 610,92 588,88 580,98 C 590,100 600,105 600,112" />
            <path class="about-stroke" pathLength="100" style="--i:8"   d="M 620,148 C 633,118 640,85 633,60 C 627,38 650,38 655,62 C 658,90 658,120 668,148" />
            <path class="about-stroke" pathLength="100" style="--i:9"   d="M 695,80 C 700,55 708,30 715,28 C 725,26 728,42 720,70 C 712,100 695,158 685,182 C 678,195 660,193 660,180 C 662,170 675,170 685,175" />
          </svg>
        </h1>`
    : html`<h1 class="about-title font-script font-normal tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(5rem, 12vw, 9rem);">Silverwolf</h1>`;
  const ctaBlock = user
    ? html`
      <div class="about-cta-row">
        <a href="/me" class="about-login-cta">Go to your dashboard →</a>
      </div>`
    : html`
      <div class="about-cta-row">
        <a href="/auth/discord/login" class="about-login-cta">
          <svg width="20" height="20" viewBox="0 0 71 55" aria-hidden="true"><path fill="currentColor" d="M60.1 4.9A58.6 58.6 0 0 0 45.6.6a40.7 40.7 0 0 0-1.9 3.9 54.1 54.1 0 0 0-16.2 0A40.4 40.4 0 0 0 25.5.6 58.4 58.4 0 0 0 11 4.9C2 18.4-.4 31.5.7 44.4a58.9 58.9 0 0 0 17.9 9.1 43.2 43.2 0 0 0 3.8-6.2 38 38 0 0 1-6-2.9c.5-.4 1-.8 1.5-1.2a42 42 0 0 0 35.3 0c.5.4 1 .8 1.5 1.2a37.6 37.6 0 0 1-6 2.9 43 43 0 0 0 3.8 6.2 58.7 58.7 0 0 0 17.9-9.1c1.2-14.9-2.7-27.9-9.4-39.5ZM23.7 36.6c-3.5 0-6.5-3.3-6.5-7.3 0-4.1 2.9-7.4 6.5-7.4 3.6 0 6.5 3.3 6.5 7.4 0 4-2.9 7.3-6.5 7.3Zm23.6 0c-3.6 0-6.5-3.3-6.5-7.3 0-4.1 2.9-7.4 6.5-7.4 3.5 0 6.5 3.3 6.5 7.4 0 4-2.9 7.3-6.5 7.3Z"/></svg>
          Login with Discord
        </a>
      </div>`;
  const eidolonData = [
    {
      n: 1,
      title: 'Utils',
      text: 'Honestly.. boring? like even silver wolf pictured here isnt even facing us cuz she lowkirkenuinely doesnt give a fuge. some utils : /say, /convert,/profile, /avatar and...shurg idk not exactly exciting imo. more out of boring necessity.',
    },
    {
      n: 2,
      title: '@grok is this true?',
      text: 'ask the totally real grok or gork. omg we are so relevant now we added ai into the bot :fire: we are at the forefront of tech! we should ipo and get 7 dollars. enough to get something nice but not expensive! ',
    },
    {
      n: 3,
      title: 'Games',
      text: 'claim dinonuggies, gamble mystic credits, and buy..more upgrades so you can earn more dinonuggies...economy is kinda broken tho...',
    },
    {
      n: 4,
      title: 'Womb eviction commemoration day',
      text: 'Set your birthday, when it comes you get a ping and everyone knows, #OnThisDay you got expelled from you momma. You can also set a reminder to other peeps bdays.',
    },
    {
      n: 5,
      title: 'Health & Wellness - Poop tracking!',
      text: 'LIVE SILVERWOLF REACTION. Dont be like finch who hates the idea of poop tracking. ANNOUNCE TO THE WHOLE WORLD YOU DID YOUR BUINSESS!! and also gut health is important you start by tracking it smh',
    },
    {
      n: 6,
      title: 'E sex!',
      text: 'Yes... incase you couldnt get laid irl, you can with someone...on discord!!!. consent is important tho. Theres also a chance you make a virtual kid that can slave off gambling and doing tasks... Horrified yet? ',
    },
  ];

  const eidolonSections = eidolonData.map(({ n, title, text }) => {
    const imgLeft = n % 2 === 1;
    const eidolonStem = lv999 ? `Character_Silver_Wolf_LV.999_Eidolon_${n}` : `Character_Silver_Wolf_Eidolon_${n}`;
    const imgEl = html`
      <div class="eid-img ${imgLeft ? 'eid-from-left' : 'eid-from-right'} flex justify-center items-center max-[800px]:order-[-1]">
        <picture class="block w-full max-w-[28rem]">
          <source type="image/avif" srcset="/static/eidolons/${eidolonStem}.avif" />
          <img src="/static/eidolons/${eidolonStem}.webp" alt="Silver Wolf Eidolon ${n}" width="1000" height="1000" loading="lazy" decoding="async" class="w-full h-auto" />
        </picture>
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
        ${titleBlock}
        <p class="text-[1.1rem] leading-[1.6] text-fog-200">
          Silverwolf-bot is a multipurpose bot made by Ei, and XeIris.
          Mostly inside jokes, parodies and tech stack exploration,
          it runs on Bun using Typescript.
        </p>
        ${ctaBlock}
      </div>
      <div class="about-image flex justify-start items-center max-[800px]:order-[-1]">
        <picture class="block w-full">
          <source type="image/avif" srcset="${lv999 ? '/static/silverwolfLv.999.avif' : '/static/silverwolf.avif'}" />
          <img src="${lv999 ? '/static/silverwolfLv.999.webp' : '/static/silverwolf.webp'}" alt="Silverwolf" width="${lv999 ? '1800' : '2000'}" height="${lv999 ? '1800' : '2000'}" decoding="async" fetchpriority="high" class="w-full h-auto" />
        </picture>
      </div>
    </section>
    ${eidolonSections}
  `;

  return Layout({
    title: 'Silverwolf — About',
    active: 'about',
    extraHead: aboutExtras(opts.nonce) as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
    nonce: opts.nonce,
    lv999,
    user: opts.user,
  });
}
