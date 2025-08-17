const { Command } = require('./command');
const { log } = require('../../utils/log');
const { isAdmin } = require('../../utils/accessControl');

class AdminCommand extends Command {
  constructor(client, name, description, options, args = { ephemeral: false, skipDefer: false, isSubcommandOf: null }) {
    super(client, name, description, options, args);
  }

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      log(`${interaction.user.username} tried using an admin command smh`);
      if (interaction.deferred) {
        await interaction.editReply('You do not have permission to use this command.');
      } else {
        await interaction.reply('You do not have permission to use this command.');
      }
      return;
    }
    super.execute(interaction);
  }
}

module.exports = { AdminCommand };
