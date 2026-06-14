import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import type { CharacterInBattle } from '../characterInBattle';
import {
  createCharacter,
  createSkill,
  createEffect,
  createAbility,
  createSimpleBackground,
  Normal,
  Charged,
  Ultimate,
} from '../characterBuilder';
import { ImagePanelMode } from '../imagePanel';
import { characterImagePath } from '../assetPaths';
import { round2 } from '../../utils/math';
import { PYRO_ABILITY_PANEL_COLOR, PYRO_TEXT_COLORS } from './shared';

const BURN_NAME = 'Burn';
const KEQ_ALLY_NAMES = ['Keqislaw', 'Keqowski'] as const;
const BASE_BURN_PER_STACK = 3;
const BOOSTED_BURN_PER_STACK = 5;

function teamHasKeqAlly(caster: CharacterInBattle): boolean {
  return caster.battle.ally(caster.side).some(
    (ally) => KEQ_ALLY_NAMES.includes(ally.character.name as typeof KEQ_ALLY_NAMES[number]),
  );
}

/** Multiplier from {@link EffectType.DotDamageBonus} on the caster (e.g. Moonlight Alter). */
export function dotDamageMultiplierFor(caster: CharacterInBattle): number {
  let multiplier = 1;
  caster.effects
    .filter((effect) => effect.type === EffectType.DotDamageBonus)
    .forEach((effect) => {
      multiplier *= effect.amount;
    });
  return multiplier;
}

function burnDamagePerStack(caster: CharacterInBattle): number {
  const base = teamHasKeqAlly(caster) ? BOOSTED_BURN_PER_STACK : BASE_BURN_PER_STACK;
  return round2(base * dotDamageMultiplierFor(caster));
}

function applyBurn(
  target: CharacterInBattle,
  stacks: number,
  duration: number,
  caster: CharacterInBattle,
): void {
  const perStack = burnDamagePerStack(caster);
  for (let i = 0; i < stacks; i += 1) {
    target.addEffect(createEffect({
      name: BURN_NAME,
      description: `Takes ${perStack} pyro damage per turn.`,
      type: EffectType.Burn,
      amount: perStack,
      duration,
      positive: false,
      stackable: true,
      appliesToElement: Element.Pyro,
    }));
  }
}

function adjacentOpponents(caster: CharacterInBattle): CharacterInBattle[] {
  const slot = caster.slotIndexOnSide();
  return caster.battle.opponent(caster.side).filter(
    (opponent, idx) => !opponent.isKnockedOut && Math.abs(idx - slot) <= 1,
  );
}

function livingOpponents(caster: CharacterInBattle): CharacterInBattle[] {
  return caster.battle.opponent(caster.side).filter((opponent) => !opponent.isKnockedOut);
}

export const MISSING_EI = createCharacter({
  name: 'missingEi',
  title: 'Glitched entity from the moon',
  description: '-',
  rarity: 5,
  hp: 90,
  element: Element.Pyro,
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#E85D3A',
    imagePath: characterImagePath('missingei'),
  },
  background: createSimpleBackground('#E85D3A', '#8B2E1A'),
  textColors: PYRO_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Grassburner',
      description: 'Deals 5 damage to one target and inflicts one stack of [Burn] for 3 turns. Targets inflicted with burn takes 3 pyro DoT dmg per turn',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
      onUse: (caster, target) => {
        if (target && !target.isKnockedOut) {
          applyBurn(target, 1, 3, caster);
        }
      },
    }),
    createSkill({
      name: 'Flamethrower',
      description: 'Deals 15 damage to all adjacent enemies and inflicts 2 stacks of [Burn] for 5 turns. Targets inflicted with burn takes 3 pyro DoT dmg per turn',
      damage: 15,
      range: RangeType.AdjacentOpponents,
      battleCost: Charged(1),
      onUse: (caster) => {
        adjacentOpponents(caster).forEach((opponent) => {
          applyBurn(opponent, 2, 5, caster);
        });
      },
    }),
    createSkill({
      name: 'Meteor',
      description: 'Shoots a meteor from the sky, dealing 35 damage to all enemies and inflicts 4 stacks of [Burn] for 5 turns. Targets inflicted with burn takes 3 DoT pyro dmg per turn',
      damage: 35,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      onUse: (caster) => {
        livingOpponents(caster).forEach((opponent) => {
          applyBurn(opponent, 4, 5, caster);
        });
      },
    }),
  ],
  abilities: [
    createAbility({
      name: 'In other words, hold my hand',
      description: 'When Keqislaw is in the team, increase base burn damage from 3 to 5.',
      panelColor: PYRO_ABILITY_PANEL_COLOR,
      effects: [],
    }),
  ],
});
