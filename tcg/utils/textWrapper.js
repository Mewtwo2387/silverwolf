/**
 * Wraps text to fit within a specified width
 * @param {Canvas.CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    const { width } = ctx.measureText(`${currentLine} ${word}`);

    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

/**
 * Calculates the total height needed for wrapped text
 * @param {string[]} lines - Array of text lines
 * @param {number} lineHeight - Height per line in pixels
 * @returns {number} Total height needed
 */
function calculateWrappedTextHeight(lines, lineHeight) {
  return lines.length * lineHeight;
}

/**
 * Draws wrapped text on canvas
 * @param {Canvas.CanvasRenderingContext2D} ctx - Canvas context
 * @param {string[]} lines - Array of text lines
 * @param {number} x - X position
 * @param {number} y - Starting Y position
 * @param {number} lineHeight - Height per line in pixels
 */
function drawWrappedText(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });
}

module.exports = {
  wrapText,
  calculateWrappedTextHeight,
  drawWrappedText,
};
