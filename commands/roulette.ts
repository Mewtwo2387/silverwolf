import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { checkValidBet } from '../utils/betting';

export type RouletteBetType = 'number' | 'red' | 'black' | 'green' | 'even' | 'odd';

export function spinWheel(): number {
  return Math.floor(Math.random() * 37);
}

export function getColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(num) ? 'red' : 'black';
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
  await client.db.user.addUserAttr(userId, 'rouletteTimesPlayed', 1);
  await client.db.user.addUserAttr(userId, 'rouletteAmountGambled', amount);
  await client.db.user.addUserAttr(userId, 'rouletteTimesWon', multi > 0 ? 1 : 0);
  await client.db.user.addUserAttr(userId, 'rouletteAmountWon', winnings);
  await client.db.user.addUserAttr(userId, 'rouletteRelativeWon', multi);
  await client.db.user.addUserAttr(userId, 'credits', winnings - amount);
  await client.db.user.setUserAttr(userId, 'rouletteStreak', streak);
  if (streak > maxStreak) {
    await client.db.user.setUserAttr(userId, 'rouletteMaxStreak', streak);
  }

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

class Roulette extends Command {
  constructor(client: any) {
    super(client, 'roulette', 'guess what? more betting. bet your credits on roulette.', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
      {
        name: 'bet_type',
        description: 'the type of bet (number, color, even, odd)',
        type: 3,
        required: true,
        choices: [
          { name: 'Number', value: 'number' },
          { name: 'Red', value: 'red' },
          { name: 'Black', value: 'black' },
          { name: 'Green', value: 'green' },
          { name: 'Even', value: 'even' },
          { name: 'Odd', value: 'odd' },
        ],
      },
      {
        name: 'bet_value',
        description: 'the value if it is a number bet',
        type: 4,
        required: false,
      },
    ], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    const betType = interaction.options.getString('bet_type') as RouletteBetType;
    const betValue = interaction.options.getInteger('bet_value');

    if (betType === 'number' && (Number.isNaN(betValue) || betValue < 0 || betValue > 36 || betValue === null)) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid number. Must be between 0 and 36'),
        ],
      });
      return;
    }

    const result = await playRoulette(this.client, interaction.user.id, amount, betType, betValue);

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor(result.isWin ? '#00AA00' : '#AA0000')
        .setTitle(`You bet ${format(amount)} mystic credits and ${result.isWin ? `won ${format(result.winnings)} mystic credits!` : 'lost!'}\n`)
        .setDescription(result.resultMessage),
      ],
    });
  }
}

export default Roulette;
