import { describe, expect, test } from 'bun:test';
import {
  fetchWorldCupMatches,
  formatApiGoalMinute,
  mapFootballDataMatch,
  normalizeTeamName,
} from '../utils/footballData';

describe('footballData', () => {
  test('normalizeTeamName maps common API names', () => {
    expect(normalizeTeamName('United States')).toBe('USA');
    expect(normalizeTeamName('Korea Republic')).toBe('South Korea');
    expect(normalizeTeamName('Mexico')).toBe('Mexico');
  });

  test('formatApiGoalMinute handles stoppage time', () => {
    expect(formatApiGoalMinute(90, 4)).toBe('90+4');
    expect(formatApiGoalMinute(67, null)).toBe('67');
    expect(formatApiGoalMinute(90, 0)).toBe('90');
  });

  test('mapFootballDataMatch maps v4 injuryTime goals', () => {
    const mapped = mapFootballDataMatch({
      id: 3,
      utcDate: '2026-06-11T19:00:00Z',
      status: 'FINISHED',
      homeTeam: { id: 10, name: 'Mexico' },
      awayTeam: { id: 11, name: 'South Africa' },
      score: {
        fullTime: { home: 2, away: 0 },
        halfTime: { home: 1, away: 0 },
      },
      goals: [{
        minute: 90,
        injuryTime: 3,
        type: 'REGULAR',
        team: { id: 10, name: 'Mexico' },
        scorer: { id: 1, name: 'Raúl Jiménez' },
      }],
    });

    expect(mapped.goals1?.[0].minute).toBe('90+3');
  });

  test('mapFootballDataMatch maps live goals and status', () => {
    const mapped = mapFootballDataMatch({
      id: 1,
      utcDate: '2026-06-11T19:00:00Z',
      status: 'IN_PLAY',
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      venue: 'Mexico City',
      homeTeam: { id: 10, name: 'Mexico' },
      awayTeam: { id: 11, name: 'South Africa' },
      score: {
        fullTime: { home: 1, away: 0 },
        halfTime: { home: 1, away: 0 },
      },
      goals: [{
        minute: 67,
        extraTime: null,
        type: 'REGULAR',
        team: { id: 10, name: 'Mexico' },
        scorer: { name: 'Raúl Jiménez' },
      }],
    });

    expect(mapped.status).toBe('IN_PLAY');
    expect(mapped.team1).toBe('Mexico');
    expect(mapped.kickoffUtc).toBe('2026-06-11T19:00:00Z');
    expect(mapped.goals1).toHaveLength(1);
    expect(mapped.goals1?.[0].minute).toBe('67');
  });

  test('fetchWorldCupMatches requires FOOTBALL_DATA_API_KEY', async () => {
    const previous = process.env.FOOTBALL_DATA_API_KEY;
    delete process.env.FOOTBALL_DATA_API_KEY;
    try {
      await expect(fetchWorldCupMatches()).rejects.toThrow('FOOTBALL_DATA_API_KEY is required');
    } finally {
      if (previous !== undefined) process.env.FOOTBALL_DATA_API_KEY = previous;
    }
  });

  test('mapFootballDataMatch marks finished matches from status', () => {
    const mapped = mapFootballDataMatch({
      id: 2,
      utcDate: '2026-06-11T22:00:00Z',
      status: 'FINISHED',
      homeTeam: { id: 10, name: 'Mexico' },
      awayTeam: { id: 11, name: 'South Africa' },
      score: {
        fullTime: { home: 2, away: 0 },
        halfTime: { home: 1, away: 0 },
      },
    });

    expect(mapped.status).toBe('FINISHED');
    expect(mapped.score?.ft).toEqual([2, 0]);
  });
});
