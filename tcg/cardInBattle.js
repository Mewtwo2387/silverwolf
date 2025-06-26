const { EffectType } = require('./effect');

class CardInBattle {
  constructor(card) {
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
  }

  takeDamage(amount) {
    let damage = amount;
    this.effects.filter((effect) => effect.type === EffectType.INCOMING_DAMAGE).forEach((effect) => {
      damage *= effect.amount;
    });
    this.currentHp -= damage;
    this.stats.damageReceived += damage;
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.isKnockedOut = true;
    }
  }

  heal(amount) {
    this.currentHp += amount;
    if (this.currentHp > this.card.hp) this.currentHp = this.card.hp;
  }

  dealDamage(amount) {
    let damage = amount;
    this.effects.filter((effect) => effect.type === EffectType.OUTGOING_DAMAGE).forEach((effect) => {
      damage *= effect.amount;
    });
    this.stats.damageDealt += damage;
    return damage;
  }

  addEffect(effect) {
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
}

module.exports = CardInBattle;
