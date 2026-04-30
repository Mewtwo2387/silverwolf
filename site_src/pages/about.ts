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

export function AboutPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { lv999, user } = opts;
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
        <h1 class="font-script font-normal tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(5rem, 12vw, 9rem);">Silverwolf</h1>
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
    active: 'home',
    extraHead: aboutExtras(opts.nonce) as unknown as HtmlEscapedString,
    body: body as unknown as HtmlEscapedString,
    nonce: opts.nonce,
    lv999,
    user: opts.user,
  });
}
