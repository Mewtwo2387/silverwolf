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
import { Element, randomElement } from './element';
import { tcgAssetPaths } from './assetPaths';
import { round2 } from '../utils/math';

/** Character-specific logic when a skill resolves (effects, damage, etc. still run unless omitted). */
export type SkillOnUse = (caster: CharacterInBattle, target: CharacterInBattle | null) => void;

/** Optional per-skill damage behaviour (multi-hit, element overrides). */
export interface SkillDamageOptions {
  /** Hits per target; each hit rolls damage and dodge independently. Default 1. */
  hitCount?: number;
  /** Fixed element for every hit (elemental buffs apply to this element, not the caster's). */
  damageElement?: Element;
  /** Each hit picks a random element (mutually exclusive with {@link damageElement}). */
  randomElementPerHit?: boolean;
}

const SKILL_POINT_ICON_PATH = `${tcgAssetPaths.common}/skillPoint.png`;
let skillPointIconPromise: Promise<Canvas.Image> | null = null;

/**
 * Optional layout overrides for `Skill.draw`. Used to embed skill cards in alternate
 * layouts (e.g. 2-column grid for characters with many skills).
 */
export interface SkillDrawLayout {
  /** Left x of the skill block (replaces the default 64). */
  left?: number;
  /** Right x the damage number right-aligns to in normal mode (replaces the default 956). */
  right?: number;
  /** Max wrap width for the description text (replaces the default 800). */
  maxTextWidth?: number;
  /** If true, the damage number is drawn just to the right of the skill name. */
  compactDamage?: boolean;
  /** If true, uses tighter minimums for the damage slot and name wrap width (for narrow layouts). */
  compact?: boolean;
}

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
  hitCount: number;
  damageElement?: Element;
  randomElementPerHit: boolean;
  onUse?: SkillOnUse;

  constructor(
    name: string,
    description: string,
    damage: number,
    damageRange: RangeType,
    effects: RangeEffect[],
    formActiveSkillIndices?: number[],
    damageOptions?: SkillDamageOptions,
    onUse?: SkillOnUse,
    battleCost: SkillBattleCost = Normal(1),
  ) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.damageRange = damageRange;
    this.effects = effects;
    this.formActiveSkillIndices = formActiveSkillIndices;
    this.battleCost = battleCost;
    this.hitCount = damageOptions?.hitCount ?? 1;
    this.damageElement = damageOptions?.damageElement;
    this.randomElementPerHit = damageOptions?.randomElementPerHit ?? false;
    this.onUse = onUse;
  }

  /** Card-facing damage label (e.g. `4x4` for four hits of 4). */
  get damageDisplayText(): string {
    if (this.damage <= 0) {
      return '--';
    }
    if (this.hitCount > 1) {
      return `${this.hitCount}x${this.damage}`;
    }
    return `${this.damage}`;
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

  private getTypeLabel(): string {
    switch (this.category) {
      case SkillCategory.Normal:
        return 'NORMAL ATTACK';
      case SkillCategory.Charged:
        return 'CHARGED ATTACK';
      case SkillCategory.Ultimate:
        return 'ULTIMATE';
      default:
        return 'SKILL';
    }
  }

  /** Gradient stops for the attack-type pill, keyed by skill category. */
  private getPillGradientStops(): [string, string, string] {
    switch (this.category) {
      case SkillCategory.Normal:
        // Warm graphite — basic attack, low-key.
        return [
          'rgba(96, 86, 74, 0.96)',
          'rgba(56, 50, 44, 0.96)',
          'rgba(22, 20, 18, 0.96)',
        ];
      case SkillCategory.Charged:
        // Vivid electric azure — charged / empowered.
        return [
          'rgba(80, 168, 240, 0.96)',
          'rgba(34, 102, 196, 0.96)',
          'rgba(8, 30, 86, 0.96)',
        ];
      case SkillCategory.Ultimate:
        // Crimson ember — ultimate / dangerous.
        return [
          'rgba(168, 50, 60, 0.96)',
          'rgba(104, 26, 36, 0.96)',
          'rgba(40, 10, 14, 0.96)',
        ];
      default:
        return [
          'rgba(46, 40, 72, 0.96)',
          'rgba(26, 22, 44, 0.96)',
          'rgba(12, 10, 22, 0.96)',
        ];
    }
  }

  private async getSkillPointIcon(): Promise<Canvas.Image | null> {
    if (!skillPointIconPromise) {
      skillPointIconPromise = Canvas.loadImage(SKILL_POINT_ICON_PATH);
    }
    try {
      return await skillPointIconPromise;
    } catch {
      return null;
    }
  }

  async draw(
    ctx: Canvas.CanvasRenderingContext2D,
    y: number,
    textColors: CharacterTextColors = DEFAULT_CHARACTER_TEXT_COLORS,
    layout: SkillDrawLayout = {},
  ): Promise<number> {
    let currentY = y;

    const maxTextWidth = layout.maxTextWidth ?? 940;
    const nameLeft = layout.left ?? 64;
    const damageRight = layout.right ?? 1004;
    const compactDamage = layout.compactDamage ?? false;
    const compact = layout.compact ?? false;
    const nameLineHeight = 56;
    const descLineHeight = 48;

    const damageText = this.damageDisplayText;
    ctx.font = '700 64px "Bahnschrift"';
    const damageTextWidth = ctx.measureText(damageText).width;
    const damageSlotMin = compact ? 140 : 180;
    const damageSlotPadding = compact ? 32 : 56;
    const nameMinWidth = compact ? 240 : 360;
    const damageSlotWidth = Math.max(damageSlotMin, damageTextWidth + damageSlotPadding);
    const nameMaxWidth = compactDamage
      ? Math.max(200, (damageRight - nameLeft) - (damageTextWidth + 32))
      : Math.max(nameMinWidth, (damageRight - damageSlotWidth) - nameLeft);

    ctx.font = '700 60px "Bahnschrift"';
    const nameLines = wrapText(ctx, this.name.toUpperCase(), nameMaxWidth);
    const nameHeight = calculateWrappedTextHeight(nameLines, nameLineHeight);

    ctx.font = '48px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

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

    let damageX = damageRight;
    let damageAlign: Canvas.CanvasTextAlign = 'right';
    if (compactDamage) {
      ctx.font = '700 58px "Bahnschrift"';
      const widestNameLine = nameLines.reduce(
        (max, line) => Math.max(max, ctx.measureText(line.toUpperCase()).width),
        0,
      );
      damageX = Math.min(damageRight, nameLeft + widestNameLine + 24);
      damageAlign = 'left';
    }
    const damageY = currentY + Math.max(0, (nameHeight - 64) / 2);
    drawTcgText(ctx, damageText, damageX, damageY, {
      font: '700 64px "Bahnschrift"',
      fillStyle: textColors.skillDamageFill,
      strokeStyle: textColors.skillDamageStroke,
      lineWidth: 6,
      textAlign: damageAlign,
      shadowBlur: 10,
      shadowOffsetY: 3,
    });

    currentY += nameHeight - 28;

    const typeLabel = this.getTypeLabel();
    const typeFontSize = 28;
    const typeFont = `700 ${typeFontSize}px "Bahnschrift"`;
    const typeBoxHeight = 56;
    const slant = 22;
    const horizontalPadding = 30;
    ctx.font = typeFont;
    const typeTextWidth = ctx.measureText(typeLabel).width;
    const typeBoxWidth = Math.max(260, Math.ceil(typeTextWidth + horizontalPadding * 2 + slant));
    const boxTop = currentY;
    const boxBottom = boxTop + typeBoxHeight;
    const boxLeft = nameLeft;
    const boxRight = boxLeft + typeBoxWidth;

    // Parallelogram shape shared between fill, stroke, and highlights.
    const tracePill = () => {
      ctx.beginPath();
      ctx.moveTo(boxLeft + slant, boxTop);
      ctx.lineTo(boxRight, boxTop);
      ctx.lineTo(boxRight - slant, boxBottom);
      ctx.lineTo(boxLeft, boxBottom);
      ctx.closePath();
    };

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    const [pillTop, pillMid, pillBottom] = this.getPillGradientStops();
    const pillGradient = ctx.createLinearGradient(boxLeft, boxTop, boxLeft, boxBottom);
    pillGradient.addColorStop(0, pillTop);
    pillGradient.addColorStop(0.55, pillMid);
    pillGradient.addColorStop(1, pillBottom);
    tracePill();
    ctx.fillStyle = pillGradient;
    ctx.fill();
    ctx.restore();

    tracePill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = textColors.skillCostStroke;
    ctx.stroke();

    // Subtle top highlight to give the pill some sheen.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(boxLeft + slant + 3, boxTop + 3);
    ctx.lineTo(boxRight - 4, boxTop + 3);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();
    ctx.restore();

    // Center uppercase caps vertically: baseline ≈ center + capHeight/2.
    const typeBaselineY = boxTop + typeBoxHeight / 2 + typeFontSize * 0.34;
    const typeTextX = boxLeft + slant / 2 + horizontalPadding;
    drawTcgText(ctx, typeLabel, typeTextX, typeBaselineY, {
      font: typeFont,
      fillStyle: textColors.skillCostFill,
      strokeStyle: textColors.skillCostStroke,
      lineWidth: 3,
      textAlign: 'left',
      shadowBlur: 5,
      shadowOffsetY: 2,
    });

    const resourceX = boxRight + 22;
    const resourceFontSize = 36;
    const resourceFont = `700 ${resourceFontSize}px "Bahnschrift"`;
    const resourceBaselineY = boxTop + typeBoxHeight / 2 + resourceFontSize * 0.34;
    if (this.battleCost.kind === 'ultimate') {
      const parts: string[] = [];
      if (this.battleCost.energyCost > 0) {
        parts.push(`ENERGY ${this.battleCost.energyCost}`);
      }
      const spGrant = this.teamSkillPointsGrantedOnUltimate;
      if (spGrant > 0) {
        parts.push(`TEAM SP +${spGrant}`);
      }
      if (parts.length > 0) {
        drawTcgText(ctx, parts.join('  •  '), resourceX, resourceBaselineY, {
          font: resourceFont,
          fillStyle: textColors.skillCostFill,
          strokeStyle: textColors.skillCostStroke,
          lineWidth: 4,
          textAlign: 'left',
          shadowBlur: 6,
          shadowOffsetY: 2,
        });
      }
    } else if (this.battleCost.kind === 'charged') {
      const n = this.battleCost.skillPointsCost;
      const icon = await this.getSkillPointIcon();
      const iconSize = 40;
      const iconGap = 2;
      const iconY = boxTop + (typeBoxHeight - iconSize) / 2;
      for (let i = 0; i < n; i += 1) {
        const x = resourceX + (i * (iconSize + iconGap));
        if (icon) {
          ctx.drawImage(icon, x, iconY, iconSize, iconSize);
        } else {
          // Fallback diamond marker if the skill point icon failed to load.
          const cx = x + iconSize / 2;
          const cy = iconY + iconSize / 2;
          const r = iconSize / 2 - 2;
          ctx.fillStyle = textColors.skillCostFill;
          ctx.beginPath();
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r, cy);
          ctx.lineTo(cx, cy + r);
          ctx.lineTo(cx - r, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    currentY += typeBoxHeight + 48;

    drawWrappedTcgText(ctx, descLines, nameLeft, currentY, descLineHeight, {
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
    const effectDodgedTargets = Skill.resolveDodgesForHostileEffectTargets(character, target, this);

    this.effects.forEach((rangeEffect) => {
      let effectToApply = rangeEffect.effect;
      if (rangeEffect.effect.type === EffectType.FormChange && this.formActiveSkillIndices) {
        effectToApply = new Effect(
          rangeEffect.effect.name,
          rangeEffect.effect.description,
          rangeEffect.effect.type,
          rangeEffect.effect.amount,
          rangeEffect.effect.duration,
          rangeEffect.effect.positive,
          { activeSkillIndices: this.formActiveSkillIndices },
        );
      }

      Skill.resolveSkillRangeTargets(rangeEffect.range, character, target).forEach((victim) => {
        if (Skill.shouldResolveOnHostileTarget(character, victim, effectDodgedTargets)) {
          victim.addEffect(effectToApply);
        }
      });
    });

    if (this.onUse) {
      this.onUse(character, target);
    }

    if (this.damage > 0 && this.hitCount > 0) {
      let damageContext;
      if (this.category === SkillCategory.Charged) {
        damageContext = { chargedAttack: true, skillPointsSpent: this.skillPointsCost };
      } else if (this.category === SkillCategory.Ultimate) {
        damageContext = { ultimateAttack: true };
      } else {
        damageContext = undefined;
      }
      const victims = Skill.resolveSkillRangeTargets(this.damageRange, character, target);
      // Aggregate hits per victim so a multi-hit skill logs one summary line each
      // ("X took 16 pyro damage (4 hits)") instead of one noisy line per hit. KO is
      // logged after the damage line (silentKo) so the order reads damage → knockout.
      interface HitTally {
        damage: number; hits: number; dodged: number; wasAlive: boolean; elements: Set<Element>;
      }
      const tally = new Map<CharacterInBattle, HitTally>();
      victims.forEach((v) => tally.set(v, {
        damage: 0, hits: 0, dodged: 0, wasAlive: !v.isKnockedOut, elements: new Set<Element>(),
      }));
      for (let hit = 0; hit < this.hitCount; hit += 1) {
        const hitElement = this.resolveDamageElementForHit(character);
        victims.forEach((victim) => {
          const t = tally.get(victim)!;
          if (victim.side !== character.side && victim.rollDodge()) {
            t.dodged += 1;
            return;
          }
          const dealtDamage = character.dealDamage(this.damage, hitElement, damageContext);
          const applied = victim.takeDamage(dealtDamage, hitElement, character, { silent: true, silentKo: true });
          t.damage = round2(t.damage + applied);
          t.hits += 1;
          t.elements.add(hitElement);
        });
      }
      victims.forEach((victim) => {
        const t = tally.get(victim)!;
        if (t.hits > 0) {
          const elLabel = t.elements.size === 1
            ? Element[[...t.elements][0]].toLowerCase()
            : 'mixed';
          const hitSuffix = this.hitCount > 1 ? ` (${t.hits} hit${t.hits === 1 ? '' : 's'})` : '';
          character.battle.logEvent(
            `${victim.character.name} took ${round2(t.damage)} ${elLabel} damage${hitSuffix}`,
            'damage',
          );
          if (victim.isKnockedOut && t.wasAlive) {
            character.battle.logEvent(`${victim.character.name} was knocked out!`, 'ko');
          }
        } else if (t.dodged > 0) {
          character.battle.logEvent(`${victim.character.name} dodged the attack!`, 'dodge');
        }
      });
    }
  }

  /** Element used for a single damage hit (per-hit random, skill override, or caster default). */
  private resolveDamageElementForHit(caster: CharacterInBattle): Element {
    if (this.randomElementPerHit) {
      return randomElement();
    }
    if (this.damageElement !== undefined) {
      return this.damageElement;
    }
    return caster.effectiveDamageElement;
  }

  /** Living characters in range for this skill line (effects or damage). */
  private static resolveSkillRangeTargets(
    range: RangeType,
    caster: CharacterInBattle,
    target: CharacterInBattle | null,
  ): CharacterInBattle[] {
    const alive = (c: CharacterInBattle) => !c.isKnockedOut;
    switch (range) {
      case RangeType.Self:
        return alive(caster) ? [caster] : [];
      case RangeType.SingleAlly:
        if (!target) return [];
        return caster.battle.ally(caster.side).includes(target) && alive(target) ? [target] : [];
      case RangeType.AllAllies:
        return caster.battle.ally(caster.side).filter(alive);
      case RangeType.SingleOpponent:
        if (!target) return [];
        return caster.battle.opponent(caster.side).includes(target) && alive(target) ? [target] : [];
      case RangeType.AdjacentOpponents: {
        const slot = caster.slotIndexOnSide();
        return caster.battle.opponent(caster.side).filter(
          (opponent, idx) => alive(opponent) && Math.abs(idx - slot) <= 1,
        );
      }
      case RangeType.AllOpponents:
        return caster.battle.opponent(caster.side).filter(alive);
      case RangeType.AllCards:
        return caster.battle.allCards().filter(alive);
      default:
        throw new Error(`Invalid skill range: ${range}`);
    }
  }

  /**
   * Before applying skill effects, roll dodge once per hostile effect target. Dodging skips
   * debuffs/buffs from effects on that character for this skill use. Damage dodges per hit.
   */
  private static resolveDodgesForHostileEffectTargets(
    caster: CharacterInBattle,
    target: CharacterInBattle | null,
    skill: Skill,
  ): Set<CharacterInBattle> {
    const hostileTargets = new Set<CharacterInBattle>();

    skill.effects.forEach((rangeEffect) => {
      Skill.resolveSkillRangeTargets(rangeEffect.range, caster, target).forEach((victim) => {
        if (victim.side !== caster.side) {
          hostileTargets.add(victim);
        }
      });
    });

    const dodged = new Set<CharacterInBattle>();
    hostileTargets.forEach((victim) => {
      if (victim.rollDodge()) {
        dodged.add(victim);
        caster.battle.logEvent(`${victim.character.name} dodged the attack!`);
      }
    });
    return dodged;
  }

  /** False when a hostile target dodged this skill (skip effects and damage on them). */
  private static shouldResolveOnHostileTarget(
    caster: CharacterInBattle,
    victim: CharacterInBattle,
    dodgedTargets: Set<CharacterInBattle>,
  ): boolean {
    if (victim.side === caster.side) {
      return true;
    }
    return !dodgedTargets.has(victim);
  }

  toString(): string {
    const damageStr = this.damage > 0 ? `Damage: ${this.damageDisplayText}` : '';
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
