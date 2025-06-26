const EffectType = {
  INCOMING_DAMAGE: 0,
  OUTGOING_DAMAGE: 1,
  FORM_CHANGE: 2,
};

class Effect {
  constructor(name, description, type, amount, duration) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.amount = amount;
    this.duration = duration;
  }
}

module.exports = { Effect, EffectType };
