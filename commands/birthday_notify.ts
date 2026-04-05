import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class BirthdayNotify extends Command {
  constructor(client: any) {
    super(client, 'notify', 'Get a DM reminder before someone\'s birthday', [
      {
        name: 'user',
        description: 'The user whose birthday you want to be reminded about',
        type: 6,
        required: true,
      },
      {
        name: 'days-before',
        description: 'How many days in advance to remind you',
        type: 4,
        required: true,
        choices: [
          { name: '14 days before', value: 14 },
          { name: '7 days before', value: 7 },
          { name: '1 day before', value: 1 },
        ],
      },
    ], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const notifierId = interaction.user.id;
      const trackedUser = interaction.options.getUser('user');
      const trackedUserId = trackedUser.id;
      const daysBefore = interaction.options.getInteger('days-before');

      const birthdayData = await this.client.db.user.getUserAttr(trackedUserId, 'birthdays');
      if (!birthdayData) {
        await interaction.editReply(`${trackedUser.username} hasn't set their birthday yet.`);
        return;
      }

      await this.client.db.birthdayReminder.upsertReminder(notifierId, trackedUserId, daysBefore);

      const embed = new EmbedBuilder()
        .setTitle('Reminder Set!')
        .setDescription(`You will receive a DM **${daysBefore} day${daysBefore === 1 ? '' : 's'}** before **${trackedUser.username}**'s birthday.`)
        .setColor(0x00AAFF);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error setting birthday reminder:', error);
      await interaction.editReply('There was an error setting the reminder. Please try again later.');
    }
  }
}

export default BirthdayNotify;
