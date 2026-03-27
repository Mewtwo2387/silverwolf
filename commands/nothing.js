const { Command } = require('./classes/command');

class Nothing extends Command {
  constructor(client) {
    super(client, 'nothing', 'Does absolutely nothing', [], { ephemeral: false, skipDefer: true, blame: 'xei' });
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async run(_interaction) {
    // Intentionally do nothing
  }
}

module.exports = Nothing;
