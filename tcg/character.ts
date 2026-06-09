/* eslint-disable */
import Canvas from 'canvas';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background } from './background';
import { Skill } from './skill';
import { Ability } from './ability';
import { Card } from './interfaces/card';
import { Element } from './element';
import { drawTcgText } from './utils/tcgTextStyle';
import { CharacterTextColors, resolveCharacterTextColors } from './textTheme';
import { ImagePanel } from './imagePanel';
import { tcgAssetPaths } from './assetPaths';

/** Fixed card canvas dimensions. */
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
/** Y where the variable-height body (title/art/skills/abilities) begins, under the header. */
const BODY_START_Y = 192;
/** Breathing room kept below the body so content never touches the bottom edge. */
const BODY_BOTTOM_MARGIN = 32;

/**
 * A single character card and their stats
 * @param name - The name of the character
 * @param titleDesc - The title and description of the character
 * @param rarity - The rarity of the character
 * @param hp - Max HP of the character
 * @param element - The type/element of the character
 * @param imagePanel - Character image panel used for generating the card
 * @param background - Background used for generating the card
 * @param skills - A list of skills the character can use
 * @param abilities - A list of passive abilities the character has
 * @param defaultActiveSkillIndices - Optional: which skill indices are available in the default/base form. If not specified, all skills are available.
 */
export class Character implements Card {
  name: string;
  titleDesc: TitleDesc;
  rarity: Rarity;
  hp: number;
  element: Element;
  imagePanel: ImagePanel;
  background: Background;
  skills: Skill[];
  abilities: Ability[];
  defaultActiveSkillIndices?: number[];
  textColors: CharacterTextColors;
  twoColumnSkills: boolean;
  /** Internal labels for ability/equipment logic; not shown in UI. */
  tags: readonly string[];

  constructor(name: string, titleDesc: TitleDesc, rarity: Rarity, hp: number, element: Element, imagePanel: ImagePanel, background: Background, skills: Skill[] = [], abilities: Ability[] = [], defaultActiveSkillIndices?: number[], textColors?: Partial<CharacterTextColors>, twoColumnSkills: boolean = false, tags: readonly string[] = []) {
    this.name = name;
    this.titleDesc = titleDesc;
    this.rarity = rarity;
    this.hp = hp;
    this.element = element;
    this.imagePanel = imagePanel;
    this.background = background;
    this.skills = skills;
    this.abilities = abilities;
    this.defaultActiveSkillIndices = defaultActiveSkillIndices;
    this.textColors = resolveCharacterTextColors(textColors);
    this.twoColumnSkills = twoColumnSkills;
    this.tags = tags;
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  async generateCard() {
    const canvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Set background
    await this.background.draw(ctx);

    try {
      const elementName = Element[this.element]?.toLowerCase();
      const elementImagePath = `${tcgAssetPaths.types}/${elementName}.png`;
      const elementImage = await Canvas.loadImage(elementImagePath);
      ctx.drawImage(elementImage, 0, 0, 128, 128);
    } catch (error) {
      console.warn(`Element image not found for: ${this.element}`);
    }

    // Draw HP on the rightmost side
    drawTcgText(ctx, 'HP', 1048, 46, {
      font: '700 44px "Bahnschrift"',
      fillStyle: this.textColors.hpLabelFill,
      strokeStyle: this.textColors.hpLabelStroke,
      lineWidth: 5,
      textAlign: 'right',
      shadowBlur: 8,
      shadowOffsetY: 3,
    });

    drawTcgText(ctx, `${this.hp}`, 1048, 104, {
      font: '700 64px "Bahnschrift"',
      fillStyle: this.textColors.hpValueFill,
      strokeStyle: this.textColors.hpValueStroke,
      lineWidth: 6,
      textAlign: 'right',
      shadowBlur: 10,
      shadowOffsetY: 3,
    });

    await this.rarity.draw(ctx);

    drawTcgText(ctx, this.name.toUpperCase(), 144, 96, {
      font: '700 90px "Bahnschrift"',
      fillStyle: this.textColors.nameFill,
      strokeStyle: this.textColors.nameStroke,
      lineWidth: 7,
      textAlign: 'left',
      shadowBlur: 12,
      shadowOffsetY: 4,
    });

    // The body (title, art, skills, abilities) grows with how much a character has to say.
    // Measure it on a throwaway context first, then uniformly scale it down so it always
    // fits within the card instead of spilling past the bottom edge.
    const measureCtx = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT).getContext('2d');
    const bodyEndY = await this.drawBody(measureCtx, BODY_START_Y);
    const bodyHeight = bodyEndY - BODY_START_Y;
    const availableHeight = CARD_HEIGHT - BODY_BOTTOM_MARGIN - BODY_START_Y;

    if (bodyHeight > availableHeight && bodyHeight > 0) {
      const scale = availableHeight / bodyHeight;
      // Anchor the scaled body at its start Y and re-center it horizontally so the
      // shrunken content keeps even margins instead of hugging the left edge.
      const horizontalInset = (CARD_WIDTH * (1 - scale)) / 2;
      ctx.save();
      ctx.translate(horizontalInset, BODY_START_Y);
      ctx.scale(scale, scale);
      await this.drawBody(ctx, 0);
      ctx.restore();
    } else {
      await this.drawBody(ctx, BODY_START_Y);
    }

    return canvas;
  }

  /**
   * Draws the variable-height portion of the card (title/description, art panel, skills,
   * abilities) starting at `startY` and returns the Y coordinate just past the last block.
   * Kept side-effect free with respect to the header so it can be rendered twice: once to
   * measure its height, once (optionally scaled) to actually paint it.
   */
  private async drawBody(ctx: Canvas.CanvasRenderingContext2D, startY: number): Promise<number> {
    let currentY = await this.titleDesc.draw(ctx, startY, this.textColors);

    currentY = await this.imagePanel.draw(ctx, currentY);

    if (this.twoColumnSkills && this.skills.length > 0) {
      const edgeInset = 20;
      const gutter = 20;
      const renderedColumnWidth = (CARD_WIDTH - edgeInset * 2 - gutter) / 2;
      const scale = 0.85;
      const internalColumnWidth = renderedColumnWidth / scale;
      const skillLayout = {
        left: 30,
        right: internalColumnWidth - 30,
        maxTextWidth: internalColumnWidth - 80,
        compact: true,
      };
      let leftColY = currentY;
      let rightColY = currentY;

      for (let i = 0; i < this.skills.length; i += 1) {
        const isLeft = i % 2 === 0;
        const colX = isLeft ? edgeInset : edgeInset + renderedColumnWidth + gutter;
        const colY = isLeft ? leftColY : rightColY;

        ctx.save();
        ctx.translate(colX, colY);
        ctx.scale(scale, scale);
        const endYScaled = await this.skills[i].draw(ctx, 0, this.textColors, skillLayout);
        ctx.restore();

        const newY = colY + endYScaled * scale;
        if (isLeft) {
          leftColY = newY;
        } else {
          rightColY = newY;
        }
      }

      currentY = Math.max(leftColY, rightColY);
    } else {
      for (const skill of this.skills) {
        currentY = await skill.draw(ctx, currentY, this.textColors);
      }
    }

    for (const ability of this.abilities) {
      currentY = await ability.draw(ctx, currentY, this.textColors);
    }

    return currentY;
  }
}