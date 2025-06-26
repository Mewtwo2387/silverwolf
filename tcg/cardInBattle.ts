import { EffectType } from './effectType';
import { Card } from './card';
import { Battle } from './battle';
import { Effect } from './effect';

export class CardInBattle {
  card: Card;
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

  constructor(card: Card, battle: Battle, side: string) {
    this.card = card;
    this.currentHp = card.hp;
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
    if (this.currentHp > this.card.hp) this.currentHp = this.card.hp;
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

  useSkill(skillIndex: number, target: CardInBattle) {
    const skill = this.card.skills[skillIndex];
    skill.useSkill(this, target);
  }
}
