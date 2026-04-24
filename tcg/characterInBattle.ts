import { EffectType } from './effectType';
import { Character } from './character';
import { Battle } from './battle';
import { Effect } from './effect';
import { Skill } from './skill';
import { Element } from './element';
import { round2 } from '../utils/math';

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
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.isKnockedOut = true;
    }

    if (attacker && attacker !== this) {
      this.gainEnergy(5);
    }
  }

  heal(amount: number) {
    if (this.isKnockedOut) return;
    this.currentHp = round2(this.currentHp + amount);
    if (this.currentHp > this.character.hp) this.currentHp = this.character.hp;
  }

  /**
   * Calculate outgoing damage with modifiers applied (without tracking stats)
   */
  calculateDamage(amount: number, damageElement?: Element): number {
    const element = damageElement || this.character.element;

    let damage = amount;
    this.effects
      .filter((effect) => effect.type === EffectType.OutgoingDamage)
      .filter((effect) => effect.appliesToDamageElement(element))
      .forEach((effect) => {
        damage *= effect.amount;
      });
    return round2(Math.max(0, damage));
  }

  /**
   * Calculate and track outgoing damage with modifiers applied
   */
  dealDamage(amount: number, damageElement?: Element): number {
    const damage = this.calculateDamage(amount, damageElement);
    this.stats.damageDealt = round2(this.stats.damageDealt + damage);
    return damage;
  }

  addEffect(effect: Effect) {
    const existingEffect = this.effects.find((e) => e.name === effect.name);

    if (existingEffect) {
      if (effect.duration > existingEffect.duration) {
        existingEffect.duration = effect.duration;
      }
    } else {
      this.effects.push(effect);
    }
  }

  /**
   * Process end of turn: reduce effect durations, remove expired effects
   */
  processEndOfTurn() {
    this.effects.forEach((effect) => {
      effect.duration -= 1;
    });

    this.effects = this.effects.filter((effect) => effect.duration > 0);
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
