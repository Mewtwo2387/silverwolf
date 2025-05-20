const { Command } = require('./classes/command.js');

class Click extends Command {
  constructor(client) {
    super(client, 'click', 'send the link to the daily click thing', []);
  }

  async run(interaction) {
    await interaction.editReply('https://arab.org/click-to-help/palestine/');
  }
}

module.exports = Click;
