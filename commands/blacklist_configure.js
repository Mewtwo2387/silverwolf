const Discord = require('discord.js');
const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');

class BlacklistConfigure extends DevCommand {
  constructor(client) {
    super(client, 'configure', 'Add or remove a command from the blacklist for a specific server', [
      {
        name: 'command',
        description: 'The name of the command to blacklist or remove',
        type: 3, // String type
        required: true,
      },
      {
        name: 'server',
        description: 'The ID of the server to blacklist the command in',
        type: 3, // String type
        required: true,
      },
      {
        name: 'action',
        description: 'Add or remove the command from the blacklist',
        type: 3, // String type
        required: true,
        choices: [
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' },
        ],
      },
      {
        name: 'reason',
        description: 'Reason for blacklisting the command (optional)',
        type: 3, // String type
        required: false,
      },
    ], { isSubcommandOf: 'blacklist' });
  }

  async run(interaction) {
    const commandName = interaction.options.getString('command');
    const serverId = interaction.options.getString('server');
    const action = interaction.options.getString('action');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      if (action === 'add') {
        // Add the command to the blacklist
        await this.client.db.addOrUpdateCommandBlacklist(commandName, serverId, reason);

        // Send a success message
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Command Blacklisted')
              .setDescription(`Command: **${commandName}** has been blacklisted in server: **${serverId}**.`)
              .addFields({ name: 'Reason', value: reason }),
          ],
        });
      } else if (action === 'remove') {
        // Remove the command from the blacklist
        const resultMessage = await this.client.db.deleteCommandBlacklist(commandName, serverId);

        // Send a success or info message based on whether the entry was found
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('#00AA00')
              .setTitle('Command Blacklist Updated')
              .setDescription(resultMessage),
          ],
        });
      }
    } catch (err) {
      logError('Failed to update command blacklist:', err);

      // Send an error message
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle('Failed to update command blacklist')
            .setDescription('An error occurred while updating the command blacklist. Please try again.'),
        ],
      });
    }
  }
}

module.exports = BlacklistConfigure;
