class Ability {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  async generateAbility(ctx, y) {
    let currentY = y;

    // Calculate text dimensions to size the trapezium appropriately

    ctx.font = '32px "Bahnschrift"';
    const descMetrics = ctx.measureText(this.description);
    ctx.font = '48px "Bahnschrift"';
    const nameMetrics = ctx.measureText(this.name);
    const maxTextWidth = Math.max(nameMetrics.width, descMetrics.width);

    // Trapezium dimensions
    const trapeziumHeight = 120; // Height for both name and description
    const trapeziumTopWidth = maxTextWidth + 128; // Text width + padding
    const trapeziumBottomWidth = trapeziumTopWidth + 64; // Slightly wider at bottom
    const trapeziumLeft = 32; // Starting position
    const trapeziumTop = currentY - 40; // Position above the text

    // Create gradient for trapezium
    const gradient = ctx.createLinearGradient(
      trapeziumLeft,
      trapeziumTop,
      trapeziumLeft + trapeziumBottomWidth,
      trapeziumTop + trapeziumHeight,
    );
    gradient.addColorStop(0, 'rgba(240, 240, 240, 0.8)'); // Translucent light gray at top
    gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.6)'); // More translucent in middle
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0.4)'); // Most translucent at bottom

    // Draw trapezium container with gradient
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(51, 51, 51, 0.7)'; // Semi-transparent dark border
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(trapeziumLeft, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumTopWidth, trapeziumTop);
    ctx.lineTo(trapeziumLeft + trapeziumBottomWidth, trapeziumTop + trapeziumHeight);
    ctx.lineTo(trapeziumLeft, trapeziumTop + trapeziumHeight);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw ability name on top of trapezium
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 64, currentY);

    currentY += 48;

    // Draw ability description on top of trapezium
    ctx.font = '32px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.description, 64, currentY);

    currentY += 64;

    return currentY;
  }
}

module.exports = Ability;
