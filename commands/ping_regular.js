const { Command } = require('./classes/command');

class PingRegular extends Command {
  constructor(client) {
    super(client, 'regular', 'pong', [], { isSubcommandOf: 'ping', blame: 'ei' });
  }

  async run(interaction) {
    await interaction.editReply('Pong!');
  }
}

module.exports = PingRegular;
