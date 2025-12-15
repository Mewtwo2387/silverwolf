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

export const EI = createCharacter({
  name: 'Ei',
  title: 'Herrscher of Horny',
  description: 'silverwolfsbf',
  rarity: 6,
  hp: 100,
  element: Element.Quantum,
  image: '',
  background: createSimpleBackground('#5539CC', '#332266'),
  skills: [
    createSkill({
      name: 'Plap',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'Correction',
      description: 'All your [redacted] needs correction! Attacks all opponents, reducing their outgoing damage by 30% for 5 turns.',
      cost: 35,
      damage: 35,
      range: RangeType.AllOpponents,
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'Correction',
            description: 'Reduces outgoing damage by 30%.',
            type: EffectType.OutgoingDamage,
            amount: 0.7,
            duration: 5,
          })
        ),
      ],
    }),
  ],
  abilities: [
    createAbility({
      name: 'I love all my quantum girls',
      description: 'Deals 15/40% more damage when there are 1/2 quantum allies',
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
          }),
          condition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.element === Element.Quantum).length === 2;
          },
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
          }),
          condition: (context: AbilityActivationContext) => {
            return context.getAllies().filter(ally => ally.character.element === Element.Quantum).length === 3;
          },
        }),
      ],
    }),
  ],
});

export const SILVERWOLF = createCharacter({
  name: 'Silverwolf',
  title: 'Hacker of the Stellaron Hunters',
  description: 'hot.',
  rarity: 6,
  hp: 80,
  element: Element.Quantum,
  image: '',
  background: createSimpleBackground('#5539CC', '#332266'),
  skills: [
    createSkill({
      name: 'System Warning',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'Allow Changes?',
      description: 'Increases incoming quantum damage of one opponent by 50% for 5 turns.',
      damage: 10,
      cost: 20,
      range: RangeType.SingleOpponent,
      effects: [
      createRangeEffect(
        RangeType.SingleOpponent,
        createEffect({
          name: 'Allow Changes?',
          description: 'Increases incoming quantum damage by 50%.',
          type: EffectType.IncomingDamage,
          amount: 1.5,
          duration: 5,
          appliesToElement: Element.Quantum,
        })
      ),
      ],
    }),
    createSkill({
      name: 'User Banned',
      description: 'Increases incoming damage of all opponents by 50% for 3 turns.',
      cost: 35,
      range: RangeType.AllOpponents,
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'User Banned',
            description: 'Increases incoming damage by 50%.',
            type: EffectType.IncomingDamage,
            amount: 1.5,
            duration: 5,
          })
        ),
      ],
    }),
  ],
  abilities: [
    (() => {
      // Create three possible effects
      const effect1 = createEffect({
        name: 'Bug: Incoming Damage',
        description: 'Incoming damage increased by 10%.',
        type: EffectType.IncomingDamage,
        amount: 1.1,
        duration: 3,
      });
      
      const effect2 = createEffect({
        name: 'Bug: Outgoing Damage',
        description: 'Outgoing damage decreased by 10%.',
        type: EffectType.OutgoingDamage,
        amount: 0.9,
        duration: 3,
      });
      
      const effect3 = createEffect({
        name: 'Bug: Energy Gain',
        description: 'Energy gain decreased by 10%.',
        type: EffectType.EnergyGain,
        amount: 0.9,
        duration: 3,
      });
      
      // Randomly select one effect when the ability triggers
      // We use a closure to ensure only one effect is selected per activation
      // State is reset at the start of each applyEffects call (when selectedEffectIndex is null)
      let selectedEffectIndex: number | null = null;
      
      return createAbility({
        name: 'Awaiting System Response...',
        description: "After attacking an opponent, implants one of the following three effects on them for 3 turns: increases incoming damage by 10%, decreases outgoing damage by 10%, or decreases energy gain by 10%.",
        effects: [
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect1,
            condition: (context: AbilityActivationContext) => {
              // Randomize on first evaluation (when selectedEffectIndex is null)
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              return selectedEffectIndex === 0;
            },
          }),
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect2,
            condition: (context: AbilityActivationContext) => {
              // Randomize on first evaluation (when selectedEffectIndex is null)
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              return selectedEffectIndex === 1;
            },
          }),
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect3,
            condition: (context: AbilityActivationContext) => {
              // Randomize on first evaluation (when selectedEffectIndex is null)
              if (selectedEffectIndex === null) {
                selectedEffectIndex = Math.floor(Math.random() * 3);
              }
              const result = selectedEffectIndex === 2;
              // Reset state after evaluating the last condition (ready for next activation)
              selectedEffectIndex = null;
              return result;
            },
          }),
        ],
      });
    })(),
  ],
});

export const SPARKLE = createCharacter({
  name: 'Sparkle',
  title: 'Member of the Masked Fools',
  description: 'hot.',
  rarity: 6,
  hp: 80,
  element: Element.Quantum,
  image: '',
  background: createSimpleBackground('#5539CC', '#332266'),
  skills: [
    createSkill({
      name: 'Monodrama',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
    }),
    createSkill({
      name: 'Dreamdiver',
      description: 'Increases outgoing damage of one ally by 60% for 5 turns.',
      cost: 20,
      range: RangeType.SingleAlly,
      effects: [
        createRangeEffect(
          RangeType.SingleAlly,
          createEffect({
            name: 'Dreamdiver',
            description: 'Increases outgoing damage by 60%.',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            duration: 5,
          })
        ),
      ],
    }),
    createSkill({
      name: 'The Hero with a Thousand Faces',
      description: 'Increases energy gain of all allies by 50% for 5 turns.',
      cost: 35,
      range: RangeType.AllAllies,
      effects: [
        createRangeEffect(
          RangeType.AllAllies,
          createEffect({
            name: 'The Hero with a Thousand Faces',
            description: 'Increases energy gain by 50%.',
            type: EffectType.EnergyGain,
            amount: 1.5,
            duration: 5,
          })
        ),
      ],
    }),
  ],
  abilities: [
    createAbility({
      name: 'Red Herring',
      description: 'Increases energy gain of all allies by 20%.',
      effects: [
        createAbilityEffect({
          range: RangeType.AllAllies,
          effect: createEffect({
            name: 'Red Herring',
            description: 'Increases energy gain by 20%.',
            type: EffectType.EnergyGain,
            amount: 1.2,
            duration: 9999,
          }),
        }),
      ],
    }),
  ],
});

export const CHARACTERS = [KAITLIN, VENFEI, EI, SILVERWOLF, SPARKLE];

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/kaitlin.png', buffer);
}

// setTimeout(testGenerateCard, 1000);
