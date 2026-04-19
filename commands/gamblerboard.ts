import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { logError } from '../utils/log';

class GamblerBoard extends Command {
  itemsPerPage: number;

  constructor(client: any) {
    super(client, 'gamblerboard', 'gambler leaderboard', [
      {
        name: 'leaderboard',
        description: 'The leaderboard to display',
        type: 3,
        required: true,
        choices: [
          { name: 'Slots', value: 'slots' },
          { name: 'Roulette', value: 'roulette' },
          { name: 'Blackjack', value: 'blackjack' },
          { name: 'ALL', value: 'all' },
        ],
      },
    ], { blame: 'both' });
    this.itemsPerPage = 10;
  }

  async fetchData(leaderboardType: string, page: number = 0): Promise<{ winnings: any[]; totalCount: number }> {
    const winnings = (leaderboardType === 'all')
      ? await this.client.db.user.getAllRelativeNetWinnings(
        this.itemsPerPage,
        page * this.itemsPerPage,
      )
      : await this.client.db.user.getRelativeNetWinnings(
        leaderboardType,
        this.itemsPerPage,
        page * this.itemsPerPage,
      );
    const totalCount = (leaderboardType === 'all')
      ? await this.client.db.user.getAllRelativeNetWinningsCount()
      : await this.client.db.user.getEveryoneAttrCount(`${leaderboardType}TimesPlayed`);
    return { winnings, totalCount };
  }

  async run(interaction: any): Promise<void> {
    try {
      let currentPage = 0;
      const leaderboardType = interaction.options.getString('leaderboard');
      const { winnings, totalCount } = await this.fetchData(leaderboardType, currentPage);
      const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;
      const leaderboard = await this.generateLeaderboard(winnings, currentPage, leaderboardType);

      const row = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('prevPage')
            .setLabel('⬅️ Back')
            .setStyle(Discord.ButtonStyle.Primary)
            .setDisabled(true),
          new Discord.ButtonBuilder()
            .setCustomId('nextPage')
            .setLabel('Next ➡️')
            .setStyle(Discord.ButtonStyle.Primary)
            .setDisabled(currentPage === maxPage),
        );

      const message = await interaction.editReply({
        embeds: [leaderboard],
        components: [row],
      });

      const collector = message.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i: any) => {
        if (i.customId === 'prevPage' && currentPage > 0) {
          currentPage -= 1;
        } else if (i.customId === 'nextPage' && currentPage < maxPage) {
          currentPage += 1;
        }

        const { winnings: newWinnings } = await this.fetchData(leaderboardType, currentPage);
        const newLeaderboard = await this.generateLeaderboard(newWinnings, currentPage, leaderboardType);

        const newRow = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setCustomId('prevPage')
              .setLabel('⬅️ Back')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(currentPage === 0),
            new Discord.ButtonBuilder()
              .setCustomId('nextPage')
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
              .setCustomId('prevPage')
              .setLabel('⬅️ Back')
              .setStyle(Discord.ButtonStyle.Primary)
              .setDisabled(true),
            new Discord.ButtonBuilder()
              .setCustomId('nextPage')
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

  async generateLeaderboard(winnings: any[], page: number, leaderboardType: string) {
    let result = '';
    for (let i = 0; i < winnings.length; i += 1) {
      result += `${i + 1 + (page * this.itemsPerPage)}. <@${winnings[i].id}>: ${winnings[i].relativeWon > 0 ? '+' : ''}${format(winnings[i].relativeWon, true)} bets\n`;
    }

    let title;
    if (leaderboardType === 'all') {
      title = 'The Ultimate Gambler Leaderboard';
    } else {
      title = `${leaderboardType.charAt(0).toUpperCase() + leaderboardType.slice(1)} Leaderboard`;
    }

    return new Discord.EmbedBuilder()
      .setTitle(title)
      .setDescription(result)
      .setFooter({ text: `Page ${page + 1}` });
  }
}

export default GamblerBoard;
