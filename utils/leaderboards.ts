// Shared display strings for leaderboards. Both the Discord `/gamblerboard`
// + `/poopboard` commands and the web `/leaderboards` page use these so the
// titles stay in sync.

export type GamblerBoardType =
  | 'all'
  | 'slots'
  | 'blackjack'
  | 'roulette';

export function gamblerBoardTitle(type: GamblerBoardType | string): string {
  if (type === 'all') return 'The Ultimate Gambler Leaderboard';
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`;
}

export type PoopBoardPeriod = 'all-time' | 'weekly' | 'monthly';

const POOP_PERIOD_LABELS: Record<string, string> = {
  'all-time': 'All Time',
  weekly: 'This Week',
  monthly: 'This Month',
};

export function poopPeriodLabel(period: PoopBoardPeriod | string): string {
  return POOP_PERIOD_LABELS[period] ?? 'All Time';
}
