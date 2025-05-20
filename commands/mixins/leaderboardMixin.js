const Discord = require('discord.js');
const { format } = require('../../utils/math');
const { logError } = require('../../utils/log');

function LeaderboardMixin(BaseClass) {
  return class extends BaseClass {
    constructor(client, name, description, title, attribute, counter, noneSentence) {
      super(client, name, description, []);
      this.title = title; // e.g. "Dinonuggie Leaderboard"
      this.attribute = attribute; // e.g. "dinonuggies"
      this.counter = counter; // e.g. "Nuggies"
      this.noneSentence = noneSentence; // e.g. "No one have any nuggies yet!"
      this.itemsPerPage = 10;
    }

    async run(interaction) {
      try {
        // Get initial data for the first page
        let currentPage = 0;
        const attrs = await this.client.db.user.getEveryoneAttr(
          this.attribute,
          this.itemsPerPage,
          currentPage * this.itemsPerPage,
        );

        // Generate the leaderboard content for the first page
        const totalCount = await this.client.db.user.getEveryoneAttrCount(this.attribute); // New method to count total rows
        const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;
        const leaderboard = await this.generateLeaderboard(attrs, currentPage);

        // Create pagination buttons
        const row = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('prev_page')
              .setLabel('⬅️ Back')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(true), // Disable at first page
            new Discord.ButtonBuilder()
              .setCustomId('next_page')
              .setLabel('Next ➡️')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(currentPage === maxPage), // Disable if no more pages
          );

        // Send the initial message
        const message = await interaction.editReply({
          embeds: [leaderboard],
          components: [row],
        });

        // Handle button interactions for pagination
        const collector = message.createMessageComponentCollector({ time: 60000 }); // 1 minute timeout

        collector.on('collect', async (i) => {
          if (i.customId === 'prev_page' && currentPage > 0) {
            currentPage -= 1;
          } else if (i.customId === 'next_page' && currentPage < maxPage) {
            currentPage += 1;
          }

          // Fetch new data for the updated page
          const newAttrs = await this.client.db.user.getEveryoneAttr(
            this.attribute,
            this.itemsPerPage,
            currentPage * this.itemsPerPage,
          );
          const newLeaderboard = await this.generateLeaderboard(newAttrs, currentPage);

          // Update the buttons
          const newRow = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('⬅️ Back')
                .setStyle(Discord.ButtonStyle.Primary)
                .setDisabled(currentPage === 0), // Disable at first page
              new Discord.ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next ➡️')
                .setStyle(Discord.ButtonStyle.Primary)
                .setDisabled(currentPage === maxPage), // Disable at last page
            );

          // Update the message
          await i.update({ embeds: [newLeaderboard], components: [newRow] });
        });

        collector.on('end', async () => {
          // Disable the buttons when the collector times out
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
        logError('Failed to fetch leaderboard:', error);
        await interaction.editReply({ content: 'Failed to retrieve leaderboard', ephemeral: true });
      }
    }

    // Helper function to generate the leaderboard embed
    async generateLeaderboard(attrs, page) {
      let result = '';
      for (let i = 0; i < attrs.length; i += 1) {
        result += `${i + 1 + (page * this.itemsPerPage)}. <@${attrs[i].id}>: ${format(attrs[i][this.attribute])} ${this.counter}\n`;
      }
      if (result === '') {
        result = this.noneSentence;
      }
      return new Discord.EmbedBuilder()
        .setTitle(this.title)
        .setDescription(result)
        .setFooter({ text: `Page ${page + 1}` });
    }
  };
}

module.exports = LeaderboardMixin;
