const Discord = require('discord.js');
const { Command } = require('./classes/command');
const LeaderboardMixin = require('./mixins/leaderboardMixin');
const { logError } = require('../utils/log');

class PoopBoard extends LeaderboardMixin(Command) {
  constructor(client) {
    super(
      client,
      'poopboard',
      'See who has pooped the most 💩',
      'Poop Leaderboard 💩',
      'poopCount',
      'Poops',
      'No one has pooped yet... or have they? 🤔',
    );
    this.options = [
      {
        name: 'period',
        description: 'Time period for the leaderboard',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'All Time', value: 'all-time' },
          { name: 'This Week', value: 'weekly' },
          { name: 'This Month', value: 'monthly' },
        ],
      },
    ];
  }

  async run(interaction) {
    try {
      const period = interaction.options.getString('period') ?? 'all-time';
      let currentPage = 0;

      const totalCount = await this.client.db.poop.getLeaderboardCount(period);
      const maxPage = Math.max(Math.ceil(totalCount / this.itemsPerPage) - 1, 0);

      const attrs = await this.client.db.poop.getLeaderboard(period, this.itemsPerPage, 0);
      const leaderboard = await this.generateLeaderboard(attrs, currentPage);

      const periodLabel = { 'all-time': 'All Time', weekly: 'This Week', monthly: 'This Month' }[period];
      leaderboard.setTitle(`Poop Leaderboard 💩 — ${periodLabel}`);

      const row = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('⬅️ Back')
            .setStyle(Discord.ButtonStyle.Primary)
            .setDisabled(true),
          new Discord.ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ➡️')
            .setStyle(Discord.ButtonStyle.Primary)
            .setDisabled(currentPage === maxPage),
        );

      const message = await interaction.editReply({ embeds: [leaderboard], components: [row] });

      const collector = message.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'You cannot control this pagination.', ephemeral: true });
          return;
        }

        if (i.customId === 'prev_page' && currentPage > 0) {
          currentPage -= 1;
        } else if (i.customId === 'next_page' && currentPage < maxPage) {
          currentPage += 1;
        }

        const newAttrs = await this.client.db.poop.getLeaderboard(period, this.itemsPerPage, currentPage * this.itemsPerPage);
        const newLeaderboard = await this.generateLeaderboard(newAttrs, currentPage);
        newLeaderboard.setTitle(`Poop Leaderboard 💩 — ${periodLabel}`);

        const newRow = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('prev_page')
              .setLabel('⬅️ Back')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(currentPage === 0),
            new Discord.ButtonBuilder()
              .setCustomId('next_page')
              .setLabel('Next ➡️')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(currentPage === maxPage),
          );

        await i.update({ embeds: [newLeaderboard], components: [newRow] });
      });

      collector.on('end', async () => {
        const disabledRow = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('prev_page')
              .setLabel('⬅️ Back')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(true),
            new Discord.ButtonBuilder()
              .setCustomId('next_page')
              .setLabel('Next ➡️')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(true),
          );
        await message.edit({ components: [disabledRow] });
      });
    } catch (error) {
      logError('Failed to fetch poop leaderboard:', error);
      await interaction.editReply({ content: 'Failed to retrieve the leaderboard. Please try again.', ephemeral: true });
    }
  }
}

module.exports = PoopBoard;
