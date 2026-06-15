import { Element } from '../element';
import { EffectType } from '../effectType';
import { RangeType } from '../rangeType';
import { AbilityActivationContext } from '../ability';
import type { CharacterInBattle } from '../characterInBattle';
import {
  createCharacter,
  createSkill,
  createEffect,
  createAbility,
  createAbilityEffect,
  createSimpleBackground,
  Normal,
  Charged,
  Ultimate,
} from '../characterBuilder';
import { ImagePanelMode } from '../imagePanel';
import { characterImagePath } from '../assetPaths';
import { applyDotStacks } from '../dotStacks';
import { TAGS, allyHasTag } from '../characterTags';
import { PYRO_ABILITY_PANEL_COLOR, PYRO_TEXT_COLORS } from './shared';

function applyBurn(
  target: CharacterInBattle,
  stacks: number,
  duration: number,
  caster: CharacterInBattle,
): void {
  applyDotStacks(target, caster, {
    name: 'Burn',
    element: Element.Pyro,
    basePerStack: 3,
    stacks,
    duration,
  });
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
  tags: [TAGS.MISSING_EI],
  imagePanel: {
    mode: ImagePanelMode.Crop,
    imagePath: characterImagePath('missingei', 'jpg'),
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
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'In other words, hold my hand',
            description: '+2 damage per [Burn] stack inflicted.',
            type: EffectType.DotStackBaseBonus,
            amount: 2,
            positive: true,
            appliesToElement: Element.Pyro,
          }),
          condition: (context: AbilityActivationContext) => (
            allyHasTag(context.getAllies(), TAGS.KEQISLAW)
          ),
        }),
      ],
    }),
  ],
});
