const fs = require('fs');
const path = require('path');
const logFilePath = path.join(__dirname, '../logs.txt');

function log(message) {
    console.log(message); // Log to console
    fs.appendFile(logFilePath, `${new Date().toISOString()} - ${message}\n`, (err) => {
        if (err) {
            console.error("Failed to write to log file:", err);
        }
    }); // Log to file asynchronously
}

function logError(message) {
    console.error(message);
    fs.appendFile(logFilePath, `${new Date().toISOString()} - ERROR: ${message}\n`, (err) => {
        if (err) {
            console.error("Failed to write to log file:", err);
        }
    });
}

module.exports = { log, logError };
