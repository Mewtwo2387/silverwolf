import * as Discord from 'discord.js';
import { format } from '../../utils/math';
import { logError } from '../../utils/log';
import { Command } from '../classes/Command';

type Constructor = new (...args: any[]) => Command;

function LeaderboardMixin<TBase extends Constructor>(BaseClass: TBase) {
  return class extends BaseClass {
    title: string;
    attribute: string;
    counter: string;
    noneSentence: string;
    itemsPerPage: number;

    constructor(...args: any[]) {
      const [client, name, description, title, attribute, counter, noneSentence] = args;
      super(client, name, description, [], { blame: 'ei' });
      this.title = title;
      this.attribute = attribute;
      this.counter = counter;
      this.noneSentence = noneSentence;
      this.itemsPerPage = 10;
    }

    async fetchData(page: number = 0): Promise<{ attrs: any[]; totalCount: number }> {
      const attrs = await this.client.db.user.getEveryoneAttr(
        this.attribute,
        this.itemsPerPage,
        page * this.itemsPerPage,
      );
      const totalCount = await this.client.db.user.getEveryoneAttrCount(this.attribute);
      return { attrs, totalCount };
    }

    async run(interaction: any): Promise<void> {
      try {
        let currentPage = 0;
        const { attrs, totalCount } = await this.fetchData(currentPage);
        const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;
        const leaderboard = await this.generateLeaderboard(attrs, currentPage);

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

        const message = await interaction.editReply({
          embeds: [leaderboard],
          components: [row],
        });

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i: any) => {
          if (i.customId === 'prev_page' && currentPage > 0) {
            currentPage -= 1;
          } else if (i.customId === 'next_page' && currentPage < maxPage) {
            currentPage += 1;
          }

          const { attrs: newAttrs } = await this.fetchData(currentPage);
          const newLeaderboard = await this.generateLeaderboard(newAttrs, currentPage);

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
        logError('Failed to fetch leaderboard:', error);
        await interaction.editReply({ content: 'Failed to retrieve leaderboard', ephemeral: true });
      }
    }

    async generateLeaderboard(attrs: any[], page: number): Promise<Discord.EmbedBuilder> {
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

export default LeaderboardMixin;
