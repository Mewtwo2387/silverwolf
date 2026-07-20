import { describe, expect, test } from 'bun:test';
import { FOOTBALL_ENABLED_CONFIG_KEY, isFootballEnabled } from '../utils/footballChannels';

function mockDb(value: string | null) {
  return {
    globalConfig: {
      getGlobalConfig: async (key: string) => {
        expect(key).toBe(FOOTBALL_ENABLED_CONFIG_KEY);
        return value;
      },
    },
  };
}

describe('isFootballEnabled', () => {
  test('defaults to enabled when unset', async () => {
    expect(await isFootballEnabled(mockDb(null))).toBe(true);
    expect(await isFootballEnabled(mockDb(''))).toBe(true);
  });

  test('treats 0/false as disabled', async () => {
    expect(await isFootballEnabled(mockDb('0'))).toBe(false);
    expect(await isFootballEnabled(mockDb('false'))).toBe(false);
    expect(await isFootballEnabled(mockDb('FALSE'))).toBe(false);
  });

  test('treats 1/true as enabled', async () => {
    expect(await isFootballEnabled(mockDb('1'))).toBe(true);
    expect(await isFootballEnabled(mockDb('true'))).toBe(true);
  });
});
