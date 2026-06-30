import { describe, expect, test } from 'bun:test';
import {
  buildGoalEmbed,
  buildPenaltyShootoutEmbed,
  buildReplayEmbedsForMatch,
  buildScoreUpdateEmbed,
  formatGoalTitle,
  formatHighlightedScore,
  formatHighlightedScoreFromDelta,
  formatReplayWindow,
  getGoalEvents,
  getMatchesForReplay,
  getNewGoalEvents,
  replayWindowMsFromHours,
} from '../utils/footballAnnouncements';
import {
  getPenaltyShootoutTally,
  isPenaltyShootout,
  isPenaltyShootoutPhase,
  parseKickoffUtc,
  type WorldCupMatch,
} from '../utils/worldcup';

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

const mixedGoalsMatch: WorldCupMatch = {
  round: 'Matchday 1',
  date: '2026-06-11',
  time: '20:00 UTC-6',
  team1: 'South Korea',
  team2: 'Czech Republic',
  score: { ft: [2, 1], ht: [0, 0] },
  goals1: [
    { name: 'Hwang In-Beom', minute: '67' },
    { name: 'Oh Hyeon-Gyu', minute: '80' },
  ],
  goals2: [{ name: 'Ladislav Krejcí', minute: '59' }],
};

describe('footballAnnouncements', () => {
  test('formatHighlightedScore brackets the scoring side', () => {
    expect(formatHighlightedScore(1, 0, 'home')).toBe('[1] – 0');
    expect(formatHighlightedScore(1, 2, 'away')).toBe('1 – [2]');
  });

  test('formatHighlightedScoreFromDelta brackets sides that increased', () => {
    expect(formatHighlightedScoreFromDelta(1, 0, 0, 0)).toBe('[1] – 0');
    expect(formatHighlightedScoreFromDelta(1, 1, 1, 0)).toBe('1 – [1]');
    expect(formatHighlightedScoreFromDelta(2, 0, 0, 0)).toBe('[2] – 0');
    expect(formatHighlightedScoreFromDelta(2, 1, 1, 0)).toBe('[2] – [1]');
  });

  test('buildScoreUpdateEmbed highlights sides that scored since last update', () => {
    const embed = buildScoreUpdateEmbed(sampleMatch, { home: 1, away: 1 }, { home: 1, away: 0 });
    expect(embed.data.title).toContain('1 – [1]');
  });

  test('getGoalEvents follows chronological order across both teams', () => {
    const events = getGoalEvents(mixedGoalsMatch);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ scorer: 'Ladislav Krejcí', home: 0, away: 1 });
    expect(events[1]).toMatchObject({ scorer: 'Hwang In-Beom', home: 1, away: 1 });
    expect(events[2]).toMatchObject({ scorer: 'Oh Hyeon-Gyu', home: 2, away: 1 });
  });

  test('buildGoalEmbed highlights score and shows scorer', () => {
    const goal = getGoalEvents(sampleMatch)[0];
    const embed = buildGoalEmbed(sampleMatch, goal);
    expect(formatGoalTitle(sampleMatch, goal)).toContain('[1] – 0');
    expect(embed.data.description).toContain('**Julián Quiñones**');
    expect(embed.data.description).toContain("9'");
  });

  test('getNewGoalEvents returns only unannounced goals', () => {
    const events = getGoalEvents(sampleMatch);
    expect(getNewGoalEvents(sampleMatch, null)).toHaveLength(2);
    expect(getNewGoalEvents(sampleMatch, {
      matchId: 'x',
      preMatchSent: true,
      lastHomeScore: 1,
      lastAwayScore: 0,
      fullTimeSent: false,
    })).toEqual([events[1]]);
  });

  test('buildReplayEmbedsForMatch includes pre-match, goals, and full time', () => {
    const embeds = buildReplayEmbedsForMatch(sampleMatch);
    expect(embeds).toHaveLength(4);
    expect(embeds[0].data.title).toContain('vs');
    expect(embeds[1].data.title).toContain('[1] – 0');
    expect(embeds[embeds.length - 1].data.description).toContain('Full Time');
    expect(embeds[embeds.length - 1].data.description).toContain('Julián Quiñones');
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

  test('isPenaltyShootout detects live shootout status', () => {
    const match: WorldCupMatch = { ...sampleMatch, status: 'P' };
    expect(isPenaltyShootout(match)).toBe(true);
    expect(isPenaltyShootout({ ...sampleMatch, status: 'ET' })).toBe(false);
    expect(isPenaltyShootout({ ...sampleMatch, status: 'FINISHED' })).toBe(false);
  });

  test('buildPenaltyShootoutEmbed uses regulation score and penalty tally', () => {
    const match: WorldCupMatch = {
      ...sampleMatch,
      status: 'P',
      score: { ft: [1, 1], penalty: [2, 3] },
      shootoutKicks: [
        { team: 'Mexico', player: 'A', scored: true },
        { team: 'South Africa', player: 'B', scored: false },
      ],
    };
    const embed = buildPenaltyShootoutEmbed(match);
    expect(embed.data.description).toContain('1 – 1');
    expect(embed.data.description).toContain('Pens **2–3**');
    expect(embed.data.description).toContain('✅ **A**');
    expect(embed.data.description).toContain('❌ **B**');
    expect(getPenaltyShootoutTally(match)).toEqual({ home: 2, away: 3 });
  });

  test('buildReplayEmbedsForMatch uses penalty shootout embed for decided matches', () => {
    const match: WorldCupMatch = {
      ...sampleMatch,
      status: 'FINISHED',
      score: { ft: [1, 1], penalty: [4, 5] },
      shootoutKicks: [{ team: 'Mexico', player: 'A', scored: true }],
    };
    const embeds = buildReplayEmbedsForMatch(match);
    expect(embeds[embeds.length - 1].data.description).toContain('Penalties');
    expect(embeds[embeds.length - 1].data.description).toContain('Pens **4–5**');
  });

  test('isPenaltyShootoutPhase includes finished penalty results', () => {
    expect(isPenaltyShootoutPhase({
      ...sampleMatch,
      status: 'P',
    })).toBe(true);
    expect(isPenaltyShootoutPhase({
      ...sampleMatch,
      status: 'FINISHED',
      score: { ft: [1, 1], penalty: [3, 4] },
    })).toBe(true);
    expect(isPenaltyShootoutPhase({
      ...sampleMatch,
      status: 'FINISHED',
      score: { ft: [2, 0] },
    })).toBe(false);
  });
});
