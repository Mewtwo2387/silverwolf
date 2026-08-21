import { log } from './log';

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
 * The whole operation is bounded by an overall deadline (default 10 minutes —
 * the SDK's previous single-request timeout): each attempt gets
 * min(per-attempt timeout, remaining budget), and retries stop once the budget
 * is spent, so a pathologically slow provider can't hold a reply hostage
 * longer than one old-style request would have.
 *
 * The shared OpenRouter client is constructed with maxRetries: 0 so the SDK's
 * own retry loop doesn't stack on top of this schedule.
 */

/** Backoff delays between attempts: 2s → 4s → 8s → 16s (max), then error out. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

/** Per-attempt request timeout. Long enough for reasoning models, short enough
 *  that a wedged connection errors instead of hanging for 10 minutes. */
export const DEFAULT_TIMEOUT_MS = 180_000;

/** Overall elapsed-time budget for the whole retry operation — the SDK's
 *  previous single-request timeout (10 minutes). */
export const DEFAULT_OVERALL_TIMEOUT_MS = 600_000;

/** Hard ceiling on any single attempt, imposed by the runtime rather than by us.
 *
 *  Bun 1.4 made the fetch idle timeout an *absolute* 300s deadline for receiving
 *  response headers, and a non-streaming completion sends no headers until the
 *  model has finished generating. There is no per-call override — `timeout` is
 *  not part of `BunFetchRequestInit`, and the request goes through the OpenAI
 *  SDK regardless — so any per-attempt timeout above 300s is unreachable.
 *
 *  We clamp slightly under it so the attempt trips *our* AbortSignal and
 *  surfaces a classifiable SDK timeout, instead of racing Bun's deadline and
 *  surfacing an opaque network error. Callers asking for more get this. */
export const MAX_ATTEMPT_TIMEOUT_MS = 280_000;

/** Is this failure worth retrying? Rate limits, server errors, timeouts and
 *  network failures are; client errors (400/401/402/403/404…) are not. */
export function isRetryableCompletionError(err: any): boolean {
  const status = err?.status;
  if (typeof status === 'number') {
    if (status === 408 || status === 409 || status === 429) return true;
    return status >= 500;
  }

  if (!err) return false;

  const name = String(err.name || '');
  const code = String(err.code || err.cause?.code || '');
  const message = String(err.message || '').toLowerCase();

  const networkNames = new Set([
    'APIConnectionError',
    'APIConnectionTimeoutError',
    'TimeoutError',
    'AbortError',
    'FetchError',
    'NetworkError',
  ]);
  if (networkNames.has(name)) return true;

  const networkCodes = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'EAI_AGAIN',
    'ABORT_ERR',
    'ERR_NETWORK',
  ]);
  if (networkCodes.has(code)) return true;

  if (
    message.includes('fetch failed')
    || message.includes('timeout')
    || message.includes('network')
    || message.includes('connection')
    || message.includes('econnreset')
    || message.includes('etimedout')
  ) {
    return true;
  }

  return false;
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
  /** Total elapsed-time budget across all attempts in ms
   *  (default DEFAULT_OVERALL_TIMEOUT_MS). */
  overallTimeoutMs?: number;
  /** Backoff schedule in ms (default RETRY_DELAYS_MS). */
  delaysMs?: number[];
  /** Sleep between attempts — injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Validates an explicitly-supplied per-attempt timeout, then applies the ceiling.
 *
 *  Without the guard a `NaN` survives `Math.min`/`Math.max` all the way into the
 *  SDK as `timeout: NaN`, and a zero or negative value collapses to a 1ms timeout
 *  that fails every attempt instantly — both of which look like flaky upstreams
 *  rather than the caller bugs they are. Callers pass module constants today, so
 *  this is about failing loudly if that ever stops being true.
 */
function resolveAttemptTimeout(requested: number | undefined): number {
  if (requested === undefined) return Math.min(DEFAULT_TIMEOUT_MS, MAX_ATTEMPT_TIMEOUT_MS);
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new TypeError(`timeoutMs must be a positive integer number of milliseconds, got ${requested}`);
  }
  return Math.min(requested, MAX_ATTEMPT_TIMEOUT_MS);
}

export async function createChatCompletionWithRetry(
  client: ChatCompletionsClient,
  body: any,
  opts: RetryOptions = {},
): Promise<any> {
  const timeoutMs = resolveAttemptTimeout(opts.timeoutMs);
  const deadline = Date.now() + (opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS);
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));

  let lastErr: any;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    // The first attempt always runs; later ones only while budget remains.
    const remaining = deadline - Date.now();
    if (attempt > 0 && remaining <= 0) {
      log(`[llm] overall retry budget exhausted after ${attempt} attempt(s); giving up`);
      break;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      return await client.chat.completions.create(body, {
        timeout: Math.max(1, Math.min(timeoutMs, remaining)),
      });
    } catch (err: any) {
      lastErr = err;
      const hasRetryLeft = attempt < delays.length;
      if (!hasRetryLeft || !isRetryableCompletionError(err)) {
        throw err;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        log(`[llm] overall retry budget exhausted after ${attempt + 1} attempt(s); giving up`);
        break;
      }
      const delay = Math.min(delays[attempt], remainingMs);
      log(
        `[llm] completion failed (status ${err?.status ?? 'network/timeout'}), `
        + `retrying in ${delay / 1000}s (attempt ${attempt + 1}/${delays.length})`,
      );
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }
  throw lastErr;
}
