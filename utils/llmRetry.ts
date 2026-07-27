import { logWarning } from './log';

/**
 * Timeout + retry wrapper for OpenRouter chat completions (issue #209).
 *
 * Every attempt gets its own hard timeout (the SDK default is 10 minutes, so a
 * hung provider stalled a reply for ages before erroring). Transient failures
 * — 408/409/429, 5xx, network errors, timeouts — retry with exponential
 * backoff of 2s, 4s, 8s, 16s (16s max), then give up. Non-retryable 4xx
 * (bad request, auth, model rejects tools…) throws immediately so callers'
 * existing error handling (e.g. the tool-reject retry in ai.ts) is unaffected.
 *
 * The shared OpenRouter client is constructed with maxRetries: 0 so the SDK's
 * own retry loop doesn't stack on top of this schedule.
 */

/** Backoff delays between attempts: 2s → 4s → 8s → 16s (max), then error out. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

/** Per-attempt request timeout. Long enough for reasoning models, short enough
 *  that a wedged connection errors instead of hanging for 10 minutes. */
export const DEFAULT_TIMEOUT_MS = 180_000;

/** Is this failure worth retrying? Rate limits, server errors, timeouts and
 *  network failures are; client errors (400/401/402/403/404…) are not. */
export function isRetryableCompletionError(err: any): boolean {
  const status = err?.status;
  // No status = connection/timeout error before an HTTP response arrived.
  if (typeof status !== 'number') return true;
  if (status === 408 || status === 409 || status === 429) return true;
  return status >= 500;
}

interface ChatCompletionsClient {
  chat: {
    completions: {
      create: (body: any, options?: { timeout?: number }) => Promise<any>;
    };
  };
}

interface RetryOptions {
  /** Per-attempt timeout in ms (default DEFAULT_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Backoff schedule in ms (default RETRY_DELAYS_MS). */
  delaysMs?: number[];
  /** Sleep between attempts — injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export async function createChatCompletionWithRetry(
  client: ChatCompletionsClient,
  body: any,
  opts: RetryOptions = {},
): Promise<any> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));

  let lastErr: any;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await client.chat.completions.create(body, { timeout: timeoutMs });
    } catch (err: any) {
      lastErr = err;
      const hasRetryLeft = attempt < delays.length;
      if (!hasRetryLeft || !isRetryableCompletionError(err)) {
        throw err;
      }
      const delay = delays[attempt];
      logWarning(
        `[llm] completion failed (status ${err?.status ?? 'network/timeout'}), `
        + `retrying in ${delay / 1000}s (attempt ${attempt + 1}/${delays.length})`,
      );
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }
  throw lastErr;
}
