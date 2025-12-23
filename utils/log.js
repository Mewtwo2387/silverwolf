const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../logs.txt');
const logErrorFilePath = path.join(__dirname, '../logs_error.txt');

function log(message) {
  console.log(message); // Log to console
  fs.appendFile(logFilePath, `${new Date().toISOString()} - ${message}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  }); // Log to file asynchronously
}

function logError(message, error = '') {
  console.error(message, error);
  const errorStack = error.stack || error;
  fs.appendFile(logFilePath, `${new Date().toISOString()} - ERROR: ${message}\n${errorStack}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
  fs.appendFile(logErrorFilePath, `${new Date().toISOString()} - ERROR: ${message}\n${errorStack}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

function logWarning(message) {
  console.warn(message);
  fs.appendFile(logFilePath, `${new Date().toISOString()} - WARNING: ${message}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

function handleUncaughtException(error) {
  logError('----- UNCAUGHT EXCEPTION: -----', error);
}

process.on('uncaughtException', handleUncaughtException);
log('Catching uncaught exceptions...');

module.exports = {
  log,
  logError,
  logWarning,
  logErrorFilePath,
  logFilePath,
};
