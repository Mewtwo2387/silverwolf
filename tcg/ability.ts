import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight } from './utils/textWrapper';
import { RangeEffect } from './rangeEffect';
import { DrawableBlock } from './interfaces/drawable';
import { CharacterInBattle } from './characterInBattle';
import { RangeType } from './rangeType';
import { drawWrappedTcgText } from './utils/tcgTextStyle';
import { CharacterTextColors, DEFAULT_CHARACTER_TEXT_COLORS } from './textTheme';

/**
 * Context for ability activation check
 */
export interface AbilityActivationContext {
  character: CharacterInBattle;
  getAllies: () => CharacterInBattle[];
  getAllCards: () => CharacterInBattle[];
  target?: CharacterInBattle | null; // Optional target (e.g., for abilities triggered after attacking)
}

/**
 * A pair of RangeEffect and its activation condition
 */
export interface AbilityEffectPair {
  effect: RangeEffect;
  activationCondition?: (context: AbilityActivationContext) => boolean;
}

/**
 * An ability of a character
 * These are passive effects that can be triggered by certain conditions
 * @param name - The name of the ability
 * @param description - The description of the ability
 * @param effectPairs - A list of (RangeEffect, activation condition) pairs. Each effect has its own activation condition.
 */
export class Ability implements DrawableBlock {
  name: string;
  description: string;
  effectPairs: AbilityEffectPair[];
  panelColor: string;

  constructor(name: string, description: string, effectPairs: AbilityEffectPair[] = [], panelColor: string = '#D6DDE8') {
    this.name = name;
    this.description = description;
    this.effectPairs = effectPairs;
    this.panelColor = panelColor;
  }

  toString(): string {
    return `${this.name}: ${this.description}`;
  }

  /**
   * Apply this ability's effects to the appropriate targets
   * Each effect is only applied if its activation condition is met (or if no condition is specified)
   */
  applyEffects(context: AbilityActivationContext) {
    this.effectPairs.forEach(pair => {
      // Check if this effect should be activated
      let shouldActivate = true;
      if (pair.activationCondition) {
        shouldActivate = pair.activationCondition(context);
      }

      if (!shouldActivate) {
        return; // Skip this effect
      }

      // Apply the effect based on its range
      const rangeEffect = pair.effect;
      switch (rangeEffect.range) {
        case RangeType.Self:
          context.character.addEffect(rangeEffect.effect);
          break;
        case RangeType.SingleOpponent:
          // If a target is provided, apply to that target; otherwise skip
          if (context.target) {
            const opponents = context.character.battle.opponent(context.character.side);
            if (opponents.includes(context.target) && !context.target.isKnockedOut) {
              context.target.addEffect(rangeEffect.effect);
            }
          }
          break;
        case RangeType.AllOpponents:
          context.character.battle.opponent(context.character.side).forEach(opponent => {
            if (!opponent.isKnockedOut) {
              opponent.addEffect(rangeEffect.effect);
            }
          });
          break;
        case RangeType.AllAllies:
          context.getAllies().forEach(ally => {
            if (!ally.isKnockedOut) {
              ally.addEffect(rangeEffect.effect);
            }
          });
          break;
        case RangeType.AllCards:
          context.getAllCards().forEach(card => {
            if (!card.isKnockedOut) {
              card.addEffect(rangeEffect.effect);
            }
          });
          break;
        case RangeType.SingleAlly:
          // For passive abilities, single ally typically means self
          context.character.addEffect(rangeEffect.effect);
          break;
        default:
          context.character.addEffect(rangeEffect.effect);
          break;
      }
    });
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D, y: number, textColors: CharacterTextColors = DEFAULT_CHARACTER_TEXT_COLORS): Promise<number> {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping
    const nameLineHeight = 48;
    const descLineHeight = 32;
    const topTextPadding = 6;
    const nameToDescSpacing = 10;

    // Wrap text
    ctx.font = '48px "Bahnschrift"';
    const nameLines = wrapText(ctx, this.name, maxTextWidth);

    ctx.font = '32px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const nameHeight = calculateWrappedTextHeight(nameLines, nameLineHeight);
    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);
    const totalTextHeight = topTextPadding + nameHeight + nameToDescSpacing + descHeight;

    // Trapezium dimensions (tuned to match title panel styling)
    const trapeziumHeight = Math.max(120, totalTextHeight + 44);
    const trapeziumTopWidth = maxTextWidth + 120;
    const trapeziumBottomWidth = trapeziumTopWidth + 56;
    const trapeziumLeft = 32;
    const trapeziumTop = currentY - 42;
    const cornerRadius = 22;
    const rightTop = trapeziumLeft + trapeziumTopWidth;
    const rightBottom = trapeziumLeft + trapeziumBottomWidth;

    const drawTrapeziumPath = () => {
      ctx.beginPath();
      ctx.moveTo(trapeziumLeft + cornerRadius, trapeziumTop);
      ctx.lineTo(rightTop - cornerRadius, trapeziumTop);
      ctx.quadraticCurveTo(rightTop, trapeziumTop, rightTop + (cornerRadius * 0.75), trapeziumTop + cornerRadius);
      ctx.lineTo(rightBottom, trapeziumTop + trapeziumHeight - cornerRadius);
      ctx.quadraticCurveTo(rightBottom, trapeziumTop + trapeziumHeight, rightBottom - cornerRadius, trapeziumTop + trapeziumHeight);
      ctx.lineTo(trapeziumLeft + cornerRadius, trapeziumTop + trapeziumHeight);
      ctx.quadraticCurveTo(trapeziumLeft, trapeziumTop + trapeziumHeight, trapeziumLeft, trapeziumTop + trapeziumHeight - cornerRadius);
      ctx.lineTo(trapeziumLeft, trapeziumTop + cornerRadius);
      ctx.quadraticCurveTo(trapeziumLeft, trapeziumTop, trapeziumLeft + cornerRadius, trapeziumTop);
      ctx.closePath();
    };

    // Convert hex color to RGB for tunable trapezium tint
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : null;
    };

    // Create gradient for trapezium
    const gradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft,
      trapeziumTop + trapeziumHeight,
    );
    const panelRgb = hexToRgb(this.panelColor);
    if (panelRgb) {
      gradient.addColorStop(0, `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, 0.92)`);
      gradient.addColorStop(0.55, `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, 0.72)`);
      gradient.addColorStop(1, `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, 0.44)`);
    } else {
      gradient.addColorStop(0, 'rgba(236, 241, 250, 0.92)');
      gradient.addColorStop(0.55, 'rgba(214, 221, 233, 0.72)');
      gradient.addColorStop(1, 'rgba(188, 197, 212, 0.44)');
    }

    // Draw panel drop shadow first so the panel pops from the background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    drawTrapeziumPath();
    ctx.fill();
    ctx.restore();

    // Draw trapezium container with gradient
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(30, 35, 45, 0.78)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawTrapeziumPath();
    ctx.fill();
    ctx.stroke();

    // Add a subtle top gloss
    const glossGradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft,
      trapeziumTop + (trapeziumHeight * 0.5),
    );
    glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.16)');
    glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    drawTrapeziumPath();
    ctx.clip();
    ctx.fillStyle = glossGradient;
    ctx.fillRect(trapeziumLeft, trapeziumTop, trapeziumBottomWidth + 8, trapeziumHeight * 0.54);
    ctx.restore();

    // Thin inner highlight to improve edge readability
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.1;
    drawTrapeziumPath();
    ctx.stroke();

    // Draw ability name on top of trapezium
    drawWrappedTcgText(ctx, nameLines, 64, currentY + topTextPadding, nameLineHeight, {
      font: '700 46px "Bahnschrift"',
      fillStyle: textColors.abilityNameFill,
      strokeStyle: textColors.abilityNameStroke,
      lineWidth: 4,
      textAlign: 'left',
      shadowBlur: 8,
      shadowOffsetY: 2,
    });

    currentY += topTextPadding + nameHeight + nameToDescSpacing;

    // Draw ability description on top of trapezium
    drawWrappedTcgText(ctx, descLines, 64, currentY, descLineHeight, {
      font: '600 32px "Bahnschrift"',
      fillStyle: textColors.abilityDescFill,
      strokeStyle: textColors.abilityDescStroke,
      lineWidth: 3,
      textAlign: 'left',
      shadowBlur: 4,
      shadowOffsetY: 1,
    });

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }
}