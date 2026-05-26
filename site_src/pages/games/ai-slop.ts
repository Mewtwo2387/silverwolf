import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';
import { AI_SLOP_PERSONAS } from '../../routes/ai-slop-personas';

// Sidebar grouping order = order in AI_SLOP_PERSONAS.
const PERSONAS = AI_SLOP_PERSONAS;

export interface AiSlopSession {
  sessionId: number;
  personaName: string;
  title: string | null;
  messageCount: number;
}

interface SidebarSession {
  sessionId: number;
  title: string;
  messageCount: number;
}

function groupSessions(sessions: AiSlopSession[]): Map<string, SidebarSession[]> {
  const groups = new Map<string, SidebarSession[]>();
  for (const persona of PERSONAS) {
    groups.set(persona.name, []);
  }
  for (const s of sessions) {
    const fallback = `Chat ${s.sessionId}`;
    const entry: SidebarSession = {
      sessionId: s.sessionId,
      title: s.title || fallback,
      messageCount: s.messageCount ?? 0,
    };
    const bucket = groups.get(s.personaName);
    if (bucket) {
      bucket.push(entry);
    } else {
      // Session for a removed/unknown persona — surface under its own bucket
      // so the user can at least see and delete it.
      const removedKey = `(removed) ${s.personaName}`;
      const arr = groups.get(removedKey) ?? [];
      arr.push(entry);
      groups.set(removedKey, arr);
    }
  }
  return groups;
}

export function AiSlopPage(opts: {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  sessions: AiSlopSession[];
  guildAccess?: boolean;
}) {
  const {
    nonce, lv999, user, sessions, guildAccess = false,
  } = opts;
  const loggedOut = !user;
  const guildBlocked = !loggedOut && !guildAccess;

  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const personasJSON = inlineJSON(PERSONAS.map((p) => p.name));
  const groups = loggedOut || guildBlocked
    ? new Map<string, SidebarSession[]>()
    : groupSessions(sessions);

  const styles = raw(`
<style>
  @media (min-width: 1025px) {
    main:has(.aislop-page-wrap) {
      max-width: 1100px;
      width: calc(100% - 2rem);
      padding-left: 0;
      padding-right: 0;
    }
  }

  .aislop-shell {
    display: flex;
    gap: 1rem;
    height: calc(100vh - 220px);
    min-height: 540px;
    margin-top: 0.5rem;
  }
  .aislop-side {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 0.75rem;
    overflow-y: auto;
  }
  .aislop-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  @media (max-width: 760px) {
    .aislop-shell { flex-direction: column; height: auto; }
    .aislop-side { width: 100%; max-height: 38vh; }
    .aislop-main { min-height: 60vh; }
  }

  .aislop-new {
    width: 100%;
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 8%, transparent), color-mix(in oklab, var(--accent-pale) 8%, transparent));
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    padding: 0.6rem;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, opacity 0.1s, background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .aislop-new:hover:not(:disabled) {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 25%, transparent), color-mix(in oklab, var(--accent-pale) 25%, transparent));
    color: #fff;
    border-color: var(--accent-light);
    box-shadow: 0 0 16px var(--glow-bright), 0 0 4px var(--accent);
  }
  .aislop-new:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 0 6px var(--glow-faint);
  }
  .aislop-new:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--ink-500);
    background: transparent;
    color: var(--ink-500);
    box-shadow: none;
  }

  /* Reset the global <details> styling (input.css "Holo-Windows" block).
     Critical: the global rule sets backdrop-filter: blur(12px), which creates
     a containing block for position:fixed descendants — that breaks the
     overflow menu (it ends up positioned relative to this <details> instead
     of the viewport, landing off-screen). We also flatten the inherited
     padding/margin/box-shadow so the sidebar group looks like a plain card. */
  .aislop-group {
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    background: var(--ink-900);
    padding: 0;
    margin-bottom: 0;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .aislop-group:hover,
  .aislop-group[open] {
    border-color: var(--ink-600);
    box-shadow: none;
  }
  /* The global summary::after injects "[ OPEN ]" / "[ CLOSE ]" badges —
     unwanted in the compact sidebar groups. */
  .aislop-group > summary::after { content: none; }
  .aislop-group > summary {
    cursor: pointer;
    padding: 0.45rem 0.65rem;
    font-size: 0.85rem;
    color: var(--fog-200);
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    user-select: none;
  }
  .aislop-group > summary::-webkit-details-marker { display: none; }
  .aislop-group > summary::before {
    content: '▸';
    font-size: 0.7rem;
    color: var(--fog-300);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .aislop-group[open] > summary::before { transform: rotate(90deg); }
  .aislop-group .group-label {
    flex: 1;
    color: var(--accent-light);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .aislop-group .group-count {
    font-size: 0.75rem;
    color: var(--fog-400);
    background: var(--ink-700);
    border-radius: 999px;
    padding: 0.05rem 0.45rem;
  }

  .aislop-list {
    list-style: none;
    margin: 0;
    padding: 0 0.35rem 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .aislop-list li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.4rem;
    border-radius: 0.4rem;
    color: var(--fog-100);
    font-size: 0.9rem;
    position: relative;
  }
  .aislop-list li:hover { background: var(--ink-700); }
  .aislop-list li.active { background: var(--ink-700); outline: 1px solid var(--accent); }
  .aislop-list .chat-title {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .aislop-list .chat-title:hover { color: var(--accent-light); }
  .aislop-list .chat-rename {
    flex: 1;
    min-width: 0;
    background: var(--ink-800);
    border: 1px solid var(--accent);
    border-radius: 0.3rem;
    color: var(--fog-100);
    font: inherit;
    padding: 0.15rem 0.35rem;
  }
  .aislop-list .chat-rename:focus { outline: none; box-shadow: 0 0 0 2px var(--glow-faint); }

  .overflow {
    position: relative;
    flex-shrink: 0;
  }
  .overflow-trigger {
    background: transparent;
    border: none;
    color: var(--fog-300);
    cursor: pointer;
    padding: 0 0.2rem;
    border-radius: 0.25rem;
    line-height: 1;
    font-size: 1.05rem;
  }
  .overflow-trigger:hover { color: var(--fog-100); background: var(--ink-600); }
  /* position: fixed + JS-positioned so the menu escapes both the sidebar's
     overflow-y scroll container and the <details> rounded clip. Without this
     the menu was being cut off (and visually "tucked behind" the next group).
     The display rule is scoped to :not([hidden]) — otherwise display:flex
     overrides the html hidden attribute and the menu would always be visible
     (and impossible to close). */
  .overflow-menu {
    position: fixed;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.4rem;
    padding: 0.2rem;
    z-index: 1000;
    min-width: 110px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.5);
  }
  .overflow-menu:not([hidden]) {
    display: flex;
    flex-direction: column;
  }
  .overflow-menu button {
    background: transparent;
    border: none;
    color: var(--fog-100);
    font: inherit;
    padding: 0.35rem 0.6rem;
    border-radius: 0.3rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .overflow-menu button:hover { background: var(--ink-700); color: var(--accent-light); }
  .overflow-menu button.danger:hover { color: var(--danger); }

  .aislop-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--ink-600);
    background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .aislop-head h2 {
    font-size: 1rem;
    margin: 0;
    color: var(--fog-100);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .aislop-head .pill {
    font-size: 0.75rem;
    color: var(--ink-900);
    background: var(--accent);
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .aislop-msgs {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .aislop-empty {
    margin: auto;
    color: var(--fog-300);
    text-align: center;
    font-size: 0.9rem;
    max-width: 380px;
    line-height: 1.5;
  }
  .aislop-empty strong { color: var(--accent-light); }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-width: 86%;
  }
  .msg .who {
    font-size: 0.7rem;
    color: var(--fog-300);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .msg .bubble {
    padding: 0.6rem 0.85rem;
    border-radius: 0.7rem;
    line-height: 1.45;
    color: var(--fog-100);
    word-wrap: break-word;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-size: 0.95rem;
  }
  .msg.you { align-self: flex-end; }
  .msg.you .bubble {
    background: var(--accent);
    color: var(--ink-900);
    font-weight: 500;
    border-bottom-right-radius: 0.2rem;
  }
  .msg.you .who { text-align: right; color: var(--accent-light); }
  .msg.ai .bubble {
    background: var(--ink-700);
    border: 1px solid var(--ink-600);
    border-bottom-left-radius: 0.2rem;
  }
  .msg.ai .who { color: var(--accent-light); }
  .msg .bubble.md { white-space: normal; }
  .msg .bubble.md > *:first-child { margin-top: 0; }
  .msg .bubble.md > *:last-child { margin-bottom: 0; }
  .msg .bubble.md p { margin: 0 0 0.6em; }
  .msg .bubble.md h1, .msg .bubble.md h2, .msg .bubble.md h3,
  .msg .bubble.md h4, .msg .bubble.md h5, .msg .bubble.md h6 {
    margin: 0.6em 0 0.3em;
    font-weight: 700;
    line-height: 1.25;
  }
  .msg .bubble.md h1 { font-size: 1.15rem; }
  .msg .bubble.md h2 { font-size: 1.08rem; }
  .msg .bubble.md h3 { font-size: 1rem; }
  .msg .bubble.md h4, .msg .bubble.md h5, .msg .bubble.md h6 { font-size: 0.95rem; }
  .msg .bubble.md ul, .msg .bubble.md ol {
    margin: 0 0 0.6em;
    padding-left: 1.4em;
  }
  .msg .bubble.md ul { list-style: disc; }
  .msg .bubble.md ol { list-style: decimal; }
  .msg .bubble.md li { margin: 0.15em 0; }
  .msg .bubble.md code {
    background: rgba(34, 211, 255, 0.08);
    border: 1px solid var(--ink-600);
    border-radius: 3px;
    padding: 0.05em 0.3em;
    font-size: 0.88em;
    color: var(--accent-light);
  }
  .msg .bubble.md pre {
    margin: 0.4em 0 0.7em;
    padding: 0.7rem 0.85rem;
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    overflow-x: auto;
  }
  .msg .bubble.md pre code {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--fog-100);
    font-size: 0.85rem;
    white-space: pre;
  }
  .msg .bubble.md a { color: var(--accent); text-decoration: underline; }
  .msg .bubble.md strong { font-weight: 700; color: var(--fog-100); }
  .msg .bubble.md em { font-style: italic; }
  .msg .tool-note {
    font-size: 0.72rem;
    color: var(--fog-300);
    margin-top: 0.25rem;
    font-style: italic;
  }
  .msg .thinking { display: inline-flex; gap: 0.2rem; }
  .msg .thinking span {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--fog-300);
    animation: aislop-bounce 1.2s infinite ease-in-out;
  }
  .msg .thinking span:nth-child(2) { animation-delay: 0.15s; }
  .msg .thinking span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes aislop-bounce {
    0%, 70%, 100% { transform: translateY(0); opacity: 0.4; }
    35% { transform: translateY(-4px); opacity: 1; }
  }

  .aislop-error {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0.25rem 0.9rem 0;
  }

  .aislop-input {
    display: flex;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem 0.75rem;
    border-top: 1px solid var(--ink-600);
    align-items: flex-end;
  }
  .aislop-input textarea {
    flex: 1;
    min-height: 44px;
    max-height: 180px;
    resize: none;
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    color: var(--fog-100);
    font: inherit;
    padding: 0.55rem 0.7rem;
    line-height: 1.4;
  }
  .aislop-input textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--glow-faint);
  }
  .aislop-input textarea:disabled { opacity: 0.55; cursor: not-allowed; }
  .aislop-input select {
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    color: var(--fog-100);
    font: inherit;
    padding: 0.5rem 0.5rem;
    height: 44px;
  }
  .aislop-input select:focus { outline: none; border-color: var(--accent); }
  .aislop-input select:disabled { opacity: 0.6; cursor: not-allowed; }
  .aislop-input button.send {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 8%, transparent), color-mix(in oklab, var(--accent-pale) 8%, transparent));
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    padding: 0 1.1rem;
    height: 44px;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 0 8px var(--glow-faint);
    transition: transform 0.1s, box-shadow 0.15s, opacity 0.1s, background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .aislop-input button.send:hover:not(:disabled) {
    background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 25%, transparent), color-mix(in oklab, var(--accent-pale) 25%, transparent));
    color: #fff;
    border-color: var(--accent-light);
    box-shadow: 0 0 16px var(--glow-bright), 0 0 4px var(--accent);
  }
  .aislop-input button.send:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 0 6px var(--glow-faint);
  }
  .aislop-input button.send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--ink-500);
    background: transparent;
    color: var(--ink-500);
    box-shadow: none;
  }

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

  function sidebarBody() {
    const items: any[] = [];
    for (const persona of PERSONAS) {
      const bucket = groups.get(persona.name) ?? [];
      items.push(html`
        <details class="aislop-group" ${raw(bucket.length > 0 ? 'open' : '')}>
          <summary>
            <span class="group-label">${persona.name}</span>
            <span class="group-count">${bucket.length}</span>
          </summary>
          <ul class="aislop-list" data-persona="${persona.name}">
            ${bucket.map((s) => html`
              <li data-session="${String(s.sessionId)}">
                <button class="chat-title" type="button">${s.title}</button>
                <div class="overflow">
                  <button class="overflow-trigger" type="button" aria-label="More options">⋮</button>
                  <div class="overflow-menu" hidden>
                    <button type="button" data-act="rename">Rename</button>
                    <button type="button" data-act="delete" class="danger">Delete</button>
                  </div>
                </div>
              </li>
            `)}
          </ul>
        </details>
      `);
    }
    // Any sessions whose persona is no longer in PERSONAS (e.g. renamed/removed
    // from aiPersonas.json) get rendered under a "(removed) X" group.
    for (const [name, bucket] of groups.entries()) {
      if (PERSONAS.some((p) => p.name === name)) continue;
      items.push(html`
        <details class="aislop-group" open>
          <summary>
            <span class="group-label" style="color: var(--danger);">${name}</span>
            <span class="group-count">${bucket.length}</span>
          </summary>
          <ul class="aislop-list" data-persona="${name}">
            ${bucket.map((s) => html`
              <li data-session="${String(s.sessionId)}">
                <button class="chat-title" type="button">${s.title}</button>
                <div class="overflow">
                  <button class="overflow-trigger" type="button" aria-label="More options">⋮</button>
                  <div class="overflow-menu" hidden>
                    <button type="button" data-act="delete" class="danger">Delete</button>
                  </div>
                </div>
              </li>
            `)}
          </ul>
        </details>
      `);
    }
    return html`${items}`;
  }

  const modelOptions = html`${PERSONAS.map(
    (p) => html`<option value="${p.name}">${p.name} — ${p.blurb}</option>`,
  )}`;

  const script = raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};
  const PERSONAS = ${personasJSON};

  const sideEl = document.querySelector('.aislop-side');
  const newBtn = document.getElementById('aislop-new');
  const msgsEl = document.getElementById('aislop-msgs');
  const titleEl = document.getElementById('aislop-title');
  const personaPill = document.getElementById('aislop-persona-pill');
  const errorEl = document.getElementById('aislop-error');
  const textarea = document.getElementById('aislop-text');
  const sendBtn = document.getElementById('aislop-send');
  const modelSel = document.getElementById('aislop-model');
  const form = document.getElementById('aislop-form');

  let currentSessionId = null; // null = draft
  let currentPersona = PERSONAS[0];
  let hasMessages = false;
  let sending = false;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return ch;
      }
    });
  }

  function setError(msg) {
    errorEl.textContent = msg || '';
    errorEl.style.display = msg ? 'block' : 'none';
  }

  function setSending(s) {
    sending = s;
    sendBtn.disabled = s;
    textarea.disabled = s;
    modelSel.disabled = s || hasMessages || currentSessionId != null;
  }

  function updateSelectorLock() {
    modelSel.disabled = sending || hasMessages || currentSessionId != null;
  }

  function clearMessages() {
    msgsEl.innerHTML = '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderInline(s) {
    // inline code first so its contents aren't re-processed
    var codes = [];
    s = s.replace(/\`([^\`\\n]+)\`/g, function(_, c) {
      codes.push('<code>' + c + '</code>');
      return '\\u0000C' + (codes.length - 1) + '\\u0000';
    });
    // links [text](url) — only http(s) urls
    s = s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, function(_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
    });
    // bold **x** and italic *x* / _x_
    s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_])_([^_\\n]+)_(?!\\w)/g, '$1<em>$2</em>');
    // restore inline code
    s = s.replace(/\\u0000C(\\d+)\\u0000/g, function(_, i) { return codes[+i]; });
    return s;
  }

  function renderMarkdown(text) {
    // Extract fenced code blocks first
    var blocks = [];
    text = text.replace(/\`\`\`([a-zA-Z0-9_+-]*)\\n?([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
      var cls = lang ? ' class="lang-' + escapeHtml(lang) + '"' : '';
      blocks.push('<pre><code' + cls + '>' + escapeHtml(code.replace(/\\n$/, '')) + '</code></pre>');
      return '\\u0000B' + (blocks.length - 1) + '\\u0000';
    });

    text = escapeHtml(text);

    var lines = text.split(/\\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      // code block placeholder line — emit as-is
      var ph = line.match(/^\\u0000B(\\d+)\\u0000$/);
      if (ph) { out.push(blocks[+ph[1]]); i++; continue; }
      // heading
      var h = line.match(/^(#{1,6})\\s+(.*)$/);
      if (h) { out.push('<h' + h[1].length + '>' + renderInline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      // unordered list
      if (/^\\s*[-*+]\\s+/.test(line)) {
        var ul = '<ul>';
        while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i])) {
          ul += '<li>' + renderInline(lines[i].replace(/^\\s*[-*+]\\s+/, '')) + '</li>';
          i++;
        }
        ul += '</ul>';
        out.push(ul);
        continue;
      }
      // ordered list
      if (/^\\s*\\d+\\.\\s+/.test(line)) {
        var ol = '<ol>';
        while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) {
          ol += '<li>' + renderInline(lines[i].replace(/^\\s*\\d+\\.\\s+/, '')) + '</li>';
          i++;
        }
        ol += '</ol>';
        out.push(ol);
        continue;
      }
      // blank line
      if (/^\\s*$/.test(line)) { i++; continue; }
      // paragraph: gather contiguous non-blank, non-block lines
      var para = [line];
      i++;
      while (
        i < lines.length
        && !/^\\s*$/.test(lines[i])
        && !/^\\u0000B\\d+\\u0000$/.test(lines[i])
        && !/^#{1,6}\\s+/.test(lines[i])
        && !/^\\s*[-*+]\\s+/.test(lines[i])
        && !/^\\s*\\d+\\.\\s+/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p>' + renderInline(para.join('\\n')).replace(/\\n/g, '<br>') + '</p>');
    }
    return out.join('');
  }

  function renderEmptyState() {
    clearMessages();
    const div = document.createElement('div');
    div.className = 'aislop-empty';
    div.innerHTML = 'Pick a model and say <strong>hi</strong>. Existing chats live in the sidebar. The model selector locks once a chat has a first message — start a new chat to switch.';
    msgsEl.appendChild(div);
  }

  function pushMessage(role, text, opts) {
    // Remove empty state placeholder if present
    const empty = msgsEl.querySelector('.aislop-empty');
    if (empty) empty.remove();
    const wrap = document.createElement('div');
    const isYou = role === 'user';
    wrap.className = 'msg ' + (isYou ? 'you' : 'ai');
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = isYou ? 'You' : (opts && opts.persona) || currentPersona;
    wrap.appendChild(who);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (opts && opts.thinking) {
      bubble.innerHTML = '<span class="thinking"><span></span><span></span><span></span></span>';
    } else if (isYou) {
      bubble.textContent = text || '';
    } else {
      bubble.classList.add('md');
      bubble.innerHTML = renderMarkdown(text || '');
    }
    wrap.appendChild(bubble);
    if (opts && opts.toolCallCount) {
      const note = document.createElement('div');
      note.className = 'tool-note';
      note.textContent = '🔎 searched the web (' + opts.toolCallCount + ')';
      wrap.appendChild(note);
    }
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return wrap;
  }

  function renderHistory(messages, persona) {
    clearMessages();
    if (!messages.length) {
      renderEmptyState();
      return;
    }
    for (const m of messages) {
      const isYou = m.role === 'user';
      pushMessage(isYou ? 'user' : 'ai', m.message, { persona });
    }
  }

  function setHead(title, persona) {
    titleEl.textContent = title || 'New chat';
    personaPill.textContent = persona || currentPersona;
  }

  function setSelectorValue(name) {
    for (const opt of modelSel.options) {
      if (opt.value === name) { modelSel.value = name; break; }
    }
    currentPersona = modelSel.value;
  }

  function markSidebarActive(sessionId) {
    sideEl.querySelectorAll('.aislop-list li').forEach((li) => {
      li.classList.toggle('active', li.dataset.session === String(sessionId));
    });
  }

  function newChat() {
    currentSessionId = null;
    hasMessages = false;
    setHead('New chat', currentPersona);
    renderEmptyState();
    setError('');
    markSidebarActive(null);
    updateSelectorLock();
    textarea.focus();
  }

  async function loadSession(sessionId, fallbackPersona) {
    setError('');
    let data;
    try {
      const r = await fetch('/games/ai-slop/session/' + encodeURIComponent(sessionId) + '/messages');
      data = await r.json();
    } catch (e) {
      setError('Could not load chat.');
      return;
    }
    if (!data.ok) {
      setError('Could not load chat (' + (data.error || 'error') + ').');
      return;
    }
    const d = data.data;
    currentSessionId = d.sessionId;
    currentPersona = d.personaName || fallbackPersona || currentPersona;
    hasMessages = d.messages.length > 0;
    setSelectorValue(currentPersona);
    setHead(d.title || ('Chat ' + d.sessionId), currentPersona);
    renderHistory(d.messages, currentPersona);
    markSidebarActive(currentSessionId);
    updateSelectorLock();
  }

  async function sendMessage(text) {
    if (sending) return;
    if (!text.trim()) return;

    setError('');
    setSending(true);
    // Optimistic: push user bubble + thinking placeholder
    const userNode = pushMessage('user', text);
    const thinkingNode = pushMessage('ai', '', { thinking: true });

    const payload = {
      csrf,
      message: text,
      sessionId: currentSessionId,
      personaName: currentSessionId == null ? currentPersona : undefined,
    };

    let data;
    try {
      const r = await fetch('/games/ai-slop/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await r.json();
    } catch (e) {
      thinkingNode.remove();
      userNode.remove();
      setError('Network error.');
      setSending(false);
      return;
    }

    thinkingNode.remove();
    if (!data.ok) {
      userNode.remove();
      if (data.error === 'rate_limited') {
        const after = data.retryAfter ? ' Try again in ' + data.retryAfter + 's.' : '';
        setError('You\\'re sending messages too fast.' + after);
        setSending(false);
        return;
      }
      const map = {
        unauthenticated: 'You must log in.',
        csrf: 'Session expired. Refresh the page.',
        invalid_body: 'Invalid request.',
        invalid_persona: 'That model isn\\'t available.',
        persona_not_found: 'That model isn\\'t available.',
        invalid_session: 'Invalid chat session.',
        forbidden: 'You can\\'t access that chat.',
        guild_required: 'You must be in a server where Silverwolf is installed to use AI chat.',
        not_web: 'That chat can only be used in Discord.',
        not_found: 'Chat not found.',
        empty_message: 'Type a message first.',
        message_too_long: 'Message is too long.',
        server: 'Server error. Try again.',
      };
      setError(map[data.error] || ('Error: ' + data.error));
      setSending(false);
      return;
    }

    const d = data.data;
    const wasNew = currentSessionId == null;
    currentSessionId = d.sessionId;
    hasMessages = true;

    pushMessage('ai', d.assistant || '(no response)', {
      persona: d.personaName,
      toolCallCount: d.toolCallCount,
    });

    if (wasNew) {
      addSessionToSidebar(d.personaName, d.sessionId, d.title || 'Chat ' + d.sessionId);
      setHead(d.title || ('Chat ' + d.sessionId), d.personaName);
    } else if (d.title) {
      setHead(d.title, d.personaName);
    }
    markSidebarActive(d.sessionId);
    setSending(false);
    updateSelectorLock();
    textarea.focus();
  }

  function addSessionToSidebar(personaName, sessionId, title) {
    let group = sideEl.querySelector('.aislop-list[data-persona="' + CSS.escape(personaName) + '"]');
    if (!group) return; // unknown persona — sidebar group doesn't exist
    const details = group.closest('details');
    if (details) details.open = true;
    const li = document.createElement('li');
    li.dataset.session = String(sessionId);
    li.innerHTML = ''
      + '<button class="chat-title" type="button"></button>'
      + '<div class="overflow">'
      +   '<button class="overflow-trigger" type="button" aria-label="More options">⋮</button>'
      +   '<div class="overflow-menu" hidden>'
      +     '<button type="button" data-act="rename">Rename</button>'
      +     '<button type="button" data-act="delete" class="danger">Delete</button>'
      +   '</div>'
      + '</div>';
    li.querySelector('.chat-title').textContent = title;
    group.insertBefore(li, group.firstChild);
    bumpGroupCount(personaName, 1);
  }

  function removeSessionFromSidebar(sessionId) {
    const li = sideEl.querySelector('.aislop-list li[data-session="' + sessionId + '"]');
    if (!li) return;
    const list = li.closest('.aislop-list');
    const personaName = list?.dataset.persona;
    li.remove();
    if (personaName) bumpGroupCount(personaName, -1);
  }

  function bumpGroupCount(personaName, delta) {
    const list = sideEl.querySelector('.aislop-list[data-persona="' + CSS.escape(personaName) + '"]');
    if (!list) return;
    const summary = list.closest('details')?.querySelector('.group-count');
    if (!summary) return;
    const next = Math.max(0, (parseInt(summary.textContent, 10) || 0) + delta);
    summary.textContent = String(next);
  }

  function closeAllMenus(except) {
    sideEl.querySelectorAll('.overflow-menu').forEach((m) => {
      if (m !== except) m.hidden = true;
    });
  }

  function startInlineRename(li) {
    const btn = li.querySelector('.chat-title');
    if (!btn) return;
    const oldTitle = btn.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chat-rename';
    input.value = oldTitle;
    input.maxLength = 80;
    btn.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    async function commit(save) {
      if (done) return;
      done = true;
      const newTitle = input.value.trim();
      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.className = 'chat-title';
      newBtn.textContent = (save && newTitle) ? newTitle : oldTitle;
      input.replaceWith(newBtn);
      if (!save || !newTitle || newTitle === oldTitle) return;

      try {
        const r = await fetch('/games/ai-slop/session/rename', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            csrf,
            sessionId: parseInt(li.dataset.session, 10),
            title: newTitle,
          }),
        });
        const data = await r.json();
        if (!data.ok) {
          newBtn.textContent = oldTitle;
          setError('Rename failed: ' + (data.error || 'error'));
          return;
        }
        // If this is the open chat, update header too
        if (parseInt(li.dataset.session, 10) === currentSessionId) {
          setHead(newTitle, currentPersona);
        }
      } catch (e) {
        newBtn.textContent = oldTitle;
        setError('Network error during rename.');
      }
    }

    input.addEventListener('blur', () => commit(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
  }

  async function deleteSession(li) {
    const sessionId = parseInt(li.dataset.session, 10);
    if (!Number.isInteger(sessionId)) return;
    const title = li.querySelector('.chat-title, .chat-rename')?.textContent || ('Chat ' + sessionId);
    if (!window.confirm('Delete "' + title + '"? This cannot be undone.')) return;
    try {
      const r = await fetch('/games/ai-slop/session/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf, sessionId }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError('Delete failed: ' + (data.error || 'error'));
        return;
      }
      removeSessionFromSidebar(sessionId);
      if (currentSessionId === sessionId) newChat();
    } catch (e) {
      setError('Network error during delete.');
    }
  }

  // Menu is position:fixed so it escapes the sidebar's overflow:auto clipping
  // (the original position:absolute version was being cut off). We compute its
  // location from the trigger button's bounding rect each time it opens, and
  // close it on any scroll/resize since a fixed element won't track the
  // trigger when the sidebar scrolls.
  function positionMenu(trigger, menu) {
    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    let left = tRect.right - mRect.width;
    let top = tRect.bottom + 4;
    if (top + mRect.height > window.innerHeight - 8) {
      top = Math.max(8, tRect.top - mRect.height - 4);
    }
    if (left < 4) left = 4;
    if (left + mRect.width > window.innerWidth - 4) {
      left = window.innerWidth - mRect.width - 4;
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  // Sidebar event delegation
  sideEl.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const trigger = t.closest('.overflow-trigger');
    if (trigger) {
      const menu = trigger.nextElementSibling;
      if (!menu) return;
      const wasHidden = menu.hidden;
      closeAllMenus(menu);
      if (wasHidden) {
        menu.hidden = false;
        positionMenu(trigger, menu);
      } else {
        menu.hidden = true;
      }
      return;
    }

    const menuBtn = t.closest('.overflow-menu button');
    if (menuBtn) {
      const li = menuBtn.closest('li');
      if (!li) return;
      const act = menuBtn.dataset.act;
      menuBtn.closest('.overflow-menu').hidden = true;
      if (act === 'rename') startInlineRename(li);
      else if (act === 'delete') deleteSession(li);
      return;
    }

    const titleBtn = t.closest('.chat-title');
    if (titleBtn) {
      const li = titleBtn.closest('li');
      if (!li) return;
      const sessionId = parseInt(li.dataset.session, 10);
      const list = li.closest('.aislop-list');
      const personaName = list?.dataset.persona;
      if (Number.isInteger(sessionId)) loadSession(sessionId, personaName);
    }
  });

  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (!e.target.closest('.overflow')) closeAllMenus(null);
  });

  // A fixed-positioned menu doesn't follow the trigger when the sidebar
  // scrolls or the window resizes — close it instead of trying to track.
  sideEl.addEventListener('scroll', () => closeAllMenus(null), { passive: true });
  window.addEventListener('resize', () => closeAllMenus(null));

  // New chat
  newBtn.addEventListener('click', newChat);

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textarea.value;
    if (!text.trim()) return;
    textarea.value = '';
    sendMessage(text);
  });

  // Cmd/Ctrl+Enter shortcut + Enter to send (Shift+Enter for newline)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // Auto-grow textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(180, textarea.scrollHeight) + 'px';
  });

  modelSel.addEventListener('change', () => {
    currentPersona = modelSel.value;
    if (currentSessionId == null) setHead('New chat', currentPersona);
  });

  // Start in fresh-chat state
  newChat();
})();
</script>
`);

  const body = html`
    <div class="aislop-page-wrap">
      <h1 class="text-center">AI Slop</h1>
      <p class="text-center text-fog-300 mb-4">chat with ai slop or something idk</p>
      ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to chat.</div>`
    : guildBlocked
    ? html`<div class="login-cta">You need to be in a Discord server where Silverwolf is installed to use AI chat. Join that server, then refresh this page.</div>`
    : html`
          <div class="aislop-shell">
            <aside class="aislop-side">
              <button type="button" id="aislop-new" class="aislop-new">+ New chat</button>
              ${sidebarBody()}
            </aside>
            <section class="aislop-main">
              <div class="aislop-head">
                <h2 id="aislop-title">New chat</h2>
                <span id="aislop-persona-pill" class="pill">${PERSONAS[0].name}</span>
              </div>
              <div id="aislop-error" class="aislop-error" style="display:none"></div>
              <div id="aislop-msgs" class="aislop-msgs"></div>
              <form id="aislop-form" class="aislop-input">
                <textarea id="aislop-text" rows="1" placeholder="Talk to AI Slop..." aria-label="Message" autocomplete="off"></textarea>
                <select id="aislop-model" aria-label="Model">
                  ${modelOptions}
                </select>
                <button type="submit" class="send" id="aislop-send">Send</button>
              </form>
            </section>
          </div>
        `}
    </div>
    ${styles}
    ${loggedOut || guildBlocked ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — AI Slop',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
