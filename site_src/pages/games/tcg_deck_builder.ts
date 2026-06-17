/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';

// JSON.stringify escapes neither '<' nor '/'; escape '<' so a crafted item
// string can't break out of the inline <script> data island.
function inlineJson(v: unknown): string {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c');
}

export interface DeckBuilderItem {
  id: string;
  name: string;
  kind: 'equipment' | 'consumable';
  rarity: number;
  description: string;
}

export interface DeckBuilderCaps {
  deckSize: number;
  perCard: number;
  fiveStarMax: number;
  fourStarMax: number;
}

export interface DeckBuilderOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  csrf: string | null;
  items: DeckBuilderItem[];
  composition: Record<string, number>;
  caps: DeckBuilderCaps;
  loginReturnPath: string;
}

export function TcgDeckBuilderPage(opts: DeckBuilderOpts) {
  const {
    nonce, lv999, user, csrf, items, composition, caps, loginReturnPath,
  } = opts;

  const styles = deckStyles();

  if (!user) {
    return Layout({
      title: 'Silverwolf — TCG Deck Builder',
      active: 'games',
      body: html`
        ${styles}
        <h1 class="text-center">TCG Deck Builder</h1>
        <div class="tcg-deck-wrap">
          <div class="tcg-panel" style="text-align:center;">
            <p class="tcg-subtitle">Log In Required</p>
            <p style="color: var(--fog-300); margin: 0 0 1rem;">
              Log in with Discord to edit and save your item deck.
            </p>
            <a href="/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}"
               class="tcg-btn">[ Log in with Discord ]</a>
          </div>
        </div>
      ` as any,
      nonce,
      lv999,
      user,
    });
  }

  const script = raw(deckScript(nonce, {
    csrf: csrf ?? '', items, composition, caps,
  }));

  const body = html`
    ${styles}
    <h1 class="text-center" style="margin-bottom:0.25rem;">TCG Deck Builder</h1>
    <p class="text-center text-fog-300" style="margin-bottom:1rem;">
      Build a legal ${String(caps.deckSize)}-card deck. It's shared with <code style="color:var(--accent-light)">/tcgbattle</code> on Discord.
    </p>
    <div class="tcg-deck-wrap">
      <div class="tcg-panel tcg-deck-summary" id="tcg-deck-summary">
        <div class="tcg-deck-counts">
          <span>Total <b id="dk-total">0</b>/${String(caps.deckSize)}</span>
          <span>5★+ <b id="dk-five">0</b>/${String(caps.fiveStarMax)}</span>
          <span>4★+ <b id="dk-four">0</b>/${String(caps.fourStarMax)}</span>
        </div>
        <div class="tcg-deck-actions">
          <span id="dk-legal" class="tcg-badge">—</span>
          <a href="/games/tcg" class="tcg-btn">[ back ]</a>
          <button id="dk-save" type="button" class="tcg-btn">[ save deck ]</button>
        </div>
        <div id="dk-msg" class="tcg-deck-msg" aria-live="polite"></div>
      </div>
      <div class="tcg-deck-grid" id="tcg-deck-grid"></div>
    </div>
    ${script}
  `;

  return Layout({
    title: 'Silverwolf — TCG Deck Builder',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

function deckStyles() {
  return raw(`
<style>
  .tcg-deck-wrap { max-width: 1100px; margin: 1.25rem auto 0; display: flex; flex-direction: column; gap: 1rem; }
  .tcg-panel {
    background: color-mix(in oklab, var(--ink-800) 50%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 18%, var(--ink-600));
    border-radius: 0.75rem; padding: 1rem 1.25rem;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .tcg-subtitle {
    text-align: center; color: var(--fog-300); font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.18em; margin: 0 0 1rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .tcg-btn {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 10%, transparent), color-mix(in oklab, var(--accent-pale) 10%, transparent));
    color: var(--accent-light); border: 1px solid var(--accent); border-radius: 4px;
    padding: 0.5rem 1rem; font: inherit; font-size: 0.85rem; font-weight: 700;
    cursor: pointer; white-space: nowrap; text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.4rem;
    box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, color 0.15s;
  }
  .tcg-btn:hover { color: #fff; box-shadow: 0 0 16px var(--glow-bright); }
  .tcg-btn:active { transform: translateY(1px); }
  .tcg-btn[disabled] { opacity: 0.55; cursor: not-allowed; }

  .tcg-deck-summary {
    position: sticky; top: 0.5rem; z-index: 5;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
  }
  .tcg-deck-counts { display: flex; gap: 1.25rem; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: var(--fog-200); }
  .tcg-deck-counts b { color: var(--accent-light); }
  .tcg-deck-counts b.over { color: var(--danger); }
  .tcg-deck-actions { display: flex; align-items: center; gap: 0.6rem; }
  .tcg-badge {
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700;
    padding: 0.2rem 0.55rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;
    border: 1px solid var(--ink-600); color: var(--fog-300);
  }
  .tcg-badge.legal { color: #4ade80; border-color: color-mix(in oklab, #4ade80 50%, transparent); }
  .tcg-badge.illegal { color: var(--danger); border-color: color-mix(in oklab, var(--danger) 50%, transparent); }
  .tcg-deck-msg { flex-basis: 100%; text-align: right; min-height: 1.1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--fog-300); }
  .tcg-deck-msg.err { color: var(--danger); }
  .tcg-deck-msg.ok { color: #4ade80; }

  .tcg-deck-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.9rem;
  }
  .tcg-card {
    background: color-mix(in oklab, var(--ink-900) 45%, transparent);
    border: 1px solid var(--ink-600); border-radius: 0.6rem; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .tcg-card.has { border-color: color-mix(in oklab, var(--accent) 55%, transparent); box-shadow: 0 0 10px var(--glow-faint); }
  .tcg-card-img { aspect-ratio: 1080 / 1920; background: var(--ink-900); position: relative; }
  .tcg-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tcg-card-rarity {
    position: absolute; top: 4px; right: 6px; font-size: 0.7rem; font-weight: 800;
    color: #f7d774; text-shadow: 0 0 6px rgba(0,0,0,0.9); font-family: 'JetBrains Mono', monospace;
  }
  .tcg-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; padding: 0.4rem 0.5rem; }
  .tcg-step {
    width: 26px; height: 26px; flex: 0 0 auto; border-radius: 4px; cursor: pointer;
    background: var(--ink-800); border: 1px solid var(--accent); color: var(--accent-light);
    font: inherit; font-weight: 800; font-size: 1rem; line-height: 1; display: flex; align-items: center; justify-content: center;
  }
  .tcg-step:hover { color: #fff; box-shadow: 0 0 8px var(--glow-faint); }
  .tcg-step[disabled] { opacity: 0.35; cursor: not-allowed; }
  .tcg-count { font-family: 'JetBrains Mono', monospace; font-weight: 800; color: var(--fog-100); min-width: 1.4rem; text-align: center; }
  .tcg-count.zero { color: var(--fog-500); }
</style>
`);
}

function deckScript(nonce: string, ctx: {
  csrf: string;
  items: DeckBuilderItem[];
  composition: Record<string, number>;
  caps: DeckBuilderCaps;
}) {
  return `
<script nonce="${nonce}">
(() => {
  const CSRF = ${inlineJson(ctx.csrf)};
  const ITEMS = ${inlineJson(ctx.items)};
  const CAPS = ${inlineJson(ctx.caps)};
  const initial = ${inlineJson(ctx.composition)};

  const counts = {};
  for (const it of ITEMS) counts[it.id] = Math.max(0, Math.min(CAPS.perCard, (initial && initial[it.id]) | 0));

  const grid = document.getElementById('tcg-deck-grid');
  const totalEl = document.getElementById('dk-total');
  const fiveEl = document.getElementById('dk-five');
  const fourEl = document.getElementById('dk-four');
  const legalEl = document.getElementById('dk-legal');
  const saveBtn = document.getElementById('dk-save');
  const msgEl = document.getElementById('dk-msg');
  if (!grid) return;

  function totals() {
    let total = 0, five = 0, four = 0;
    for (const it of ITEMS) {
      const n = counts[it.id] || 0;
      total += n;
      if (it.rarity >= 5) five += n;
      if (it.rarity >= 4) four += n;
    }
    return { total, five, four };
  }

  function validate() {
    const t = totals();
    if (t.total !== CAPS.deckSize) return { ok: false, reason: 'Deck must have exactly ' + CAPS.deckSize + ' cards (currently ' + t.total + ').' };
    if (t.five > CAPS.fiveStarMax) return { ok: false, reason: 'At most ' + CAPS.fiveStarMax + ' cards may be 5★+.' };
    if (t.four > CAPS.fourStarMax) return { ok: false, reason: 'At most ' + CAPS.fourStarMax + ' cards may be 4★+.' };
    return { ok: true };
  }

  function star(n) { return '★'.repeat(n); }

  function buildCards() {
    const frag = document.createDocumentFragment();
    for (const it of ITEMS) {
      const card = document.createElement('div');
      card.className = 'tcg-card';
      card.dataset.id = it.id;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'tcg-card-img';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = it.name;
      img.src = '/static/tcg/item/' + encodeURIComponent(it.id) + '.png';
      imgWrap.appendChild(img);
      const rar = document.createElement('span');
      rar.className = 'tcg-card-rarity';
      rar.textContent = star(it.rarity);
      imgWrap.appendChild(rar);
      card.appendChild(imgWrap);

      const foot = document.createElement('div');
      foot.className = 'tcg-card-foot';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.className = 'tcg-step'; minus.textContent = '−';
      const cnt = document.createElement('span');
      cnt.className = 'tcg-count';
      const plus = document.createElement('button');
      plus.type = 'button'; plus.className = 'tcg-step'; plus.textContent = '+';
      minus.addEventListener('click', () => bump(it.id, -1));
      plus.addEventListener('click', () => bump(it.id, 1));
      foot.appendChild(minus); foot.appendChild(cnt); foot.appendChild(plus);
      card.appendChild(foot);

      frag.appendChild(card);
    }
    grid.appendChild(frag);
  }

  function bump(id, delta) {
    const next = Math.max(0, Math.min(CAPS.perCard, (counts[id] || 0) + delta));
    counts[id] = next;
    refresh();
  }

  let raf = 0;
  function refresh() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const t = totals();
      totalEl.textContent = String(t.total);
      fiveEl.textContent = String(t.five);
      fourEl.textContent = String(t.four);
      totalEl.classList.toggle('over', t.total > CAPS.deckSize);
      fiveEl.classList.toggle('over', t.five > CAPS.fiveStarMax);
      fourEl.classList.toggle('over', t.four > CAPS.fourStarMax);
      const v = validate();
      legalEl.textContent = v.ok ? 'legal' : 'illegal';
      legalEl.className = 'tcg-badge ' + (v.ok ? 'legal' : 'illegal');
      if (saveBtn) saveBtn.toggleAttribute('disabled', !v.ok);
      // per-card UI
      grid.querySelectorAll('.tcg-card').forEach((card) => {
        const id = card.dataset.id;
        const n = counts[id] || 0;
        const cnt = card.querySelector('.tcg-count');
        const minus = card.querySelector('.tcg-step');
        const plus = card.querySelectorAll('.tcg-step')[1];
        if (cnt) { cnt.textContent = String(n); cnt.classList.toggle('zero', n === 0); }
        if (minus) minus.toggleAttribute('disabled', n <= 0);
        if (plus) plus.toggleAttribute('disabled', n >= CAPS.perCard);
        card.classList.toggle('has', n > 0);
      });
    });
  }

  async function save() {
    const v = validate();
    if (!v.ok) { msg(v.reason, 'err'); return; }
    saveBtn.setAttribute('disabled', 'disabled');
    msg('Saving…', '');
    try {
      const composition = {};
      for (const it of ITEMS) if (counts[it.id] > 0) composition[it.id] = counts[it.id];
      const res = await fetch('/games/tcg/deck/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: CSRF, composition }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        msg((data && data.error) ? data.error : 'Failed to save.', 'err');
        refresh();
        return;
      }
      msg('Deck saved.', 'ok');
    } catch (e) {
      msg('Network error.', 'err');
      refresh();
    }
  }

  function msg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'tcg-deck-msg' + (kind ? ' ' + kind : '');
  }

  if (saveBtn) saveBtn.addEventListener('click', save);
  buildCards();
  refresh();
})();
</script>
`;
}
