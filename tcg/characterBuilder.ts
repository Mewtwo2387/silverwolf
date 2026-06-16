/**
 * Helper functions for building characters in a more readable way
 */

import { Character } from './character';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background, BackgroundType, TopBarType } from './background';
import { Skill } from './skill';
import { Normal, type SkillBattleCost } from './skillBattleCost';
import { Ability, AbilityEffectPair, AbilityActivationContext } from './ability';
import type { AbilityBattleEventHandler } from './battleEvents';
import { RangeEffect } from './rangeEffect';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { RangeType } from './rangeType';
import { Element } from './element';
import type { SkillDamageOptions, SkillOnUse } from './skill';
import { CharacterTextColors } from './textTheme';
import { ImagePanel, ImagePanelOptions } from './imagePanel';
import type { CharacterTag } from './characterTags';

export {
  Normal,
  Charged,
  Ultimate,
  type SkillBattleCost,
  type UltimateOptions,
} from './skillBattleCost';

export type { AbilityBattleEventHandler, BattleEvent } from './battleEvents';

export interface CharacterImagePanelConfig extends ImagePanelOptions {
  imagePath?: string;
}

/**
 * Helper to create a simple gradient background
 */
export function createSimpleBackground(
  color1: string,
  color2: string,
  topBarColor: string = '#68343B',
): Background {
  return new Background(
    BackgroundType.Gradient,
    { color1, color2, image: '' },
    topBarColor,
    TopBarType.Fade,
    { color: '#440000', opacity1: 0.6, opacity2: 0.3 },
  );
}

/**
 * Helper to create a character with named parameters for better readability
 */
export function createCharacter(params: {
  name: string;
  title: string;
  description: string;
  titleColor?: string;
  rarity: number;
  hp: number;
  element: Element;
  imagePanel: CharacterImagePanelConfig;
  background?: Background;
  skills?: Skill[];
  abilities?: Ability[];
  defaultForm?: number[]; // skill indices available in default form
  textColors?: Partial<CharacterTextColors>;
  /** Render skills in a 2-column half-scale grid (useful for characters with many skills). */
  twoColumnSkills?: boolean;
  /** Internal labels for ability/equipment logic; not shown in UI. */
  tags?: readonly CharacterTag[];
  /** Internal namespace for file outputs (card PNG). Defaults to a slug of {@link name}. */
  slug?: string;
}): Character {
  const titleDesc = new TitleDesc(
    params.title,
    params.description,
    params.titleColor || '#777777',
  );

  const background = params.background || createSimpleBackground('#FFFFFF', '#68343B');

  return new Character(
    params.name,
    titleDesc,
    new Rarity(params.rarity),
    params.hp,
    params.element,
    new ImagePanel(params.imagePanel.imagePath, params.imagePanel),
    background,
    params.skills || [],
    params.abilities || [],
    params.defaultForm,
    params.textColors,
    params.twoColumnSkills ?? false,
    params.tags ?? [],
    params.slug,
  );
}

/**
 * Helper to create a skill
 */
export function createSkill(params: {
  name: string;
  description: string;
  damage?: number;
  range?: RangeType;
  effects?: RangeEffect[];
  formChange?: number[]; // skill indices active after transformation
  /** Normal(n) / Charged(n) / Ultimate(energy); defaults to Normal(1). */
  battleCost?: SkillBattleCost;
  /** Hits per target; each hit rolls damage and dodge independently. Default 1. */
  hitCount?: number;
  /** Fixed element for every hit. */
  damageElement?: Element;
  /** Each hit picks a random element. */
  randomElementPerHit?: boolean;
  /** Character-specific resolve logic (see {@link SkillOnUse}). */
  onUse?: SkillOnUse;
}): Skill {
  const damageOptions: SkillDamageOptions | undefined = (
    params.hitCount !== undefined
      || params.damageElement !== undefined
      || params.randomElementPerHit
  ) ? {
      hitCount: params.hitCount,
      damageElement: params.damageElement,
      randomElementPerHit: params.randomElementPerHit,
    } : undefined;

  return new Skill(
    params.name,
    params.description,
    params.damage || 0,
    params.range ?? RangeType.SingleOpponent,
    params.effects || [],
    params.formChange,
    damageOptions,
    params.onUse,
    params.battleCost ?? Normal(1),
  );
}

/**
 * Helper to create an effect
 */
export function createEffect(params: {
  name: string;
  description: string;
  type: EffectType;
  amount: number;
  /** True for buffs, false for debuffs. Drives log phrasing and future UI cues. */
  positive: boolean;
  duration?: number; // defaults to permanent (9999)
  /** When true, additional copies of this effect coexist instead of refreshing/overwriting. */
  stackable?: boolean;
  activeSkillIndices?: number[]; // for FormChange effects
  appliesToElement?: Element; // for damage effects: if specified, only applies to damage of this element type
  overrideElement?: Element; // for DamageElementOverride: the element to convert outgoing damage to
  maxStacks?: number;
}): Effect {
  const metadata: {
    activeSkillIndices?: number[];
    appliesToElement?: Element;
    overrideElement?: Element;
    maxStacks?: number;
  } = {};
  if (params.activeSkillIndices) {
    metadata.activeSkillIndices = params.activeSkillIndices;
  }
  if (params.appliesToElement !== undefined) {
    metadata.appliesToElement = params.appliesToElement;
  }
  if (params.overrideElement !== undefined) {
    metadata.overrideElement = params.overrideElement;
  }
  if (params.maxStacks !== undefined) {
    metadata.maxStacks = params.maxStacks;
  }

  return new Effect(
    params.name,
    params.description,
    params.type,
    params.amount,
    params.duration !== undefined ? params.duration : 9999,
    params.positive,
    Object.keys(metadata).length > 0 ? metadata : undefined,
    params.stackable ?? false,
  );
}

/**
 * Helper to create a range effect
 */
export function createRangeEffect(
  range: RangeType,
  effect: Effect,
): RangeEffect {
  return new RangeEffect(range, effect);
}

/**
 * Helper to create an ability with effect pairs
 */
export function createAbility(params: {
  name: string;
  description: string;
  effects?: AbilityEffectPair[];
  panelColor?: string;
  onBattleEvent?: AbilityBattleEventHandler;
}): Ability {
  return new Ability(
    params.name,
    params.description,
    params.effects ?? [],
    params.panelColor,
    params.onBattleEvent,
  );
}

/**
 * Helper to create an ability effect pair
 */
export function createAbilityEffect(params: {
  range: RangeType;
  effect: Effect;
  condition?: (context: AbilityActivationContext) => boolean;
}): AbilityEffectPair {
  return {
    effect: new RangeEffect(params.range, params.effect),
    activationCondition: params.condition,
  };
}
