import { describe, expect, test } from 'bun:test';
import type { GoalEvent } from '../utils/footballAnnouncements';
import {
  brazilFlagSpam,
  displayScorerName,
  getGoalFollowUpContent,
  isMinute67,
  isScore71,
  MINUTE_67_GIF_URL,
} from '../utils/footballEasterEggs';

const baseGoal: GoalEvent = {
  home: 1,
  away: 0,
  scorer: 'Lionel Messi',
  minute: '12',
  team: 'Argentina',
};

describe('footballEasterEggs', () => {
  test('displayScorerName renames pen takers', () => {
    expect(displayScorerName({ ...baseGoal, penalty: true })).toBe('Pessi');
    expect(displayScorerName({ ...baseGoal, scorer: 'Cristiano Ronaldo', penalty: true })).toBe('Penaldo');
    expect(displayScorerName({ ...baseGoal, scorer: 'Erling Haaland', penalty: true })).toBe('Paaland');
    expect(displayScorerName({ ...baseGoal, penalty: true, scorer: 'Someone Else' })).toBe('Someone Else');
    expect(displayScorerName({ ...baseGoal, scorer: 'Lionel Messi' })).toBe('Lionel Messi');
  });

  test('isMinute67 matches exactly 67', () => {
    expect(isMinute67({ ...baseGoal, minute: '67' })).toBe(true);
    expect(isMinute67({ ...baseGoal, minute: '90+67' })).toBe(false);
    expect(isMinute67({ ...baseGoal, minute: '66' })).toBe(false);
  });

  test('isScore71 matches either orientation', () => {
    expect(isScore71(7, 1)).toBe(true);
    expect(isScore71(1, 7)).toBe(true);
    expect(isScore71(7, 0)).toBe(false);
  });

  test('getGoalFollowUpContent stacks easter eggs', () => {
    const goal: GoalEvent = { ...baseGoal, home: 7, away: 1, minute: '67' };
    expect(getGoalFollowUpContent(goal)).toEqual([MINUTE_67_GIF_URL, brazilFlagSpam()]);
  });
});
