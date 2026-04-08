import { encodingForModel } from 'js-tiktoken';
import { getGeminiAI } from './ai';

// OpenRouter token counting via tiktoken (cl100k_base covers GPT-3.5/4 and most OR models)
const tiktoken = encodingForModel('gpt-4o');

function countTokensOpenRouter(text: string): number {
  return tiktoken.encode(text).length;
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
  } catch {
    // Fallback: rough estimate
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
}

const CONTEXT_LIMITS: Record<string, number> = {
  // Gemini models
  'gemini-3-flash-preview': 1_000_000,
  'gemini-2.0-flash-preview-image-generation': 8_192,
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
  const availableForHistory = contextLimit - computeReservedTokens(contextLimit);

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
  if (percentage >= 95) {
    warnings.push({ level: 95, message: `Context is **95%** full (${usedTokens.toLocaleString()}/${contextLimit.toLocaleString()} tokens). Old messages are being trimmed.` });
  } else if (percentage >= 75) {
    warnings.push({ level: 75, message: `Context is **75%** full (${usedTokens.toLocaleString()}/${contextLimit.toLocaleString()} tokens).` });
  } else if (percentage >= 50) {
    warnings.push({ level: 50, message: `Context is **50%** full (${usedTokens.toLocaleString()}/${contextLimit.toLocaleString()} tokens).` });
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
