import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight, drawWrappedText } from './utils/textWrapper';
import { RangeEffect } from './rangeEffect';
import { DrawableBlock } from './interfaces/drawable';
import { CharacterInBattle } from './characterInBattle';
import { RangeType } from './rangeType';

/**
 * Context for ability activation check
 */
export interface AbilityActivationContext {
  character: CharacterInBattle;
  getAllies: () => CharacterInBattle[];
  getAllCards: () => CharacterInBattle[];
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

  constructor(name: string, description: string, effectPairs: AbilityEffectPair[] = []) {
    this.name = name;
    this.description = description;
    this.effectPairs = effectPairs;
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

  async draw(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number> {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping
    const nameLineHeight = 48;
    const descLineHeight = 32;

    // Wrap text
    ctx.font = '48px "Bahnschrift"';
    const nameLines = wrapText(ctx, this.name, maxTextWidth);

    ctx.font = '32px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const nameHeight = calculateWrappedTextHeight(nameLines, nameLineHeight);
    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);
    const totalTextHeight = nameHeight + descHeight + 16; // 16px spacing between name and description

    // Trapezium dimensions - now dynamic based on text height
    const trapeziumHeight = Math.max(120, totalTextHeight + 40); // Minimum 120px, or text height + padding
    const trapeziumTopWidth = maxTextWidth + 128; // Text width + padding
    const trapeziumBottomWidth = trapeziumTopWidth + 64; // Slightly wider at bottom
    const trapeziumLeft = 32; // Starting position
    const trapeziumTop = currentY - 40; // Position above the text

    // Create gradient for trapezium
    const gradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft + trapeziumBottomWidth,
      trapeziumTop + trapeziumHeight,
    );
    gradient.addColorStop(0, 'rgba(240, 240, 240, 0.8)'); // Translucent light gray at top
    gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.6)'); // More translucent in middle
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0.4)'); // Most translucent at bottom

    // Draw trapezium container with gradient
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(51, 51, 51, 0.7)'; // Semi-transparent dark border
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(trapeziumLeft, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumTopWidth, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumBottomWidth, trapeziumTop + trapeziumHeight);
    ctx.lineTo(trapeziumLeft, trapeziumTop + trapeziumHeight);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw ability name on top of trapezium
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, nameLines, 64, currentY, nameLineHeight);

    currentY += nameHeight + 16; // Add spacing between name and description

    // Draw ability description on top of trapezium
    ctx.font = '32px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, descLines, 64, currentY, descLineHeight);

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }
}