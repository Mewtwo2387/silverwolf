const fs = require('fs');
const { logError } = require('./log');

function formatFile(inputPath) {
  try {
    const text = fs.readFileSync(inputPath, 'utf8');

    const convertedText = text
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .trim();

    return convertedText;
  } catch (error) {
    logError('Error processing file:', error);
    throw error;
  }
}

function unformatFile(inputPath) {
  try {
    const text = fs.readFileSync(inputPath, 'utf8');

    const convertedText = text
      .replace(/\n/g, '\\n')
      .replace(/"/g, '\\"')
      .replace(/\t/g, '\\t')
      .trim();

    return convertedText;
  } catch (error) {
    logError('Error processing file:', error);
    throw error;
  }
}

module.exports = {
  formatFile,
  unformatFile,
};
