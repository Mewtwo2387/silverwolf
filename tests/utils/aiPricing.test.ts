import { describe, test, expect } from 'bun:test';
import {
  creditsForTokens,
  usdCostForTokens,
  CREDIT_BASE_USD_PER_MILLION,
} from '../../utils/aiPricing';

describe('creditsForTokens', () => {
  test('bills unknown models at 1x/1x (legacy raw-token behavior)', () => {
    expect(creditsForTokens('some/unknown-model', 1000, 500)).toBe(1500);
  });

  test('bills deepseek-v4-flash at 0.5x in / 1x out', () => {
    expect(creditsForTokens('deepseek/deepseek-v4-flash', 100000, 50000)).toBe(100000);
  });

  test('bills mimo-v2.5 at 0.5x in / 1x out', () => {
    expect(creditsForTokens('xiaomi/mimo-v2.5', 100000, 50000)).toBe(100000);
  });

  test('bills grok-4.5 at 7x in / 21.43x out ($2/M in, $6/M out)', () => {
    expect(creditsForTokens('x-ai/grok-4.5', 10000, 10000)).toBe(284300);
  });

  test('bills gpt-5.6-luna at 3.5x in / 21.43x out ($1/M in, $6/M out)', () => {
    expect(creditsForTokens('openai/gpt-5.6-luna', 10000, 10000)).toBe(249300);
  });
});

describe('usdCostForTokens', () => {
  test('derives USD from credits at the $0.28/M base rate', () => {
    // 1M in @0.5x + 1M out @1x = 1.5M credits → $0.42
    expect(usdCostForTokens('deepseek/deepseek-v4-flash', 1_000_000, 1_000_000))
      .toBeCloseTo(1.5 * CREDIT_BASE_USD_PER_MILLION, 10);
  });

  test('1x model: 1M tokens costs exactly the base rate', () => {
    expect(usdCostForTokens('unknown/model', 1_000_000, 0))
      .toBeCloseTo(CREDIT_BASE_USD_PER_MILLION, 10);
  });
});
