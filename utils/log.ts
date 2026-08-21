import fs from 'fs';
import path from 'path';

const logFilePath = path.join(import.meta.dir, '../persistence/logs.txt');
const logErrorFilePath = path.join(import.meta.dir, '../persistence/logs_error.txt');

function log(message: string): void {
  console.log(message);
  fs.appendFile(logFilePath, `${new Date().toISOString()} - ${message}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

function logError(message: string, error: unknown = ''): void {
  console.error(message, error);
  const errorStack = (error instanceof Error ? error.stack : String(error)) || String(error);
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

function logWarning(message: string): void {
  console.warn(message);
  fs.appendFile(logFilePath, `${new Date().toISOString()} - WARNING: ${message}\n`, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

function handleUncaughtException(error: Error): void {
  logError('----- UNCAUGHT EXCEPTION: -----', error);
}

// A rejected promise nobody awaited is fatal by default — the process exits
// with code 1 and Docker restarts the bot. That is far too blunt for this
// codebase: schedulers, keyword handlers and the interaction dispatcher all
// fire async work that nobody awaits, so one failed Discord or DB call would
// take the whole bot (and the website it hosts) down. Log and keep serving,
// mirroring the uncaughtException handler above.
//
// `reason` is whatever was passed to reject() — not necessarily an Error —
// so it is typed as unknown and logError stringifies non-Errors.
function handleUnhandledRejection(reason: unknown): void {
  logError('----- UNHANDLED REJECTION: -----', reason);
}

process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);
log('Catching uncaught exceptions and unhandled rejections...');

export {
  log,
  logError,
  logWarning,
  logErrorFilePath,
  logFilePath,
};
