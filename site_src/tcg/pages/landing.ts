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
  loadTcgHtml,
  renderActiveRoomRow,
  renderTeamPicker,
  renderTcgHtml,
  tcgScriptAssets,
} from '../html';
import { formatRoomMode, formatRoomStatus } from '../labels';

export interface TcgRoster {
  value: string;
  name: string;
}

export interface TcgActiveRoomBrief {
  id: string;
  mode: 'pvp' | 'solo';
  status: 'lobby' | 'active' | 'ended';
  opponentUsername: string | null;
  youAreCreator: boolean;
}

export interface TcgLandingOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  csrf: string | null;
  roster: TcgRoster[];
  characterCatalog: CharacterCatalogEntry[];
  deckLegal: boolean;
  activeRooms: TcgActiveRoomBrief[];
  loginReturnPath: string;
}

function renderActiveRoomsList(rooms: TcgActiveRoomBrief[]): string {
  if (rooms.length === 0) return loadTcgHtml('tcg-active-rooms-empty.html');
  const rows = rooms.map((r) => {
    const opponentHtml = r.opponentUsername
      ? `vs @${escapeText(r.opponentUsername)}`
      : (r.mode === 'pvp'
        ? '<span class="tcg-muted">waiting for opponent</span>'
        : '<span class="tcg-muted">solo</span>');
    const copyButton = r.mode === 'pvp' && r.status === 'lobby'
      ? fillTcgHtml('tcg-copy-link-btn.html', { ID: escapeAttr(r.id) })
      : '';
    return renderActiveRoomRow({
      id: r.id,
      status: formatRoomStatus(r.status),
      mode: formatRoomMode(r.mode),
      opponentHtml,
      copyButton,
    });
  }).join('');
  return `<ul class="tcg-rooms">${rows}</ul>`;
}

export function TcgBattleLandingPage(opts: TcgLandingOpts) {
  const {
    nonce, lv999, user, csrf, roster, characterCatalog, deckLegal, activeRooms, loginReturnPath,
  } = opts;

  if (!user) {
    return Layout({
      title: 'Silverwolf — TCG Battle',
      active: 'games',
      body: renderTcgHtml('tcg-login.html', {
        TITLE: 'TCG Battle',
        WRAP_CLASS: 'tcg-wrap',
        MESSAGE: 'TCG battles need a Discord account for matchmaking and your saved deck.',
        LOGIN_URL: `/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}`,
      }) as any,
      nonce,
      lv999,
      user,
    });
  }

  const firstThree = roster.slice(0, 3).map((r) => r.value);
  const teamPicker = renderTeamPicker({
    prefix: 'tcg-char',
    roster,
    deckLegal,
    submitId: 'tcg-create',
    submitLabel: '[ Create Battle ]',
    errorId: 'tcg-err',
  });

  const body = html`
    ${renderTcgHtml('tcg-battle-landing.html', {
    TEAM_PICKER: teamPicker,
    ACTIVE_ROOMS: renderActiveRoomsList(activeRooms),
  })}
    ${tcgDetailModalShell()}
    ${tcgDetailAssets(nonce, characterCatalog)}
    ${tcgScriptAssets('tcg-landing', nonce, { id: 'tcg-landing-data', payload: { csrf: csrf ?? '', defaults: firstThree } })}
  `;

  return Layout({
    title: 'Silverwolf — TCG Battle',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}
