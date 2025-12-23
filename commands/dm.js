const { AdminCommand } = require('./classes/admincommand');
const { logError } = require('../utils/log');

class DM extends AdminCommand {
  constructor(client) {
    super(client, 'say-dm', 'Send a direct message to a user', [
      {
        name: 'user',
        type: 6,
        description: 'The user you want to send a message to',
        required: true,
      },
      {
        name: 'message',
        type: 3,
        description: 'The message you want to send',
        required: true,
      },
    ], { ephemeral: true, blame: 'xei' });
  }

  async run(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const messageContent = interaction.options.getString('message');

      if (!targetUser || !messageContent) {
        await interaction.editReply('Invalid user or message.');
        return;
      }

      await targetUser.send(messageContent);
      await interaction.editReply(`Message sent to ${targetUser.tag}.`);
    } catch (error) {
      logError('Error sending DM:', error);
      await interaction.editReply('Failed to send the DM.');
    }
  }
}

module.exports = DM;
