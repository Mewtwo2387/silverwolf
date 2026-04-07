import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class PoopGacha extends Command {
  constructor(client: any) {
    super(
      client,
      'gacha',
      'Pull a random poop... from the members...',
      [],
      { isSubcommandOf: 'poop', blame: 'ei' },
    );
  }

  async run(interaction: any): Promise<void> {
    try {
      const randomPoop = await this.client.db.poop.getRandomPoop();

      if (!randomPoop) {
        await interaction.editReply({
          content: 'No poop entries found yet. Please use `/poop log` first.',
        });
        return;
      }

      const colour = randomPoop.colour ?? 'Unknown';
      const size = randomPoop.size ?? 'Unknown';
      const type = randomPoop.type ?? 'Unknown';
      const duration = randomPoop.duration != null ? `${randomPoop.duration} min` : 'Unknown';

      const embed = new Discord.EmbedBuilder()
        .setTitle('💩 Poop Gacha Pull')
        .setDescription(`Congratulations! You pulled <@${randomPoop.userId}>'s poop!`)
        .setColor(0x8B4513)
        .addFields(
          { name: '👤 User', value: `<@${randomPoop.userId}>`, inline: true },
          { name: '🎨 Colour', value: colour, inline: true },
          { name: '📏 Size', value: size, inline: true },
          { name: '🧪 Type', value: type, inline: true },
          { name: '⏱️ Duration', value: duration, inline: true },
          { name: '🕒 Logged', value: `<t:${randomPoop.loggedAt}:F>`, inline: false },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to fetch random poop:', error);
      await interaction.editReply({ content: 'Failed to pull a random poop. Please try again.' });
    }
  }
}

export default PoopGacha;
