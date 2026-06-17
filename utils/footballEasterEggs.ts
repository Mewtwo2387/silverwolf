import type { GoalEvent } from './footballAnnouncements';

export const MINUTE_67_GIF_URL = 'https://tenor.com/view/abster-abstract-abstractchain-green-pudgy-gif-6595049812886649814';
const BRAZIL_FLAG = '🇧🇷';

export function displayScorerName(goal: GoalEvent): string {
  if (!goal.penalty) return goal.scorer;
  if (/messi/i.test(goal.scorer)) return 'Pessi';
  if (/ronaldo/i.test(goal.scorer)) return 'Penaldo';
  if (/haaland/i.test(goal.scorer)) return 'Paaland';
  return goal.scorer;
}

export function isMinute67(goal: GoalEvent): boolean {
  return goal.minute.trim() === '67';
}

export function isScore71(home: number, away: number): boolean {
  return (home === 7 && away === 1) || (home === 1 && away === 7);
}

export function brazilFlagSpam(): string {
  return BRAZIL_FLAG.repeat(14);
}

export function getGoalFollowUpContent(goal: GoalEvent): string[] {
  const messages: string[] = [];
  if (isMinute67(goal)) messages.push(MINUTE_67_GIF_URL);
  if (isScore71(goal.home, goal.away)) messages.push(brazilFlagSpam());
  return messages;
}
