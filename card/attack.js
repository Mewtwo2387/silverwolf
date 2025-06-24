const { wrapText, calculateWrappedTextHeight, drawWrappedText } = require('./utils/textWrapper');

class Attack {
  constructor(name, description, damage, cost) {
    this.name = name;
    this.description = description;
    this.damage = damage;
    this.cost = cost;
  }

  async generateAttack(ctx, y) {
    let currentY = y;

    // Set up text wrapping parameters
    const maxTextWidth = 800; // Maximum width for text wrapping (leaving space for damage)
    const costLineHeight = 48;
    const descLineHeight = 48;

    // Wrap only the description text
    ctx.font = '48px "Bahnschrift"';
    const descLines = wrapText(ctx, this.description, maxTextWidth);

    // Calculate total height needed
    const nameHeight = 64; // Fixed height for single-line name

    // Add cost height if present
    let costHeight = 0;
    if (this.cost > 0) {
      costHeight = costLineHeight;
    }

    const descHeight = calculateWrappedTextHeight(descLines, descLineHeight);

    // Draw attack name (single line)
    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 64, currentY);

    // Draw damage on the right side
    const damageText = this.damage > 0 ? `${this.damage}` : '--';
    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(damageText, 956, currentY);

    currentY += nameHeight + 16; // Add spacing after name

    // Draw cost if present
    if (this.cost > 0) {
      ctx.font = '48px "Bahnschrift"';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(`Cost: ${this.cost}`, 64, currentY);
      currentY += costHeight + 16; // Add spacing after cost
    }

    // Draw attack description (wrapped)
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    drawWrappedText(ctx, descLines, 64, currentY, descLineHeight);

    currentY += descHeight + 32; // Add padding at bottom

    return currentY;
  }
}

module.exports = Attack;
