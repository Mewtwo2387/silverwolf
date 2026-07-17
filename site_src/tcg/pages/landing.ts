/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define, no-nested-ternary */
import { html } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import type { CharacterCatalogEntry } from './detail';
import { tcgDetailAssets, tcgDetailModalShell } from './detail';
import {
  escapeAttr,
  escapeText,
  fillTcgHtml,
  renderTcgHtml,
  renderTeamPicker,
  tcgScriptAssets,
} from '../html';
import { formatRoomMode } from '../labels';

/** One open room for the browse list (still live until everyone leaves). */
export interface TcgBrowseRoom {
  id: string;
  mode: 'pvp' | 'solo';
  status: 'lobby' | 'active' | 'ended';
  p1: string | null;
  p2: string | null;
  spectators: number;
  /** Viewer is a participant (creator/p1/p2) → label the button "open". */
  you: boolean;
  /** Open PvP lobby waiting for a second player → label "join". */
  openLobby: boolean;
}

/** One finished match for the history list. */
export interface TcgHistoryEntry {
  id: string;
  mode: 'pvp' | 'solo';
  p1: string;
  p2: string;
  winner: 'p1' | 'p2' | 'draw' | null;
  endReason: string;
  rounds: number;
  endedAt: number;
}

export interface TcgBrowseOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  rooms: TcgBrowseRoom[];
  history: TcgHistoryEntry[];
  loginReturnPath: string;
}

/** Client-facing brief of the five team slots (lineups + deck size/legality; deck contents stay server-side). */
export interface TcgTeamStateBrief {
  active: number;
  deckSize: number;
  slots: { team: string[]; deckCount: number; deckLegal: boolean }[];
}

export interface TcgCreateOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  csrf: string | null;
  characterCatalog: CharacterCatalogEntry[];
  deckLegal: boolean;
  /** The user's team slots; the picker edits the active one in place. */
  teamState: TcgTeamStateBrief;
  loginReturnPath: string;
}

function loginPage(opts: { nonce: string; lv999?: boolean; user: NavUser | null; loginReturnPath: string }) {
  return Layout({
    title: 'Silverwolf — TCG Battle',
    active: 'games',
    body: renderTcgHtml('tcg-login.html', {
      TITLE: 'TCG Battle',
      WRAP_CLASS: 'tcg-wrap',
      MESSAGE: 'TCG battles need a Discord account for matchmaking and your saved deck.',
      LOGIN_URL: `/auth/discord/login?return=${encodeURIComponent(opts.loginReturnPath)}`,
    }) as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

// ── Browse page (default landing): in-progress battles + match history ───────
function matchup(p1: string | null, p2: string | null, mode: 'pvp' | 'solo', waiting: boolean): string {
  const a = p1 ? escapeText(p1) : '—';
  if (mode === 'solo') return `${a} <span class="tcg-muted">(solo)</span>`;
  if (waiting) return `${a} <span class="tcg-muted">— waiting for opponent</span>`;
  return `${a} <span class="tcg-vs">vs</span> ${p2 ? escapeText(p2) : '—'}`;
}

const STATUS_LABEL: Record<TcgBrowseRoom['status'], string> = {
  lobby: 'Lobby',
  active: 'Live',
  ended: 'Finished',
};

function renderBrowseRooms(rooms: TcgBrowseRoom[]): string {
  if (rooms.length === 0) return '<p class="tcg-empty">No battles in progress. Create one!</p>';
  const rows = rooms.map((r) => {
    const label = r.you ? 'open' : (r.openLobby ? 'join' : 'watch');
    const watchers = r.spectators > 0
      ? `<span class="tcg-room-watch" title="${r.spectators} watching">👁 ${r.spectators}</span>`
      : '';
    return fillTcgHtml('tcg-browse-room.html', {
      ID: escapeAttr(r.id),
      STATUS_CLASS: escapeAttr(r.status),
      STATUS: STATUS_LABEL[r.status],
      MODE: escapeText(formatRoomMode(r.mode)),
      MATCHUP: matchup(r.p1, r.p2, r.mode, r.mode === 'pvp' && !r.p2),
      WATCHERS: watchers,
      LABEL: label,
    });
  }).join('');
  return `<ul class="tcg-rooms">${rows}</ul>`;
}

function relTime(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function resultText(e: TcgHistoryEntry): { text: string; cls: string } {
  const tail = e.endReason === 'timeout' ? ' (timeout)'
    : e.endReason === 'disconnect' ? ' (disconnect)'
      : e.endReason === 'forfeit' ? ' (forfeit)' : '';
  if (e.winner === 'draw' || e.winner == null) return { text: `Draw${tail}`, cls: 'draw' };
  const name = e.winner === 'p1' ? e.p1 : e.p2;
  return { text: `${escapeText(name)} won${tail}`, cls: 'win' };
}

function renderHistory(history: TcgHistoryEntry[], now: number): string {
  if (history.length === 0) return '<p class="tcg-empty">No matches played yet.</p>';
  const rows = history.map((e) => {
    const res = resultText(e);
    return fillTcgHtml('tcg-browse-history.html', {
      ID: escapeAttr(e.id),
      MODE: escapeText(formatRoomMode(e.mode)),
      MATCHUP: `${escapeText(e.p1)} <span class="tcg-vs">vs</span> ${escapeText(e.p2)}`,
      RESULT: `${res.text} <span class="tcg-muted">· ${e.rounds} rounds</span>`,
      RESULT_CLASS: res.cls,
      TIME: escapeText(relTime(e.endedAt, now)),
    });
  }).join('');
  return `<ul class="tcg-rooms">${rows}</ul>`;
}

export function TcgBrowsePage(opts: TcgBrowseOpts) {
  const {
    nonce, lv999, user, rooms, history, loginReturnPath,
  } = opts;
  if (!user) {
    return loginPage({
      nonce, lv999, user, loginReturnPath,
    });
  }

  const body = renderTcgHtml('tcg-browse.html', {
    IN_PROGRESS: renderBrowseRooms(rooms),
    HISTORY: renderHistory(history, Date.now()),
  });

  return Layout({
    title: 'Silverwolf — TCG Battles',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

// ── Create page (separate from browse) ──────────────────────────────────────
export function TcgCreatePage(opts: TcgCreateOpts) {
  const {
    nonce, lv999, user, csrf, characterCatalog, deckLegal, teamState, loginReturnPath,
  } = opts;
  if (!user) {
    return loginPage({
      nonce, lv999, user, loginReturnPath,
    });
  }

  const teamPicker = renderTeamPicker({
    deckLegal,
    submitId: 'tcg-create',
    submitLabel: '[ Create Battle ]',
    errorId: 'tcg-err',
  });

  const body = html`
    ${renderTcgHtml('tcg-create.html', { TEAM_PICKER: teamPicker })}
    ${tcgDetailModalShell()}
    ${tcgDetailAssets(nonce, characterCatalog)}
    ${tcgScriptAssets('tcg-landing', nonce, {
    id: 'tcg-landing-data',
    payload: { csrf: csrf ?? '', deckLegal, teamState },
  })}
  `;

  return Layout({
    title: 'Silverwolf — Create TCG Battle',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
