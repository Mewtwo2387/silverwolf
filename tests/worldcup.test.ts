import { describe, expect, test } from 'bun:test';
import {
  getDisplayedScore,
  getFinishedMatches,
  formatMatchResultLine,
  matchId,
  needsAnnouncementBaseline,
  parseKickoffUtc,
  type WorldCupMatch,
} from '../utils/worldcup';
import { getFootballTeamDisplay } from '../utils/footballTeams';

const sampleMatch: WorldCupMatch = {
  round: 'Matchday 1',
  date: '2026-06-11',
  time: '13:00 UTC-6',
  team1: 'Mexico',
  team2: 'South Africa',
  score: { ft: [2, 0], ht: [1, 0] },
  goals1: [{ name: 'Julián Quiñones', minute: '9' }],
  goals2: [],
  group: 'Group A',
  ground: 'Mexico City',
};

describe('worldcup utils', () => {
  test('matchId is stable', () => {
    expect(matchId(sampleMatch)).toBe('2026-06-11|Mexico|South Africa');
  });

  test('parseKickoffUtc converts local offset to UTC', () => {
    const kickoff = parseKickoffUtc(sampleMatch);
    expect(kickoff).not.toBeNull();
    expect(kickoff!.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  test('parseKickoffUtc prefers kickoffUtc from live API', () => {
    const kickoff = parseKickoffUtc({
      ...sampleMatch,
      kickoffUtc: '2026-06-12T01:00:00Z',
    });
    expect(kickoff!.toISOString()).toBe('2026-06-12T01:00:00.000Z');
  });

  test('getDisplayedScore prefers full-time score', () => {
    expect(getDisplayedScore(sampleMatch)).toEqual({ home: 2, away: 0 });
  });

  test('getDisplayedScore uses goal counts when no score block exists', () => {
    const liveMatch: WorldCupMatch = {
      ...sampleMatch,
      score: undefined,
      goals1: [{ name: 'A', minute: '10' }],
      goals2: [{ name: 'B', minute: '20' }, { name: 'C', minute: '55' }],
    };
    expect(getDisplayedScore(liveMatch)).toEqual({ home: 1, away: 2 });
  });

  test('formatMatchResultLine includes score and metadata', () => {
    expect(formatMatchResultLine(sampleMatch)).toBe(
      '2026-06-11 · 🇲🇽 Mexico **2–0** South Africa 🇿🇦 (HT 1–0) — Matchday 1 · Group A',
    );
  });

  test('needsAnnouncementBaseline only for matches that already kicked off', () => {
    const kickoffMs = parseKickoffUtc(sampleMatch)!.getTime();
    expect(needsAnnouncementBaseline(false, kickoffMs, kickoffMs - 60_000)).toBe(false);
    expect(needsAnnouncementBaseline(false, kickoffMs, kickoffMs)).toBe(true);
    expect(needsAnnouncementBaseline(true, kickoffMs, kickoffMs + 60_000)).toBe(false);
  });

  test('football team mapping provides nicknames and flags', () => {
    expect(getFootballTeamDisplay('Mexico')).toEqual({ nickname: 'Mexico', flag: '🇲🇽' });
    expect(getFootballTeamDisplay('W101')).toEqual({ nickname: 'W101', flag: '' });
  });

  test('getFinishedMatches filters by team and sorts newest first', () => {
    const matches: WorldCupMatch[] = [
      sampleMatch,
      {
        round: 'Matchday 1',
        date: '2026-06-12',
        time: '15:00 UTC-4',
        team1: 'Canada',
        team2: 'Mexico',
        score: { ft: [1, 2] },
      },
      {
        round: 'Matchday 8',
        date: '2026-06-18',
        time: '12:00 UTC-4',
        team1: 'Czech Republic',
        team2: 'South Africa',
      },
    ];

    const mexicoResults = getFinishedMatches(matches, { team: 'mexico' });
    expect(mexicoResults).toHaveLength(2);
    expect(mexicoResults[0].team1).toBe('Canada');
    expect(mexicoResults[1].team1).toBe('Mexico');
  });
});
