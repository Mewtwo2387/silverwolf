import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight, drawWrappedText } from './utils/textWrapper';
import { RangeEffect } from './rangeEffect';
import { RangeType } from './rangeType';
import { CharacterInBattle } from './characterInBattle';
import { DrawableBlock } from './interfaces/drawable';
import { Effect } from './effect';
import { EffectType } from './effectType';

/**
 * A skill of a character
 * @param name - The name of the skill
 * @param description - The description of the skill
 * @param damage - Base outgoing damage of the skill
 * @param cost - Energy cost of the skill
 * @param damageRange - The target range of the skill's damage
 * @param effects - List of effects this skill applies
 * @param formActiveSkillIndices - For transformation skills: which skill indices become active when this skill's form change is applied (optional)
 */
export class Skill implements DrawableBlock {
  name: string;
  description: string;
  damage: number;
  cost: number;
  damageRange: RangeType;
  effects: RangeEffect[];
  formActiveSkillIndices?: number[]; // For transformation skills: skill indices that become active in the new form

  constructor(name: string, description: string, damage: number, cost: number, damageRange: RangeType, effects: RangeEffect[] = [], formActiveSkillIndices?: number[]) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.cost = cost;
    this.damageRange = damageRange;
    this.effects = effects;
    this.formActiveSkillIndices = formActiveSkillIndices;
  }

  async draw(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number> {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping (leaving space for damage)
    const costLineHeight = 48;
    const descLineHeight = 48;

    // Wrap only the description text
    ctx.font = '48px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const nameHeight = 64; // Fixed height for single-line name

    // Add cost height if present
    let costHeight = 0;
    if (this.cost > 0) {
      costHeight = costLineHeight;
    }

    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);

    // Draw attack name (single line)
    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 64, currentY);

    // Draw damage on the right side
    const damageText = this.damage > 0 ? `${this.damage}` : '--';
    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(damageText, 956, currentY);

    currentY += nameHeight + 16; // Add spacing after name

    // Draw cost if present
    if (this.cost > 0) {
      ctx.font = '48px "Bahnschrift"';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(`Cost: ${this.cost}`, 64, currentY);
      currentY += costHeight + 16; // Add spacing after cost
    }

    // Draw attack description (wrapped)
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, descLines, 64, currentY, descLineHeight);

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }

  useSkill(character: CharacterInBattle, target: CharacterInBattle | null) {
    // Apply effects first
    this.effects.forEach((rangeEffect) => {
      // For form change effects, add metadata about which skills should be active
      let effectToApply = rangeEffect.effect;
      if (rangeEffect.effect.type === EffectType.FormChange && this.formActiveSkillIndices) {
        // Clone the effect and add metadata
        effectToApply = new Effect(
          rangeEffect.effect.name,
          rangeEffect.effect.description,
          rangeEffect.effect.type,
          rangeEffect.effect.amount,
          rangeEffect.effect.duration,
          { activeSkillIndices: this.formActiveSkillIndices }
        );
      }
      
      // Apply the effect based on range
      switch (rangeEffect.range) {
        case RangeType.Self:
          character.addEffect(effectToApply);
          break;
        case RangeType.SingleAlly:
          if (target) {
            // Verify target is an ally
            const allies = character.battle.ally(character.side);
            if (allies.includes(target)) {
              target.addEffect(effectToApply);
            }
          }
          break;
        case RangeType.AllAllies:
          character.battle.ally(character.side).forEach((ally) => {
            if (!ally.isKnockedOut) {
              ally.addEffect(effectToApply);
            }
          });
          break;
        case RangeType.SingleOpponent:
          if (target) {
            // Verify target is an opponent
            const opponents = character.battle.opponent(character.side);
            if (opponents.includes(target)) {
              target.addEffect(effectToApply);
            }
          }
          break;
        case RangeType.AllOpponents:
          character.battle.opponent(character.side).forEach((opponent) => {
            if (!opponent.isKnockedOut) {
              opponent.addEffect(effectToApply);
            }
          });
          break;
        case RangeType.AllCards:
          character.battle.allCards().forEach((card) => {
            if (!card.isKnockedOut) {
              card.addEffect(effectToApply);
            }
          });
          break;
        default:
          throw new Error(`Invalid skill effect type: ${rangeEffect.range}`);
      }
    });

    // Apply damage
    if (this.damage > 0) {
      switch (this.damageRange) {
        case RangeType.Self:
          // Self damage (rare, but possible)
          character.takeDamage(character.dealDamage(this.damage));
          break;
        case RangeType.SingleOpponent:
          if (target) {
            const opponents = character.battle.opponent(character.side);
            if (opponents.includes(target) && !target.isKnockedOut) {
              target.takeDamage(character.dealDamage(this.damage));
            }
          }
          break;
        case RangeType.AllOpponents:
          character.battle.opponent(character.side).forEach((opponent) => {
            if (!opponent.isKnockedOut) {
              opponent.takeDamage(character.dealDamage(this.damage));
            }
          });
          break;
        case RangeType.SingleAlly:
          if (target) {
            const allies = character.battle.ally(character.side);
            if (allies.includes(target) && !target.isKnockedOut) {
              target.takeDamage(character.dealDamage(this.damage));
            }
          }
          break;
        case RangeType.AllAllies:
          character.battle.ally(character.side).forEach((ally) => {
            if (!ally.isKnockedOut) {
              ally.takeDamage(character.dealDamage(this.damage));
            }
          });
          break;
        case RangeType.AllCards:
          character.battle.allCards().forEach((card) => {
            if (!card.isKnockedOut) {
              card.takeDamage(character.dealDamage(this.damage));
            }
          });
          break;
        default:
          break;
      }
    }
  }

  /**
   * Get a string representation of this skill's basic info
   */
  toString(): string {
    const damageStr = this.damage > 0 ? `Damage: ${this.damage}` : '';
    const costStr = this.cost > 0 ? `Cost: ${this.cost}` : '';
    const parts = [this.name, damageStr, costStr].filter(p => p);
    return parts.join(', ');
  }
}
