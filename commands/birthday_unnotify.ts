import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class BirthdayUnnotify extends Command {
  constructor(client: any) {
    super(client, 'unnotify', 'Remove a birthday reminder for a user', [
      {
        name: 'user',
        description: 'The user whose birthday reminder you want to remove',
        type: 6,
        required: true,
      },
    ], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const notifierId = interaction.user.id;
      const trackedUser = interaction.options.getUser('user');
      const trackedUserId = trackedUser.id;

      const existing = await this.client.db.birthdayReminder.getReminder(notifierId, trackedUserId);
      if (!existing) {
        await interaction.editReply(`You don't have a birthday reminder set for **${trackedUser.username}**.`);
        return;
      }

      await this.client.db.birthdayReminder.deleteReminder(notifierId, trackedUserId);

      const embed = new EmbedBuilder()
        .setTitle('Reminder Removed')
        .setDescription(`Birthday reminder for **${trackedUser.username}** has been removed.`)
        .setColor(0xFF4444);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error removing birthday reminder:', error);
      await interaction.editReply('There was an error removing the reminder. Please try again later.');
    }
  }
}

export default BirthdayUnnotify;
