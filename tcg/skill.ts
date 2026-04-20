import Canvas from 'canvas';
import { wrapText, calculateWrappedTextHeight } from './utils/textWrapper';
import { RangeEffect } from './rangeEffect';
import { RangeType } from './rangeType';
import { CharacterInBattle } from './characterInBattle';
import { DrawableBlock } from './interfaces/drawable';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { drawTcgText, drawWrappedTcgText } from './utils/tcgTextStyle';
import { CharacterTextColors, DEFAULT_CHARACTER_TEXT_COLORS } from './textTheme';
import { SkillCategory } from './skillCategory';
import type { SkillBattleCost } from './skillBattleCost';
import { Normal } from './skillBattleCost';

/**
 * A skill of a character
 * @param battleCost - Normal(n) / Charged(n) / Ultimate(energy) — defines SP gain/cost or ultimate energy
 */
export class Skill implements DrawableBlock {
  name: string;
  description: string;
  damage: number;
  damageRange: RangeType;
  effects: RangeEffect[];
  formActiveSkillIndices?: number[];
  battleCost: SkillBattleCost;

  constructor(
    name: string,
    description: string,
    damage: number,
    damageRange: RangeType,
    effects: RangeEffect[],
    formActiveSkillIndices?: number[],
    battleCost: SkillBattleCost = Normal(1),
  ) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.damageRange = damageRange;
    this.effects = effects;
    this.formActiveSkillIndices = formActiveSkillIndices;
    this.battleCost = battleCost;
  }

  /** Legacy-style category for turn rules and UI branches. */
  get category(): SkillCategory {
    switch (this.battleCost.kind) {
      case 'normal':
        return SkillCategory.Normal;
      case 'charged':
        return SkillCategory.Charged;
      case 'ultimate':
        return SkillCategory.Ultimate;
      default: {
        const bad: never = this.battleCost;
        throw new Error(`Unexpected battle cost: ${JSON.stringify(bad)}`);
      }
    }
  }

  get ultimateEnergyCost(): number {
    return this.battleCost.kind === 'ultimate' ? this.battleCost.energyCost : 0;
  }

  get skillPointsGranted(): number {
    return this.battleCost.kind === 'normal' ? this.battleCost.skillPointsGranted : 0;
  }

  get skillPointsCost(): number {
    return this.battleCost.kind === 'charged' ? this.battleCost.skillPointsCost : 0;
  }

  /** Team pool restoration when this ultimate resolves (0 if not an ultimate or no grant). */
  get teamSkillPointsGrantedOnUltimate(): number {
    return this.battleCost.kind === 'ultimate' ? (this.battleCost.grantTeamSkillPoints ?? 0) : 0;
  }

  async draw(
    ctx: Canvas.CanvasRenderingContext2D,
    y: number,
    textColors: CharacterTextColors = DEFAULT_CHARACTER_TEXT_COLORS,
  ): Promise<number> {
    let currentY = y;

    const maxTextWidth = 800;
    const nameLeft = 64;
    const damageRight = 956;
    const nameLineHeight = 56;
    const costLineHeight = 48;
    const descLineHeight = 48;

    const damageText = this.damage > 0 ? `${this.damage}` : '--';
    ctx.font = '700 64px "Bahnschrift"';
    const damageTextWidth = ctx.measureText(damageText).width;
    const damageSlotWidth = Math.max(180, damageTextWidth + 56);
    const nameMaxWidth = Math.max(360, (damageRight - damageSlotWidth) - nameLeft);

    ctx.font = '700 60px "Bahnschrift"';
    const nameLines = wrapText(ctx, this.name.toUpperCase(), nameMaxWidth);
    const nameHeight = calculateWrappedTextHeight(nameLines, nameLineHeight);

    ctx.font = '48px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    let costHeight = 0;
    if (this.battleCost.kind === 'ultimate') {
      const ultLines = (this.battleCost.energyCost > 0 ? 1 : 0)
        + (this.teamSkillPointsGrantedOnUltimate > 0 ? 1 : 0);
      if (ultLines > 0) {
        costHeight = ultLines * costLineHeight + (ultLines > 1 ? 8 : 0);
      }
    } else if (this.battleCost.kind === 'charged') {
      costHeight = costLineHeight;
    } else if (this.battleCost.kind === 'normal' && this.battleCost.skillPointsGranted > 0) {
      costHeight = costLineHeight;
    }

    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);

    drawWrappedTcgText(ctx, nameLines, nameLeft, currentY, nameLineHeight, {
      font: '700 58px "Bahnschrift"',
      fillStyle: textColors.skillNameFill,
      strokeStyle: textColors.skillNameStroke,
      lineWidth: 5,
      textAlign: 'left',
      shadowBlur: 8,
      shadowOffsetY: 2,
    });

    const damageY = currentY + Math.max(0, (nameHeight - 64) / 2);
    drawTcgText(ctx, damageText, damageRight, damageY, {
      font: '700 64px "Bahnschrift"',
      fillStyle: textColors.skillDamageFill,
      strokeStyle: textColors.skillDamageStroke,
      lineWidth: 6,
      textAlign: 'right',
      shadowBlur: 10,
      shadowOffsetY: 3,
    });

    currentY += nameHeight + 16;

    if (this.battleCost.kind === 'ultimate') {
      if (this.battleCost.energyCost > 0) {
        drawTcgText(ctx, `ENERGY ${this.battleCost.energyCost}`, 64, currentY, {
          font: '700 44px "Bahnschrift"',
          fillStyle: textColors.skillCostFill,
          strokeStyle: textColors.skillCostStroke,
          lineWidth: 4,
          textAlign: 'left',
          shadowBlur: 6,
          shadowOffsetY: 2,
        });
        currentY += costLineHeight + 8;
      }
      const spGrant = this.teamSkillPointsGrantedOnUltimate;
      if (spGrant > 0) {
        drawTcgText(ctx, `TEAM SP +${spGrant}`, 64, currentY, {
          font: '700 44px "Bahnschrift"',
          fillStyle: textColors.skillCostFill,
          strokeStyle: textColors.skillCostStroke,
          lineWidth: 4,
          textAlign: 'left',
          shadowBlur: 6,
          shadowOffsetY: 2,
        });
        currentY += costLineHeight;
      }
      if (this.battleCost.energyCost > 0 || spGrant > 0) {
        currentY += 8;
      }
    } else if (this.battleCost.kind === 'charged') {
      const n = this.battleCost.skillPointsCost;
      drawTcgText(ctx, n === 1 ? 'SKILL POINT 1' : `SKILL POINTS ${n}`, 64, currentY, {
        font: '700 44px "Bahnschrift"',
        fillStyle: textColors.skillCostFill,
        strokeStyle: textColors.skillCostStroke,
        lineWidth: 4,
        textAlign: 'left',
        shadowBlur: 6,
        shadowOffsetY: 2,
      });
      currentY += costHeight + 16;
    } else if (this.battleCost.kind === 'normal' && this.battleCost.skillPointsGranted > 0) {
      const g = this.battleCost.skillPointsGranted;
      drawTcgText(ctx, g === 1 ? 'TEAM SP +1' : `TEAM SP +${g}`, 64, currentY, {
        font: '700 44px "Bahnschrift"',
        fillStyle: textColors.skillCostFill,
        strokeStyle: textColors.skillCostStroke,
        lineWidth: 4,
        textAlign: 'left',
        shadowBlur: 6,
        shadowOffsetY: 2,
      });
      currentY += costHeight + 16;
    }

    drawWrappedTcgText(ctx, descLines, 64, currentY, descLineHeight, {
      font: '600 46px "Bahnschrift"',
      fillStyle: textColors.skillDescFill,
      strokeStyle: textColors.skillDescStroke,
      lineWidth: 4,
      textAlign: 'left',
      shadowBlur: 5,
      shadowOffsetY: 1,
    });

    currentY += descHeight + 32;

    return currentY;
  }

  useSkill(character: CharacterInBattle, target: CharacterInBattle | null) {
    this.effects.forEach((rangeEffect) => {
      let effectToApply = rangeEffect.effect;
      if (rangeEffect.effect.type === EffectType.FormChange && this.formActiveSkillIndices) {
        effectToApply = new Effect(
          rangeEffect.effect.name,
          rangeEffect.effect.description,
          rangeEffect.effect.type,
          rangeEffect.effect.amount,
          rangeEffect.effect.duration,
          { activeSkillIndices: this.formActiveSkillIndices },
        );
      }

      switch (rangeEffect.range) {
        case RangeType.Self:
          character.addEffect(effectToApply);
          break;
        case RangeType.SingleAlly:
          if (target) {
            const allies = character.battle.ally(character.side);
            if (allies.includes(target) && !target.isKnockedOut) {
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

    const damageElement = character.character.element;

    if (this.damage > 0) {
      switch (this.damageRange) {
        case RangeType.Self: {
          const selfDamage = character.dealDamage(this.damage, damageElement);
          character.takeDamage(selfDamage, damageElement, character);
          break;
        }
        case RangeType.SingleOpponent:
          if (target) {
            const opponents = character.battle.opponent(character.side);
            if (opponents.includes(target) && !target.isKnockedOut) {
              const dealtDamage = character.dealDamage(this.damage, damageElement);
              target.takeDamage(dealtDamage, damageElement, character);
            }
          }
          break;
        case RangeType.AllOpponents:
          character.battle.opponent(character.side).forEach((opponent) => {
            if (!opponent.isKnockedOut) {
              const dealtDamage = character.dealDamage(this.damage, damageElement);
              opponent.takeDamage(dealtDamage, damageElement, character);
            }
          });
          break;
        case RangeType.SingleAlly:
          if (target) {
            const allies = character.battle.ally(character.side);
            if (allies.includes(target) && !target.isKnockedOut) {
              const dealtDamage = character.dealDamage(this.damage, damageElement);
              target.takeDamage(dealtDamage, damageElement, character);
            }
          }
          break;
        case RangeType.AllAllies:
          character.battle.ally(character.side).forEach((ally) => {
            if (!ally.isKnockedOut) {
              const dealtDamage = character.dealDamage(this.damage, damageElement);
              ally.takeDamage(dealtDamage, damageElement, character);
            }
          });
          break;
        case RangeType.AllCards:
          character.battle.allCards().forEach((card) => {
            if (!card.isKnockedOut) {
              const dealtDamage = character.dealDamage(this.damage, damageElement);
              card.takeDamage(dealtDamage, damageElement, character);
            }
          });
          break;
        default:
          break;
      }
    }
  }

  toString(): string {
    const damageStr = this.damage > 0 ? `Damage: ${this.damage}` : '';
    let costStr = '';
    if (this.battleCost.kind === 'ultimate') {
      const ultParts: string[] = [];
      if (this.battleCost.energyCost > 0) {
        ultParts.push(`Energy: ${this.battleCost.energyCost}`);
      }
      if (this.teamSkillPointsGrantedOnUltimate > 0) {
        ultParts.push(`Team SP +${this.teamSkillPointsGrantedOnUltimate}`);
      }
      costStr = ultParts.join('; ');
    } else if (this.battleCost.kind === 'charged') {
      costStr = `Skill points: ${this.battleCost.skillPointsCost}`;
    } else if (this.battleCost.kind === 'normal' && this.battleCost.skillPointsGranted > 0) {
      costStr = `Grants SP: +${this.battleCost.skillPointsGranted}`;
    }
    const parts = [this.name, damageStr, costStr].filter((p) => p);
    return parts.join(', ');
  }
}
