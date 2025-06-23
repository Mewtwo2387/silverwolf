class Attack {
  constructor(name, description, damage, cost) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.cost = cost;
  }

  async generateAttack(ctx, y) {
    let currentY = y;

    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 64, currentY);

    const damageText = this.damage > 0 ? `${this.damage}` : '--';

    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(damageText, 956, currentY);

    currentY += 64;

    if (this.cost > 0) {
      ctx.font = '48px "Bahnschrift"';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(`Cost: ${this.cost}`, 64, currentY);
      currentY += 48;
    }

    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.description, 64, currentY);
    currentY += 96;

    return currentY;
  }
}

module.exports = Attack;
