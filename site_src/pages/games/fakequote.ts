import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';

const FONTS = [
  { value: 'sans-serif', label: 'Default (Sans-serif)' },
  { value: 'playfair', label: 'Playfair Display (Elegant Serif)' },
  { value: 'caveat', label: 'Caveat (Handwritten)' },
  { value: 'cinzel', label: 'Cinzel (Dramatic Classic)' },
  { value: 'righteous', label: 'Righteous (Bold Display)' },
  { value: 'special-elite', label: 'Special Elite (Typewriter)' },
  { value: 'minecraft', label: 'Minecraft (Pixel)' },
  { value: 'harrypotter', label: 'Harry Potter (Wizarding)' },
  { value: 'genshin', label: 'Genshin Impact' },
  { value: 'comic-sans', label: 'Comic Sans (Comic Neue)' },
  { value: 'bebas-neue', label: 'Bebas Neue (Condensed)' },
];

const PROFILE_COLOURS = [
  { value: 'normal', label: 'Normal' },
  { value: 'bw', label: 'Black and White' },
  { value: 'inverted', label: 'Inverted' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'nightmare', label: 'Nightmare Fuel' },
];

export function FakeQuotePage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  const extras = raw(`
<style>
  .fq-container {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1rem;
    max-width: 760px;
    margin-left: auto;
    margin-right: auto;
  }
  .fq-viewport {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    background: var(--ink-900);
    border: 1px dashed var(--ink-600);
    border-radius: 0.75rem;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fog-400);
    font-size: 0.95rem;
    text-align: center;
    padding: 1rem;
  }
  .fq-viewport img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .fq-viewport.has-image { border-style: solid; border-color: var(--ink-600); }
  .fq-viewport .fq-placeholder { max-width: 32ch; line-height: 1.5; }
  .fq-viewport.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
  }
  .fq-spinner {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 4px solid var(--ink-600);
    border-top-color: var(--accent);
    animation: fq-spin 0.9s linear infinite;
    z-index: 2;
    display: none;
  }
  .fq-viewport.loading .fq-spinner { display: block; }
  @keyframes fq-spin { to { transform: rotate(360deg); } }

  .fq-form {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
  }
  @media (max-width: 600px) { .fq-form { grid-template-columns: 1fr; } }
  .fq-form .full { grid-column: 1 / -1; }
  .fq-form label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--fog-300);
  }
  .fq-form .req::after {
    content: ' *';
    color: var(--danger, #f43f5e);
  }
  .fq-form input[type="text"],
  .fq-form input[type="number"],
  .fq-form textarea,
  .fq-form select {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    color: var(--fog-100);
    font: inherit;
  }
  .fq-form textarea { resize: vertical; min-height: 5rem; }
  .fq-form input:focus, .fq-form textarea:focus, .fq-form select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .fq-form .missing { border-color: var(--danger, #f43f5e) !important; box-shadow: 0 0 0 1px var(--danger, #f43f5e); }

  .fq-swatches {
    display: flex;
    gap: 0.5rem;
  }
  .fq-swatch {
    flex: 1;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--ink-600);
    background: var(--ink-800);
    color: var(--fog-200);
    font: inherit;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: border-color 0.15s, background 0.15s;
  }
  .fq-swatch:hover { border-color: var(--accent); }
  .fq-swatch.active { border-color: var(--accent); background: var(--ink-700, #1e2030); color: var(--accent-light); }
  .fq-swatch .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--ink-600);
    display: inline-block;
  }
  .fq-swatch .dot.black { background: #000; }
  .fq-swatch .dot.white { background: #fff; }

  .fq-colour-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .fq-colour-row input[type="color"] {
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    background: var(--ink-800);
    cursor: pointer;
  }
  .fq-colour-row input[type="text"] { flex: 1; min-width: 0; }
  .fq-colour-row .clear-btn {
    background: transparent;
    border: 1px solid var(--ink-600);
    color: var(--fog-300);
    border-radius: 4px;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .fq-colour-row .clear-btn:hover { color: var(--fog-100); border-color: var(--accent); }

  .fq-actions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: stretch;
  }
  .fq-generate {
    position: relative;
    overflow: hidden;
    padding: 0.8rem 2rem;
  }
  .fq-generate .label-text { position: relative; z-index: 2; }
  /* Cooldown progress bar: a coloured layer that grows from 0% back to 100% width */
  .fq-generate .cooldown-fill {
    position: absolute;
    inset: 0;
    width: 0%;
    background: linear-gradient(135deg, var(--accent), var(--accent-pale));
    transition: width linear;
    z-index: 1;
  }
  .fq-generate.cooling { background: var(--ink-700, #1e2030); }
  .fq-generate.cooling .label-text { color: var(--fog-200); }

  .fq-message {
    min-height: 1.4rem;
    font-weight: 600;
    color: var(--accent-light);
    text-align: center;
  }
  .fq-message.error { color: var(--danger, #f43f5e); }

  .login-cta {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.5rem 2rem;
    text-align: center;
    color: var(--fog-200);
  }
  .login-cta a { color: var(--accent-light); font-weight: bold; text-decoration: none; }
  .login-cta a:hover { color: var(--accent); }
</style>
`);

  const fontOptions = FONTS.map(
    (f) => html`<option value="${f.value}">${f.label}</option>`,
  );
  const profileOptions = PROFILE_COLOURS.map(
    (p) => html`<option value="${p.value}">${p.label}</option>`,
  );

  const formScript = raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};
  const form = document.getElementById('fq-form');
  const btn = document.getElementById('fq-generate');
  const labelText = btn.querySelector('.label-text');
  const fill = btn.querySelector('.cooldown-fill');
  const viewport = document.getElementById('fq-viewport');
  const placeholder = document.getElementById('fq-placeholder');
  const imageEl = document.getElementById('fq-image');
  const msg = document.getElementById('fq-message');
  const uidInput = form.elements.namedItem('uid');
  const messageInput = form.elements.namedItem('message');
  const bgInput = form.elements.namedItem('background');
  const textColourPicker = document.getElementById('fq-text-colour');
  const textColourHex = document.getElementById('fq-text-colour-hex');
  const textColourClear = document.getElementById('fq-text-colour-clear');
  const swatches = form.querySelectorAll('.fq-swatch');

  const COOLDOWN_MS = 20000;
  const REQUIRED = ['uid', 'message'];

  function setBackground(value) {
    bgInput.value = value;
    swatches.forEach((s) => {
      s.classList.toggle('active', s.dataset.bg === value);
    });
  }
  swatches.forEach((s) => {
    s.addEventListener('click', () => setBackground(s.dataset.bg));
  });
  setBackground('black');

  // Two-way bind: colour picker ↔ hex text input.
  textColourPicker.addEventListener('input', () => {
    textColourHex.value = textColourPicker.value.toUpperCase();
  });
  textColourHex.addEventListener('input', () => {
    const v = textColourHex.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
      textColourPicker.value = (v.startsWith('#') ? v : '#' + v).toLowerCase();
    }
  });
  textColourClear.addEventListener('click', () => {
    textColourHex.value = '';
    textColourPicker.value = '#ffffff';
    textColourHex.classList.remove('missing');
  });

  function isFilled(name) {
    const el = form.elements.namedItem(name);
    return el && el.value.trim().length > 0;
  }

  function refreshButton() {
    if (btn.dataset.cooling === '1') return;
    btn.disabled = !REQUIRED.every(isFilled);
  }
  REQUIRED.forEach((n) => {
    const el = form.elements.namedItem(n);
    if (el) el.addEventListener('input', () => {
      el.classList.remove('missing');
      refreshButton();
    });
  });
  refreshButton();

  function markMissing() {
    let firstMissing = null;
    REQUIRED.forEach((n) => {
      const el = form.elements.namedItem(n);
      if (!el) return;
      if (!el.value.trim()) {
        el.classList.add('missing');
        if (!firstMissing) firstMissing = el;
      }
    });
    if (firstMissing) firstMissing.focus();
  }

  function startCooldown() {
    btn.dataset.cooling = '1';
    btn.disabled = true;
    btn.classList.add('cooling');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    // Force reflow so the next transition is honoured.
    void fill.offsetWidth;
    fill.style.transition = 'width ' + COOLDOWN_MS + 'ms linear';
    fill.style.width = '100%';

    const start = Date.now();
    const update = () => {
      const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - start));
      if (remaining <= 0) {
        labelText.textContent = 'Generate Quote';
        btn.classList.remove('cooling');
        delete btn.dataset.cooling;
        fill.style.transition = 'none';
        fill.style.width = '0%';
        refreshButton();
        return;
      }
      labelText.textContent = 'Cooldown ' + Math.ceil(remaining / 1000) + 's';
      requestAnimationFrame(update);
    };
    update();
  }

  function setMessage(text, isError) {
    msg.textContent = text;
    msg.classList.toggle('error', !!isError);
  }

  async function submit() {
    if (btn.disabled) return;
    if (!REQUIRED.every(isFilled)) {
      markMissing();
      setMessage('Please fill in the highlighted fields.', true);
      return;
    }

    setMessage('Generating…', false);
    viewport.classList.add('loading');
    btn.disabled = true;

    const body = {
      csrf,
      uid: uidInput.value.trim(),
      message: messageInput.value.trim(),
      nickname: form.elements.namedItem('nickname').value.trim() || null,
      background: bgInput.value,
      textColor: textColourHex.value.trim() || null,
      profileColor: form.elements.namedItem('profileColor').value,
      fontStyle: form.elements.namedItem('fontStyle').value,
    };

    let res;
    let status = 0;
    try {
      const r = await fetch('/games/fakequote/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = r.status;
      res = await r.json();
    } catch (err) {
      viewport.classList.remove('loading');
      setMessage('Network error. Try again.', true);
      refreshButton();
      return;
    }
    viewport.classList.remove('loading');

    if (status === 429 || res.error === 'rate_limited') {
      const after = res.retryAfter ? ' Wait ' + res.retryAfter + 's.' : '';
      setMessage('Rate limit reached (3 / min).' + after, true);
      // Server already rejected us; client cooldown still kicks in to throttle the next click.
      startCooldown();
      return;
    }
    if (!res.ok) {
      const messages = {
        unauthenticated: 'You must log in.',
        csrf: 'Session expired. Refresh the page.',
        invalid_uid: 'That UID doesn\\u2019t look like a Discord ID.',
        user_not_found: 'No Discord user found with that UID.',
        invalid_message: 'The message is empty or too long (max 1000 chars).',
        invalid_options: 'One of the options is invalid.',
        render_failed: res.message || 'The renderer failed.',
        server: 'Server error. Try again.',
      };
      setMessage(messages[res.error] || ('Error: ' + res.error), true);
      refreshButton();
      return;
    }

    imageEl.src = res.image;
    imageEl.style.display = 'block';
    placeholder.style.display = 'none';
    viewport.classList.add('has-image');
    setMessage('Done.', false);
    startCooldown();
  }

  btn.addEventListener('click', submit);
})();
</script>
`);

  const form = html`
    <form id="fq-form" class="fq-form" onsubmit="return false">
      <label class="full">
        <span class="req">Discord User ID (UID)</span>
        <input type="text" name="uid" inputmode="numeric" pattern="\\d{17,20}" placeholder="e.g. 123456789012345678" autocomplete="off" />
      </label>

      <label class="full">
        <span class="req">Message</span>
        <textarea name="message" maxlength="1000" placeholder="What did they (not) say?"></textarea>
      </label>

      <label>
        Nickname (optional)
        <input type="text" name="nickname" placeholder="Override the display name" autocomplete="off" />
      </label>

      <label>
        Profile colour
        <select name="profileColor">${profileOptions}</select>
      </label>

      <label class="full">
        Background
        <div class="fq-swatches">
          <button type="button" class="fq-swatch" data-bg="black"><span class="dot black"></span>Black</button>
          <button type="button" class="fq-swatch" data-bg="white"><span class="dot white"></span>White</button>
        </div>
        <input type="hidden" name="background" value="black" />
      </label>

      <label class="full">
        Text colour (optional — defaults to white on black, black on white)
        <div class="fq-colour-row">
          <input type="color" id="fq-text-colour" value="#ffffff" aria-label="Pick text colour" />
          <input type="text" id="fq-text-colour-hex" placeholder="#RRGGBB" maxlength="7" autocomplete="off" />
          <button type="button" id="fq-text-colour-clear" class="clear-btn">Auto</button>
        </div>
      </label>

      <label class="full">
        Font style
        <select name="fontStyle">${fontOptions}</select>
      </label>
    </form>
  `;

  const body = html`
    <h1 class="text-center">Fake Quote</h1>
    <p class="text-center text-fog-300 mb-4">Create your very real totally accurate quotes!</p>

    <div class="fq-container">
      <div id="fq-viewport" class="fq-viewport">
        <div id="fq-placeholder" class="fq-placeholder">
          Your quote will appear here. Fill in a UID and message below, then hit Generate.
        </div>
        <div class="fq-spinner" aria-hidden="true"></div>
        <img id="fq-image" alt="Generated quote" style="display:none" />
      </div>

      ${loggedOut
    ? html`<div class="login-cta">
            Log in with <a href="/auth/discord/login">Discord</a> to make a fake quote.
          </div>`
    : html`
            ${form}
            <div class="fq-actions">
              <button id="fq-generate" class="btn-accent fq-generate" type="button" disabled>
                <span class="cooldown-fill"></span>
                <span class="label-text">Generate Quote</span>
              </button>
              <div id="fq-message" class="fq-message" role="status" aria-live="polite" aria-atomic="true"></div>
              <p class="text-fog-400 text-sm text-center">Limit: 3 quotes per minute.</p>
            </div>
          `}
    </div>
    ${extras}
    ${loggedOut ? '' : formScript}
  `;

  return Layout({
    title: 'Silverwolf — Fake Quote',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
