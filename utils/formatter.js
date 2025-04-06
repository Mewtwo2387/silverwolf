const fs = require('fs');

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
        throw new Error(`Error processing file: ${error.message}`);
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
        throw new Error(`Error processing file: ${error.message}`);
    }
}

module.exports = {
    formatFile,
    unformatFile
};
