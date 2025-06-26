const SkillEffectType = {
  SELF: 0,
  SINGLE_ALLY: 1,
  ALL_ALLIES: 2,
  SINGLE_OPPONENT: 3,
  ALL_OPPONENTS: 4,
};

class SkillEffect {
  constructor(type, effect) {
    this.type = type;
    this.effect = effect;
  }
}

module.exports = { SkillEffect, SkillEffectType };
