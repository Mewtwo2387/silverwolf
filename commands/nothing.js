const { Command } = require('./classes/command.js');

class Nothing extends Command {
  constructor(client) {
    super(client, 'nothing', 'Does absolutely nothing', [], { ephemeral: false, skipDefer: true });
  }

  async run(interaction) {
    // Intentionally do nothing

  }
}

module.exports = Nothing;
