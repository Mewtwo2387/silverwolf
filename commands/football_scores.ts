import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';
import {
  fetchWorldCupMatches,
  formatMatchResultLine,
  getFinishedMatches,
} from '../utils/worldcup';

const RESULTS_PER_PAGE = 10;

class FootballScores extends Command {
  constructor(client: any) {
    super(client, 'scores', 'View previous World Cup match results', [
      {
        name: 'team',
        description: 'Filter results by team name',
        type: 3,
        required: false,
      },
    ], { isSubcommandOf: 'football', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const team = interaction.options.getString('team') ?? undefined;

    try {
      const matches = await fetchWorldCupMatches();
      const finished = getFinishedMatches(matches, { team });

      if (finished.length === 0) {
        const suffix = team ? ` for **${team}**` : '';
        await interaction.editReply(`No finished World Cup matches found${suffix}.`);
        return;
      }

      const totalPages = Math.ceil(finished.length / RESULTS_PER_PAGE);
      let currentPage = 0;

      const buildEmbed = (page: number) => {
        const slice = finished.slice(page * RESULTS_PER_PAGE, (page + 1) * RESULTS_PER_PAGE);
        const lines = slice.map((match) => formatMatchResultLine(match)).filter(Boolean);
        const title = team
          ? `World Cup Results — ${team}`
          : 'World Cup Results';

        return new EmbedBuilder()
          .setTitle(title)
          .setColor(0x1E90FF)
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Page ${page + 1} of ${totalPages} · ${finished.length} match${finished.length === 1 ? '' : 'es'}` });
      };

      const buildRow = (page: number) => new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('footballScoresPrev')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('footballScoresNext')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1),
        );

      if (totalPages <= 1) {
        await interaction.editReply({ embeds: [buildEmbed(0)] });
        return;
      }

      const message = await interaction.editReply({
        embeds: [buildEmbed(currentPage)],
        components: [buildRow(currentPage)],
      });

      const collector = message.createMessageComponentCollector({ time: 60_000 });

      collector.on('collect', async (i: any) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'These buttons are not for you.', ephemeral: true });
          return;
        }

        if (i.customId === 'footballScoresPrev' && currentPage > 0) currentPage -= 1;
        if (i.customId === 'footballScoresNext' && currentPage < totalPages - 1) currentPage += 1;

        await i.update({
          embeds: [buildEmbed(currentPage)],
          components: [buildRow(currentPage)],
        });
      });

      collector.on('end', async () => {
        const row = buildRow(currentPage);
        row.components.forEach((button) => button.setDisabled(true));
        await message.edit({ components: [row] }).catch(() => {});
      });
    } catch (error) {
      logError('Error fetching World Cup scores:', error);
      await interaction.editReply('Failed to fetch World Cup results. Please try again later.');
    }
  }
}

export default FootballScores;
