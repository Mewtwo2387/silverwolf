import { readFileSync } from 'fs';
import path from 'path';
import { html, raw } from 'hono/html';
import { assetVersion } from '../asset-version';

const HTML_DIR = path.join(import.meta.dir, 'html');
const ASSETS_DIR = path.join(import.meta.dir, 'assets');
const htmlCache = new Map<string, string>();

export function loadTcgHtml(name: string): string {
  if (!htmlCache.has(name)) {
    htmlCache.set(name, readFileSync(path.join(HTML_DIR, name), 'utf8'));
  }
  return htmlCache.get(name)!;
}

export function fillTcgHtml(name: string, vars: Record<string, string>): string {
  let out = loadTcgHtml(name);
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function renderTcgHtml(name: string, vars: Record<string, string>) {
  return raw(fillTcgHtml(name, vars));
}

export function inlineJson(v: unknown): string {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c');
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

/** JSON data island + deferred page script (built from Assets/{name}.src.js). */
export function tcgScriptAssets(
  name: string,
  nonce: string,
  data?: { id: string; payload: unknown },
) {
  const jsPath = path.join(ASSETS_DIR, `${name}.js`);
  const dataIsland = data
    ? raw(`<script type="application/json" id="${escapeAttr(data.id)}">${inlineJson(data.payload)}</script>`)
    : raw('');
  const scriptTag = raw(
    `<script src="/static/${name}.js?v=${assetVersion(jsPath)}" defer nonce="${nonce}"></script>`,
  );
  return html`${dataIsland}${scriptTag}`;
}

export function buildTeamSelects(prefix: string, roster: { value: string; name: string }[]) {
  const options = roster.map((r) => `<option value="${escapeAttr(r.value)}">${escapeText(r.name)}</option>`).join('');
  return [0, 1, 2].map((i) => fillTcgHtml('tcg-team-select.html', {
    ID: `${prefix}-${i}`,
    LABEL: `Team slot ${i + 1}`,
    OPTIONS: options,
  })).join('\n');
}

export function renderTeamPicker(vars: {
  prefix: string;
  roster: { value: string; name: string }[];
  deckLegal: boolean;
  submitId: string;
  submitLabel: string;
  errorId: string;
}) {
  return fillTcgHtml('tcg-team-picker.html', {
    TEAM_SELECTS: buildTeamSelects(vars.prefix, vars.roster),
    DECK_BADGE_CLASS: vars.deckLegal ? 'legal' : 'illegal',
    DECK_BADGE_TEXT: vars.deckLegal ? 'legal deck' : 'illegal deck',
    DECK_WARN: vars.deckLegal ? '' : loadTcgHtml('tcg-deck-warn.html'),
    SUBMIT_ID: vars.submitId,
    SUBMIT_LABEL: vars.submitLabel,
    SUBMIT_DISABLED: vars.deckLegal ? '' : 'disabled',
    ERROR_ID: vars.errorId,
  });
}

export interface ActiveRoomVars {
  id: string;
  status: string;
  mode: string;
  opponentHtml: string;
  copyButton: string;
}

export function renderActiveRoomRow(vars: ActiveRoomVars): string {
  return fillTcgHtml('tcg-active-room.html', {
    ID: escapeAttr(vars.id),
    STATUS: escapeText(vars.status),
    MODE: escapeText(vars.mode),
    OPPONENT: vars.opponentHtml,
    COPY_BUTTON: vars.copyButton,
  });
}
