import { EffectType } from './effectType';
import { Character } from './character';
import { Battle } from './battle';
import { Effect } from './effect';
import { Skill } from './skill';
import { Element } from './element';
import type { Equipment } from './item';
import { runEquipmentCombineIfReady } from './equipmentCombine';
import { round2 } from '../utils/math';

export const MAX_EQUIPMENTS_PER_CHARACTER = 3;

/**
 * Optional context for a single damage roll. Charged-attack bonuses are applied here only
 * (not stored as separate timed buffs).
 */
export interface DamageCalculationContext {
  chargedAttack?: boolean;
  /** Team skill points spent to use the charged attack (from {@link Skill.skillPointsCost}). */
  skillPointsSpent?: number;
  ultimateAttack?: boolean;
}

/**
 * A single character and their status in a battle
 * @param character - The character class, which includes its base stats and skills/abilities
 * @param battle - The battle
 * @param side - Ally side or opponent side
 * @param currentHp - Current HP of the character
 * @param effects - List of effects active on the character
 * @param stats - Statistics such as damage dealt
 * @param isKnockedOut - Whether the character is knocked out
 * @param energy - Current energy available to use ultimates
 */
export class CharacterInBattle {
  character: Character;
  currentHp: number;
  effects: Effect[];
  stats: {
    damageDealt: number;
    damageReceived: number;
    attacksUsed: number;
    abilitiesUsed: number;
    turnsActive: number;
  };
  isKnockedOut: boolean;
  battle: Battle;
  side: string;
  energy: number;
  /** Equipment items attached to this character (max {@link MAX_EQUIPMENTS_PER_CHARACTER}). */
  equipments: Equipment[];
  /** Consumable item id → earliest battle round when that consumable may target this character again. */
  consumableCooldownUntilRound: Record<string, number>;

  constructor(character: Character, battle: Battle, side: string) {
    this.character = character;
    this.currentHp = character.hp;
    this.effects = [];
    this.stats = {
      damageDealt: 0,
      damageReceived: 0,
      attacksUsed: 0,
      abilitiesUsed: 0,
      turnsActive: 0,
    };
    this.isKnockedOut = false;
    this.battle = battle;
    this.side = side;
    this.energy = 0;
    this.equipments = [];
    this.consumableCooldownUntilRound = {};
  }

  /** True when a consumable with the given id is off cooldown for this character. */
  canUseConsumable(itemId: string): boolean {
    const availableRound = this.consumableCooldownUntilRound[itemId] ?? 1;
    return this.battle.currentTurn >= availableRound;
  }

  /** Earliest round (inclusive) when the consumable may be used again. */
  consumableAvailableRound(itemId: string): number {
    return this.consumableCooldownUntilRound[itemId] ?? 1;
  }

  /** Block a consumable on this character for `cooldownRounds` full battle rounds. */
  setConsumableCooldown(itemId: string, cooldownRounds: number): void {
    this.consumableCooldownUntilRound[itemId] = this.battle.currentTurn + cooldownRounds;
  }

  /**
   * Detach all equipment with the given id and remove one matching effect instance per
   * effect defined on each removed piece (supports stackable equipment bonuses).
   */
  removeEquipmentsById(itemId: string): number {
    const removed = this.equipments.filter((e) => e.id === itemId);
    removed.forEach((equipment) => {
      equipment.effects.forEach((effTemplate) => {
        const idx = this.effects.findIndex(
          (e) => e.name === effTemplate.name
            && e.type === effTemplate.type
            && e.stackable === effTemplate.stackable,
        );
        if (idx >= 0) {
          this.effects.splice(idx, 1);
        }
      });
    });
    this.equipments = this.equipments.filter((e) => e.id !== itemId);
    return removed.length;
  }

  /**
   * Element used for outgoing damage. Defaults to character.element, but a
   * {@link EffectType.DamageElementOverride} effect can convert outgoing damage to another element.
   */
  get effectiveDamageElement(): Element {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      if (
        effect.type === EffectType.DamageElementOverride
        && effect.metadata?.overrideElement !== undefined
      ) {
        return effect.metadata.overrideElement;
      }
    }
    return this.character.element;
  }

  /**
   * Attach an equipment to this character. Equipment effects are pushed to the regular
   * effects list (with whatever duration the effect specifies; equipment effects should
   * use 9999 to be permanent).
   * @returns true if equipped, false if the character is already at the cap or KO'd.
   */
  equip(equipment: Equipment): boolean {
    if (this.isKnockedOut) return false;
    if (this.equipments.length >= MAX_EQUIPMENTS_PER_CHARACTER) return false;
    this.equipments.push(equipment);
    equipment.effects.forEach((effect) => {
      this.addEffect(effect);
    });
    equipment.onEquipped?.(this);
    runEquipmentCombineIfReady(this, equipment);
    if (this.equipments.includes(equipment)) {
      this.battle.logEvent(`${this.character.name} equipped [${equipment.name}]`);
    }
    return true;
  }

  /**
   * Remove all currently active debuff effects (positive=false). Used by the Cleanser consumable.
   * @returns number of debuffs removed.
   */
  cleanseDebuffs(): number {
    const before = this.effects.length;
    this.effects = this.effects.filter((e) => e.positive);
    return before - this.effects.length;
  }

  /**
   * Get the active skills for this character (based on current form)
   * If a form change effect is active, uses the skill indices specified in the effect metadata
   * Otherwise, uses the character's defaultActiveSkillIndices, or all skills if not specified
   */
  getActiveSkills(): Skill[] {
    const formChangeEffect = this.effects.find((effect) => effect.type === EffectType.FormChange);

    if (formChangeEffect && formChangeEffect.metadata?.activeSkillIndices) {
      return formChangeEffect.metadata.activeSkillIndices
        .map((index) => this.character.skills[index])
        .filter((skill) => skill !== undefined);
    }

    if (this.character.defaultActiveSkillIndices) {
      return this.character.defaultActiveSkillIndices
        .map((index) => this.character.skills[index])
        .filter((skill) => skill !== undefined);
    }

    return this.character.skills;
  }

  /**
   * Get a skill by index from active skills
   */
  getActiveSkill(index: number): Skill | null {
    const activeSkills = this.getActiveSkills();
    if (index < 0 || index >= activeSkills.length) {
      return null;
    }
    return activeSkills[index];
  }

  /**
   * Get a skill by its original index in the character's skill array
   */
  getSkillByOriginalIndex(originalIndex: number): Skill | null {
    if (originalIndex < 0 || originalIndex >= this.character.skills.length) {
      return null;
    }
    return this.character.skills[originalIndex];
  }

  /**
   * Take damage from an attacker
   * @param amount - Base damage amount
   * @param damageElement - Element type of the damage (defaults to character's element if not specified)
   * @param attacker - If from another character, this character gains energy from being hit
   */
  /**
   * Combined dodge chance from all {@link EffectType.DodgeChance} effects (capped at 100%).
   * Rolled once per incoming enemy skill in {@link Skill.useSkill}.
   */
  getDodgeChance(): number {
    return this.effects
      .filter((effect) => effect.type === EffectType.DodgeChance)
      .reduce((sum, effect) => Math.min(1, sum + effect.amount), 0);
  }

  /** Single roll for whether an entire enemy skill is avoided (effects + damage). */
  rollDodge(): boolean {
    const chance = this.getDodgeChance();
    return chance > 0 && Math.random() < chance;
  }

  takeDamage(amount: number, damageElement?: Element, attacker?: CharacterInBattle | null) {
    if (this.isKnockedOut) return;

    const element = damageElement || this.character.element;

    let damage = amount;
    this.effects
      .filter((effect) => effect.type === EffectType.IncomingDamage)
      .filter((effect) => effect.appliesToDamageElement(element))
      .forEach((effect) => {
        damage *= effect.amount;
      });
    damage = round2(Math.max(0, damage));
    this.currentHp = round2(this.currentHp - damage);
    this.stats.damageReceived = round2(this.stats.damageReceived + damage);
    if (damage > 0) {
      this.battle.logEvent(`${this.character.name} lost ${damage} HP`);
    }
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.isKnockedOut = true;
      this.battle.logEvent(`${this.character.name} fainted`);
    }

    if (attacker && attacker !== this) {
      this.gainEnergy(5);
    }
  }

  heal(amount: number) {
    if (this.isKnockedOut) return;
    const before = this.currentHp;
    this.currentHp = round2(this.currentHp + amount);
    if (this.currentHp > this.character.hp) this.currentHp = this.character.hp;
    const gained = round2(this.currentHp - before);
    if (gained > 0) {
      this.battle.logEvent(`${this.character.name} recovered ${gained} HP`);
    }
  }

  /**
   * Calculate outgoing damage with modifiers applied (without tracking stats).
   * Pass {@link DamageCalculationContext} for charged-attack-only equipment bonuses.
   */
  calculateDamage(
    amount: number,
    damageElement?: Element,
    context?: DamageCalculationContext,
  ): number {
    const element = damageElement || this.character.element;

    let damage = amount;
    this.effects
      .filter((effect) => effect.type === EffectType.OutgoingDamage)
      .filter((effect) => effect.appliesToDamageElement(element))
      .forEach((effect) => {
        damage *= effect.amount;
      });

    if (context?.chargedAttack) {
      this.effects
        .filter((effect) => effect.type === EffectType.ChargedOutgoingDamage)
        .forEach((effect) => {
          damage *= effect.amount;
        });
      const sp = context.skillPointsSpent ?? 0;
      if (sp > 0) {
        this.effects
          .filter((effect) => effect.type === EffectType.ChargedSkillPointScaling)
          .forEach((effect) => {
            damage *= 1 + effect.amount * sp;
          });
      }
    }

    if (context?.ultimateAttack) {
      this.effects
        .filter((effect) => effect.type === EffectType.UltimateOutgoingDamage)
        .forEach((effect) => {
          damage *= effect.amount;
        });
    }

    return round2(Math.max(0, damage));
  }

  /**
   * Calculate and track outgoing damage with modifiers applied
   */
  dealDamage(
    amount: number,
    damageElement?: Element,
    context?: DamageCalculationContext,
  ): number {
    const damage = this.calculateDamage(amount, damageElement, context);
    this.stats.damageDealt = round2(this.stats.damageDealt + damage);
    return damage;
  }

  /**
   * Apply an effect. By default, an existing effect with the same name has its duration
   * refreshed (longest-of) and no new instance is added. When the incoming effect has
   * `stackable === true`, it is appended as a separate copy so multiple identical effects
   * coexist (e.g. two of the same equipment each contribute their own multiplier).
   */
  /**
   * Apply an effect. By default, an existing effect with the same name has its duration
   * refreshed (longest-of) and no new instance is added. When the incoming effect has
   * `stackable === true`, it is appended as a separate copy so multiple identical effects
   * coexist (e.g. two of the same equipment each contribute their own multiplier).
   *
   * Effects are always cloned before being pushed so the per-instance state we mutate
   * (duration ticks down, etc.) can't bleed back into the shared source definition.
   */
  removeEffectsByName(name: string): void {
    this.effects = this.effects.filter((e) => e.name !== name);
  }

  addEffect(effect: Effect) {
    if (effect.stackable && effect.metadata?.maxStacks !== undefined) {
      const stacks = this.effects.filter((e) => e.name === effect.name);
      if (stacks.length >= effect.metadata.maxStacks) {
        stacks.forEach((e) => {
          if (effect.duration > e.duration) {
            // eslint-disable-next-line no-param-reassign
            e.duration = effect.duration;
          }
        });
        return;
      }
    }
    if (!effect.stackable) {
      const existingEffect = this.effects.find((e) => e.name === effect.name && !e.stackable);
      if (existingEffect) {
        if (effect.duration > existingEffect.duration) {
          existingEffect.duration = effect.duration;
        }
        return;
      }
    }
    this.effects.push(effect.clone());
    const verb = effect.positive ? 'gained' : 'was inflicted with';
    this.battle.logEvent(`${this.character.name} ${verb} [${effect.name}]`);
  }

  /**
   * Process end of turn: reduce effect durations, remove expired effects
   */
  processEndOfTurn() {
    this.equipments.forEach((equipment) => {
      equipment.onTurnEnd?.(this);
    });

    this.processBurnTicks();

    this.effects.forEach((effect) => {
      // eslint-disable-next-line no-param-reassign
      effect.duration -= 1;
    });

    this.effects = this.effects.filter((effect) => effect.duration > 0);
  }

  /** Sum per-stack {@link EffectType.Burn} damage and apply as elemental DoT (no attacker). */
  private processBurnTicks(): void {
    if (this.isKnockedOut) return;

    const burnStacks = this.effects.filter((effect) => effect.type === EffectType.Burn);
    if (burnStacks.length === 0) return;

    const totalDamage = round2(burnStacks.reduce((sum, effect) => sum + effect.amount, 0));
    if (totalDamage <= 0) return;

    const element = burnStacks[0].metadata?.appliesToElement ?? Element.Pyro;
    this.battle.logEvent(`${this.character.name} took ${totalDamage} pyro damage from [Burn]`);
    this.takeDamage(totalDamage, element, null);
  }

  /**
   * Gain energy (combat and effects). Applies EnergyGain multipliers on self.
   */
  gainEnergy(amount: number) {
    let amt = amount;
    this.effects
      .filter((effect) => effect.type === EffectType.EnergyGain)
      .forEach((effect) => {
        amt = Math.max(0, Math.floor(amt * effect.amount));
      });
    this.energy += amt;
  }

  /**
   * Spend energy for ultimates
   */
  spendEnergy(amount: number) {
    this.energy = Math.max(0, this.energy - amount);
  }

  useAttack() {
    this.stats.attacksUsed += 1;
  }

  useAbility() {
    this.stats.abilitiesUsed += 1;
  }

  /**
   * Called after skill.useSkill resolves (same behavior as the legacy useSkill tail).
   */
  onSkillCompleted(skill: Skill, target: CharacterInBattle | null) {
    if (skill.damage > 0) {
      this.useAttack();

      if (target && this.battle.opponent(this.side).includes(target)) {
        this.triggerAttackAbilities(target);
      }
    } else {
      this.useAbility();
    }
  }

  /**
   * Trigger abilities that activate after attacking an opponent
   */
  private triggerAttackAbilities(attackedTarget: CharacterInBattle) {
    this.character.abilities.forEach((ability) => {
      const context = {
        character: this,
        getAllies: () => this.battle.ally(this.side),
        getAllCards: () => this.battle.allCards(),
        target: attackedTarget,
      };
      ability.applyEffects(context);
    });
  }

  /**
   * Slot index of this character on their team (0-based)
   */
  slotIndexOnSide(): number {
    return this.battle.ally(this.side).indexOf(this);
  }

  toString(): string {
    const statusParts = [this.character.name, `HP: ${this.currentHp}/${this.character.hp}`, `Energy: ${this.energy}`];

    if (this.isKnockedOut) {
      statusParts.push('[KNOCKED OUT]');
    }

    const status = statusParts.join(', ');
    const lines: string[] = [status];

    if (this.equipments.length > 0) {
      const equipStr = this.equipments.map((e) => e.name).join(', ');
      lines.push(`  Equipped: ${equipStr}`);
    }

    if (this.effects.length > 0) {
      const effectsStr = this.effects.map((e) => e.toString()).join('\n  ');
      lines.push(`  Effects: \n  ${effectsStr}`);
    }

    const activeSkills = this.getActiveSkills();
    if (activeSkills.length > 0) {
      const skillsStr = activeSkills
        .map((s) => {
          const idx = this.character.skills.indexOf(s);
          return `${idx}: ${s.toString()}`;
        })
        .join('\n  ');
      lines.push(`  Active skills:\n  ${skillsStr}`);
    }

    return lines.join('\n');
  }

  getActiveSkillsString(): string {
    const activeSkills = this.getActiveSkills();
    return activeSkills
      .map((s) => {
        const idx = this.character.skills.indexOf(s);
        return `${idx}: ${s.toString()}`;
      })
      .join('; ');
  }
}
