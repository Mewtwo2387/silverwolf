import { Element } from './element';
import { Effect } from './effect';
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
  Normal,
  Charged,
  Ultimate,
} from './characterBuilder';
import { ImagePanelMode } from './imagePanel';
import { characterImagePath } from './assetPaths';
import { TAGS, countTaggedAllies } from './characterTags';
import type { CharacterInBattle } from './characterInBattle';
import { round2 } from '../utils/math';

const POLYGROWTH_STACK_NAME = 'Polygrowth Stack';
const POLYGROWTH_BONUS_NAME = 'Polygrowth';
const POLYGROWTH_DURATION = 5;
const POLYGROWTH_MAX_STACKS = 5;

/** Mystic charged skill: stack markers + outgoing-damage bonus at 20% × stacks². */
function applyPolygrowthStack(caster: CharacterInBattle): void {
  caster.addEffect(createEffect({
    name: POLYGROWTH_STACK_NAME,
    description: 'One Polygrowth stack.',
    type: EffectType.OutgoingDamage,
    amount: 1,
    duration: POLYGROWTH_DURATION,
    positive: true,
    stackable: true,
    maxStacks: POLYGROWTH_MAX_STACKS,
  }));

  const stacks = Math.min(
    POLYGROWTH_MAX_STACKS,
    caster.effects.filter((e) => e.name === POLYGROWTH_STACK_NAME).length,
  );
  const bonusMultiplier = round2(1 + 0.2 * stacks * stacks);

  caster.removeEffectsByName(POLYGROWTH_BONUS_NAME);

  caster.addEffect(createEffect({
    name: POLYGROWTH_BONUS_NAME,
    description: `Outgoing damage +${Math.round((bonusMultiplier - 1) * 100)}% (${stacks} stack${stacks === 1 ? '' : 's'}).`,
    type: EffectType.OutgoingDamage,
    amount: bonusMultiplier,
    duration: POLYGROWTH_DURATION,
    positive: true,
  }));
}

/**
 * A list of all characters in the game
 */

const FAIRY_TEXT_COLORS = {
  nameFill: '#FFF6F9',
  nameStroke: '#3A1323',
  hpLabelFill: '#FFD8EC',
  hpLabelStroke: '#3A1323',
  hpValueFill: '#FFFFFF',
  hpValueStroke: '#2B1020',
  titleFill: '#FFE5F2',
  titleStroke: '#2E1320',
  titleDescFill: '#FFF9FD',
  titleDescStroke: '#23111A',
  skillNameFill: '#FFE0F0',
  skillNameStroke: '#2E1320',
  skillDamageFill: '#FFFFFF',
  skillDamageStroke: '#2B1020',
  skillCostFill: '#FFEFFF',
  skillCostStroke: '#2B1636',
  skillDescFill: '#FFFFFF',
  skillDescStroke: '#221824',
  abilityNameFill: '#FFE0F0',
  abilityNameStroke: '#2E1320',
  abilityDescFill: '#FFFFFF',
  abilityDescStroke: '#221824',
};

const FAIRY_ABILITY_PANEL_COLOR = '#D5ABB2';

const QUANTUM_TEXT_COLORS = {
  nameFill: '#EDE2FF',
  nameStroke: '#1A123A',
  hpLabelFill: '#D7CCFF',
  hpLabelStroke: '#1A123A',
  hpValueFill: '#F8F3FF',
  hpValueStroke: '#16122D',
  titleFill: '#E5D8FF',
  titleStroke: '#1B1433',
  titleDescFill: '#F8F3FF',
  titleDescStroke: '#1A1730',
  skillNameFill: '#E3D5FF',
  skillNameStroke: '#1B1433',
  skillDamageFill: '#FDFBFF',
  skillDamageStroke: '#16122D',
  skillCostFill: '#CDE8FF',
  skillCostStroke: '#18223D',
  skillDescFill: '#F9F5FF',
  skillDescStroke: '#1A1730',
  abilityNameFill: '#E3D5FF',
  abilityNameStroke: '#1B1433',
  abilityDescFill: '#F9F5FF',
  abilityDescStroke: '#1A1730',
};

const QUANTUM_ABILITY_PANEL_COLOR = '#5539CC';

/** Purple-violet card text (pairs with cyan Electro backgrounds). */
const ELECTRO_TEXT_COLORS = {
  nameFill: '#F4E9FF',
  nameStroke: '#2A1445',
  hpLabelFill: '#E4D4FF',
  hpLabelStroke: '#2A1445',
  hpValueFill: '#FCF7FF',
  hpValueStroke: '#1E0F35',
  titleFill: '#ECD9FF',
  titleStroke: '#261742',
  titleDescFill: '#FAF4FF',
  titleDescStroke: '#1E1538',
  skillNameFill: '#E8D6FF',
  skillNameStroke: '#2A1A4A',
  skillDamageFill: '#FFF9FF',
  skillDamageStroke: '#1A0F32',
  skillCostFill: '#DCC4FF',
  skillCostStroke: '#2D1F52',
  skillDescFill: '#F7F0FF',
  skillDescStroke: '#22183C',
  abilityNameFill: '#E6D2FF',
  abilityNameStroke: '#2A1A4A',
  abilityDescFill: '#F7F0FF',
  abilityDescStroke: '#22183C',
};

const ELECTRO_ABILITY_PANEL_COLOR = '#39AACC';

const ANEMO_TEXT_COLORS = {
  nameFill: '#E8FFF4',
  nameStroke: '#123A2A',
  hpLabelFill: '#C8F5E0',
  hpLabelStroke: '#123A2A',
  hpValueFill: '#F4FFFA',
  hpValueStroke: '#0E2E22',
  titleFill: '#D4F5E4',
  titleStroke: '#143528',
  titleDescFill: '#F0FFF8',
  titleDescStroke: '#102820',
  skillNameFill: '#C8EDDA',
  skillNameStroke: '#143528',
  skillDamageFill: '#FFFFFF',
  skillDamageStroke: '#0E2E22',
  skillCostFill: '#D8FFE8',
  skillCostStroke: '#1A3D30',
  skillDescFill: '#F4FFFA',
  skillDescStroke: '#102820',
  abilityNameFill: '#C8EDDA',
  abilityNameStroke: '#143528',
  abilityDescFill: '#F4FFFA',
  abilityDescStroke: '#102820',
};

const ANEMO_ABILITY_PANEL_COLOR = '#5FBF8A';

export const KAITLIN = createCharacter({
  name: 'Kaitlin',
  title: 'Herrscher of Egg',
  description: 'Starts in Doge form. Converts into Kaitlin form after casting skill.',
  rarity: 6,
  hp: 100,
  element: Element.Fairy,
  tags: [TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    imagePath: characterImagePath('kaitlin'),
    mode: ImagePanelMode.Crop,
  },
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  textColors: FAIRY_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Unlimited Doge Works',
      description: 'Basic Attack when in Doge Form.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Slay Queen',
      description: 'Basic Attack when in Kaitlin Form.',
      damage: 35,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Estrogen',
      description: 'Our girl finally goes through her transformation and becomes a girl. Converts into Kaitlin Form.',
      range: RangeType.Self,
      battleCost: Ultimate(30),
      effects: [
        createRangeEffect(
          RangeType.Self,
          createEffect({
            name: 'Estrogen',
            description: 'Converted into Kaitlin Form.',
            type: EffectType.FormChange,
            amount: 1,
            positive: true,
          }),
        ),
      ],
      formChange: [1, 2], // When transformed, skills 1 (Slay Queen) and 2 (Estrogen) become active
    }),
  ],
  abilities: [
    createAbility({
      name: 'Coincidence? I Think Not.',
      description: 'Deals 15/40% more damage when there are 1/2 allies with name starting in "V".',
      panelColor: FAIRY_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().filter((ally) => ally.character.name.startsWith('V')).length === 1
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Coincidence? I Think Not.',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().filter((ally) => ally.character.name.startsWith('V')).length === 2
          ),
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
  tags: [TAGS.TGP],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#FFFFFF',
    imagePath: characterImagePath('venfei'),
  },
  background: createSimpleBackground('#D5ABB2', '#B76E79'),
  textColors: FAIRY_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'h',
      description: 'h',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'aaaaaaa',
      description: 'Increases outgoing damage of one ally by 60% for 3 turns.',
      range: RangeType.SingleAlly,
      battleCost: Charged(1),
      effects: [
        createRangeEffect(
          RangeType.SingleAlly,
          createEffect({
            name: 'aaaaaaa',
            description: 'Increases outgoing damage by 60%',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            duration: 3,
            positive: true,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'aaaaaaaaaaaaaa',
      description: 'Increases outgoing damage of all allies by 35% for 5 turns.',
      range: RangeType.AllAllies,
      battleCost: Ultimate(20),
      effects: [
        createRangeEffect(
          RangeType.AllAllies,
          createEffect({
            name: 'aaaaaaaaaaaaaa',
            description: 'Increases outgoing damage by 35%',
            type: EffectType.OutgoingDamage,
            amount: 1.35,
            duration: 5,
            positive: true,
          }),
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
  tags: [TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#49497d',
    imagePath: characterImagePath('ei'),
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Plap',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'uuoohhh',
      description: 'Attacks a single opponent.',
      damage: 45,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
    }),
    createSkill({
      name: 'PLAP PLAP PLAP GET CORRECTED',
      description: 'All your [redacted] needs correction! Attacks all opponents, reducing their outgoing damage by 35% for 5 turns.',
      damage: 35,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'PLAP PLAP PLAP GET CORRECTED',
            description: 'Reduces outgoing damage by 35%.',
            type: EffectType.OutgoingDamage,
            amount: 0.65,
            duration: 5,
            positive: false,
          }),
        ),
      ],
    }),
  ],
  abilities: [
    createAbility({
      name: 'I love all my quantum girls',
      description: 'Deals 15/40% more damage when there are 1/2 quantum allies',
      panelColor: QUANTUM_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 15%.',
            type: EffectType.OutgoingDamage,
            amount: 1.15,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.QUANTUM_GIRL) === 2
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'I love all my quantum girls',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.QUANTUM_GIRL) === 3
          ),
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
  tags: [TAGS.QUANTUM_GIRL, TAGS.HSR],
  imagePanel: {
    imagePath: characterImagePath('silverwolf', 'jpg'),
    mode: ImagePanelMode.Crop,
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'System Warning',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Allow Changes?',
      description: 'Increases incoming quantum damage of one opponent by 50% for 5 turns.',
      damage: 10,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
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
            positive: false,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'User Banned',
      description: 'Increases incoming damage of all opponents by 50% for 5 turns.',
      damage: 25,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
      effects: [
        createRangeEffect(
          RangeType.AllOpponents,
          createEffect({
            name: 'User Banned',
            description: 'Increases incoming damage by 50%.',
            type: EffectType.IncomingDamage,
            amount: 1.5,
            duration: 5,
            positive: false,
          }),
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
        positive: false,
      });

      const effect2 = createEffect({
        name: 'Bug: Outgoing Damage',
        description: 'Outgoing damage decreased by 10%.',
        type: EffectType.OutgoingDamage,
        amount: 0.9,
        duration: 3,
        positive: false,
      });

      const effect3 = createEffect({
        name: 'Bug: Energy Gain',
        description: 'Energy gain decreased by 10%.',
        type: EffectType.EnergyGain,
        amount: 0.9,
        duration: 3,
        positive: false,
      });

      // Randomly select one effect when the ability triggers
      // We use a closure to ensure only one effect is selected per activation
      // State is reset at the start of each applyEffects call (when selectedEffectIndex is null)
      let selectedEffectIndex: number | null = null;

      return createAbility({
        name: 'Awaiting System Response...',
        description: 'After attacking an opponent, implants one of the following three effects on them for 3 turns: increases incoming damage by 10%, decreases outgoing damage by 10%, or decreases energy gain by 10%.',
        panelColor: QUANTUM_ABILITY_PANEL_COLOR,
        effects: [
          createAbilityEffect({
            range: RangeType.SingleOpponent,
            effect: effect1,
            condition: (_context: AbilityActivationContext) => {
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
            condition: (_context: AbilityActivationContext) => {
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
            condition: (_context: AbilityActivationContext) => {
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
  tags: [TAGS.QUANTUM_GIRL, TAGS.HSR],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#000000',
    imagePath: characterImagePath('sparkle', 'jpg'),
  },
  background: createSimpleBackground('#5539CC', '#332266'),
  textColors: QUANTUM_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Monodrama',
      description: 'Basic Attack.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Dreamdiver',
      description: 'Increases outgoing damage of one ally by 60% for 3 turns.',
      range: RangeType.SingleAlly,
      battleCost: Charged(1),
      effects: [
        createRangeEffect(
          RangeType.SingleAlly,
          createEffect({
            name: 'Dreamdiver',
            description: 'Increases outgoing damage by 60%.',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            duration: 3,
            positive: true,
          }),
        ),
      ],
    }),
    createSkill({
      name: 'The Hero with a Thousand Faces',
      description: 'Regenerates 6 skill points for all allies.',
      range: RangeType.AllAllies,
      battleCost: Ultimate(35, { grantTeamSkillPoints: 6 }),
    }),
  ],
  abilities: [
    (() => {
      let redHerringSurgeSerial = 0;
      return createAbility({
        name: 'Red Herring',
        description:
          'Increases the maximum number of skill points by 2. For every skill point an ally consumes, increase their damage by 5% for 5 turns.',
        panelColor: QUANTUM_ABILITY_PANEL_COLOR,
        effects: [
          createAbilityEffect({
            range: RangeType.Self,
            effect: createEffect({
              name: 'Red Herring',
              description: '+2 to maximum team skill points.',
              type: EffectType.SkillPointsMaxBonus,
              amount: 2,
              duration: 9999,
              positive: true,
            }),
          }),
        ],
        onBattleEvent(event, owner) {
          if (event.type !== 'skill_points_consumed') return;
          if (event.side !== owner.side) return;
          if (owner.isKnockedOut) return;
          for (let i = 0; i < event.pointsConsumed; i += 1) {
            redHerringSurgeSerial += 1;
            event.consumer.addEffect(
              new Effect(
                `Red Herring •${redHerringSurgeSerial}`,
                'Outgoing damage +5% from Red Herring.',
                EffectType.OutgoingDamage,
                1.05,
                5,
                true,
              ),
            );
          }
        },
      });
    })(),
  ],
});

export const ELECTRO = createCharacter({
  name: 'Electro',
  title: "Furina's Wife",
  description: 'bottom + whale + yuri',
  rarity: 6,
  hp: 100,
  element: Element.Electro,
  tags: [TAGS.TGP, TAGS.BASEMENT],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#39AACC',
    imagePath: characterImagePath('electro', 'jpg'),
  },
  background: createSimpleBackground('#39AACC', '#7ADDFF'),
  textColors: ELECTRO_TEXT_COLORS,
  twoColumnSkills: true,
  skills: [
    createSkill({
      name: '60',
      description: '$1.',
      damage: 5,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: '300+30',
      description: '$5.',
      damage: 15,
      range: RangeType.SingleOpponent,
      battleCost: Charged(1),
    }),
    createSkill({
      name: '980+110',
      description: '$15.',
      damage: 35,
      range: RangeType.SingleOpponent,
      battleCost: Charged(2),
    }),
    createSkill({
      name: '1980+260',
      description: '$30.',
      damage: 60,
      range: RangeType.SingleOpponent,
      battleCost: Charged(3),
    }),
    createSkill({
      name: '3280+600',
      description: '$50.',
      damage: 90,
      range: RangeType.SingleOpponent,
      battleCost: Charged(4),
    }),
    createSkill({
      name: '6480+1600',
      description: '$100.',
      damage: 120,
      range: RangeType.SingleOpponent,
      battleCost: Charged(5),
    }),
    createSkill({
      name: 'Shop sweep',
      description: 'All of them.',
      damage: 100,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(100),
    }),
  ],
  abilities: [
    createAbility({
      name: "Furina's Bottom",
      description: 'When Furina is in the same team, decrease damage taken by 40%',
      panelColor: ELECTRO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: "Furina's Bottom",
            description: 'Decreases damage taken by 40%.',
            type: EffectType.IncomingDamage,
            amount: 0.6,
            duration: 9999,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            context.getAllies().some((ally) => ally.character.name === 'Furina')
          ),
        }),
      ],
    }),
  ],
});

export const MYSTIC = createCharacter({
  name: 'Mystic',
  title: 'Herrscher of Poly',
  description: '-',
  rarity: 6,
  hp: 100,
  element: Element.Anemo,
  tags: [TAGS.TGP],
  imagePanel: {
    mode: ImagePanelMode.Background,
    backgroundColor: '#5FBF8A',
    imagePath: characterImagePath('mystic'),
  },
  background: createSimpleBackground('#5FBF8A', '#2D6B4A'),
  textColors: ANEMO_TEXT_COLORS,
  skills: [
    createSkill({
      name: 'Polyrhythm',
      description: 'Deals 4 damage to one target 4 times.',
      damage: 4,
      hitCount: 4,
      range: RangeType.SingleOpponent,
      battleCost: Normal(1),
    }),
    createSkill({
      name: 'Polynomial Polygrowth',
      description: 'Gains one stack of [Polygrowth] for 5 turns. Increases outgoing damage by 20% x stacks² (max 5 stacks).',
      range: RangeType.Self,
      battleCost: Charged(1),
      onUse: (caster) => {
        applyPolygrowthStack(caster);
      },
    }),
    createSkill({
      name: 'Polychromatic Polystrike',
      description: 'Deals 20 damage of 3 random elements to all targets.',
      damage: 20,
      hitCount: 3,
      randomElementPerHit: true,
      range: RangeType.AllOpponents,
      battleCost: Ultimate(35),
    }),
  ],
  abilities: [
    createAbility({
      name: 'Polymorphism',
      description: 'For every TGP member in the team, increase outgoing damage by 20%.',
      panelColor: ANEMO_ABILITY_PANEL_COLOR,
      effects: [
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 20%.',
            type: EffectType.OutgoingDamage,
            amount: 1.2,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 1
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 40%.',
            type: EffectType.OutgoingDamage,
            amount: 1.4,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 2
          ),
        }),
        createAbilityEffect({
          range: RangeType.Self,
          effect: createEffect({
            name: 'Polymorphism',
            description: 'Increases outgoing damage by 60%.',
            type: EffectType.OutgoingDamage,
            amount: 1.6,
            positive: true,
          }),
          condition: (context: AbilityActivationContext) => (
            countTaggedAllies(context.getAllies(), TAGS.TGP) === 3
          ),
        }),
      ],
    }),
  ],
});

export const CHARACTERS = [KAITLIN, VENFEI, EI, SILVERWOLF, SPARKLE, ELECTRO, MYSTIC];
