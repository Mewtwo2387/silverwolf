import fs from 'fs';
import { logError } from './log';

function formatFile(inputPath: string): string {
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

function unformatFile(inputPath: string): string {
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

export {
  formatFile,
  unformatFile,
};
