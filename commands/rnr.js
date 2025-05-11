const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { Command } = require('./classes/command');

class RnRCommand extends Command {
  constructor(client) {
    super(client, 'risk-n-reward', 'Risk & Reward: how much are you willing to?', [{
      name: 'amount',
      description: 'The amount of credits to bet.',
      type: 4,
      required: true,
    }]);
  }

  async run(interaction) {
    const amount = interaction.options.getInteger('amount');
    const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');

    if (amount <= 0) {
      return interaction.editReply('Please enter a valid amount greater than 0.');
    }

    if (amount > credits) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You don\'t have enough credits to bet that much!'),
        ],
      });
    }

    const currentAmount = amount;

    // Generate a random win amount between 0% and 100%
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
          .setCustomId('step_out')
          .setLabel('No balls')
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      if (i.customId === 'continue') {
        // Determine if the player wins or loses based on the generated chance
        const rng = Math.random() * 100;
        if (rng < failureChance) {
          // Player loses
          const lostAmount = currentAmount * (1 + (winAmount / 100));
          await this.client.db.addUserAttr(interaction.user.id, 'credits', -lostAmount);
          await i.update({
            embeds: [embed.setDescription(`Aw, you lost! You lost ${lostAmount.toFixed(2)} credits.`).setColor('#FF0000')],
            components: [],
          });
          collector.stop();
        } else {
          // Player wins
          const winnings = currentAmount * (winAmount / 100);
          await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings);
          await i.update({
            embeds: [embed.setDescription(`Congratulations! You won ${winnings.toFixed(2)} credits with a ${winAmount.toFixed(2)}% chance!`).setColor('#00FF00')],
            components: [],
          });
          collector.stop();
        }
      } else if (i.customId === 'step_out') {
        // Calculate the 5% entrance fee
        const entranceFee = currentAmount * 0.05;
        await this.client.db.addUserAttr(interaction.user.id, 'credits', -entranceFee); // Deduct the entrance fee
        await i.update({
          embeds: [embed.setDescription(`You chose to step out. You lost ${entranceFee.toFixed(2)} credits as an entrance fee.`).setColor('#0000FF')],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on('end', async () => {
      if (!interaction.replied || !interaction.deferred) {
        await this.client.db.addUserAttr(interaction.user.id, 'credits', -amount); // Deduct initial bet on timeout
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

module.exports = RnRCommand;
