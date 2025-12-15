import fs from 'fs';
import { Element } from './element';
import { EffectType } from './effectType';
import { RangeType } from './rangeType';
import { AbilityActivationContext } from './ability';
import {
  createCharacter,
  createSkill,
  createEffect,
  createRangeEffect,
  createAbility,
  createAbilityEffect,
  createSimpleBackground,
} from './characterBuilder';

/**
 * A list of all characters in the game
 */

export const KAITLIN = createCharacter({
  name: 'Kaitlin',
  title: 'Herrscher of Egg',
  description: 'Starts in Doge form. Converts into Kaitlin form after casting skill.',
  rarity: 6,
  hp: 100,
  element: Element.Fairy,
  image: 'https://static.wikia.nocookie.net/bocchi-the-rock/images/9/98/Hitori_Gotoh_Character_Design_2.png/revision/latest?cb=20220915114341',
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  skills: [
    createSkill({
      name: 'Unlimited Doge Works',
      description: 'Basic Attack when in Doge Form.',
      damage: 5,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'Slay Queen',
      description: 'Basic Attack when in Kaitlin Form.',
      damage: 35,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'Estrogen',
      description: 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.',
      cost: 30,
      range: RangeType.Self,
      effects: [
        createRangeEffect(
          RangeType.Self,
          createEffect({
            name: 'Estrogen',
            description: 'Converted into Kaitlin Form.',
            type: EffectType.FormChange,
            amount: 1,
          })
        ),
      ],
      formChange: [1, 2], // When transformed, skills 1 (Slay Queen) and 2 (Estrogen) become active
    }),
  ],
  abilities: [
    createAbility({
      name: 'Coincidence? I Think Not.',
      description: 'Deals 15/40% more damage when there are 1/2 allies with name starting in "V".',
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
          }),
          condition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.name.startsWith('V')).length === 1;
          },
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
          }),
          condition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.name.startsWith('V')).length === 2;
          },
        }),
      ],
    }),
  ],
  defaultForm: [0, 2], // Default form (Doge): skills 0 (Unlimited Doge Works) and 2 (Estrogen) are available
});

export const VENFEI = createCharacter({
  name: 'Venfei',
  title: 'The TGP Queen',
  description: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
  rarity: 6,
  hp: 80,
  element: Element.Fairy,
  image: '',
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  skills: [
    createSkill({
      name: 'h',
      description: 'h',
      damage: 5,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'aaaaaaa',
      description: 'Increases outgoing damage of all allies by 30% for 5 turns.',
      cost: 20,
      range: RangeType.AllAllies,
      effects: [
        createRangeEffect(
          RangeType.AllAllies,
          createEffect({
            name: 'aaaaaaa',
            description: 'Increases outgoing damage by 30%',
            type: EffectType.OutgoingDamage,
            amount: 1.3,
            duration: 5,
          })
        ),
      ],
    }),
  ],
});

export const CHARACTERS = [KAITLIN, VENFEI];

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/kaitlin.png', buffer);
}

// setTimeout(testGenerateCard, 1000);
