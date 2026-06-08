import Canvas from 'canvas';
import { Battle } from './battle';
import { CharacterInBattle, MAX_EQUIPMENTS_PER_CHARACTER } from './characterInBattle';
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

function roundRect(
  ctx: Canvas.CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Draws up to {@link MAX_EQUIPMENTS_PER_CHARACTER} small slot pips in the top-right
 * of a thumbnail. Filled blue = equipped, dim outline = empty slot. Hidden if the
 * character isn't holding anything (to avoid visual noise on most cards).
 */
function drawEquipmentPips(ctx: Canvas.CanvasRenderingContext2D, cib: CharacterInBattle): void {
  const equipped = cib.equipments.length;
  if (equipped === 0) return;

  const pipW = 18;
  const pipH = 10;
  const gap = 3;
  const right = TW - 6;
  const top = 6;

  ctx.save();
  ctx.font = 'bold 8px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let i = 0; i < MAX_EQUIPMENTS_PER_CHARACTER; i += 1) {
    const x = right - (MAX_EQUIPMENTS_PER_CHARACTER - i) * (pipW + gap) + gap;
    const y = top;
    const filled = i < equipped;
    ctx.fillStyle = filled ? 'rgba(59, 108, 242, 0.92)' : 'rgba(20, 24, 32, 0.55)';
    ctx.strokeStyle = filled ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, pipW, pipH, 3);
    ctx.fill();
    ctx.stroke();
    if (filled) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('EQ', x + pipW / 2, y + pipH / 2 + 0.5);
    }
  }
  ctx.restore();
}

async function renderCharacterThumb(
  cib: CharacterInBattle,
  slotIndex: number,
  isActive: boolean,
): Promise<Canvas.Canvas> {
  const base = await cib.character.generateCard();
  const effectLines = buildEffectDisplayLines(cib);
  const barH = overlayBarHeight(effectLines);

  const thumb = Canvas.createCanvas(TW, TH);
  const ctx = thumb.getContext('2d');

  if (isActive && !cib.isKnockedOut) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 214, 96, 0.95)';
    ctx.shadowBlur = 28;
    ctx.drawImage(base, 0, 0, TW, TH);
    ctx.shadowBlur = 18;
    ctx.drawImage(base, 0, 0, TW, TH);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 214, 96, 0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, TW - 3, TH - 3);
    ctx.restore();
  } else {
    ctx.drawImage(base, 0, 0, TW, TH);
  }

  const overlayTop = TH - barH;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, overlayTop, TW, barH);

  ctx.textBaseline = 'top';
  let y = overlayTop + OVERLAY_TOP_PAD;
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 15px "Segoe UI", "Bahnschrift", sans-serif';
  const prefix = `${slotIndex}. `;
  const maxNameLen = 18 - prefix.length;
  const shortName = cib.character.name.length > maxNameLen
    ? `${cib.character.name.slice(0, Math.max(0, maxNameLen - 1))}…`
    : cib.character.name;
  ctx.fillText(`${prefix}${shortName}`, 8, y);
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

  drawEquipmentPips(ctx, cib);

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
  const activeSlot = battle.getCurrentActiveSlot();
  const activeSide = battle.currentPlayer;

  const [p1Thumbs, p2Thumbs] = await Promise.all([
    Promise.all(battle.p1cards.map((c, i) => renderCharacterThumb(c, i, activeSide === 'p1' && i === activeSlot))),
    Promise.all(battle.p2cards.map((c, i) => renderCharacterThumb(c, i, activeSide === 'p2' && i === activeSlot))),
  ]);

  // Active side is rendered on the BOTTOM so it flips when turns change.
  const topLabel = activeSide === 'p1' ? 'P2' : 'P1';
  const bottomLabel = activeSide === 'p1' ? 'P1' : 'P2';
  const topThumbs = activeSide === 'p1' ? p2Thumbs : p1Thumbs;
  const bottomThumbs = activeSide === 'p1' ? p1Thumbs : p2Thumbs;

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
  ctx.fillText(topLabel, MARGIN, y);
  y += LABEL_H;
  for (let i = 0; i < topThumbs.length; i += 1) {
    ctx.drawImage(topThumbs[i], MARGIN + i * (TW + GAP), y);
  }
  y += TH + GAP;

  ctx.fillText(`${bottomLabel}  (active)`, MARGIN, y);
  y += LABEL_H;
  for (let i = 0; i < bottomThumbs.length; i += 1) {
    ctx.drawImage(bottomThumbs[i], MARGIN + i * (TW + GAP), y);
  }

  return board.toBuffer('image/png') as Buffer;
}
