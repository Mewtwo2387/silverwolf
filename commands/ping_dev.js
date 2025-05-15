const { DevCommand } = require('./classes/devcommand');

class PingDev extends DevCommand {
  constructor(client) {
    super(client, 'dev', 'pong but for dev', [], { isSubcommandOf: 'ping' });
  }

  async run(interaction) {
    await interaction.editReply('Pong!');
  }
}

module.exports = PingDev;
