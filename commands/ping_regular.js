const { Command } = require('./classes/command.js');

class Ping extends Command {
  constructor(client) {
    super(client, 'regular', 'pong', [], { isSubcommandOf: 'ping' });
  }

  async run(interaction) {
    await interaction.editReply('Pong!');
  }
}

module.exports = Ping;
