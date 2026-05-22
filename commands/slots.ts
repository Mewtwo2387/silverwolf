import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { checkValidBet } from '../utils/betting';
import { spinSlots } from '../utils/slots';

class Slots extends Command {
  constructor(client: any) {
    super(client, 'slots', 'lose all your mystic credits', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
    ], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    if (amount < 0) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Betting debt is disabled'),
        ],
      });
      return;
    }

    const result = await spinSlots(this.client, interaction.user.id, amount);
    const { results } = result;
    const description = `${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`;

    if (result.isWin) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(result.winMessage)
          .setDescription(description),
        ],
      });
    } else {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle(result.loseMessage)
          .setDescription(description),
        ],
      });
    }
  }
}

export default Slots;
