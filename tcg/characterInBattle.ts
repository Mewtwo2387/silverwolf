import { EffectType } from './effectType';
import { Character } from './character';
import { Battle } from './battle';
import { Effect } from './effect';
import { Skill } from './skill';
import { Element } from './element';

/**
 * A single character and their status in a battle
 * @param character - The character class, which includes its base stats and skills/abilities
 * @param battle - The battle
 * @param side - Ally side or opponent side
 * @param currentHp - Current HP of the character
 * @param effects - List of effects active on the character
 * @param stats - Statistics such as damage dealt
 * @param isKnockedOut - Whether the character is knocked out
 * @param energy - Current energy available to use skills
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
  hasUsedSkillThisTurn: boolean;

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
    this.energy = 0; // Start with 0 energy
    this.hasUsedSkillThisTurn = false;
  }

  /**
   * Get the active skills for this character (based on current form)
   * If a form change effect is active, uses the skill indices specified in the effect metadata
   * Otherwise, uses the character's defaultActiveSkillIndices, or all skills if not specified
   */
  getActiveSkills(): Skill[] {
    // Check if we have a form change effect active
    const formChangeEffect = this.effects.find(effect => effect.type === EffectType.FormChange);
    
    if (formChangeEffect && formChangeEffect.metadata?.activeSkillIndices) {
      // Use the skill indices specified in the form change effect metadata
      return formChangeEffect.metadata.activeSkillIndices
        .map(index => this.character.skills[index])
        .filter(skill => skill !== undefined);
    }
    
    // Default form: use character's defaultActiveSkillIndices if specified, otherwise all skills
    if (this.character.defaultActiveSkillIndices) {
      return this.character.defaultActiveSkillIndices
        .map(index => this.character.skills[index])
        .filter(skill => skill !== undefined);
    }
    
    // Fallback: return all skills if no defaults specified
    return this.character.skills;
  }

  /**
   * Get a skill by index from active skills
   * Note: This uses the index within active skills, not the character's full skill array
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
   * Check if this character can use a skill (has enough energy and hasn't used a skill this turn)
   */
  canUseSkill(skillIndex: number): boolean {
    if (this.isKnockedOut) return false;
    if (this.hasUsedSkillThisTurn) return false; // Already used a skill this turn
    const skill = this.getActiveSkill(skillIndex);
    if (!skill) return false;
    return this.energy >= skill.cost;
  }

  /**
   * Take damage from an attacker
   * @param amount - Base damage amount
   * @param damageElement - Element type of the damage (defaults to character's element if not specified)
   */
  takeDamage(amount: number, damageElement?: Element) {
    if (this.isKnockedOut) return;
    
    // Default to attacker's element if not specified (for backwards compatibility)
    const element = damageElement || this.character.element;
    
    let damage = amount;
    this.effects
      .filter((effect) => effect.type === EffectType.IncomingDamage)
      .filter((effect) => effect.appliesToDamageElement(element))
      .forEach((effect) => {
        damage *= effect.amount;
      });
    this.currentHp -= Math.max(0, damage); // Ensure non-negative
    this.stats.damageReceived += Math.max(0, damage);
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.isKnockedOut = true;
    }
  }

  heal(amount: number) {
    if (this.isKnockedOut) return;
    this.currentHp += amount;
    if (this.currentHp > this.character.hp) this.currentHp = this.character.hp;
  }

  /**
   * Calculate outgoing damage with modifiers applied (without tracking stats)
   * Use this to calculate damage amount before dealing it
   * @param amount - Base damage amount
   * @param damageElement - Element type of the damage being dealt (defaults to character's element)
   * @returns Modified damage amount
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
    return Math.max(0, damage);
  }

  /**
   * Calculate and track outgoing damage with modifiers applied
   * @param amount - Base damage amount
   * @param damageElement - Element type of the damage being dealt (defaults to character's element)
   * @returns Modified damage amount
   */
  dealDamage(amount: number, damageElement?: Element): number {
    const damage = this.calculateDamage(amount, damageElement);
    this.stats.damageDealt += damage;
    return damage;
  }

  addEffect(effect: Effect) {
    // Check if an effect with the same name already exists
    const existingEffect = this.effects.find(e => e.name === effect.name);
    
    if (existingEffect) {
      // If the new effect has a longer duration, update the existing effect's duration
      // Otherwise, keep the existing effect with its current duration
      if (effect.duration > existingEffect.duration) {
        existingEffect.duration = effect.duration;
      }
      // Don't add a duplicate - the existing effect is already in the list
    } else {
      // No existing effect with this name, add the new one
      this.effects.push(effect);
    }
  }

  /**
   * Process end of turn: reduce effect durations, remove expired effects
   */
  processEndOfTurn() {
    // Reduce duration of all effects
    this.effects.forEach(effect => {
      effect.duration -= 1;
    });

    // Remove expired effects (form changes will automatically revert when effect expires)
    this.effects = this.effects.filter(effect => effect.duration > 0);
  }

  /**
   * Roll 2d6 (two six-sided dice)
   * Returns a value between 2 and 12
   */
  private roll2d6(): number {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return die1 + die2;
  }

  /**
   * Gain energy (typically at start of turn)
   */
  gainEnergy(amount: number) {
    this.energy += amount;
  }

  /**
   * Spend energy for using a skill
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
   * Process the start of a new turn
   * @returns The amount of energy gained from the 2d6 roll (after modifiers)
   */
  nextTurn(): number {
    this.stats.turnsActive += 1;
    let energyGained = this.roll2d6();
    
    // Apply energy gain modifiers
    this.effects
      .filter((effect) => effect.type === EffectType.EnergyGain)
      .forEach((effect) => {
        energyGained = Math.max(0, Math.floor(energyGained * effect.amount));
      });
    
    this.gainEnergy(energyGained);
    this.hasUsedSkillThisTurn = false; // Reset skill usage for new turn
    return energyGained;
  }

  /**
   * Use a skill by its original index in the character's skill array.
   * Returns true if successful, false otherwise.
   */
  useSkill(originalSkillIndex: number, target: CharacterInBattle | null): boolean {
    if (this.isKnockedOut) return false;
    
    // Check if character has already used a skill this turn
    if (this.hasUsedSkillThisTurn) {
      return false; // Already used a skill this turn
    }
    
    // Get skill by original index
    const skill = this.getSkillByOriginalIndex(originalSkillIndex);
    if (!skill) return false;

    // Check if skill is available in current form
    const activeSkills = this.getActiveSkills();
    if (!activeSkills.includes(skill)) {
      return false; // Skill not available in current form
    }

    // Check energy cost
    if (this.energy < skill.cost) {
      return false;
    }

    // Spend energy
    this.spendEnergy(skill.cost);

    // Use the skill
    skill.useSkill(this, target);

    // Mark that this character has used a skill this turn
    this.hasUsedSkillThisTurn = true;

    // Track usage
    if (skill.damage > 0) {
      this.useAttack();
      
      // Trigger abilities after attacking an opponent
      if (target && this.battle.opponent(this.side).includes(target)) {
        this.triggerAttackAbilities(target);
      }
    } else {
      this.useAbility();
    }

    return true;
  }

  /**
   * Trigger abilities that activate after attacking an opponent
   */
  private triggerAttackAbilities(attackedTarget: CharacterInBattle) {
    this.character.abilities.forEach(ability => {
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
   * Get a string representation of this character in battle
   * Includes all relevant information: name, HP, energy, status flags, effects, and active skills
   */
  toString(): string {
    const statusParts = [
      this.character.name,
      `HP: ${this.currentHp}/${this.character.hp}`,
      `Energy: ${this.energy}`
    ];
    
    if (this.hasUsedSkillThisTurn) {
      statusParts.push('[USED SKILL]');
    }
    
    if (this.isKnockedOut) {
      statusParts.push('[KNOCKED OUT]');
    }

    const status = statusParts.join(', ');
    const lines: string[] = [status];
    
    // Add effects if any
    if (this.effects.length > 0) {
      const effectsStr = this.effects.map(e => e.toString()).join('\n  ');
      lines.push(`  Effects: \n  ${effectsStr}`);
    }
    
    // Add active skills
    const activeSkills = this.getActiveSkills();
    if (activeSkills.length > 0) {
      const skillsStr = activeSkills.map((s, i) => {
        const idx = this.character.skills.indexOf(s);
        return `${idx}: ${s.toString()}`;
      }).join('\n  ');
      lines.push(`  Active skills:\n  ${skillsStr}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get a string representation of active skills for this character
   * Kept for backward compatibility, but toString() now includes this
   */
  getActiveSkillsString(): string {
    const activeSkills = this.getActiveSkills();
    return activeSkills.map((s, i) => {
      const idx = this.character.skills.indexOf(s);
      return `${idx}: ${s.toString()}`;
    }).join('; ');
  }
}
