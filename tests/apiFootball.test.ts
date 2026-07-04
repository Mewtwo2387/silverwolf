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

  test('mapApiFootballFixture credits own goals to event.team (benefiting side)', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 4, date: '2026-06-12T19:00:00+00:00', status: { short: 'FT' } },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 1113, name: 'Bosnia & Herzegovina' },
        away: { id: 1569, name: 'Qatar' },
      },
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 2, away: 1 },
        fulltime: { home: null, away: null },
      },
      events: [{
        time: { elapsed: 29, extra: null },
        team: { id: 1113, name: 'Bosnia & Herzegovina' },
        player: { id: 1, name: 'K. Alajbegovic' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 34, extra: null },
        team: { id: 1113, name: 'Bosnia & Herzegovina' },
        player: { id: 2, name: 'S. Al Brake' },
        type: 'Goal',
        detail: 'Own Goal',
      }, {
        time: { elapsed: 42, extra: null },
        team: { id: 1569, name: 'Qatar' },
        player: { id: 3, name: 'H. Al Haydos' },
        type: 'Goal',
        detail: 'Normal Goal',
      }],
    });

    expect(mapped.goals1).toHaveLength(2);
    expect(mapped.goals1?.[1].name).toBe('S. Al Brake');
    expect(mapped.goals2).toHaveLength(1);
    expect(mapped.score?.ft).toEqual([2, 1]);
  });

  test('mapApiFootballFixture uses API goals for official score', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 5, date: '2026-06-12T19:00:00+00:00', status: { short: '1H' } },
      league: { round: 'Group Stage - 1' },
      teams: {
        home: { id: 2384, name: 'USA' },
        away: { id: 2380, name: 'Paraguay' },
      },
      goals: { home: 1, away: 0 },
      score: {
        halftime: { home: 0, away: 0 },
        fulltime: { home: null, away: null },
      },
      events: [{
        time: { elapsed: 7, extra: null },
        team: { id: 2384, name: 'USA' },
        player: { id: 1, name: 'D. Bobadilla' },
        type: 'Goal',
        detail: 'Own Goal',
      }],
    });

    expect(mapped.goals1).toHaveLength(1);
    expect(mapped.score?.ft).toEqual([1, 0]);
  });

  test('mapApiFootballFixture prefers live goals over stale fulltime during extra time', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 7, date: '2026-07-04T19:00:00+00:00', status: { short: 'ET' } },
      league: { round: 'Round of 16' },
      teams: {
        home: { id: 1, name: 'Argentina' },
        away: { id: 2, name: 'Cape Verde' },
      },
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 1, away: 1 },
        extratime: { home: 1, away: 0 },
      },
      events: [{
        time: { elapsed: 29, extra: null },
        team: { id: 1, name: 'Argentina' },
        player: { id: 1, name: 'L. Messi' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 59, extra: null },
        team: { id: 2, name: 'Cape Verde' },
        player: { id: 2, name: 'D. Duarte' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 92, extra: null },
        team: { id: 1, name: 'Argentina' },
        player: { id: 3, name: 'L. Martinez' },
        type: 'Goal',
        detail: 'Normal Goal',
      }],
    });

    expect(mapped.status).toBe('ET');
    expect(mapped.score?.ft).toEqual([2, 1]);
  });

  test('mapApiFootballFixture skips penalty-shootout kicks', () => {
    const mapped = mapApiFootballFixture({
      fixture: { id: 6, date: '2026-06-20T19:00:00+00:00', status: { short: 'PEN' } },
      league: { round: 'Round of 32' },
      teams: {
        home: { id: 1, name: 'Germany' },
        away: { id: 2, name: 'Paraguay' },
      },
      goals: { home: 1, away: 1 },
      score: {
        halftime: { home: 0, away: 1 },
        fulltime: { home: 1, away: 1 },
        penalty: { home: 1, away: 1 },
      },
      events: [{
        time: { elapsed: 42, extra: null },
        team: { id: 2, name: 'Paraguay' },
        player: { id: 1, name: 'Scorer' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 54, extra: null },
        team: { id: 1, name: 'Germany' },
        player: { id: 2, name: 'K. Havertz' },
        type: 'Goal',
        detail: 'Normal Goal',
      }, {
        time: { elapsed: 54, extra: null },
        team: { id: 1, name: 'Germany' },
        player: { id: 3, name: 'K. Havertz' },
        type: 'Goal',
        detail: 'Penalty',
      }, {
        time: { elapsed: 120, extra: 1 },
        team: { id: 2, name: 'Paraguay' },
        player: { id: 4, name: 'Taker' },
        type: 'Goal',
        detail: 'Penalty',
      }, {
        time: { elapsed: 120, extra: 2 },
        team: { id: 1, name: 'Germany' },
        player: { id: 5, name: 'Taker' },
        type: 'Goal',
        detail: 'Penalty',
      }],
    });

    expect(mapped.status).toBe('FINISHED');
    expect(mapped.goals1).toHaveLength(2);
    expect(mapped.goals1?.[1].penalty).toBe(true);
    expect(mapped.goals2).toHaveLength(1);
    expect(mapped.score?.ft).toEqual([1, 1]);
    expect(mapped.score?.penalty).toEqual([1, 1]);
    expect(mapped.shootoutKicks).toHaveLength(2);
    expect(mapped.shootoutKicks?.[0]).toMatchObject({ team: 'Paraguay', scored: true });
    expect(mapped.shootoutKicks?.[1]).toMatchObject({ team: 'Germany', scored: true });
  });

  test('mapApiFootballStatus preserves penalty shootout live status', () => {
    expect(mapApiFootballStatus('P')).toBe('P');
    expect(mapApiFootballStatus('PEN')).toBe('FINISHED');
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
