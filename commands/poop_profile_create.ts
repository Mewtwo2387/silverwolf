import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class PoopProfileCreate extends Command {
  constructor(client: any) {
    super(
      client,
      'profile-create',
      'Set your timezone for poop tracking',
      [
        {
          name: 'timezone',
          description: 'Your UTC offset (e.g. 5 for UTC+5, -3 for UTC-3)',
          type: 4,
          required: true,
          min_value: -14,
          max_value: 14,
        },
      ],
      { isSubcommandOf: 'poop', blame: 'ei' },
    );
  }

  async run(interaction: any): Promise<void> {
    try {
      const timezone = interaction.options.getInteger('timezone');
      const userId = interaction.user.id;

      await this.client.db.poop.createOrUpdateProfile(userId, timezone);

      const sign = timezone >= 0 ? '+' : '';
      const embed = new Discord.EmbedBuilder()
        .setTitle('💩 Poop Profile Updated!')
        .setDescription(`Your timezone has been set to **UTC${sign}${timezone}**.\nYour poop logs will now be displayed in your local time.`)
        .setColor(0x8B4513);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Failed to create poop profile:', error);
      await interaction.followUp({ content: 'Failed to save your timezone. Please try again.', ephemeral: true });
    }
  }
}

export default PoopProfileCreate;
