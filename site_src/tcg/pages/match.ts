/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { escapeAttr, escapeText, renderTcgHtml } from '../html';
import { formatRoomMode } from '../labels';
import type { BattleSnapshot, SnapshotCharacter, SnapshotEffect } from '../../../tcg/battleSnapshot';
import type { BattleLogEntry } from '../../../tcg/battle';
import type { TcgChatMessage, TcgFeedItem } from '../rooms';

export interface TcgMatchDetailOpts {
  nonce: string;
  lv999?: boolean;
  user: NavUser | null;
  id: string;
  mode: 'pvp' | 'solo';
  p1: string;
  p2: string;
  winner: 'p1' | 'p2' | 'draw' | null;
  endReason: string;
  rounds: number;
  endedAt: number;
  snapshot: BattleSnapshot | null;
  feed: TcgFeedItem[];
  notFound?: boolean;
}

const MAX_EQUIP = 3;
const REASON_TAIL: Record<string, string> = {
  timeout: ' (timeout)',
  disconnect: ' (disconnect)',
  forfeit: ' (forfeit)',
};

function effectsHtml(effects: SnapshotEffect[]): string {
  const max = 6;
  const shown = effects.slice(0, max).map((e) => {
    const dur = e.duration < 999 ? ` ${e.duration}` : '';
    const cls = e.positive ? 'buff' : 'debuff';
    const title = escapeAttr(`${e.name}: ${e.description}`);
    return `<span class="tcg-eff ${cls}" title="${title}">${escapeText(e.name + dur)}</span>`;
  }).join('');
  const more = effects.length > max ? `<span class="tcg-eff more">+${effects.length - max}</span>` : '';
  return `${shown}${more}`;
}

function ultOrbHtml(ch: SnapshotCharacter): string {
  const ult = ch.skills.find((s) => s.category === 'ultimate');
  if (!ult || ult.energyCost <= 0) return '';
  const cost = ult.energyCost;
  const pct = Math.max(0, Math.min(100, (100 * ch.energy) / cost));
  const full = ch.energy >= cost && !ch.isKnockedOut ? ' full' : '';
  return `<div class="tcg-ult-orb foe${full}" title="${escapeAttr(ult.name)}">`
    + `<span class="orb-fill" style="--pct:${pct}"></span>`
    + '<span class="orb-glyph">⚡</span>'
    + `<span class="orb-val">${Math.min(ch.energy, cost)}/${cost}</span></div>`;
}

function equipPipsHtml(ch: SnapshotCharacter): string {
  const count = Math.min(ch.equipmentCount || 0, MAX_EQUIP);
  let pips = '';
  for (let i = 0; i < MAX_EQUIP; i += 1) {
    const eq = ch.equipments[i];
    let title = 'Empty slot';
    if (i < count) title = eq ? escapeAttr(eq.name) : 'Equipped';
    pips += `<span class="tcg-equip-pip${i < count ? ' on' : ''}" title="${title}"></span>`;
  }
  return `<div class="tcg-equip-pips${count === 0 ? ' empty' : ''}">${pips}</div>`;
}

function charCardHtml(ch: SnapshotCharacter): string {
  const hpPct = Math.max(0, Math.min(100, (100 * ch.currentHp) / Math.max(1, ch.maxHp)));
  const low = hpPct <= 30 ? ' low' : '';
  const koCls = ch.isKnockedOut ? ' ko' : '';
  return `<div class="tcg-char${koCls}">`
    + '<div class="tcg-char-art">'
    + `<img class="art" src="/static/tcg/char/${encodeURIComponent(ch.slug)}.png" alt="${escapeAttr(ch.name)}" loading="lazy" decoding="async">`
    + '<div class="tcg-ko-badge">KO</div>'
    + `${equipPipsHtml(ch)}${ultOrbHtml(ch)}</div>`
    + '<div class="tcg-char-info">'
    + `<div class="tcg-char-namerow"><span class="tcg-char-name">${escapeText(ch.name)}</span></div>`
    + `<div class="tcg-hp-bar"><div class="tcg-hp-fill${low}" style="width:${hpPct}%"></div>`
    + `<span class="tcg-hp-val">${Math.max(0, Math.round(ch.currentHp))} / ${ch.maxHp}</span></div>`
    + `<div class="tcg-effects">${effectsHtml(ch.effects || [])}</div>`
    + '</div></div>';
}

function sideHtml(side: 'p1' | 'p2', name: string, team: SnapshotCharacter[], isWinner: boolean): string {
  const cards = team.map(charCardHtml).join('');
  const crown = isWinner ? ' 👑' : '';
  const acting = isWinner ? ' acting' : '';
  return `<div class="tcg-side" data-side="${side}">`
    + `<div class="tcg-side-label${acting}"><span class="tcg-side-dot"></span>`
    + `<span>${escapeText(name)}${crown}</span></div>`
    + `<div class="tcg-row">${cards}</div></div>`;
}

function boardHtml(o: TcgMatchDetailOpts): string {
  const s = o.snapshot;
  if (!s) return '<p class="tcg-empty">Final board state wasn’t saved for this match.</p>';
  return `<div class="tcg-arena tcg-arena-static">${
    sideHtml('p1', o.p1, s.teams.p1 || [], o.winner === 'p1')
  }<div class="tcg-arena-divider"><span class="tcg-arena-vs">VS</span></div>${
    sideHtml('p2', o.p2, s.teams.p2 || [], o.winner === 'p2')
  }</div>`;
}

function logLineHtml(e: BattleLogEntry): string {
  const kind = escapeAttr(e.kind || 'info');
  const title = e.detail ? ` title="${escapeAttr(e.detail)}"` : '';
  return `<div class="tcg-log-line tcg-log-${kind}"${title}>${escapeText(e.text)}</div>`;
}

function chatLineHtml(m: TcgChatMessage): string {
  if (m.kind === 'system') return `<div class="tcg-feed-system">${escapeText(m.text)}</div>`;
  const dev = m.isDev ? '<span class="tcg-chat-pico dev" title="Developer">★</span>' : '';
  const player = m.isPlayer ? '<span class="tcg-chat-pico" title="Player">⚔</span>' : '';
  return `<div class="tcg-chat-line"><span class="tcg-chat-author">${dev}${player}${escapeText(`${m.username}: `)}</span>`
    + `<span class="tcg-chat-text">${escapeText(m.text)}</span></div>`;
}

// One combined feed (battle-log lines + chat interleaved) — identical to the live battle.
function feedHtml(feed: TcgFeedItem[]): string {
  if (!feed.length) return '<p class="tcg-empty">Nothing was recorded for this match.</p>';
  const lines = feed.map((it) => (it.kind === 'chat' ? chatLineHtml(it.m) : logLineHtml(it.e))).join('');
  return `<div class="tcg-feed tcg-feed-static">${lines}</div>`;
}

function resultLine(o: TcgMatchDetailOpts): string {
  const tail = REASON_TAIL[o.endReason] || '';
  if (o.winner === 'draw' || o.winner == null) {
    return `<span class="tcg-hist-result draw">Draw${tail}</span>`;
  }
  const name = o.winner === 'p1' ? o.p1 : o.p2;
  return `<span class="tcg-hist-result win">${escapeText(name)} won${escapeText(tail)}</span>`;
}

function shell(bodyInner: string, opts: TcgMatchDetailOpts) {
  return Layout({
    title: 'Silverwolf — TCG Match',
    active: 'games',
    body: raw(bodyInner) as any,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

export function TcgMatchDetailPage(opts: TcgMatchDetailOpts) {
  if (!opts.user) {
    return Layout({
      title: 'Silverwolf — TCG Match',
      active: 'games',
      body: renderTcgHtml('tcg-login.html', {
        TITLE: 'TCG Match',
        WRAP_CLASS: 'tcg-wrap',
        MESSAGE: 'Log in to view match history.',
        LOGIN_URL: `/auth/discord/login?return=${encodeURIComponent(`/games/tcg/match/${opts.id}`)}`,
      }) as any,
      nonce: opts.nonce,
      lv999: opts.lv999,
      user: opts.user,
    });
  }

  const header = '<div class="tcg-room-header">'
    + '<h1 class="tcg-page-title tcg-room-title">Match Result</h1>'
    + '<a class="tcg-room-match tcg-link" href="/games/tcg">← all battles</a></div>';

  if (opts.notFound) {
    return shell(`${header}<div class="tcg-room-wrap"><div class="tcg-panel">`
      + '<p class="tcg-empty">This match doesn’t exist.</p></div></div>', opts);
  }

  const meta = `${escapeText(formatRoomMode(opts.mode))} · ${opts.rounds} rounds`;
  const matchup = `${escapeText(opts.p1)} <span class="tcg-vs">vs</span> ${escapeText(opts.p2)}`;

  const body = `${header}
    <div class="tcg-room-wrap">
      <div class="tcg-panel">
        <div class="tcg-match-summary">
          <span class="tcg-match-matchup">${matchup}</span>
          ${resultLine(opts)}
          <span class="tcg-match-meta">${meta}</span>
        </div>
        ${boardHtml(opts)}
      </div>
      <div class="tcg-panel">
        <p class="tcg-subtitle">Battle Log &amp; Chat</p>
        ${feedHtml(opts.feed)}
      </div>
    </div>`;

  return shell(body, opts);
}
