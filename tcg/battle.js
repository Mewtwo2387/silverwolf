class Battle {
  constructor(p1cards, p2cards) {
    this.p1cards = p1cards;
    this.p2cards = p2cards;
  }

  ally(side) {
    return side === 'p1' ? this.p1cards : this.p2cards;
  }

  opponent(side) {
    return side === 'p1' ? this.p2cards : this.p1cards;
  }
}

module.exports = Battle;
