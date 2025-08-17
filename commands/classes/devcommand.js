const { Command } = require('./command');
const { log } = require('../../utils/log');
const { isDev } = require('../../utils/accessControl');

class DevCommand extends Command {
  constructor(client, name, description, options, args = { ephemeral: false, skipDefer: false, isSubcommandOf: null }) {
    super(client, name, description, options, args);
  }

  async execute(interaction) {
    if (!isDev(interaction)) {
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
