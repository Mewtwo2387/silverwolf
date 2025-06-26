import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight, drawWrappedText } from './utils/textWrapper';
import { RangeEffect } from './rangeEffect';
import { RangeType } from './rangeType';
import { CardInBattle } from './cardInBattle';

export class Skill {
  name: string;
  description: string;
  damage: number;
  cost: number;
  damageRange: RangeType;
  effects: RangeEffect[];

  constructor(name: string, description: string, damage: number, cost: number, damageRange: RangeType, effects: RangeEffect[] = []) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.cost = cost;
    this.damageRange = damageRange;
    this.effects = effects;
  }

  async generateSkill(ctx: Canvas.CanvasRenderingContext2D, y: number): Promise<number> {
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

  useSkill(card: CardInBattle, target: CardInBattle) {
    this.effects.forEach((effect) => {
      switch (effect.range) {
        case RangeType.Self:
          card.addEffect(effect.effect);
          break;
        case RangeType.SingleAlly:
          target.addEffect(effect.effect);
          break;
        case RangeType.AllAllies:
          card.battle.ally(card.side).forEach((ally) => {
            ally.addEffect(effect.effect);
          });
          break;
        case RangeType.SingleOpponent:
          target.addEffect(effect.effect);
          break;
        case RangeType.AllOpponents:
          card.battle.opponent(card.side).forEach((opponent) => {
            opponent.addEffect(effect.effect);
          });
          break;
        case RangeType.AllCards:
          card.battle.allCards().forEach((card) => {
            card.addEffect(effect.effect);
          });
          break;
        default:
          throw new Error(`Invalid skill effect type: ${effect.range}`);
      }
    });

    switch (this.damageRange) {
      case RangeType.SingleOpponent:
        target.takeDamage(card.dealDamage(this.damage));
        break;
      case RangeType.AllOpponents:
        card.battle.opponent(card.side).forEach((opponent) => {
          opponent.takeDamage(card.dealDamage(this.damage));
        });
        break;
      case RangeType.AllCards:
        card.battle.allCards().forEach((opponent) => {
          opponent.takeDamage(card.dealDamage(this.damage));
        });
        break;
      default:
        break;
    }
  }
}
