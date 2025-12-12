import { EffectType } from './effectType';
import { Character } from './character';
import { Battle } from './battle';
import { Effect } from './effect';

/**
 * A single character and their status in a battle
 * @param character - The character class, which includes its base stats and skills/abilities
 * @param battle - The battle
 * @param side - Ally side or opponent side
 * @param currentHp - Current HP of the character
 * @param effects - List of effects active on the character
 * @param stats - Statistics such as damage dealt
 * @param isKnockedOut - Whether the character is knocked out
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
  }

  takeDamage(amount: number) {
    let damage = amount;
    this.effects.filter((effect) => effect.type === EffectType.IncomingDamage).forEach((effect) => {
      damage *= effect.amount;
    });
    this.currentHp -= damage;
    this.stats.damageReceived += damage;
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.isKnockedOut = true;
    }
  }

  heal(amount: number) {
    this.currentHp += amount;
    if (this.currentHp > this.character.hp) this.currentHp = this.character.hp;
  }

  dealDamage(amount: number) {
    let damage = amount;
    this.effects.filter((effect) => effect.type === EffectType.OutgoingDamage).forEach((effect) => {
      damage *= effect.amount;
    });
    this.stats.damageDealt += damage;
    return damage;
  }

  addEffect(effect: Effect) {
    this.effects.push(effect);
  }

  useAttack() {
    this.stats.attacksUsed += 1;
  }

  useAbility() {
    this.stats.abilitiesUsed += 1;
  }

  nextTurn() {
    this.stats.turnsActive += 1;
  }

  useSkill(skillIndex: number, target: CharacterInBattle) {
    const skill = this.character.skills[skillIndex];
    skill.useSkill(this, target);
  }
}
