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
    border-radius: 1.5rem;
    border: 1px solid rgba(34, 211, 255, 0.25);
    padding: 0.5rem;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%);
    box-shadow: 
      0 0 0 4px var(--ink-900),
      0 0 0 5px rgba(167, 139, 250, 0.35),
      0 12px 36px rgba(0, 0, 0, 0.5),
      0 0 25px rgba(34, 211, 255, 0.12);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s;
  }
  .about-image img:hover {
    transform: scale(1.04) rotate(1deg);
    border-color: rgba(34, 211, 255, 0.6);
    box-shadow: 
      0 0 0 4px var(--ink-900),
      0 0 0 5px rgba(34, 211, 255, 0.6),
      0 16px 40px rgba(0, 0, 0, 0.6),
      0 0 30px rgba(34, 211, 255, 0.25);
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
    padding: 0.7rem 1.6rem;
    border-radius: 4px;
    background: linear-gradient(135deg, color-mix(in oklab, #5865F2 8%, transparent) 0%, color-mix(in oklab, #404eed 8%, transparent) 100%);
    color: #5865F2;
    font-weight: 700;
    text-decoration: none;
    border: 1px solid #5865F2;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 8px rgba(88, 101, 242, 0.25);
    transition: transform 0.1s, box-shadow 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .about-login-cta:hover {
    transform: translateY(-1px);
    background: linear-gradient(135deg, color-mix(in oklab, #5865F2 25%, transparent) 0%, color-mix(in oklab, #404eed 25%, transparent) 100%);
    color: #ffffff;
    border-color: #7289da;
    box-shadow: 0 0 16px rgba(88, 101, 242, 0.55), 0 0 4px #5865F2;
  }
  .about-login-cta:active {
    transform: translateY(1px);
    box-shadow: 0 0 6px rgba(88, 101, 242, 0.2);
  }
  @keyframes about-slide-left {
    0%   { opacity: 0; transform: translate3d(-5rem, 0, 0); }
    100% { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes about-slide-right {
    0%   { opacity: 0; transform: translate3d(5rem, 0, 0); }
    100% { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  .about-text {
    animation: about-slide-left 1.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both !important;
    background: color-mix(in oklab, var(--ink-800) 65%, transparent);
    border: 1px solid rgba(34, 211, 255, 0.2);
    border-radius: 0.75rem;
    padding: 3rem 2.5rem 2.5rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 
      0 10px 30px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 15px rgba(34, 211, 255, 0.05);
    position: relative;
    overflow: hidden;
  }
  .about-text::before {
    content: 'SYS.ABOUT.LOG_00';
    position: absolute;
    top: 0.8rem;
    left: 1.2rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: rgba(34, 211, 255, 0.4);
    letter-spacing: 0.08em;
  }
  .about-text::after {
    content: '[ONLINE]';
    position: absolute;
    top: 0.8rem;
    right: 1.2rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #10b981;
    letter-spacing: 0.08em;
  }
  .about-image { animation: about-slide-right 1.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both !important; }

  /* eidolon sections */
  .eidolon-section { padding-top: clamp(4rem, 8vw, 7rem); padding-bottom: clamp(4rem, 8vw, 7rem); padding-left: clamp(1rem, 4vw, 3rem); padding-right: clamp(1rem, 4vw, 3rem); }
  .eid-txt {
    background: color-mix(in oklab, var(--ink-800) 65%, transparent);
    border: 1px solid rgba(34, 211, 255, 0.2);
    border-radius: 0.75rem;
    padding: 2.25rem 2rem 2rem;
    backdrop-filter: blur(12px);
    box-shadow: 
      0 10px 30px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 15px rgba(34, 211, 255, 0.05);
    position: relative;
    overflow: hidden;
  }
  .eid-txt::before {
    content: 'SYS.EIDOLON.LOG_0' attr(data-index);
    position: absolute;
    top: 0.6rem;
    left: 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: rgba(34, 211, 255, 0.4);
    letter-spacing: 0.08em;
  }
  .eid-txt::after {
    content: '[ONLINE]';
    position: absolute;
    top: 0.6rem;
    right: 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: #10b981;
    letter-spacing: 0.08em;
  }
  .eid-txt h2 {
    background: linear-gradient(180deg, var(--heading-top) 0%, var(--heading-bottom) 100%);
    -webkit-background-clip: text;
            background-clip: text;
    color: transparent;
    line-height: 1.15;
    padding-bottom: 0.15em;
  }
  .eid-img img {
    border-radius: 1.5rem;
    border: 1px solid rgba(34, 211, 255, 0.25);
    padding: 0.5rem;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%);
    box-shadow: 
      0 0 0 4px var(--ink-900),
      0 0 0 5px rgba(167, 139, 250, 0.35),
      0 12px 36px rgba(0, 0, 0, 0.5),
      0 0 25px rgba(34, 211, 255, 0.12);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s;
  }
  .eid-img img:hover {
    transform: scale(1.04) rotate(1deg);
    border-color: rgba(34, 211, 255, 0.6);
    box-shadow: 
      0 0 0 4px var(--ink-900),
      0 0 0 5px rgba(34, 211, 255, 0.6),
      0 16px 40px rgba(0, 0, 0, 0.6),
      0 0 30px rgba(34, 211, 255, 0.25);
  }
  .eid-txt, .eid-img { opacity: 0; }
  .eid-from-left.is-visible  { animation: about-slide-left  1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .eid-from-right.is-visible { animation: about-slide-right 1.8s cubic-bezier(0.22, 1, 0.36, 1) both; }

  /* Typing text animations and terminal cursor */
  .typing-text {
    visibility: hidden;
  }
  .typing-text.is-typing,
  .typing-text.is-typed {
    visibility: visible;
  }
  .terminal-cursor {
    display: inline-block;
    color: rgba(34, 211, 255, 0.95);
    margin-left: 2px;
    font-weight: bold;
    vertical-align: middle;
  }
  .terminal-cursor.blink {
    animation: terminal-blink 1s step-end infinite;
  }
  @keyframes terminal-blink {
    from, to { opacity: 0; }
    50% { opacity: 1; }
  }

  /* ── Artist credit: clickable hero image ───────────────────────────────── */
  .artist-trigger { cursor: pointer; }
  .artist-trigger .artist-hint {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: 9999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    color: var(--accent-light);
    background: color-mix(in oklab, var(--ink-900) 70%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 45%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 12px var(--glow-faint);
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.25s, transform 0.25s;
  }
  .artist-trigger:hover .artist-hint,
  .artist-trigger:focus-visible .artist-hint {
    opacity: 1;
    transform: translateY(0);
  }
  .artist-hint svg { width: 16px; height: 16px; }

  /* ── Artist modal (Holographic Transmitter Theme — matches birthdays) ──── */
  #artist-modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(4, 6, 13, 0.75);
    backdrop-filter: blur(8px) saturate(180%);
    -webkit-backdrop-filter: blur(8px) saturate(180%);
  }
  #artist-modal {
    position: relative;
    width: 100%;
    max-width: 22rem;
    background: color-mix(in oklab, var(--ink-800) 75%, transparent);
    border: 1px solid var(--accent);
    border-radius: 1rem;
    padding: 1.75rem;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 30px var(--glow-faint);
    overflow: hidden;
  }
  #artist-modal::before {
    content: '// ARTIST_CREDIT';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2.75rem;
    display: flex;
    align-items: center;
    background: linear-gradient(90deg, rgba(34, 211, 255, 0.1), transparent);
    border-bottom: 1px solid rgba(34, 211, 255, 0.2);
    padding: 0 1.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--accent);
    letter-spacing: 0.08em;
  }
  #artist-modal-close {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    z-index: 10;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    color: var(--danger);
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(255, 107, 138, 0.2);
    background: rgba(255, 107, 138, 0.05);
  }
  #artist-modal-close:hover {
    color: #ffffff;
    background: var(--danger);
    border-color: var(--danger);
    box-shadow: 0 0 10px rgba(255, 107, 138, 0.5);
  }
  #artist-modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 3.25rem;
  }
  #artist-modal-body .artist-caption {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--fog-300);
    margin: 0 0 0.25rem;
    text-align: center;
    letter-spacing: 0.02em;
  }
  .artist-link {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 0.9rem;
    border-radius: 0.6rem;
    text-decoration: none;
    color: var(--fog-100);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    background: color-mix(in oklab, var(--ink-900) 45%, transparent);
    border: 1px solid var(--ink-600);
    transition: border-color 0.2s, background-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .artist-link:hover {
    transform: translateY(-1px);
    border-color: color-mix(in oklab, var(--accent) 55%, transparent);
    background: color-mix(in oklab, var(--accent) 10%, transparent);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 0 10px var(--glow-faint);
  }
  .artist-link svg { width: 20px; height: 20px; flex-shrink: 0; }
  .artist-link .artist-link-label { display: flex; flex-direction: column; line-height: 1.25; }
  .artist-link .artist-link-name { color: var(--fog-100); font-weight: 600; }
  .artist-link .artist-link-sub { color: var(--fog-400); font-size: 0.72rem; }
  .artist-link .artist-link-arrow { margin-left: auto; color: var(--accent-light); opacity: 0.7; }
</style>
<noscript>
  <style>
    .about-text, .about-image { opacity: 1 !important; transform: none !important; }
    .eid-txt, .eid-img { opacity: 1 !important; transform: none !important; }
    .about-stroke { animation: none !important; stroke-dashoffset: 0 !important; }
    .typing-text { visibility: visible !important; }
  </style>
</noscript>
<script nonce="${nonce}">
(() => {
  const animateTyping = (el) => {
    if (el.classList.contains('is-typed')) return;
    el.classList.add('is-typing');

    const originalText = el.getAttribute('data-text') || el.textContent.trim();
    let textToType = originalText;

    if (textToType.endsWith('.')) {
      textToType = textToType.slice(0, -1);
    }

    const words = originalText.split(/\\s+/).filter(w => w.length > 0);
    const wordCount = words.length || 1;
    const wps = 5;
    const totalDuration = (wordCount / wps) * 1000;
    const charCount = textToType.length || 1;
    const baseInterval = totalDuration / charCount;

    el.textContent = '';

    const textSpan = document.createElement('span');
    el.appendChild(textSpan);

    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'terminal-cursor';
    cursorSpan.textContent = '.';
    el.appendChild(cursorSpan);

    let charIndex = 0;

    const typeChar = () => {
      if (charIndex < textToType.length) {
        textSpan.textContent += textToType[charIndex];
        charIndex++;
        const randomDelay = baseInterval * (0.8 + Math.random() * 0.4);
        setTimeout(typeChar, randomDelay);
      } else {
        cursorSpan.classList.add('blink');
        el.classList.remove('is-typing');
        el.classList.add('is-typed');
      }
    };

    typeChar();
  };

  const run = () => {
    const typingEls = document.querySelectorAll('.typing-text');
    typingEls.forEach((el) => {
      const text = el.textContent.trim().replace(/\\s+/g, ' ');
      el.setAttribute('data-text', text);
      el.textContent = '';
    });

    const els = document.querySelectorAll('.about-text, .about-image');
    els.forEach((el) => { void el.getBoundingClientRect(); });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.forEach((el) => el.classList.add('is-in'));

        const mainTypingEl = document.querySelector('.about-text .typing-text');
        if (mainTypingEl) {
          setTimeout(() => {
            animateTyping(mainTypingEl);
          }, 350);
        }
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          
          if (entry.target.classList.contains('eid-txt')) {
            const typingEl = entry.target.querySelector('.typing-text');
            if (typingEl) {
              animateTyping(typingEl);
            }
          }

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

// Artist-credit modal shell + driver. Rendered in the body (after the hero)
// so the script runs once the trigger exists — mirrors the birthdays modal.
const artistModal = raw(`
<div id="artist-modal-backdrop" role="presentation">
  <div id="artist-modal" role="dialog" aria-modal="true" aria-label="Artist credit">
    <button id="artist-modal-close" aria-label="Close">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"
           fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
      </svg>
    </button>
    <div id="artist-modal-body">
      <p class="artist-caption">Illustration by the artist — find more of their work:</p>
      <a class="artist-link" href="https://www.pixiv.net/en/users/15611520" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="color:#0096fa;"><path d="M4.935 0A4.924 4.924 0 0 0 0 4.935v14.13A4.924 4.924 0 0 0 4.935 24h14.13A4.924 4.924 0 0 0 24 19.065V4.935A4.924 4.924 0 0 0 19.065 0H4.935zm7.81 4.547c2.181 0 4.058.676 5.399 1.847a5.74 5.74 0 0 1 2.01 4.42c0 1.694-.636 3.244-1.794 4.366-1.183 1.148-2.804 1.78-4.566 1.78-1.844 0-3.55-.633-4.39-1.027v2.84c.43.123 1.029.31 1.029.953 0 .532-.426.96-.954.96H5.95a.957.957 0 0 1-.957-.96c0-.604.564-.823.954-.94V7.81c1.214-1.92 3.59-3.263 6.798-3.263zm.123 1.738c-2.51 0-4.434 1.276-5.276 2.524v5.494c.764.435 2.46 1.156 4.21 1.156 1.268 0 2.4-.45 3.212-1.234.81-.785 1.262-1.872 1.262-3.066 0-1.198-.45-2.288-1.262-3.072-.812-.785-1.946-1.236-3.216-1.236l-.13.013z"/></svg>
        <span class="artist-link-label">
          <span class="artist-link-name">Pixiv</span>
          <span class="artist-link-sub">pixiv.net/en/users/15611520</span>
        </span>
        <span class="artist-link-arrow">→</span>
      </a>
      <a class="artist-link" href="https://x.com/CAISENA33" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
        <span class="artist-link-label">
          <span class="artist-link-name">X (Twitter)</span>
          <span class="artist-link-sub">@CAISENA33</span>
        </span>
        <span class="artist-link-arrow">→</span>
      </a>
    </div>
  </div>
</div>
`);

const artistModalScript = (nonce: string) => raw(`
<script nonce="${nonce}">
(() => {
  const backdrop = document.getElementById('artist-modal-backdrop');
  const modal    = document.getElementById('artist-modal');
  const closeBtn = document.getElementById('artist-modal-close');
  const trigger  = document.querySelector('.artist-trigger');
  if (!backdrop || !modal || !closeBtn || !trigger) return;

  // Escape any stacking context inside <main>.
  document.body.appendChild(backdrop);

  let closeTimer = null;
  let previousActiveElement = null;
  let previousBodyOverflow = '';

  function openModal() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    previousActiveElement = document.activeElement;
    previousBodyOverflow = document.body.style.overflow;
    modal.style.transition = 'none';
    modal.style.transform  = 'scale(0.94) translateY(8px)';
    modal.style.opacity    = '0';
    backdrop.style.display = 'flex';
    backdrop.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        modal.style.transition = 'transform 0.22s cubic-bezier(0.22,1,0.36,1), opacity 0.18s ease';
        modal.style.transform  = 'scale(1) translateY(0)';
        modal.style.opacity    = '1';
      });
    });
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    if (closeTimer) return;
    if (!backdrop.classList.contains('open')) return;
    backdrop.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    modal.style.transition = 'transform 0.15s cubic-bezier(0.4,0,1,1), opacity 0.15s ease';
    modal.style.transform  = 'scale(0.94) translateY(6px)';
    modal.style.opacity    = '0';
    closeTimer = setTimeout(function() {
      backdrop.style.display       = 'none';
      modal.style.transition       = 'none';
      modal.style.transform        = '';
      modal.style.opacity          = '';
      document.body.style.overflow = previousBodyOverflow || '';
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
      previousActiveElement = null;
      previousBodyOverflow = '';
      closeTimer = null;
    }, 160);
  }

  trigger.addEventListener('click', openModal);
  trigger.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
  });
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });
})();
</script>
`);

export function AboutPage(opts: { nonce: string; lv999?: boolean; goof?: boolean; user?: NavUser | null }) {
  const { lv999, goof, user } = opts;
  const titleBlock = goof
    ? html`
        <h1 class="about-title about-title--goof font-mono italic font-bold tracking-[0.01em] leading-[0.95] mb-4" style="font-size: clamp(3.5rem, 9vw, 5.5rem);">
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
    : html`<h1 class="about-title font-mono italic font-bold tracking-tight mb-4" style="font-size: clamp(2.25rem, 6vw, 4.25rem);">Silverwolf</h1>`;
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
      <div class="eid-txt font-mono ${imgLeft ? 'eid-from-right' : 'eid-from-left'} max-w-[38rem] ${imgLeft ? 'justify-self-end' : 'justify-self-start'}" data-index="${n}">
        <h2 class="font-mono italic font-bold tracking-tight mb-4" style="font-size: clamp(2rem, 5.5vw, 3.75rem);">${title}</h2>
        <p class="typing-text text-[1.1rem] leading-[1.6] text-fog-200">${text}</p>
      </div>`;
    return html`
      <section class="eidolon-section grid grid-cols-2 gap-12 items-center max-[800px]:grid-cols-1 max-[800px]:text-left">
        ${imgLeft ? html`${imgEl}${txtEl}` : html`${txtEl}${imgEl}`}
      </section>`;
  });

  const body = html`
    <section class="about-wrap grid grid-cols-2 gap-12 items-center min-h-[calc(100vh-180px)] max-[800px]:grid-cols-1 max-[800px]:text-left">
      <div class="about-text font-mono max-w-[38rem] justify-self-start">
        ${titleBlock}
        <p class="typing-text text-[1.1rem] leading-[1.6] text-fog-200">
          Silverwolf-bot is a multipurpose bot made by Ei, and XeIris.
          Mostly inside jokes, parodies and tech stack exploration,
          it runs on Bun using Typescript.
        </p>
        ${ctaBlock}
      </div>
      <div class="about-image artist-trigger relative flex justify-center items-center max-[800px]:order-[-1]" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="artist-modal" aria-expanded="false" aria-label="View artist credit">
        <picture class="block w-full max-w-[48rem]">
          <source type="image/avif" srcset="${lv999 ? '/static/silverwolfLv.999.avif' : '/static/silverwolf.avif'}" />
          <img src="${lv999 ? '/static/silverwolfLv.999.webp' : '/static/silverwolf.webp'}" alt="Silverwolf" width="${lv999 ? '1800' : '2000'}" height="${lv999 ? '1800' : '2000'}" decoding="async" fetchpriority="high" class="w-full h-auto" />
        </picture>
        <span class="artist-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          artist credit
        </span>
      </div>
    </section>
    ${artistModal}
    ${artistModalScript(opts.nonce)}
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
