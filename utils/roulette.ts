// Pure roulette mechanics + per-spin DB stat updates. Shared by the Discord
// `/roulette` command and the web roulette page (via bot-bridge).

export type RouletteBetType = 'number' | 'red' | 'black' | 'green' | 'even' | 'odd';

// European roulette red pocket set; used both for payout resolution and for
// colouring the wheel preview in the web UI.
export const ROULETTE_RED_NUMBERS: ReadonlyArray<number> = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];

const RED_SET = new Set(ROULETTE_RED_NUMBERS);

export function spinWheel(): number {
  return Math.floor(Math.random() * 37);
}

export function getColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  return RED_SET.has(num) ? 'red' : 'black';
}

export interface RouletteResult {
  wheelResult: number;
  color: 'red' | 'black' | 'green';
  multi: number;
  winnings: number;
  streak: number;
  isWin: boolean;
  resultMessage: string;
}

export async function playRoulette(
  client: any,
  userId: string,
  amount: number,
  betType: RouletteBetType,
  betValue: number | null,
): Promise<RouletteResult> {
  let streak = await client.db.user.getUserAttr(userId, 'rouletteStreak');
  const maxStreak = await client.db.user.getUserAttr(userId, 'rouletteMaxStreak');

  const wheelResult = spinWheel();
  const colorResult = getColor(wheelResult);

  let multi = 0;
  let resultMessage = `The wheel landed on **${wheelResult} ${colorResult}**.\n`;

  if (betType === 'number' && betValue !== null && betValue === wheelResult) {
    multi = 38 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed the number! You are now on a streak of ${streak}`;
  } else if (betType === 'red' && colorResult === 'red') {
    multi = 2 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed red! You are now on a streak of ${streak}`;
  } else if (betType === 'black' && colorResult === 'black') {
    multi = 2 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed black! You are now on a streak of ${streak}`;
  } else if (betType === 'green' && colorResult === 'green') {
    multi = 38 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed green! You are now on a streak of ${streak}`;
  } else if (betType === 'even' && wheelResult !== 0 && wheelResult % 2 === 0) {
    multi = 2 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed even! You are now on a streak of ${streak}`;
  } else if (betType === 'odd' && wheelResult !== 0 && wheelResult % 2 !== 0) {
    multi = 2 * 1.06 ** streak;
    streak += 1;
    resultMessage += `You correctly guessed odd! You are now on a streak of ${streak}`;
  } else {
    streak = 0;
    resultMessage += 'You guessed wrongly. Skill issue.';
  }

  multi *= await client.db.marriage.getMarriageBenefits(userId);
  const winnings = multi * amount;
  const sets: Record<string, number> = { rouletteStreak: streak };
  if (streak > maxStreak) sets.rouletteMaxStreak = streak;
  await client.db.user.updateUserAttrs(userId, {
    adds: {
      rouletteTimesPlayed: 1,
      rouletteAmountGambled: amount,
      rouletteTimesWon: multi > 0 ? 1 : 0,
      rouletteAmountWon: winnings,
      rouletteRelativeWon: multi,
      credits: winnings - amount,
    },
    sets,
  });

  return {
    wheelResult,
    color: colorResult,
    multi,
    winnings,
    streak,
    isWin: multi > 0,
    resultMessage,
  };
}
