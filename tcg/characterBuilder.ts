/**
 * Helper functions for building characters in a more readable way
 */

import { Character } from './character';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background, BackgroundType, TopBarType } from './background';
import { Skill } from './skill';
import { Ability, AbilityEffectPair, AbilityActivationContext } from './ability';
import { RangeEffect } from './rangeEffect';
import { Effect } from './effect';
import { EffectType } from './effectType';
import { RangeType } from './rangeType';
import { Element } from './element';

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
  image: string;
  background?: Background;
  skills?: Skill[];
  abilities?: Ability[];
  defaultForm?: number[]; // skill indices available in default form
}): Character {
  const titleDesc = new TitleDesc(
    params.title,
    params.description,
    params.titleColor || '#777777'
  );

  const background = params.background || createSimpleBackground('#FFFFFF', '#68343B');

  return new Character(
    params.name,
    titleDesc,
    new Rarity(params.rarity),
    params.hp,
    params.element,
    params.image,
    background,
    params.skills || [],
    params.abilities || [],
    params.defaultForm
  );
}

/**
 * Helper to create a simple gradient background
 */
export function createSimpleBackground(
  color1: string,
  color2: string,
  topBarColor: string = '#68343B'
): Background {
  return new Background(
    BackgroundType.Gradient,
    { color1, color2, image: '' },
    topBarColor,
    TopBarType.Fade,
    { color: '#440000', opacity1: 0.6, opacity2: 0.3 }
  );
}

/**
 * Helper to create a skill
 */
export function createSkill(params: {
  name: string;
  description: string;
  damage?: number;
  cost?: number;
  range?: RangeType;
  effects?: RangeEffect[];
  formChange?: number[]; // skill indices active after transformation
}): Skill {
  return new Skill(
    params.name,
    params.description,
    params.damage || 0,
    params.cost || 0,
    params.range || RangeType.SingleOpponent,
    params.effects || [],
    params.formChange
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
  duration?: number; // defaults to permanent (9999)
  activeSkillIndices?: number[]; // for FormChange effects
  appliesToElement?: Element; // for damage effects: if specified, only applies to damage of this element type
}): Effect {
  const metadata: { activeSkillIndices?: number[]; appliesToElement?: Element } = {};
  if (params.activeSkillIndices) {
    metadata.activeSkillIndices = params.activeSkillIndices;
  }
  if (params.appliesToElement !== undefined) {
    metadata.appliesToElement = params.appliesToElement;
  }
  
  return new Effect(
    params.name,
    params.description,
    params.type,
    params.amount,
    params.duration !== undefined ? params.duration : 9999,
    Object.keys(metadata).length > 0 ? metadata : undefined
  );
}

/**
 * Helper to create a range effect
 */
export function createRangeEffect(
  range: RangeType,
  effect: Effect
): RangeEffect {
  return new RangeEffect(range, effect);
}

/**
 * Helper to create an ability with effect pairs
 */
export function createAbility(params: {
  name: string;
  description: string;
  effects: AbilityEffectPair[];
}): Ability {
  return new Ability(params.name, params.description, params.effects);
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

