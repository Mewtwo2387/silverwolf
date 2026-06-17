import { describe, expect, test } from 'bun:test';
import {
  buildReplayEmbedsForMatch,
  formatReplayWindow,
  getMatchesForReplay,
  getScoreProgression,
  replayWindowMsFromHours,
} from '../utils/footballAnnouncements';
import { parseKickoffUtc, type WorldCupMatch } from '../utils/worldcup';

const sampleMatch: WorldCupMatch = {
  round: 'Matchday 1',
  date: '2026-06-11',
  time: '13:00 UTC-6',
  team1: 'Mexico',
  team2: 'South Africa',
  score: { ft: [2, 0], ht: [1, 0] },
  goals1: [
    { name: 'Julián Quiñones', minute: '9' },
    { name: 'Raúl Jiménez', minute: '67' },
  ],
  goals2: [],
  group: 'Group A',
};

describe('footballAnnouncements', () => {
  test('getScoreProgression follows goal order', () => {
    expect(getScoreProgression(sampleMatch)).toEqual([
      { home: 1, away: 0 },
      { home: 2, away: 0 },
    ]);
  });

  test('buildReplayEmbedsForMatch includes pre-match, goals, and full time', () => {
    const embeds = buildReplayEmbedsForMatch(sampleMatch);
    expect(embeds).toHaveLength(4);
    expect(embeds[0].data.title).toContain('vs');
    expect(embeds[embeds.length - 1].data.description).toContain('Full Time');
  });

  test('getMatchesForReplay includes kickoffs in the last 24 hours', () => {
    const kickoff = parseKickoffUtc(sampleMatch)!.getTime();
    const now = kickoff + 60 * 60 * 1000;
    const recent = getMatchesForReplay([sampleMatch], now);
    expect(recent).toHaveLength(1);

    const old = getMatchesForReplay([sampleMatch], kickoff + 25 * 60 * 60 * 1000);
    expect(old).toHaveLength(0);
  });

  test('replayWindowMsFromHours validates input', () => {
    expect(replayWindowMsFromHours(null)).toBe(24 * 60 * 60 * 1000);
    expect(replayWindowMsFromHours(48)).toBe(48 * 60 * 60 * 1000);
    expect(replayWindowMsFromHours(36)).toBe(36 * 60 * 60 * 1000);
    expect(() => replayWindowMsFromHours(0)).toThrow();
    expect(() => replayWindowMsFromHours(9999)).toThrow();
  });

  test('formatReplayWindow labels windows in hours', () => {
    expect(formatReplayWindow(24)).toBe('the last 24 hours');
    expect(formatReplayWindow(48)).toBe('the last 48 hours');
    expect(formatReplayWindow(1)).toBe('the last 1 hour');
  });
});
