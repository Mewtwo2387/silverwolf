import { describe, test, expect } from 'bun:test';
import {
  creditsForImages,
  creditsForTokens,
  usdCostForImages,
  usdCostForTokens,
  CREDIT_BASE_USD_PER_MILLION,
} from '../../utils/aiPricing';

describe('creditsForTokens', () => {
  test('bills unknown models at 1x/1x (legacy raw-token behavior)', () => {
    expect(creditsForTokens('some/unknown-model', 1000, 500)).toBe(1500);
  });

  test('bills deepseek-v4-flash-vision at peak rate: 1.58x in / 4.72x out', () => {
    expect(creditsForTokens('deepseek/deepseek-v4-flash-vision-exp', 100000, 50000))
      .toBeCloseTo(394000, 6);
  });

  test('bills mimo-v2.5 at 0.5x in / 1x out', () => {
    expect(creditsForTokens('xiaomi/mimo-v2.5', 100000, 50000)).toBe(100000);
  });

  test('bills grok-4.5 at 7x in / 21.43x out ($2/M in, $6/M out)', () => {
    expect(creditsForTokens('x-ai/grok-4.5', 10000, 10000)).toBe(284300);
  });

  test('bills gpt-5.6-luna at 0.72x in / 4.3x out ($0.20/M in, $1.2/M out)', () => {
    expect(creditsForTokens('openai/gpt-5.6-luna', 10000, 10000)).toBe(50200);
  });

  test('bills qwen3.7-flash at 0.11x in / 0.46x out ($0.03/M in, $0.13/M out)', () => {
    expect(creditsForTokens('qwen/qwen3.7-flash', 10000, 10000)).toBeCloseTo(5700, 6);
  });

  test('free models cost nothing', () => {
    expect(creditsForTokens('openrouter/free', 1_000_000, 1_000_000)).toBe(0);
  });
});

describe('usdCostForTokens', () => {
  test('derives USD from credits at the $0.28/M base rate', () => {
    // 1M in @1.58x + 1M out @4.72x = 6.3M credits → $1.764
    expect(usdCostForTokens('deepseek/deepseek-v4-flash-vision-exp', 1_000_000, 1_000_000))
      .toBeCloseTo(6.3 * CREDIT_BASE_USD_PER_MILLION, 10);
  });

  test('1x model: 1M tokens costs exactly the base rate', () => {
    expect(usdCostForTokens('unknown/model', 1_000_000, 0))
      .toBeCloseTo(CREDIT_BASE_USD_PER_MILLION, 10);
  });
});

describe('image pricing', () => {
  const IMAGE_MODEL = 'google/gemini-3.1-flash-lite-image';

  test('Nano Banana 2 Lite bills its list price per image', () => {
    expect(usdCostForImages(IMAGE_MODEL)).toBeCloseTo(0.03363, 10);
    expect(usdCostForImages(IMAGE_MODEL, 3)).toBeCloseTo(0.10089, 10);
  });

  test('credits are the list price at the $0.28/M base, times the 1.5x surcharge', () => {
    // 0.03363 / 0.00000028 = 120107.142... credits at 1x, x1.5 = 180160.71...
    expect(creditsForImages(IMAGE_MODEL)).toBeCloseTo(180160.714, 3);
    expect(creditsForImages(IMAGE_MODEL, 2)).toBeCloseTo(360321.4286, 3);
  });

  test('unpriced models generate free', () => {
    expect(creditsForImages('some/unknown-image-model')).toBe(0);
    expect(usdCostForImages('some/unknown-image-model')).toBe(0);
  });

  test('zero or negative image counts cost nothing', () => {
    expect(creditsForImages(IMAGE_MODEL, 0)).toBe(0);
    expect(creditsForImages(IMAGE_MODEL, -3)).toBe(0);
  });

  test('fractional and non-finite image counts cost nothing', () => {
    [1.5, NaN, Infinity, -Infinity].forEach((count) => {
      expect(usdCostForImages(IMAGE_MODEL, count)).toBe(0);
      expect(creditsForImages(IMAGE_MODEL, count)).toBe(0);
    });
  });
});
