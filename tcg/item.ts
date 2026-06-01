/* eslint-disable max-classes-per-file */
import Canvas from 'canvas';
import { Rarity } from './rarity';
import { Background } from './background';
import { ImagePanel } from './imagePanel';
import { Card } from './interfaces/card';
import { Effect } from './effect';
import { drawTcgText } from './utils/tcgTextStyle';
import type { CharacterInBattle } from './characterInBattle';
import type { Battle } from './battle';

export enum ItemKind {
  Equipment = 'equipment',
  Consumable = 'consumable',
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const TOP_BAR_HEIGHT = 128;

/**
 * Base class for any item card. Items live in a player's deck/hand and can be played onto
 * an own alive character during their turn. Subclasses define how the item resolves
 * (permanent equipment vs one-shot consumable).
 *
 * Visual design (from the user spec):
 *  - Top bar: stars + name (same as character cards).
 *  - Type emblem (top-left): one logo for equipment, one for consumable, in place of element.
 *  - No HP, no title/description above the image.
 *  - Image panel.
 *  - One paragraph of description below the image.
 *  - Optional footer: smaller italic gray lore line(s) beneath the description.
 */
export abstract class Item implements Card {
  /** Stable identifier used to persist decks (must be unique across all items). */
  id: string;
  name: string;
  description: string;
  /** Optional flavor text rendered below the description (italic, light gray). */
  footer?: string;
  rarity: Rarity;
  imagePanel: ImagePanel;
  background: Background;

  constructor(
    id: string,
    name: string,
    description: string,
    rarity: Rarity,
    imagePanel: ImagePanel,
    background: Background,
    footer?: string,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.footer = footer?.trim() ? footer.trim() : undefined;
    this.rarity = rarity;
    this.imagePanel = imagePanel;
    this.background = background;
  }

  abstract get kind(): ItemKind;

  /**
   * Apply the item onto a target character. Equipment attaches; consumables run their effect.
   * Caller must enforce game-rule gates (own side, alive target, etc.).
   * @returns true if the item was applied; false if the application was rejected.
   */
  abstract apply(target: CharacterInBattle, battle: Battle): boolean;

  /** Color used for the type emblem (drawn behind the EQ/CO glyph). Subclasses override. */
  protected abstract get emblemColor(): string;
  /** Two-letter glyph drawn inside the type emblem (e.g. EQ / CO). */
  protected abstract get emblemLabel(): string;

  /**
   * Draw the type emblem in the top-left where character cards put their element icon.
   * Falls back to a stylized vector glyph since item type icons aren't shipped as PNGs.
   */
  protected drawTypeEmblem(ctx: Canvas.CanvasRenderingContext2D): void {
    const size = 96;
    const x = 16;
    const y = 16;
    const cx = x + size / 2;
    const cy = y + size / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;

    if (this.kind === ItemKind.Consumable) {
      // Flask shape: rounded triangle/teardrop.
      ctx.beginPath();
      ctx.arc(cx, cy + 4, size / 2 - 4, 0, Math.PI * 2);
      ctx.fillStyle = this.emblemColor;
      ctx.fill();
    } else {
      // Shield-style rounded square for equipment.
      const r = 18;
      const left = x + 4;
      const top = y + 4;
      const right = x + size - 4;
      const bottom = y + size - 4;
      ctx.beginPath();
      ctx.moveTo(left + r, top);
      ctx.lineTo(right - r, top);
      ctx.quadraticCurveTo(right, top, right, top + r);
      ctx.lineTo(right, bottom - r);
      ctx.quadraticCurveTo(right, bottom, right - r, bottom);
      ctx.lineTo(left + r, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
      ctx.closePath();
      ctx.fillStyle = this.emblemColor;
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (this.kind === ItemKind.Consumable) {
      ctx.arc(cx, cy + 4, size / 2 - 4, 0, Math.PI * 2);
    } else {
      const r = 18;
      const left = x + 4;
      const top = y + 4;
      const right = x + size - 4;
      const bottom = y + size - 4;
      ctx.moveTo(left + r, top);
      ctx.lineTo(right - r, top);
      ctx.quadraticCurveTo(right, top, right, top + r);
      ctx.lineTo(right, bottom - r);
      ctx.quadraticCurveTo(right, bottom, right - r, bottom);
      ctx.lineTo(left + r, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();

    drawTcgText(ctx, this.emblemLabel, cx, cy + 14, {
      font: '800 38px "Bahnschrift"',
      fillStyle: '#ffffff',
      strokeStyle: 'rgba(0, 0, 0, 0.6)',
      lineWidth: 4,
      textAlign: 'center',
      shadowBlur: 6,
    });
  }

  private static wrapLines(
    ctx: Canvas.CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (ctx.measureText(candidate).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line.length > 0) lines.push(line);
    return lines;
  }

  /**
   * Wrap a text block beneath the image panel. Returns the y coordinate after the text.
   */
  protected drawWrappedTextBlock(
    ctx: Canvas.CanvasRenderingContext2D,
    startY: number,
    text: string,
    style: {
      fontSize: number;
      font: string;
      fillStyle: string;
      strokeStyle?: string;
      lineWidth?: number;
      shadowBlur?: number;
      topGap?: number;
      /** When false, render fill only (used for subtle footer lore). Default true. */
      outline?: boolean;
    },
  ): number {
    const left = 96;
    const maxWidth = CARD_WIDTH - 192;
    const lineHeight = Math.round(style.fontSize * 1.35);
    const topGap = style.topGap ?? 24;
    const useOutline = style.outline !== false;
    ctx.save();
    ctx.font = style.font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const lines = Item.wrapLines(ctx, text, maxWidth);
    let y = startY + style.fontSize + topGap;
    for (const ln of lines) {
      if (useOutline) {
        drawTcgText(ctx, ln, left, y, {
          font: style.font,
          fillStyle: style.fillStyle,
          strokeStyle: style.strokeStyle,
          lineWidth: style.lineWidth,
          textAlign: 'left',
          shadowBlur: style.shadowBlur,
        });
      } else {
        ctx.fillStyle = style.fillStyle;
        ctx.fillText(ln, left, y);
      }
      y += lineHeight;
    }
    ctx.restore();
    return y;
  }

  /** Main rules text beneath the image panel. */
  protected drawDescription(ctx: Canvas.CanvasRenderingContext2D, startY: number, text: string): number {
    return this.drawWrappedTextBlock(ctx, startY, text, {
      fontSize: 44,
      font: '500 44px "Bahnschrift"',
      fillStyle: '#f7f4ec',
      strokeStyle: 'rgba(0, 0, 0, 0.6)',
      lineWidth: 4,
      shadowBlur: 6,
    });
  }

  /** Optional lore footer — smaller, light gray, italic. Omitted when {@link Item.footer} is unset. */
  protected drawFooter(ctx: Canvas.CanvasRenderingContext2D, startY: number, text: string): number {
    return this.drawWrappedTextBlock(ctx, startY, text, {
      fontSize: 36,
      font: 'italic 500 36px "Bahnschrift"',
      fillStyle: '#b4bac6',
      topGap: 40,
      outline: false,
    });
  }

  async generateCard(): Promise<Canvas.Canvas> {
    const canvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    await this.background.draw(ctx);
    this.drawTypeEmblem(ctx);
    await this.rarity.draw(ctx);

    drawTcgText(ctx, this.name.toUpperCase(), 144, 96, {
      font: '700 84px "Bahnschrift"',
      fillStyle: '#fdfaf2',
      strokeStyle: '#3a2018',
      lineWidth: 7,
      textAlign: 'left',
      shadowBlur: 12,
      shadowOffsetY: 4,
    });

    // Items skip the title-desc panel; image panel starts directly below the top bar.
    const imagePanelY = TOP_BAR_HEIGHT + 64;
    const afterImageY = await this.imagePanel.draw(ctx, imagePanelY);

    let textEndY = this.drawDescription(ctx, afterImageY, this.description);
    if (this.footer) {
      textEndY = this.drawFooter(ctx, textEndY, this.footer);
    }

    return canvas;
  }
}

/**
 * Equipment item: stays attached to a target character permanently and continually applies
 * its effects (each effect should use a near-permanent duration). Each character can hold
 * up to 3 equipments — see {@link CharacterInBattle.equip}.
 */
export class Equipment extends Item {
  effects: Effect[];
  /** Optional hook after base effects are applied (conditional bonuses, form change, etc.). */
  onEquipped?: (target: CharacterInBattle) => void;

  constructor(
    id: string,
    name: string,
    description: string,
    rarity: Rarity,
    imagePanel: ImagePanel,
    background: Background,
    effects: Effect[],
    onEquipped?: (target: CharacterInBattle) => void,
    footer?: string,
  ) {
    super(id, name, description, rarity, imagePanel, background, footer);
    this.effects = effects;
    this.onEquipped = onEquipped;
  }

  override get kind(): ItemKind {
    return ItemKind.Equipment;
  }

  protected override get emblemColor(): string {
    return '#3b6cf2';
  }

  protected override get emblemLabel(): string {
    return 'EQ';
  }

  override apply(target: CharacterInBattle, _battle: Battle): boolean {
    return target.equip(this);
  }
}

/**
 * Consumable item: runs its `effect` callback once on the target and is then destroyed.
 * Use one of the helper factories (heal / dispel / restoreEnergy) or pass a custom callback.
 */
export class Consumable extends Item {
  effect: (target: CharacterInBattle, battle: Battle) => void;

  constructor(
    id: string,
    name: string,
    description: string,
    rarity: Rarity,
    imagePanel: ImagePanel,
    background: Background,
    effect: (target: CharacterInBattle, battle: Battle) => void,
    footer?: string,
  ) {
    super(id, name, description, rarity, imagePanel, background, footer);
    this.effect = effect;
  }

  override get kind(): ItemKind {
    return ItemKind.Consumable;
  }

  protected override get emblemColor(): string {
    return '#23b378';
  }

  protected override get emblemLabel(): string {
    return 'CO';
  }

  override apply(target: CharacterInBattle, battle: Battle): boolean {
    if (target.isKnockedOut) return false;
    this.effect(target, battle);
    return true;
  }
}
