const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class BirthdayUnnotify extends Command {
  constructor(client) {
    super(client, 'unnotify', 'Remove a birthday reminder for a user', [
      {
        name: 'user',
        description: 'The user whose birthday reminder you want to remove',
        type: 6, // User type
        required: true,
      },
    ], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async run(interaction) {
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

module.exports = BirthdayUnnotify;
