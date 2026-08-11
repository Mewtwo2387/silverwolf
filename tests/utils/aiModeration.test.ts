import { describe, expect, test } from 'bun:test';
import { parseModerationOutput } from '../../utils/aiModeration';
import { GLOBAL_CONFIG_KEYS, validateGlobalConfigValue } from '../../utils/globalConfig';

// The four strings below are verbatim responses from
// nvidia/nemotron-3.5-content-safety:free, captured against OpenRouter.
describe('parseModerationOutput', () => {
  test('user-only screen, benign — no Response Safety line', () => {
    expect(parseModerationOutput('User Safety: safe')).toEqual({ safe: true });
  });

  test('full exchange, benign', () => {
    expect(parseModerationOutput('User Safety: safe\nResponse Safety: safe')).toEqual({ safe: true });
  });

  test('user-only screen, unsafe', () => {
    expect(parseModerationOutput(
      'User Safety: unsafe\nSafety Categories: Guns and Illegal Weapons, Criminal Planning/Confessions',
    )).toEqual({
      safe: false,
      flaggedSide: 'user',
      categories: 'Guns and Illegal Weapons, Criminal Planning/Confessions',
    });
  });

  test('full exchange, unsafe on both sides — reports the user side', () => {
    expect(parseModerationOutput(
      'User Safety: unsafe\nResponse Safety: unsafe\nSafety Categories: Harassment, Criminal Planning/Confessions, Violence',
    )).toEqual({
      safe: false,
      flaggedSide: 'user',
      categories: 'Harassment, Criminal Planning/Confessions, Violence',
    });
  });

  test('safe prompt with an unsafe reply is attributed to the response', () => {
    expect(parseModerationOutput('User Safety: safe\nResponse Safety: unsafe\nSafety Categories: Violence')).toEqual({
      safe: false,
      flaggedSide: 'response',
      categories: 'Violence',
    });
  });

  test('strips a reasoning-mode <think> block before reading labels', () => {
    expect(parseModerationOutput(
      '<think>The user is asking about weapons. User Safety: safe is wrong here.</think>\nUser Safety: unsafe',
    )).toEqual({ safe: false, flaggedSide: 'user', categories: undefined });
  });

  test('handles a dangling </think> with no opening tag', () => {
    // Some models emit only the closer because the opener is in the chat
    // template. Everything before it is reasoning that may quote a label.
    expect(parseModerationOutput(
      'The user asks about knives. User Safety: safe would be wrong.\n</think>\nUser Safety: unsafe\nSafety Categories: Violence',
    )).toEqual({ safe: false, flaggedSide: 'user', categories: 'Violence' });
  });

  test('reads the last label occurrence, not the first', () => {
    expect(parseModerationOutput('User Safety: safe\nUser Safety: unsafe')).toEqual({
      safe: false,
      flaggedSide: 'user',
      categories: undefined,
    });
  });

  test('a safe verdict after a dangling think block stays safe', () => {
    expect(parseModerationOutput(
      'Considering whether User Safety: unsafe applies.\n</think>\nUser Safety: safe\nResponse Safety: safe',
    )).toEqual({ safe: true });
  });

  test('fails open on empty or unparseable output', () => {
    expect(parseModerationOutput('')).toEqual({ safe: true });
    expect(parseModerationOutput('   ')).toEqual({ safe: true });
    expect(parseModerationOutput('I cannot classify this.')).toEqual({ safe: true });
    expect(parseModerationOutput('User Safety: perhaps')).toEqual({ safe: true });
  });
});

describe('ai_moderation global config key', () => {
  test('is a 0/1 boolean key', () => {
    expect(validateGlobalConfigValue(GLOBAL_CONFIG_KEYS.AI_MODERATION, '0')).toBeNull();
    expect(validateGlobalConfigValue(GLOBAL_CONFIG_KEYS.AI_MODERATION, '1')).toBeNull();
    expect(validateGlobalConfigValue(GLOBAL_CONFIG_KEYS.AI_MODERATION, 'on')).not.toBeNull();
  });
});
