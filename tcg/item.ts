/* eslint-disable max-classes-per-file */
import Canvas from 'canvas';
import { Rarity } from './rarity';
import { Background } from './background';
import { ImagePanel } from './imagePanel';
import { Card } from './interfaces/card';
import { Effect } from './effect';
import { drawTcgText } from './utils/tcgTextStyle';
import { commonConsumableIconPath, commonEquipmentIconPath } from './assetPaths';
import type { CharacterInBattle } from './characterInBattle';
import type { Battle } from './battle';

export enum ItemKind {
  Equipment = 'equipment',
  Consumable = 'consumable',
}

let equipmentIconPromise: Promise<Canvas.Image> | null = null;
let consumableIconPromise: Promise<Canvas.Image> | null = null;

async function loadItemTypeIcon(kind: ItemKind): Promise<Canvas.Image | null> {
  const path = kind === ItemKind.Consumable ? commonConsumableIconPath() : commonEquipmentIconPath();
  const cache = kind === ItemKind.Consumable ? consumableIconPromise : equipmentIconPromise;
  const loader = cache ?? Canvas.loadImage(path);
  if (kind === ItemKind.Consumable) {
    consumableIconPromise = loader;
  } else {
    equipmentIconPromise = loader;
  }
  try {
    return await loader;
  } catch {
    if (kind === ItemKind.Consumable) {
      consumableIconPromise = null;
    } else {
      equipmentIconPromise = null;
    }
    return null;
  }
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
 *  - Type emblem (top-left): equipment/consumable PNG (card background is tinted by star tier).
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

  /**
   * Draw the type emblem in the top-left (same slot as character element icons):
   * `common/equipment.png` or `common/consumable.png`.
   */
  protected async drawTypeEmblem(ctx: Canvas.CanvasRenderingContext2D): Promise<void> {
    const icon = await loadItemTypeIcon(this.kind);
    if (icon) {
      ctx.drawImage(icon, 0, 0, 128, 128);
    }
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
    await this.drawTypeEmblem(ctx);
    await this.rarity.draw(ctx, 'item');

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

    const descEndY = this.drawDescription(ctx, afterImageY, this.description);
    if (this.footer) {
      this.drawFooter(ctx, descEndY, this.footer);
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

  override apply(target: CharacterInBattle, _battle: Battle): boolean {
    return target.equip(this);
  }
}

/** Gold palette for signature equipment card art (visual only; no combat effect). */
const SIGNATURE_GOLD = '#e8c468';
const SIGNATURE_GOLD_DARK = '#9a6b2e';
const SIGNATURE_GOLD_LIGHT = '#fff6d8';

/**
 * Signature equipment: same combat rules as {@link Equipment}, but the generated card
 * uses a distinct gold frame and a banner naming the linked character.
 */
export class SignatureEquipment extends Equipment {
  /** Display name of the character this item is signature gear for (e.g. "Kaitlin"). */
  signatureOf: string;

  constructor(
    id: string,
    name: string,
    signatureOf: string,
    description: string,
    rarity: Rarity,
    imagePanel: ImagePanel,
    background: Background,
    effects: Effect[],
    onEquipped?: (target: CharacterInBattle) => void,
    footer?: string,
  ) {
    super(id, name, description, rarity, imagePanel, background, effects, onEquipped, footer);
    this.signatureOf = signatureOf;
  }

  private drawSignatureBorder(ctx: Canvas.CanvasRenderingContext2D): void {
    const inset = 12;
    const w = CARD_WIDTH - inset * 2;
    const h = CARD_HEIGHT - inset * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(232, 196, 104, 0.55)';
    ctx.shadowBlur = 28;
    ctx.strokeStyle = SIGNATURE_GOLD;
    ctx.lineWidth = 6;
    ctx.strokeRect(inset, inset, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = SIGNATURE_GOLD_DARK;
    ctx.lineWidth = 2;
    ctx.strokeRect(inset + 8, inset + 8, w - 16, h - 16);
    ctx.restore();

    // Corner accents
    const corner = 48;
    const corners: [number, number, number, number][] = [
      [inset, inset, 1, 1],
      [CARD_WIDTH - inset, inset, -1, 1],
      [inset, CARD_HEIGHT - inset, 1, -1],
      [CARD_WIDTH - inset, CARD_HEIGHT - inset, -1, -1],
    ];
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 246, 216, 0.75)';
    ctx.lineWidth = 3;
    corners.forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + sx * corner, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + sy * corner);
      ctx.stroke();
    });
    ctx.restore();
  }

  /** Ribbon under the top bar: SIGNATURE + character name. */
  private drawSignatureBanner(ctx: Canvas.CanvasRenderingContext2D): void {
    const bannerY = TOP_BAR_HEIGHT + 8;
    const bannerH = 56;
    const left = 64;
    const right = CARD_WIDTH - 64;
    const width = right - left;

    ctx.save();
    const grad = ctx.createLinearGradient(left, bannerY, right, bannerY + bannerH);
    grad.addColorStop(0, 'rgba(154, 107, 46, 0.92)');
    grad.addColorStop(0.5, 'rgba(232, 196, 104, 0.95)');
    grad.addColorStop(1, 'rgba(154, 107, 46, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(left, bannerY, width, bannerH);
    ctx.strokeStyle = SIGNATURE_GOLD_LIGHT;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, bannerY, width, bannerH);
    ctx.restore();

    drawTcgText(ctx, 'SIGNATURE', left + width / 2, bannerY + 18, {
      font: '700 22px "Bahnschrift"',
      fillStyle: SIGNATURE_GOLD_DARK,
      strokeStyle: 'rgba(255, 255, 255, 0.35)',
      lineWidth: 2,
      textAlign: 'center',
      shadowBlur: 0,
    });
    drawTcgText(ctx, this.signatureOf.toUpperCase(), left + width / 2, bannerY + 46, {
      font: '800 28px "Bahnschrift"',
      fillStyle: SIGNATURE_GOLD_LIGHT,
      strokeStyle: SIGNATURE_GOLD_DARK,
      lineWidth: 3,
      textAlign: 'center',
      shadowBlur: 8,
    });
  }

  override async generateCard(): Promise<Canvas.Canvas> {
    const canvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    await this.background.draw(ctx);
    this.drawSignatureBorder(ctx);
    await this.drawTypeEmblem(ctx);
    await this.rarity.draw(ctx, 'item');

    drawTcgText(ctx, this.name.toUpperCase(), 144, 96, {
      font: '700 84px "Bahnschrift"',
      fillStyle: SIGNATURE_GOLD_LIGHT,
      strokeStyle: SIGNATURE_GOLD_DARK,
      lineWidth: 7,
      textAlign: 'left',
      shadowBlur: 14,
      shadowOffsetY: 4,
    });

    this.drawSignatureBanner(ctx);

    const imagePanelY = TOP_BAR_HEIGHT + 64 + 56;
    const afterImageY = await this.imagePanel.draw(ctx, imagePanelY);

    const descEndY = this.drawDescription(ctx, afterImageY, this.description);
    if (this.footer) {
      this.drawFooter(ctx, descEndY, this.footer);
    }

    return canvas;
  }
}

export function isSignatureEquipment(item: Item): item is SignatureEquipment {
  return item instanceof SignatureEquipment;
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

  override apply(target: CharacterInBattle, battle: Battle): boolean {
    if (target.isKnockedOut) return false;
    this.effect(target, battle);
    return true;
  }
}
