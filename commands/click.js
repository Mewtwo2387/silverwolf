const { Command } = require('./classes/command');

class Click extends Command {
  constructor(client) {
    super(client, 'click', 'send the link to the daily click thing', [], { blame: 'ei' });
  }

  async run(interaction) {
    await interaction.editReply('https://arab.org/click-to-help/palestine/');
  }
}

module.exports = Click;
