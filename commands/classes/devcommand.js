require('dotenv').config();
const { Command } = require('./command.js');
const { log } = require('../../utils/log');

class DevCommand extends Command {
  constructor(client, name, description, options, args = { ephemeral: false, skipDefer: false, isSubcommandOf: null }) {
    super(client, name, description, options, args);
  }

  async execute(interaction) {
    const allowedUsers = process.env.ALLOWED_USERS.split(',');
    if (!allowedUsers.includes(interaction.user.id)) {
      log(`${interaction.user.username} tried using a dev command smh`);
      if (interaction.deferred) {
        await interaction.editReply('No.');
      } else {
        await interaction.reply('No.');
      }
      return;
    }
    super.execute(interaction);
  }
}

module.exports = { DevCommand };
