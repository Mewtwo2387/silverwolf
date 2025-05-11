const { Command } = require('./classes/command');

class Hello extends Command {
  constructor(client) {
    super(client, 'hello', 'hello', []);
  }

  async run(interaction) {
    await interaction.editReply(`Hello ${interaction.user.username}!`);
  }
}

module.exports = Hello;
