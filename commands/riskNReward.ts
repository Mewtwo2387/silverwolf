import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from './classes/Command';
import { checkValidBet } from '../utils/betting';

class RiskNReward extends Command {
  constructor(client: any) {
    super(client, 'risk-n-reward', 'Risk & Reward: how much are you willing to?', [{
      name: 'amount',
      description: 'The amount of credits to bet.',
      type: 3,
      required: true,
    }], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    const currentAmount = amount;

    const winAmount = Math.random() * 100;
    const failureChance = (100 - winAmount).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle('RnR Minigame')
      .setDescription(`You can win ${winAmount.toFixed(2)}% of your initial bet. Success is at ${failureChance}%.\n\nWould you like to continue?`)
      .setFooter({ text: `Current Bet: ${currentAmount}` })
      .setColor('#FFD700');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('continue')
          .setLabel('Continue')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('stepOut')
          .setLabel('No balls')
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = (i: any) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i: any) => {
      if (i.customId === 'continue') {
        const rng = Math.random() * 100;
        if (rng < failureChance) {
          const lostAmount = currentAmount * (1 + (winAmount / 100));
          await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -lostAmount);
          await i.update({
            embeds: [embed.setDescription(`Aw, you lost! You lost ${lostAmount.toFixed(2)} credits.`).setColor('#FF0000')],
            components: [],
          });
          collector.stop();
        } else {
          const winnings = currentAmount * (winAmount / 100);
          await this.client.db.user.addUserAttr(interaction.user.id, 'credits', winnings);
          await i.update({
            embeds: [embed.setDescription(`Congratulations! You won ${winnings.toFixed(2)} credits with a ${winAmount.toFixed(2)}% chance!`).setColor('#00FF00')],
            components: [],
          });
          collector.stop();
        }
      } else if (i.customId === 'stepOut') {
        const entranceFee = currentAmount * 0.05;
        await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -entranceFee);
        await i.update({
          embeds: [embed.setDescription(`You chose to step out. You lost ${entranceFee.toFixed(2)} credits as an entrance fee.`).setColor('#0000FF')],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on('end', async () => {
      if (!interaction.replied || !interaction.deferred) {
        await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -amount);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#AA0000')
            .setTitle(`You took too long and lost ${amount} credits!`),
          ],
          components: [],
        });
      }
    });
  }
}

export default RiskNReward;
