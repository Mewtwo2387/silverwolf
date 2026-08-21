import path from 'path';
import { describe, test, expect } from 'bun:test';

// utils/log registers the process-level uncaughtException / unhandledRejection
// handlers as an import side effect, so these have to be exercised in a real
// subprocess — asserting on listener counts in-process would not prove the
// thing that actually matters, which is that the process survives.
const LOG_MODULE = path.join(import.meta.dir, '..', '..', 'utils', 'log.ts');

interface RunResult {
  exitCode: number | null;
  stderr: string;
}

/** Runs `body` in a fresh Bun process and reports how it terminated.
 *
 *  Each fixture schedules `process.exit(0)` on a timer: if the rejection is
 *  fatal the process dies first and the exit code is non-zero, and if it is
 *  handled the timer fires and the code is 0. So the exit code alone
 *  distinguishes "survived" from "crashed".
 */
async function run(body: string): Promise<RunResult> {
  const proc = Bun.spawn(['bun', '-e', body], { stdout: 'pipe', stderr: 'pipe' });
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { exitCode, stderr };
}

const importLog = `await import(${JSON.stringify(LOG_MODULE)});`;
const exitLater = 'setTimeout(() => process.exit(0), 500);';

describe('unhandledRejection handler', () => {
  test('an unawaited rejection kills a process that has no handler', async () => {
    // Control case. Without this the test below proves nothing — it would pass
    // just as happily if unhandled rejections were harmless in the first place.
    const { exitCode } = await run(`
      Promise.reject(new Error('control-boom'));
      ${exitLater}
    `);

    expect(exitCode).not.toBe(0);
  });

  test('importing utils/log keeps the process alive and logs the reason', async () => {
    const { exitCode, stderr } = await run(`
      ${importLog}
      Promise.reject(new Error('rejection-boom'));
      ${exitLater}
    `);

    expect(exitCode).toBe(0);
    expect(stderr).toContain('UNHANDLED REJECTION');
    expect(stderr).toContain('rejection-boom');
  });

  test('survives a rejection whose reason is not an Error', async () => {
    // reject() takes any value; logError has to stringify non-Errors rather
    // than reading .stack off undefined.
    const { exitCode, stderr } = await run(`
      ${importLog}
      Promise.reject('plain-string-reason');
      ${exitLater}
    `);

    expect(exitCode).toBe(0);
    expect(stderr).toContain('UNHANDLED REJECTION');
    expect(stderr).toContain('plain-string-reason');
  });

  test('a rejection thrown from an async function is caught too', async () => {
    // The shape the schedulers actually produce: an async fn nobody awaits.
    const { exitCode, stderr } = await run(`
      ${importLog}
      async function automation() { throw new Error('scheduler-boom'); }
      automation();
      ${exitLater}
    `);

    expect(exitCode).toBe(0);
    expect(stderr).toContain('scheduler-boom');
  });
});

describe('uncaughtException handler', () => {
  test('importing utils/log keeps the process alive on a sync throw', async () => {
    const { exitCode, stderr } = await run(`
      ${importLog}
      setTimeout(() => { throw new Error('sync-boom'); }, 50);
      ${exitLater}
    `);

    expect(exitCode).toBe(0);
    expect(stderr).toContain('UNCAUGHT EXCEPTION');
    expect(stderr).toContain('sync-boom');
  });
});
