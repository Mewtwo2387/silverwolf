const { Command } = require('./classes/command');

class PingRegular extends Command {
  constructor(client) {
    super(client, 'regular', 'pong', [], { isSubcommandOf: 'ping' });
  }

  async run(interaction) {
    await interaction.editReply('Pong!');
  }
}

module.exports = PingRegular;
