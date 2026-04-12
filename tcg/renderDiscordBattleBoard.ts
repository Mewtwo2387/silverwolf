import Canvas from 'canvas';
import { Battle } from './battle';
import { CharacterInBattle } from './characterInBattle';
import type { Effect } from './effect';

const SCALE = 0.2;
const CARD_W = 1080;
const CARD_H = 1920;
const TW = Math.round(CARD_W * SCALE);
const TH = Math.round(CARD_H * SCALE);
const GAP = 10;
const MARGIN = 16;
const LABEL_H = 26;

const OVERLAY_TOP_PAD = 6;
const LINE_NAME = 16;
const GAP_NAME_HP = 4;
const LINE_HP = 14;
const GAP_BEFORE_EFFECTS = 4;
const LINE_EFFECT = 11;
const OVERLAY_BOTTOM_PAD = 8;
const MAX_EFFECT_LINES = 14;
const EFFECT_CHARS = 44;

function formatEffectLine(e: Effect): string {
  const dur = e.duration >= 999 ? '∞' : `${e.duration}t`;
  let text = `${e.name} (${dur})`;
  if (text.length > EFFECT_CHARS) {
    text = `${text.slice(0, EFFECT_CHARS - 1)}…`;
  }
  return text;
}

/** Lines to draw in the overlay (each ≤ one row); may truncate count with “+N more”. */
function buildEffectDisplayLines(cib: CharacterInBattle): string[] {
  if (cib.effects.length === 0) return [];
  const raw = cib.effects.map(formatEffectLine);
  if (raw.length <= MAX_EFFECT_LINES) return raw;
  const head = raw.slice(0, MAX_EFFECT_LINES - 1);
  const rest = raw.length - head.length;
  return [...head, `+${rest} more effects`];
}

function overlayBarHeight(effectLines: string[]): number {
  const base = OVERLAY_TOP_PAD + LINE_NAME + GAP_NAME_HP + LINE_HP + OVERLAY_BOTTOM_PAD;
  if (effectLines.length === 0) return base;
  return base + GAP_BEFORE_EFFECTS + effectLines.length * LINE_EFFECT;
}

async function renderCharacterThumb(cib: CharacterInBattle): Promise<Canvas.Canvas> {
  const base = await cib.character.generateCard();
  const effectLines = buildEffectDisplayLines(cib);
  const barH = overlayBarHeight(effectLines);

  const thumb = Canvas.createCanvas(TW, TH);
  const ctx = thumb.getContext('2d');
  ctx.drawImage(base, 0, 0, TW, TH);

  const overlayTop = TH - barH;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, overlayTop, TW, barH);

  ctx.textBaseline = 'top';
  let y = overlayTop + OVERLAY_TOP_PAD;
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 15px "Segoe UI", "Bahnschrift", sans-serif';
  const shortName = cib.character.name.length > 18
    ? `${cib.character.name.slice(0, 16)}…`
    : cib.character.name;
  ctx.fillText(shortName, 8, y);
  y += LINE_NAME + GAP_NAME_HP;

  ctx.font = '600 13px "Segoe UI", "Bahnschrift", sans-serif';
  ctx.fillStyle = '#e8e8e8';
  const line2 = `HP ${cib.currentHp}/${cib.character.hp}  ·  Energy ${cib.energy}`;
  ctx.fillText(line2, 8, y);
  y += LINE_HP;

  if (effectLines.length > 0) {
    y += GAP_BEFORE_EFFECTS;
    ctx.font = '500 10px "Segoe UI", "Bahnschrift", sans-serif';
    ctx.fillStyle = '#c9dcff';
    for (const line of effectLines) {
      ctx.fillText(line, 8, y);
      y += LINE_EFFECT;
    }
  }

  if (cib.isKnockedOut) {
    ctx.fillStyle = 'rgba(15,15,18,0.82)';
    ctx.fillRect(0, 0, TW, TH);
    ctx.fillStyle = '#ff5555';
    ctx.font = 'bold 40px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KO', TW / 2, TH / 2);
    ctx.textAlign = 'left';
  }

  return thumb;
}

/**
 * Renders P1 and P2 teams as a single PNG (scaled card art + HP/energy overlays).
 */
export async function renderBattleBoardPng(battle: Battle): Promise<Buffer> {
  const [p1Thumbs, p2Thumbs] = await Promise.all([
    Promise.all(battle.p1cards.map((c) => renderCharacterThumb(c))),
    Promise.all(battle.p2cards.map((c) => renderCharacterThumb(c))),
  ]);

  const rowW = 3 * TW + 2 * GAP;
  const boardW = MARGIN * 2 + rowW;
  const boardH = MARGIN + LABEL_H + TH + GAP + LABEL_H + TH + MARGIN;

  const board = Canvas.createCanvas(boardW, boardH);
  const ctx = board.getContext('2d');
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, boardW, boardH);

  ctx.fillStyle = '#f2f3f5';
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';

  let y = MARGIN;
  ctx.fillText('P1', MARGIN, y);
  y += LABEL_H;
  for (let i = 0; i < p1Thumbs.length; i += 1) {
    ctx.drawImage(p1Thumbs[i], MARGIN + i * (TW + GAP), y);
  }
  y += TH + GAP;

  ctx.fillText('P2', MARGIN, y);
  y += LABEL_H;
  for (let i = 0; i < p2Thumbs.length; i += 1) {
    ctx.drawImage(p2Thumbs[i], MARGIN + i * (TW + GAP), y);
  }

  return board.toBuffer('image/png') as Buffer;
}
