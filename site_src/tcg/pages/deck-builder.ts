/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { html } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { tcgDetailAssets, tcgDetailModalShell } from './detail';
import { renderTcgHtml, tcgScriptAssets } from '../html';

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

  if (!user) {
    return Layout({
      title: 'Silverwolf — TCG Deck Builder',
      active: 'games',
      body: renderTcgHtml('tcg-login.html', {
        TITLE: 'TCG Deck Builder',
        WRAP_CLASS: 'tcg-deck-wrap',
        MESSAGE: 'Log in with Discord to edit and save your item deck.',
        LOGIN_URL: `/auth/discord/login?return=${encodeURIComponent(loginReturnPath)}`,
      }) as any,
      nonce,
      lv999,
      user,
    });
  }

  const body = html`
    ${renderTcgHtml('tcg-deck-builder.html', {
    DECK_SIZE: String(caps.deckSize),
    FIVE_MAX: String(caps.fiveStarMax),
    FOUR_MAX: String(caps.fourStarMax),
  })}
    ${tcgDetailModalShell()}
    ${tcgDetailAssets(nonce)}
    ${tcgScriptAssets('tcg-deck-builder', nonce, {
    id: 'tcg-deck-data',
    payload: {
      csrf: csrf ?? '', items, composition, caps,
    },
  })}
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
