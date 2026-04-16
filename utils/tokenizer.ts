import { encode as encodeCl100k } from 'gpt-tokenizer';
import { getGeminiAI } from './ai';
import { getCalibrationMultiplier } from './tokenCalibration';

// Real BPE tokenizer (GPT-4 cl100k_base). Not vocab-exact for nemotron/grok,
// but within ~10% on typical text — orders of magnitude better than char/4.
// Per-model drift is corrected by tokenCalibration against usage.prompt_tokens.
function countTokensOpenRouter(text: string): number {
  try {
    return encodeCl100k(text).length;
  } catch {
    return Math.ceil(text.length / 3);
  }
}

function countTokensOpenRouterMessages(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    // ~4 tokens overhead per message for role/formatting
    total += 4 + countTokensOpenRouter(msg.content);
  }
  return total;
}

async function countTokensGemini(model: string, text: string): Promise<number> {
  try {
    const genAI = getGeminiAI();
    const modelClient = genAI.getGenerativeModel({ model });
    const result = await modelClient.countTokens(text);
    return result.totalTokens;
  } catch (err) {
    console.error(`[countTokensGemini] Failed for model ${model}:`, err);
    return Math.ceil(text.length / 4);
  }
}

async function countTokensGeminiMessages(
  model: string,
  messages: { role: string; message: string }[],
): Promise<number> {
  const combined = messages.map((m) => m.message).join('\n');
  return countTokensGemini(model, combined);
}

// Provider-agnostic token counter for history
export interface TokenBudget {
  maxTokens: number;
  usedTokens: number;
  percentage: number;
}

export interface ContextWarning {
  level: 50 | 75 | 95;
  message: string;
  wasTrimmed: boolean;
  trimmedCount: number;
}

const CONTEXT_LIMITS: Record<string, number> = {
  // Gemini models
  'gemini-3-flash-preview': 1_000_000,
  'gemini-2.0-flash-preview-image-generation': 8_192,
  // OpenRouter models
  'x-ai/grok-4.1-fast': 2_000_000,
  // Spec says 262k but the :free tier caps well below that in practice.
  // Calibration further narrows the effective budget based on real usage.
  'nvidia/nemotron-3-super-120b-a12b:free': 131_072,
  'xiaomi/mimo-v2-flash:nitro': 256_000,
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': 32_768,
  // Default for unknown models
  default: 128_000,
};

function getContextLimit(model: string): number {
  return CONTEXT_LIMITS[model] || CONTEXT_LIMITS.default;
}

// Reserve tokens for system prompt + new user message + response
// Dynamic reserve: 10% of context, clamped between 1024 and 8192
function computeReservedTokens(contextSize: number): number {
  return Math.min(8_192, Math.max(1_024, Math.floor(contextSize * 0.1)));
}

/**
 * Trims history from the oldest messages to fit within the token budget.
 * Returns the trimmed history and context usage info.
 */
async function trimHistoryToFit(
  provider: string,
  model: string,
  systemPrompt: string,
  history: { role: string; message: string }[],
  newPrompt: string,
): Promise<{ trimmedHistory: typeof history; budget: TokenBudget; warnings: ContextWarning[] }> {
  const contextLimit = getContextLimit(model);
  const reserved = computeReservedTokens(contextLimit);
  const rawAvailable = contextLimit - reserved;
  // Shrink budget by the calibrated drift factor for this model (openrouter only).
  const calibration = provider === 'openrouter' ? getCalibrationMultiplier(model) : 1.0;
  const availableForHistory = Math.floor(rawAvailable / calibration);

  let systemTokens: number;
  let promptTokens: number;

  if (provider === 'gemini') {
    [systemTokens, promptTokens] = await Promise.all([
      countTokensGemini(model, systemPrompt),
      countTokensGemini(model, newPrompt),
    ]);
  } else {
    systemTokens = countTokensOpenRouter(systemPrompt);
    promptTokens = countTokensOpenRouter(newPrompt);
  }

  const fixedTokens = systemTokens + promptTokens;
  const budgetForHistory = Math.max(0, availableForHistory - fixedTokens);

  if (fixedTokens > contextLimit) {
    throw new Error(
      `System prompt + user prompt (${fixedTokens.toLocaleString()} tokens) exceeds context limit (${contextLimit.toLocaleString()} tokens) for model ${model}`,
    );
  }

  // Count tokens for each history message and trim from oldest
  let messageCosts: number[];
  if (provider === 'gemini') {
    messageCosts = await Promise.all(
      history.map((msg) => countTokensGemini(model, msg.message)),
    );
  } else {
    messageCosts = history.map((msg) => countTokensOpenRouter(msg.message) + 4);
  }

  // Trim from the start (oldest) until we fit
  let totalHistoryTokens = messageCosts.reduce((a, b) => a + b, 0);
  let startIndex = 0;

  while (totalHistoryTokens > budgetForHistory && startIndex < history.length) {
    totalHistoryTokens -= messageCosts[startIndex];
    startIndex += 1;
  }

  const trimmedHistory = history.slice(startIndex);
  const usedTokens = fixedTokens + totalHistoryTokens;
  const percentage = Math.round((usedTokens / contextLimit) * 100);

  const warnings: ContextWarning[] = [];
  const wasTrimmed = startIndex > 0;
  const trimmedCount = startIndex;
  let warningLevel: 50 | 75 | 95 | null = null;
  if (percentage >= 95) warningLevel = 95;
  else if (percentage >= 75) warningLevel = 75;
  else if (percentage >= 50) warningLevel = 50;

  if (warningLevel) {
    const trimNote = wasTrimmed ? ` Trimmed ${trimmedCount} old message${trimmedCount === 1 ? '' : 's'}.` : '';
    warnings.push({
      level: warningLevel,
      message: `Context is **${percentage}%** full (${usedTokens.toLocaleString()}/${contextLimit.toLocaleString()} tokens).${trimNote}`,
      wasTrimmed,
      trimmedCount,
    });
  } else if (wasTrimmed) {
    warnings.push({
      level: 50,
      message: `Trimmed ${trimmedCount} old message${trimmedCount === 1 ? '' : 's'} to fit context (${usedTokens.toLocaleString()}/${contextLimit.toLocaleString()} tokens).`,
      wasTrimmed,
      trimmedCount,
    });
  }

  return {
    trimmedHistory,
    budget: { maxTokens: contextLimit, usedTokens, percentage },
    warnings,
  };
}

export {
  countTokensOpenRouter,
  countTokensOpenRouterMessages,
  countTokensGemini,
  countTokensGeminiMessages,
  getContextLimit,
  trimHistoryToFit,
};
