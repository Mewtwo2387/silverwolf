import { describe, expect, test } from 'bun:test';
import {
  fetchWorldCupMatches,
  formatEventMinute,
  mapApiFootballFixture,
  mapApiFootballStatus,
  normalizeTeamName,
} from '../utils/apiFootball';

describe('apiFootball', () => {
  test('normalizeTeamName maps common API names', () => {
    expect(normalizeTeamName('United States')).toBe('USA');
    expect(normalizeTeamName('Korea Republic')).toBe('South Korea');
    expect(normalizeTeamName('Mexico')).toBe('Mexico');
  });

  test('formatEventMinute handles stoppage time', () => {
    expect(formatEventMinute(90, 4)).toBe('90+4');
    expect(formatEventMinute(67, null)).toBe('67');
    expect(formatEventMinute(90, 0)).toBe('90');
  });

  test('mapApiFootballStatus maps finished and live statuses', () => {
    expect(mapApiFootballStatus('FT')).toBe('FINISHED');
    expect(mapApiFootballStatus('1H')).toBe('1H');
    expect(mapApiFootballStatus('HT')).toBe('HT');
  });

  test('mapApiFootballFixture maps goals from events', () => {
    const mapped = mapApiFootballFixture({
      fixture: {
        id: 1,
        date: '2026-06-11T19:00:00+00:00',
        status: { short: 'FT' },
        venue: { name: 'Estadio Azteca', city: 'Mexico City' },
      },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 16, name: 'Mexico' },
        away: { id: 1531, name: 'South Africa' },
      },
      goals: { home: 2, away: 0 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 0 },
      },
      events: [{
        time: { elapsed: 9, extra: null },
        team: { id: 16, name: 'Mexico' },
        player: { id: 1, name: 'J. Quinones' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 67, extra: null },
        team: { id: 16, name: 'Mexico' },
        player: { id: 2, name: 'R. Jiménez' },
        type: 'Goal',
        detail: 'Normal Goal',
      }],
    });

    expect(mapped.status).toBe('FINISHED');
    expect(mapped.team1).toBe('Mexico');
    expect(mapped.kickoffUtc).toBe('2026-06-11T19:00:00.000Z');
    expect(mapped.goals1).toHaveLength(2);
    expect(mapped.goals1?.[0].minute).toBe('9');
    expect(mapped.goals1?.[1].name).toBe('R. Jiménez');
  });

  test('mapApiFootballFixture marks penalties', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 2, date: '2026-06-12T19:00:00+00:00', status: { short: 'FT' } },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 1, name: 'Argentina' },
        away: { id: 2, name: 'France' },
      },
      goals: { home: 1, away: 0 },
      score: {
        halftime: { home: 0, away: 0 },
        fulltime: { home: 1, away: 0 },
      },
      events: [{
        time: { elapsed: 45, extra: 2 },
        team: { id: 1, name: 'Argentina' },
        player: { id: 10, name: 'L. Messi' },
        type: 'Goal',
        detail: 'Penalty',
      }],
    });

    expect(mapped.goals1?.[0].penalty).toBe(true);
    expect(mapped.goals1?.[0].minute).toBe('45+2');
  });

  test('mapApiFootballFixture skips missed penalties', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 3, date: '2026-06-12T19:00:00+00:00', status: { short: 'FT' } },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 1, name: 'Argentina' },
        away: { id: 2, name: 'France' },
      },
      goals: { home: 0, away: 0 },
      score: {
        halftime: { home: 0, away: 0 },
        fulltime: { home: 0, away: 0 },
      },
      events: [{
        time: { elapsed: 55, extra: null },
        team: { id: 1, name: 'Argentina' },
        player: { id: 10, name: 'L. Messi' },
        type: 'Goal',
        detail: 'Missed Penalty',
      }],
    });

    expect(mapped.goals1).toBeUndefined();
    expect(mapped.goals2).toBeUndefined();
  });

  test('mapApiFootballFixture credits own goals to the opposing side', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 4, date: '2026-06-12T19:00:00+00:00', status: { short: 'FT' } },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 1, name: 'Argentina' },
        away: { id: 2, name: 'France' },
      },
      goals: { home: 1, away: 0 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 1, away: 0 },
      },
      events: [{
        time: { elapsed: 33, extra: null },
        team: { id: 2, name: 'France' },
        player: { id: 20, name: 'Defender' },
        type: 'Goal',
        detail: 'Own Goal',
      }],
    });

    expect(mapped.goals1).toHaveLength(1);
    expect(mapped.goals1?.[0].name).toBe('Defender');
    expect(mapped.goals1?.[0].penalty).toBe(false);
    expect(mapped.goals2).toBeUndefined();
  });

  test('fetchWorldCupMatches requires API_FOOTBALL_KEY', async () => {
    const previous = process.env.API_FOOTBALL_KEY;
    delete process.env.API_FOOTBALL_KEY;
    try {
      await expect(fetchWorldCupMatches()).rejects.toThrow('API_FOOTBALL_KEY is required');
    } finally {
      if (previous !== undefined) process.env.API_FOOTBALL_KEY = previous;
    }
  });
});
