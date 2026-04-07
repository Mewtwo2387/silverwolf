import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class PoopStats extends Command {
  constructor(client: any) {
    super(
      client,
      'stats',
      'View poop stats for a user',
      [
        {
          name: 'user',
          description: 'The user to view stats for (defaults to you)',
          type: 6,
          required: false,
        },
      ],
      { isSubcommandOf: 'poop', blame: 'ei' },
    );
  }

  async run(interaction: any): Promise<void> {
    try {
      const targetUser = interaction.options.getUser('user') ?? interaction.user;

      const stats = await this.client.db.poop.getUserStats(targetUser.id);
      const profile = await this.client.db.poop.getProfile(targetUser.id);

      if (!stats || stats.totalPoops === 0) {
        await interaction.editReply({
          content: `No poop data found for ${targetUser.username}. Time to get to work! 💩`,
        });
        return;
      }

      const timezone = profile?.timezone ?? 0;
      const sign = timezone >= 0 ? '+' : '';

      const formatTimestamp = (unixTs: number | null): string => {
        if (!unixTs) return 'N/A';
        const offsetMs = timezone * 60 * 60 * 1000;
        const localDate = new Date(unixTs * 1000 + offsetMs);
        return `${localDate.toUTCString().replace(' GMT', '')} (UTC${sign}${timezone})`;
      };

      const avgDuration = stats.avgDuration != null
        ? `${Math.round(stats.avgDuration)} min`
        : 'N/A';

      const avgDaily = stats.avgDaily != null
        ? parseFloat(stats.avgDaily).toFixed(2)
        : 'N/A';

      const embed = new Discord.EmbedBuilder()
        .setTitle(`💩 Poop Stats — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x8B4513)
        .addFields(
          { name: '💩 Total Poops', value: String(stats.totalPoops ?? 'N/A'), inline: true },
          { name: '📅 Avg Daily Poops', value: String(avgDaily), inline: true },
          { name: '🕒 Last Poop', value: formatTimestamp(stats.lastLoggedAt), inline: false },
          { name: '🔬 Most Common Type', value: stats.commonType ?? 'N/A', inline: true },
          { name: '🎨 Most Common Colour', value: stats.commonColour ?? 'N/A', inline: true },
          { name: '⏱️ Avg Duration', value: avgDuration, inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to fetch poop stats:', error);
      await interaction.editReply({ content: 'Failed to retrieve poop stats. Please try again.' });
    }
  }
}

export default PoopStats;
