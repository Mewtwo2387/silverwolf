import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { checkValidBet } from '../utils/betting';
import { playRoulette, type RouletteBetType } from '../utils/roulette';

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
