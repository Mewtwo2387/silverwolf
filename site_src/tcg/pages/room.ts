/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { html } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import type { TcgRoomSnapshot } from '../rooms';
import type { TcgTeamStateBrief } from './landing';
import type { CharacterCatalogEntry } from './detail';
import { tcgDetailAssets, tcgDetailModalShell } from './detail';
import {
  fillTcgHtml, renderTeamPicker, renderTcgHtml, tcgScriptAssets,
} from '../html';

export interface TcgRoomPageOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  matchId: string;
  selfDiscordId: string | null;
  csrf: string | null;
  snapshot: TcgRoomSnapshot | null;
  roomMissing?: boolean;
  loginReturnPath: string;
}

export interface TcgJoinPageOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  matchId: string;
  csrf: string | null;
  characterCatalog: CharacterCatalogEntry[];
  deckLegal: boolean;
  /** The joiner's team slots; the picker edits the active one in place. */
  teamState: TcgTeamStateBrief;
}

function noticePage(opts: {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  title: string;
  bodyName: string;
  bodyVars?: Record<string, string>;
}) {
  const bodyInner = fillTcgHtml(opts.bodyName, opts.bodyVars ?? {});
  return Layout({
    title: `Silverwolf — ${opts.title}`,
    active: 'games',
    body: renderTcgHtml('tcg-notice.html', { TITLE: opts.title, BODY: bodyInner }) as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

/** Team-picker shown to a second player opening a PvP lobby link. */
export function TcgBattleJoinPage(opts: TcgJoinPageOpts) {
  const {
    nonce, lv999, user, matchId, csrf, characterCatalog, deckLegal, teamState,
  } = opts;

  const teamPicker = renderTeamPicker({
    deckLegal,
    submitId: 'tcg-join',
    submitLabel: '[ Join Battle ]',
    errorId: 'tcg-join-err',
  });

  const body = html`
    ${renderTcgHtml('tcg-battle-join.html', { TEAM_PICKER: teamPicker })}
    ${tcgDetailModalShell()}
    ${tcgDetailAssets(nonce, characterCatalog)}
    ${tcgScriptAssets('tcg-join', nonce, {
    id: 'tcg-join-data',
    payload: {
      csrf: csrf ?? '', matchId, deckLegal, teamState,
    },
  })}
  `;

  return Layout({
    title: 'Silverwolf — Join TCG Battle',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

export function TcgBattleRoomPage(opts: TcgRoomPageOpts) {
  const {
    nonce, lv999, user, matchId, selfDiscordId, csrf, snapshot, roomMissing, loginReturnPath,
  } = opts;

  if (!user) {
    return noticePage({
      nonce,
      lv999,
      user,
      title: 'Log In Required',
      bodyName: 'tcg-notice-login.html',
      bodyVars: { LOGIN_URL: `/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}` },
    });
  }

  if (roomMissing) {
    return noticePage({
      nonce,
      lv999,
      user,
      title: 'Battle Not Found',
      bodyName: 'tcg-notice-missing.html',
    });
  }

  const body = html`
    ${renderTcgHtml('tcg-battle-room.html', { MATCH_ID: `${matchId.slice(0, 10)}…` })}
    ${tcgDetailModalShell()}
    ${tcgDetailAssets(nonce)}
    ${tcgScriptAssets('tcg-battle-room', nonce, {
    id: 'tcg-battle-data',
    payload: {
      matchId,
      csrf: csrf ?? '',
      selfDiscordId: selfDiscordId ?? '',
      snapshot,
    },
  })}
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
